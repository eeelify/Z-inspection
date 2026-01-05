const mongoose = require('mongoose');
const Response = require('../models/response');
const Question = require('../models/question');
const Score = require('../models/score');
const { calculateAnswerSeverity } = require('./answerRiskService');

/**
 * Compute ethical scores for a project/user/questionnaire
 * Implements: ERC (Ethical Risk Contribution) = QuestionRiskImportance × AnswerRiskSeverity
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

      // Initialize principle data (ERC model)
      for (const principle of CANONICAL_PRINCIPLES) {
        principleData[principle] = {
          questions: [],
          ercSum: 0, // Sum of ERC values
          answeredCount: 0,
          missingCount: 0
        };
      }

      let totalErcSum = 0;
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

        // ERC Model: Get QuestionRiskImportance (0-4) from question.riskScore or answer.score
        // Priority: question.riskScore (expert-provided importance) > answer.score (legacy)
        let questionRiskImportance = 2; // Default to medium importance
        if (question.riskScore !== undefined && question.riskScore !== null) {
          questionRiskImportance = Math.max(0, Math.min(4, question.riskScore));
        } else if (answer.score !== undefined && answer.score !== null) {
          // Fallback to answer.score for backward compatibility
          questionRiskImportance = Math.max(0, Math.min(4, answer.score));
        }

        // ERC Model: Calculate AnswerRiskSeverity (0-1) from answer content
        const answerSeverityResult = calculateAnswerSeverity(question, answer);
        const answerRiskSeverity = answerSeverityResult.answerSeverity;

        // ERC Model: Compute Ethical Risk Contribution
        // ERC = QuestionRiskImportance × AnswerRiskSeverity (0-4 × 0-1 = 0-4)
        const erc = questionRiskImportance * answerRiskSeverity;

        // Add to principle data
        principleData[principle].questions.push({
          questionId: question._id,
          questionCode: question.code || answer.questionCode,
          riskImportance: questionRiskImportance,
          answerSeverity: answerRiskSeverity,
          erc: erc
        });

        // Store per-question breakdown
        questionBreakdown.push({
          questionId: question._id,
          principle: principle,
          riskImportance: questionRiskImportance,
          answerSeverity: answerRiskSeverity,
          computedERC: erc,
          answerType: question.answerType,
          mappingMissing: answerSeverityResult.metadata?.mappingMissing || false,
          source: answerSeverityResult.metadata?.source || 'unknown'
        });

        principleData[principle].ercSum += erc;
        principleData[principle].answeredCount++;

        totalErcSum += erc;
        totalAnsweredCount++;
      }

      // ERC Model: Calculate principle-level metrics
      // Principle Risk = Average ERC of questions belonging to that principle
      const byPrinciple = {};
      const principleRisks = [];
      
      for (const principle of CANONICAL_PRINCIPLES) {
        const data = principleData[principle];
        
        // Principle Risk = average(ERC for questions in principle)
        const principleRisk = data.answeredCount > 0
          ? data.ercSum / data.answeredCount // 0-4 scale
          : 0;

        // Sort top drivers by ERC (descending)
        const topDrivers = data.questions
          .sort((a, b) => b.erc - a.erc)
          .slice(0, 5); // Top 5

        byPrinciple[principle] = {
          avg: principleRisk, // For backward compatibility
          n: data.answeredCount,
          min: data.questions.length > 0 ? Math.min(...data.questions.map(q => q.riskImportance)) : undefined,
          max: data.questions.length > 0 ? Math.max(...data.questions.map(q => q.riskImportance)) : undefined,
          risk: Math.round(principleRisk * 100) / 100, // Principle risk (0-4)
          answeredCount: data.answeredCount,
          missingCount: data.missingCount,
          topDrivers: topDrivers.map(driver => ({
            questionId: driver.questionId,
            questionCode: driver.questionCode,
            riskImportance: Math.round(driver.riskImportance * 100) / 100,
            answerSeverity: Math.round(driver.answerSeverity * 100) / 100,
            computedERC: Math.round(driver.erc * 100) / 100
          }))
        };
        
        if (data.answeredCount > 0) {
          principleRisks.push(principleRisk);
        }
      }

      // ERC Model: Calculate overall metrics
      // Overall Risk = Average of all ERC values across experts
      // For now, we average principle risks (which are already averages of ERC)
      const overallRisk = principleRisks.length > 0
        ? principleRisks.reduce((a, b) => a + b, 0) / principleRisks.length // 0-4 scale
        : 0;

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
        scoringModelVersion: 'erc_v1', // ERC model version
        totals: {
          avg: Math.round(avgRiskImportance * 100) / 100, // Backward compatibility (average risk importance)
          min: allRiskImportances.length > 0 ? Math.min(...allRiskImportances) : undefined,
          max: allRiskImportances.length > 0 ? Math.max(...allRiskImportances) : undefined,
          n: totalAnsweredCount,
          overallRisk: Math.round(overallRisk * 100) / 100, // Overall risk (0-4) = average ERC
          answeredCount: totalAnsweredCount,
          missingCount: totalMissingCount
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
