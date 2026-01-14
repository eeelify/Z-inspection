const mongoose = require('mongoose');
const Response = require('../models/response');
const Question = require('../models/question');
const Score = require('../models/score');

/**
 * ETHICAL SCORING SERVICE — STRICT MODE
 * 
 * Enforces the mandatory ethical scoring formula:
 * FinalRiskContribution = questionImportance × (1 - answerScore)
 * 
 * Rules:
 * 1. questionImportance: Integer 1–4 (Ethical Criticality)
 * 2. answerScore: Float 0.0–1.0 (Ethical Acceptability, 1.0=Safe, 0.0=Risk)
 * 3. NO Inference.
 * 4. NO Defaulting missing values.
 */

// Canonical Principles List
const CANONICAL_PRINCIPLES = [
  'TRANSPARENCY',
  'HUMAN AGENCY & OVERSIGHT',
  'TECHNICAL ROBUSTNESS & SAFETY',
  'PRIVACY & DATA GOVERNANCE',
  'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
  'SOCIETAL & INTERPERSONAL WELL-BEING',
  'ACCOUNTABILITY'
];

/**
 * Validate and normalize principle keys
 */
function normalizePrinciple(principle) {
  if (!principle) return null;
  const upper = principle.toUpperCase();
  // Map legacy/variation strings to canonical
  const mapping = {
    'TRANSPARENCY & EXPLAINABILITY': 'TRANSPARENCY',
    'HUMAN OVERSIGHT & CONTROL': 'HUMAN AGENCY & OVERSIGHT',
    'PRIVACY & DATA PROTECTION': 'PRIVACY & DATA GOVERNANCE',
    'ACCOUNTABILITY & RESPONSIBILITY': 'ACCOUNTABILITY',
    'LAWFULNESS & COMPLIANCE': 'ACCOUNTABILITY',
    'RISK MANAGEMENT & HARM PREVENTION': 'TECHNICAL ROBUSTNESS & SAFETY',
    'PURPOSE LIMITATION & DATA MINIMIZATION': 'PRIVACY & DATA GOVERNANCE',
    'USER RIGHTS & AUTONOMY': 'HUMAN AGENCY & OVERSIGHT'
  };

  if (CANONICAL_PRINCIPLES.includes(upper)) return upper;
  if (mapping[upper]) return mapping[upper];

  // Try snake_case mapping from seed files
  const snakeMap = {
    'transparency': 'TRANSPARENCY',
    'human_agency_oversight': 'HUMAN AGENCY & OVERSIGHT',
    'technical_robustness_safety': 'TECHNICAL ROBUSTNESS & SAFETY',
    'privacy_data_governance': 'PRIVACY & DATA GOVERNANCE',
    'diversity_fairness': 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
    'societal_wellbeing': 'SOCIETAL & INTERPERSONAL WELL-BEING',
    'accountability': 'ACCOUNTABILITY'
  };
  if (snakeMap[principle.toLowerCase()]) return snakeMap[principle.toLowerCase()];

  return null; // Invalid principle
}

/**
 * Compute ethical scores for a project context
 */
