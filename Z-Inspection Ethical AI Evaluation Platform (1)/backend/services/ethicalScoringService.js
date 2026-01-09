const mongoose = require('mongoose');
const Response = require('../models/response');
const Question = require('../models/question');
const Score = require('../models/score');
const { calculateAnswerSeverity } = require('./answerRiskService');

/**
 * Compute ethical scores for a project/user/questionnaire
 * 
 * NEW SYSTEM (Importance-based):
 * Score = Importance (0-4) × Answer Quality (0-1) - Higher = Better performance
 * 
 * LEGACY SYSTEM (Risk-based):
 * ERC = QuestionRiskImportance (0-4) × AnswerRiskSeverity (0-1) - Higher = More Risk
 * 
 * The system automatically detects which scoring model to use based on question data.
 * 
 * @param {string|ObjectId} projectId - Project ID
 * @param {string|ObjectId} userId - User ID (optional, if null computes for all users)
 * @param {string} questionnaireKey - Questionnaire key (optional)
 * @returns {Promise<Array>} Array of computed score documents
 */
async function computeEthicalScores(projectId, userId = null, questionnaireKey = null) {
  try {
    const isValidObjectId = (id) => {
      if (!id) return false;
      try {
        return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id.toString();
      } catch {
        return false;
      }
    };

    const projectIdObj = isValidObjectId(projectId) 
      ? new mongoose.Types.ObjectId(projectId) 
      : projectId;

    const matchStage = { 
      projectId: projectIdObj,
      status: { $in: ['draft', 'submitted'] }
    };

    if (userId) {
      matchStage.userId = isValidObjectId(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;
    }

    if (questionnaireKey) {
      matchStage.questionnaireKey = questionnaireKey;
    }

    // Get all responses
    const responses = await Response.find(matchStage)
      .select('userId role questionnaireKey answers.questionCode answers.questionId answers.answer answers.score answers.answerSeverity')
      .lean();

    if (responses.length === 0) {
      return [];
    }

    // Group by userId, role, questionnaireKey
    const grouped = {};
    for (const response of responses) {
      const key = `${response.userId}_${response.role}_${response.questionnaireKey}`;
      if (!grouped[key]) {
        grouped[key] = {
          userId: response.userId,
          role: response.role,
          questionnaireKey: response.questionnaireKey,
          answers: []
        };
      }
      grouped[key].answers.push(...(response.answers || []));
    }

    // Get all question IDs to fetch in one query
    const questionIds = new Set();
    for (const group of Object.values(grouped)) {
      for (const answer of group.answers) {
        if (answer.questionId) {
          questionIds.add(answer.questionId.toString());
        }
      }
    }

    // Fetch all questions (include riskScore and optionSeverityMap for ERC model)
    const questions = await Question.find({
      _id: { $in: Array.from(questionIds).map(id => isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id) }
    })
      .select('_id code principle answerType options optionScores optionRiskMap optionSeverityMap riskScore order')
      .lean();

    const questionMap = new Map();
    for (const question of questions) {
      questionMap.set(question._id.toString(), question);
    }

    // Principle mapping to canonical principles
    const principleMapping = {
      'TRANSPARENCY & EXPLAINABILITY': 'TRANSPARENCY',
      'HUMAN OVERSIGHT & CONTROL': 'HUMAN AGENCY & OVERSIGHT',
      'PRIVACY & DATA PROTECTION': 'PRIVACY & DATA GOVERNANCE',
      'ACCOUNTABILITY & RESPONSIBILITY': 'ACCOUNTABILITY',
      'LAWFULNESS & COMPLIANCE': 'ACCOUNTABILITY',
      'RISK MANAGEMENT & HARM PREVENTION': 'TECHNICAL ROBUSTNESS & SAFETY',
      'PURPOSE LIMITATION & DATA MINIMIZATION': 'PRIVACY & DATA GOVERNANCE',
      'USER RIGHTS & AUTONOMY': 'HUMAN AGENCY & OVERSIGHT'
    };

    const CANONICAL_PRINCIPLES = [
      'TRANSPARENCY',
      'HUMAN AGENCY & OVERSIGHT',
      'TECHNICAL ROBUSTNESS & SAFETY',
      'PRIVACY & DATA GOVERNANCE',
      'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
      'SOCIETAL & INTERPERSONAL WELL-BEING',
      'ACCOUNTABILITY'
    ];

    // Compute scores for each group
    const scores = [];
    for (const key in grouped) {
      const group = grouped[key];
      const principleData = {}; // principle -> { questions: [], ercSum, answeredCount }

      // Initialize principle data (Performance model)
      for (const principle of CANONICAL_PRINCIPLES) {
        principleData[principle] = {
          questions: [],
          scoreSum: 0, // Sum of performance scores (Importance × Quality)
          answeredCount: 0,
          missingCount: 0,
          // Legacy fields for backward compatibility
          ercSum: 0
        };
      }

      let totalScoreSum = 0;
      let totalAnsweredCount = 0;
      let totalMissingCount = 0;
      const questionBreakdown = []; // Store per-question breakdown

      // Process each answer
      for (const answer of group.answers) {
        const question = questionMap.get(answer.questionId?.toString());
        if (!question) {
          continue;
        }

        // Map principle
        let principle = question.principle;
        if (principleMapping[principle]) {
          principle = principleMapping[principle];
        }

        if (!CANONICAL_PRINCIPLES.includes(principle)) {
          continue; // Skip unknown principles
        }

        // Check if answered
        const isUnanswered = 
          !answer.answer ||
          (typeof answer.answer === 'object' && 
           !answer.answer.choiceKey && 
           !answer.answer.text && 
           !answer.answer.numeric &&
           (!answer.answer.multiChoiceKeys || answer.answer.multiChoiceKeys.length === 0));

        if (isUnanswered) {
          // Count missing but don't include in risk calculation
          principleData[principle].missingCount++;
          totalMissingCount++;
          continue;
        }

        // SCORING MODEL: Get Question Importance (0-4) from expert's answer or question default
        // Priority: answer.score (expert-assigned importance per use case) > question.riskScore (default)
        let questionImportance = 2; // Default to medium importance
        if (answer.score !== undefined && answer.score !== null) {
          // PRIORITY 1: Use expert's assigned importance for this specific answer
          questionImportance = Math.max(0, Math.min(4, answer.score));
        } else if (question.riskScore !== undefined && question.riskScore !== null) {
          // PRIORITY 2: Fallback to question's default importance
          questionImportance = Math.max(0, Math.min(4, question.riskScore));
        }

        // SCORING MODEL: Calculate Answer Quality/Severity (0-1) from answer content
        // NEW: If answerQuality exists (higher = better), use it directly
        // OLD: If answerSeverity exists (higher = worse), use it for backward compatibility
        const answerSeverityResult = calculateAnswerSeverity(question, answer);
        const answerValue = answerSeverityResult.answerSeverity; // This is actually answerQuality if isQuality=true
        const isQualityBased = answerSeverityResult.isQuality || false;

        // Legacy fields (for backward compatibility with old reports)
        const questionRiskImportance = questionImportance; // Same as questionImportance
        const answerRiskSeverity = answerValue; // Raw value from service

        // SCORING FORMULA:
        // CURRENT: Score = Importance (0-4) × Answer Quality (0-1) → Higher = Better Performance
        // LEGACY: ERC = QuestionRiskImportance × AnswerRiskSeverity (0-4 × 0-1) → Higher = More Risk
        // 
        // If answerQuality is used (isQualityBased=true), high score = good performance
        // If answerSeverity is used (isQualityBased=false), high score = high risk (legacy)
        const score = questionImportance * answerValue;
        const performanceScore = isQualityBased ? score : (questionImportance - score); // Convert risk to performance if needed

        // Add to principle data
        principleData[principle].questions.push({
          questionId: question._id,
          questionCode: question.code || answer.questionCode,
          importance: questionImportance,
          answerQuality: isQualityBased ? answerValue : (1 - answerValue),
          score: performanceScore,
          // Legacy fields for backward compatibility
          riskImportance: questionRiskImportance,
          answerSeverity: answerRiskSeverity,
          erc: score
        });

        // Store per-question breakdown
        questionBreakdown.push({
          questionId: question._id,
          principle: principle,
          importance: questionImportance,
          answerQuality: isQualityBased ? answerValue : (1 - answerValue),
          performanceScore: performanceScore,
          isQualityBased: isQualityBased,
          // Legacy fields for backward compatibility
          riskImportance: questionRiskImportance,
          answerSeverity: answerRiskSeverity,
          computedERC: score,
          answerType: question.answerType,
          mappingMissing: answerSeverityResult.metadata?.mappingMissing || false,
          source: answerSeverityResult.metadata?.source || 'unknown'
        });

        principleData[principle].scoreSum += performanceScore;
        principleData[principle].answeredCount++;

        totalScoreSum += performanceScore;
        totalAnsweredCount++;
      }

      // Performance Model: Calculate principle-level metrics
      // Principle Performance = Average score of questions belonging to that principle
      const byPrinciple = {};
      const principleScores = [];
      
      for (const principle of CANONICAL_PRINCIPLES) {
        const data = principleData[principle];
        
        // Principle Performance = average(Score for questions in principle)
        const principleScore = data.answeredCount > 0
          ? data.scoreSum / data.answeredCount // 0-4 scale (higher = better)
          : 0;

        // Sort top drivers by score (descending for performance, or ascending for issues)
        // For "top drivers" we want to show BEST performing questions
        const topDrivers = data.questions
          .sort((a, b) => b.score - a.score)
          .slice(0, 5); // Top 5

        byPrinciple[principle] = {
          performance: Math.round(principleScore * 100) / 100, // NEW: Performance score (0-4, higher = better)
          avg: principleScore, // For backward compatibility
          n: data.answeredCount,
          min: data.questions.length > 0 ? Math.min(...data.questions.map(q => q.importance || q.riskImportance)) : undefined,
          max: data.questions.length > 0 ? Math.max(...data.questions.map(q => q.importance || q.riskImportance)) : undefined,
          score: Math.round(principleScore * 100) / 100, // Performance score (0-4, higher = better)
          answeredCount: data.answeredCount,
          missingCount: data.missingCount,
          topDrivers: topDrivers.map(driver => ({
            questionId: driver.questionId,
            questionCode: driver.questionCode,
            importance: Math.round((driver.importance || driver.riskImportance) * 100) / 100,
            answerQuality: Math.round((driver.answerQuality || (1 - driver.answerSeverity)) * 100) / 100,
            performanceScore: Math.round(driver.score * 100) / 100,
            // Legacy fields
            riskImportance: Math.round(driver.riskImportance * 100) / 100,
            answerSeverity: Math.round(driver.answerSeverity * 100) / 100,
            computedERC: Math.round(driver.erc * 100) / 100
          })),
          // Legacy field for backward compatibility
          risk: Math.round((4 - principleScore) * 100) / 100 // Convert performance to risk for old reports
        };
        
        if (data.answeredCount > 0) {
          principleScores.push(principleScore);
        }
      }

      // Performance Model: Calculate overall metrics
      // Overall Performance = Average of all principle scores
      const overallPerformance = principleScores.length > 0
        ? principleScores.reduce((a, b) => a + b, 0) / principleScores.length // 0-4 scale (higher = better)
        : 0;
      
      // Legacy: Convert performance to risk for backward compatibility
      const overallRisk = 4 - overallPerformance;

      // Calculate average risk importance for backward compatibility
      const allRiskImportances = [];
      for (const principle of CANONICAL_PRINCIPLES) {
        for (const question of principleData[principle].questions) {
          allRiskImportances.push(question.riskImportance);
        }
      }
      const avgRiskImportance = allRiskImportances.length > 0
        ? allRiskImportances.reduce((a, b) => a + b, 0) / allRiskImportances.length
        : 0;

      const scoreDoc = {
        projectId: projectIdObj,
        userId: group.userId,
        role: group.role,
        questionnaireKey: group.questionnaireKey,
        computedAt: new Date(),
        scoringModelVersion: 'performance_v1', // NEW: Performance model (Importance × Quality)
        totals: {
          overallPerformance: Math.round(overallPerformance * 100) / 100, // NEW: Performance score (0-4, higher = better)
          performancePercentage: Math.round((overallPerformance / 4) * 100), // NEW: As percentage
          avg: Math.round(overallPerformance * 100) / 100, // For backward compatibility
          min: allRiskImportances.length > 0 ? Math.min(...allRiskImportances) : undefined,
          max: allRiskImportances.length > 0 ? Math.max(...allRiskImportances) : undefined,
          n: totalAnsweredCount,
          answeredCount: totalAnsweredCount,
          missingCount: totalMissingCount,
          // Legacy field for old reports
          overallRisk: Math.round(overallRisk * 100) / 100 // Legacy: Converted from performance (4 - performance)
        },
        byPrinciple,
        questionBreakdown: questionBreakdown // Store per-question breakdown
      };

      // Save or update score
      const savedScore = await Score.findOneAndUpdate(
        { projectId: projectIdObj, userId: group.userId, questionnaireKey: group.questionnaireKey },
        scoreDoc,
        { new: true, upsert: true }
      );

      scores.push(savedScore);
    }

    return scores;
  } catch (error) {
    throw new Error(`Failed to compute ethical scores: ${error.message}`);
  }
}

/**
 * Compute project-level ethical scores (aggregated across all roles)
 * Only includes roles that actually submitted responses
 * @param {string|ObjectId} projectId - Project ID
 * @returns {Promise<Object>} Project-level score document
 */
async function computeProjectEthicalScores(projectId) {
  try {
    const isValidObjectId = (id) => {
      if (!id) return false;
      try {
        return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id.toString();
      } catch {
        return false;
      }
    };

    const projectIdObj = isValidObjectId(projectId) 
      ? new mongoose.Types.ObjectId(projectId) 
      : projectId;

    // Get all role-specific scores for this project (only submitted responses)
    const roleScores = await Score.find({
      projectId: projectIdObj,
      role: { $ne: 'project' } // Exclude project-level scores
    })
      .select('role questionnaireKey totals.overallRisk totals.answeredCount totals.missingCount byPrinciple')
      .lean();

    if (roleScores.length === 0) {
      return null;
    }

    // Group by role
    const byRole = {};
    const CANONICAL_PRINCIPLES = [
      'TRANSPARENCY',
      'HUMAN AGENCY & OVERSIGHT',
      'TECHNICAL ROBUSTNESS & SAFETY',
      'PRIVACY & DATA GOVERNANCE',
      'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
      'SOCIETAL & INTERPERSONAL WELL-BEING',
      'ACCOUNTABILITY'
    ];

    // ERC Model: Aggregate by role (only roles that submitted)
    for (const roleScore of roleScores) {
      const role = roleScore.role;
      if (!byRole[role]) {
        byRole[role] = {
          role: role,
          overallRisk: 0,
          answeredCount: 0,
          missingCount: 0,
          byPrinciple: {}
        };
      }

      // Aggregate role-level metrics
      byRole[role].overallRisk += roleScore.totals?.overallRisk || 0;
      byRole[role].answeredCount += roleScore.totals?.answeredCount || 0;
      byRole[role].missingCount += roleScore.totals?.missingCount || 0;

      // Aggregate principle-level metrics
      for (const principle of CANONICAL_PRINCIPLES) {
        const principleData = roleScore.byPrinciple?.[principle];
        if (principleData) {
          if (!byRole[role].byPrinciple[principle]) {
            byRole[role].byPrinciple[principle] = {
              risk: 0,
              answeredCount: 0,
              missingCount: 0
            };
          }
          byRole[role].byPrinciple[principle].risk += principleData.risk || 0;
          byRole[role].byPrinciple[principle].answeredCount += principleData.answeredCount || 0;
          byRole[role].byPrinciple[principle].missingCount += principleData.missingCount || 0;
        }
      }
    }

    // ERC Model: Calculate project-level aggregates
    // Average principleRisk across all roles that submitted
    const projectPrincipleRisks = {};
    const projectPrincipleCounts = {};
    
    for (const role of Object.keys(byRole)) {
      for (const principle of CANONICAL_PRINCIPLES) {
        const rolePrincipleData = byRole[role].byPrinciple[principle];
        if (rolePrincipleData && rolePrincipleData.answeredCount > 0) {
          if (!projectPrincipleRisks[principle]) {
            projectPrincipleRisks[principle] = 0;
            projectPrincipleCounts[principle] = 0;
          }
          // Average risk per role (already averaged ERC)
          const rolePrincipleRisk = rolePrincipleData.risk;
          projectPrincipleRisks[principle] += rolePrincipleRisk;
          projectPrincipleCounts[principle] += 1;
        }
      }
    }

    // Calculate final project-level principle risks
    const projectByPrinciple = {};
    const projectPrincipleRiskValues = [];
    
    for (const principle of CANONICAL_PRINCIPLES) {
      const avgRisk = projectPrincipleCounts[principle] > 0
        ? projectPrincipleRisks[principle] / projectPrincipleCounts[principle]
        : 0;
      
      projectByPrinciple[principle] = {
        avg: avgRisk,
        n: projectPrincipleCounts[principle] || 0,
        risk: Math.round(avgRisk * 100) / 100
      };
      
      if (projectPrincipleCounts[principle] > 0) {
        projectPrincipleRiskValues.push(avgRisk);
      }
    }

    // Project-level overall risk = average of principle risks
    const projectOverallRisk = projectPrincipleRiskValues.length > 0
      ? projectPrincipleRiskValues.reduce((a, b) => a + b, 0) / projectPrincipleRiskValues.length
      : 0;

    // Calculate total answered/missing counts
    let totalAnswered = 0;
    let totalMissing = 0;
    for (const role of Object.values(byRole)) {
      totalAnswered += role.answeredCount || 0;
      totalMissing += role.missingCount || 0;
    }

    // Save or update project-level score
    const projectScoreDoc = {
      projectId: projectIdObj,
      userId: null, // Project-level has no userId
      role: 'project',
      questionnaireKey: 'project',
      computedAt: new Date(),
      scoringModelVersion: 'erc_v1',
      totals: {
        avg: Math.round(projectOverallRisk * 100) / 100, // Backward compatibility
        n: totalAnswered,
        overallRisk: Math.round(projectOverallRisk * 100) / 100,
        answeredCount: totalAnswered,
        missingCount: totalMissing
      },
      byPrinciple: projectByPrinciple,
      byRole: byRole
    };

    const savedProjectScore = await Score.findOneAndUpdate(
      { projectId: projectIdObj, role: 'project', questionnaireKey: 'project' },
      projectScoreDoc,
      { new: true, upsert: true }
    );

    return savedProjectScore;
  } catch (error) {
    throw new Error(`Failed to compute project-level ethical scores: ${error.message}`);
  }
}

module.exports = {
  computeEthicalScores,
  computeProjectEthicalScores
};