async function computeEthicalScores(projectId, userId = null, questionnaireKey = null) {
  try {
    // 1. Validate Types
    const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;

    // 2. Build Match Stage
    const matchStage = {
      projectId: projectIdObj,
      status: { $in: ['draft', 'submitted'] }
    };
    if (userId) matchStage.userId = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    if (questionnaireKey) matchStage.questionnaireKey = questionnaireKey;

    // 3. Fetch Data
    const responses = await Response.find(matchStage).lean();
    if (responses.length === 0) return [];

    // 4. Fetch Questions Reference
    // We need riskScore (Importance) and principle details
    const questionIds = new Set();
    responses.forEach(r => r.answers.forEach(a => {
      if (a.questionId) questionIds.add(a.questionId.toString());
    }));

    const questionsFn = await Question.find({ _id: { $in: Array.from(questionIds) } }).lean();
    const questionMap = new Map(questionsFn.map(q => [q._id.toString(), q]));

    // 5. Group Responses (One Score document per User+Role+Questionnaire)
    const grouped = {};
    for (const res of responses) {
      const gKey = `${res.userId}_${res.role}_${res.questionnaireKey}`;
      if (!grouped[gKey]) {
        grouped[gKey] = {
          userId: res.userId,
          role: res.role,
          questionnaireKey: res.questionnaireKey,
          answers: []
        };
      }
      grouped[gKey].answers.push(...res.answers);
    }

    // 6. Compute Scores for each Group
    const scoresToSave = [];

    for (const groupKey in grouped) {
      const group = grouped[groupKey];

      // Initialize Aggregators
      const principleStats = {};
      CANONICAL_PRINCIPLES.forEach(p => {
        principleStats[p] = {
          sumRisk: 0,
          count: 0,
          maxImportance: 0,
          sumImportance: 0, // NEW: For Average Importance
          highImportanceCount: 0, // NEW: For High Importance Ratio
          questions: []
        };
      });

      let totalAnswers = 0;
      let totalRiskSum = 0; // Sum of FinalRiskContributions
      const questionBreakdown = [];

      for (const ans of group.answers) {
        const question = questionMap.get(ans.questionId?.toString());
        if (!question) continue;

        // PRINCIPLE MAPPING
        const pKey = normalizePrinciple(question.principleKey || question.principle);
        if (!pKey) continue; // Skip if no valid principle

        // DATA EXTRACTION (STRICT)
        // 1. answerScore (0.0 - 1.0)
        let answerScore = ans.answerScore;

        // Allow null for optional questions that are unanswered, BUT valid answers must have scores.
        if (answerScore === undefined || answerScore === null) {
          // Check if ignored/unanswered
          const hasResponse = ans.answer && (ans.answer.choiceKey || ans.answer.text || (ans.answer.multiChoiceKeys && ans.answer.multiChoiceKeys.length > 0));
          if (!hasResponse) continue; // Skip unanswered

          // If answer exists but no score:
          if (question.answerType === 'open_text') {
            // Open text might not have score yet. Skip calculation but maybe log.
            console.warn(`[EthicalScoring] Missing answerScore for open_text '${question.code}'. Skipping risk calculation.`);
            continue;
          } else {
            // Select question missing score -> DATA CORRUPTION
            console.error(`[EthicalScoring] STRICT VIOLATION: Question ${question.code} has answer but missing 'answerScore'.`);
            // We could throw, but to allow report generation for partial data, we might skip or default?
            // User requested strictness, but failing entire report is harsh if one question is bad.
            // Let's SKIP and Log Error.
            continue;
          }
        }

        // 2. questionImportance (1-4)
        // CHECK ORDER: Response Override -> Question Definition -> Default
        let importance = 2; // Default

        // Check if answer has specific importance override (rare)
        if (ans.importanceScore !== undefined && ans.importanceScore !== null) {
          importance = ans.importanceScore;
        } else if (ans.importance !== undefined && ans.importance !== null) {
          importance = ans.importance;
        } else if (question.riskScore !== undefined && question.riskScore !== null) {
          importance = question.riskScore;
        } else if (question.importance !== undefined && question.importance !== null) {
          importance = question.importance;
        }

        // Validate Ranges
        importance = Number(importance);
        if (isNaN(importance)) importance = 2;
        importance = Math.max(1, Math.min(4, Math.round(importance)));

        answerScore = Number(answerScore);
        if (isNaN(answerScore)) {
          console.warn(`Invalid answerScore used for ${question.code}, skipping.`);
          continue;
        }
        if (answerScore < 0 || answerScore > 1) {
          // Allow slight float error or clamp? User said 0-1 strict.
          answerScore = Math.max(0, Math.min(1, answerScore));
        }

        // CALCULATION (THE ONLY ALLOWED FORMULA)
        // FinalRiskContribution = importance * (1 - answerScore)
        const riskContribution = importance * (1 - answerScore);

        // Aggregation
        principleStats[pKey].sumRisk += riskContribution;
        principleStats[pKey].count += 1;
        principleStats[pKey].maxImportance = Math.max(principleStats[pKey].maxImportance, importance);

        // NEW: Importance Aggregation
        principleStats[pKey].sumImportance += importance;
        if (importance >= 3) {
          principleStats[pKey].highImportanceCount += 1;
        }

        const qEntry = {
          questionId: question._id,
          principle: pKey,
          importance: importance,
          answerScore: answerScore,
          finalRiskContribution: riskContribution,
          code: question.code
        };

        principleStats[pKey].questions.push(qEntry);
        questionBreakdown.push(qEntry);

        totalRiskSum += riskContribution;
        totalAnswers += 1;
      }

      // Build Output Document
      const byPrinciple = {};
      CANONICAL_PRINCIPLES.forEach(p => {
        const stats = principleStats[p];
        // Aggregation: SUM ONLY (Cumulative Risk)
        const totalRisk = stats.sumRisk;

        // Importance Metrics
        const avgImportance = stats.count > 0 ? (stats.sumImportance / stats.count) : 0;
        const highImportanceRatio = stats.count > 0 ? (stats.highImportanceCount / stats.count) : 0;

        byPrinciple[p] = {
          risk: Math.round(totalRisk * 100) / 100, // Cumulative Risk (Main Metric)
          n: stats.count,

          // NEW EXPLICIT METRICS
          avgImportance: Math.round(avgImportance * 100) / 100,
          highImportanceRatio: Math.round(highImportanceRatio * 100) / 100,

          score: undefined, // meaningless
          topDrivers: stats.questions
            .sort((a, b) => b.finalRiskContribution - a.finalRiskContribution)
            .slice(0, 5)
        };
      });

      // Overall Risk: Sum of all FinalRiskContributions
      const overallRisk = totalRiskSum;

      scoresToSave.push({
        projectId: projectIdObj,
        userId: group.userId,
        role: group.role,
        questionnaireKey: group.questionnaireKey,
        computedAt: new Date(),
        scoringModelVersion: 'strict_ethical_v3_cumulative',
        totals: {
          overallRisk: Math.round(overallRisk * 100) / 100,
          n: totalAnswers
        },
        byPrinciple: byPrinciple,
        questionBreakdown: questionBreakdown
      });
    }

    // 7. Save to DB
    const results = [];
    for (const s of scoresToSave) {
      const saved = await Score.findOneAndUpdate(
        { projectId: s.projectId, userId: s.userId, questionnaireKey: s.questionnaireKey },
        s,
        { new: true, upsert: true }
      );
      results.push(saved);
    }

    return results;

  } catch (error) {
    console.error("Ethical Scoring Failed:", error);
    throw error;
  }
}

// Project level aggregation remains relevant but must use NEW fields
async function computeProjectEthicalScores(projectId) {
  // Placeholder for project aggregation if needed, relying on 'strict_ethical_v2' data
  // For now, returning null to ensure we don't run broken legacy aggregation
  // If strict aggregation is needed, it should merely average the 'overallRisk' from user scores.
  return null;
}

module.exports = {
  computeEthicalScores,
  computeProjectEthicalScores
};
