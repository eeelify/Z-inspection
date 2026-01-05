/**
 * Top Risk Drivers Service
 * 
 * Builds top risk drivers table from scores.byPrinciple[...].topDrivers
 * Includes answer snippets from responses collection
 */

const mongoose = require('mongoose');
const Score = require('../models/score');
const Response = require('../models/response');
const Question = require('../models/question');
const User = mongoose.model('User'); // User model is registered in server.js

const isValidObjectId = (id) => {
  if (typeof mongoose.isValidObjectId === 'function') {
    return mongoose.isValidObjectId(id);
  }
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Build top risk drivers table with answer snippets
 * @param {string|ObjectId} projectId - Project ID
 * @returns {Promise<Array>} Array of top risk drivers with answer snippets
 */
async function buildTopRiskDriversTable(projectId) {
  const projectIdObj = isValidObjectId(projectId)
    ? new mongoose.Types.ObjectId(projectId)
    : projectId;

  // Get all scores for this project
  const scores = await Score.find({ projectId: projectIdObj }).lean();
  
  if (scores.length === 0) {
    return []; // No scores = no drivers
  }

  // Collect all topDrivers from all principles across all scores
  const allTopDrivers = [];
  
  scores.forEach(score => {
    if (!score.byPrinciple) return;
    
    Object.entries(score.byPrinciple).forEach(([principle, principleData]) => {
      if (!principleData || !principleData.topDrivers) return;
      
      // topDrivers is an array of { questionId, questionCode, riskImportance, answerSeverity, computedERC }
      // Legacy fields (riskScore, answerRisk, rawRpn, normalizedContribution) are also supported for backward compatibility
      if (Array.isArray(principleData.topDrivers)) {
        principleData.topDrivers.forEach(driver => {
          if (driver.questionId) {
            allTopDrivers.push({
              ...driver,
              principle,
              userId: score.userId,
              role: score.role,
              questionnaireKey: score.questionnaireKey
            });
          }
        });
      }
    });
  });

  console.log(`📊 [buildTopRiskDriversTable] Extracted ${allTopDrivers.length} drivers from scores.byPrinciple`);
  
  // FALLBACK: If no topDrivers in scores, compute on-the-fly from responses
  if (allTopDrivers.length === 0) {
    console.warn('⚠️  No topDrivers found in scores, computing from responses...');
    
    const responses = await Response.find({ 
      projectId: projectIdObj,
      status: 'submitted'
    }).lean();
    
    const driverMap = {};
    
    // Fetch all questions to get riskImportance
    const questions = await Question.find({}).select('_id code principle text questionRiskImportance answerType options').lean();
    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));
    
    responses.forEach(resp => {
      if (!resp.answers || !Array.isArray(resp.answers)) return;
      
      resp.answers.forEach(ans => {
        const qIdStr = ans.questionId?.toString ? ans.questionId.toString() : String(ans.questionId);
        const question = questionMap.get(qIdStr);
        if (!question || !question.questionRiskImportance) return;
        
        // Calculate ERC
        const riskImportance = question.questionRiskImportance || 0;
        const answerSeverity = ans.answerSeverity || 0.5; // Default to 0.5 if not provided
        const erc = riskImportance * answerSeverity;
        
        if (erc === 0) return; // Skip questions with no risk
        
        // Keep only highest ERC per question
        if (!driverMap[qIdStr] || driverMap[qIdStr].computedERC < erc) {
          // Extract answer snippet
          let answerSnippet = null;
          if (ans.answer) {
            if (ans.answer.text) {
              answerSnippet = ans.answer.text.substring(0, 200) + (ans.answer.text.length > 200 ? '...' : '');
            } else if (ans.answer.choiceKey) {
              answerSnippet = `Selected: ${ans.answer.choiceKey}`;
            } else if (ans.answer.multiChoiceKeys && ans.answer.multiChoiceKeys.length > 0) {
              answerSnippet = `Selected: ${ans.answer.multiChoiceKeys.join(', ')}`;
            }
          }
          
          driverMap[qIdStr] = {
            questionId: ans.questionId,
            questionCode: question.code,
            questionText: question.text?.en || question.text?.tr || question.text || '',
            principle: question.principle,
            riskImportance: riskImportance,
            answerSeverity: answerSeverity,
            computedERC: erc,
            roles: [resp.role],
            userIds: [resp.userId],
            answerSnippet: answerSnippet
          };
        }
      });
    });
    
    const computed = Object.values(driverMap)
      .sort((a, b) => b.computedERC - a.computedERC)
      .slice(0, 20) // Top 20
      .map(d => ({
        questionId: d.questionId,
        questionCode: d.questionCode,
        questionText: d.questionText,
        principle: d.principle,
        avgRiskScore: d.riskImportance,
        AQ: d.answerSeverity,
        RW: 1, // Not computed in this fallback
        unmitigatedRisk: d.computedERC,
        roles: d.roles,
        answerSnippet: d.answerSnippet,
        answerRoles: d.roles
      }));
    
    console.log(`✅ Computed ${computed.length} drivers from responses (fallback)`);
    return computed;
  }

  // Group by questionId to aggregate across evaluators
  const driversByQuestion = new Map();
  
  allTopDrivers.forEach(driver => {
    const questionId = driver.questionId.toString ? driver.questionId.toString() : String(driver.questionId);
    
    if (!driversByQuestion.has(questionId)) {
      driversByQuestion.set(questionId, {
        questionId: driver.questionId,
        questionCode: driver.questionCode || '',
        principle: driver.principle,
        // ERC Model fields
        riskImportances: [],
        answerSeverities: [],
        ercs: [],
        // Legacy fields (for backward compatibility)
        riskScores: [],
        AQs: [],
        RWs: [],
        unmitigatedRisks: [],
        roles: new Set(),
        userIds: new Set()
      });
    }
    
    const entry = driversByQuestion.get(questionId);
    // ERC Model: Use riskImportance, answerSeverity, computedERC
    if (driver.riskImportance !== undefined && driver.riskImportance !== null) {
      entry.riskImportances.push(driver.riskImportance);
    } else if (driver.riskScore !== undefined && driver.riskScore !== null) {
      // Fallback to legacy riskScore
      entry.riskImportances.push(driver.riskScore);
    }
    if (driver.answerSeverity !== undefined && driver.answerSeverity !== null) {
      entry.answerSeverities.push(driver.answerSeverity);
    }
    if (driver.computedERC !== undefined && driver.computedERC !== null) {
      entry.ercs.push(driver.computedERC);
    }
    // Legacy fields (for backward compatibility)
    if (driver.riskScore !== undefined && driver.riskScore !== null) {
      entry.riskScores.push(driver.riskScore);
    }
    if (driver.AQ !== undefined && driver.AQ !== null) {
      entry.AQs.push(driver.AQ);
    }
    if (driver.RW !== undefined && driver.RW !== null) {
      entry.RWs.push(driver.RW);
    }
    if (driver.unmitigatedRisk !== undefined && driver.unmitigatedRisk !== null) {
      entry.unmitigatedRisks.push(driver.unmitigatedRisk);
    }
    if (driver.role) {
      entry.roles.add(driver.role);
    }
    if (driver.userId) {
      entry.userIds.add(driver.userId.toString ? driver.userId.toString() : String(driver.userId));
    }
  });

  // Get question details
  const questionIds = Array.from(driversByQuestion.keys()).map(id => 
    isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id
  );
  const questions = await Question.find({ _id: { $in: questionIds } })
    .select('_id code principle text')
    .lean();
  const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

  // Get responses for answer snippets
  const userIds = Array.from(new Set(
    Array.from(driversByQuestion.values())
      .flatMap(d => Array.from(d.userIds))
      .filter(Boolean)
  )).map(id => isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id);
  
  const responses = await Response.find({
    projectId: projectIdObj,
    userId: { $in: userIds },
    status: 'submitted'
  })
    .select('userId role questionnaireKey answers')
    .lean();

  // Build answer snippets map: questionId -> { text, roles }
  const answerSnippetsMap = new Map();
  
  responses.forEach(response => {
    if (!response.answers || !Array.isArray(response.answers)) return;
    
    response.answers.forEach(answer => {
      const qId = answer.questionId?.toString ? answer.questionId.toString() : String(answer.questionId);
      if (!qId || !driversByQuestion.has(qId)) return;
      
      // Extract text answer
      let textAnswer = '';
      if (answer.answer) {
        if (answer.answer.text) {
          textAnswer = answer.answer.text;
        } else if (answer.answer.choiceKey) {
          // For select-based, get option label if available
          const question = questionMap.get(qId);
          if (question && question.options) {
            const option = question.options.find(opt => opt.key === answer.answer.choiceKey);
            if (option) {
              textAnswer = option.label?.en || option.label?.tr || option.label || answer.answer.choiceKey;
            } else {
              textAnswer = answer.answer.choiceKey;
            }
          } else {
            textAnswer = answer.answer.choiceKey;
          }
        } else if (answer.answer.multiChoiceKeys && answer.answer.multiChoiceKeys.length > 0) {
          textAnswer = answer.answer.multiChoiceKeys.join(', ');
        }
      }
      
      if (textAnswer && textAnswer.trim().length > 0) {
        if (!answerSnippetsMap.has(qId)) {
          answerSnippetsMap.set(qId, {
            snippets: [],
            roles: new Set()
          });
        }
        
        const entry = answerSnippetsMap.get(qId);
        // Truncate to 200 chars as per requirement
        const truncated = textAnswer.trim().substring(0, 200);
        if (truncated.length > 0) {
          entry.snippets.push(truncated);
          if (response.role) {
            entry.roles.add(response.role);
          }
        }
      }
    });
  });

  // Build final table
  const topDriversTable = Array.from(driversByQuestion.values())
    .map(driver => {
      const question = questionMap.get(driver.questionId.toString ? driver.questionId.toString() : String(driver.questionId));
      const answerSnippet = answerSnippetsMap.get(driver.questionId.toString ? driver.questionId.toString() : String(driver.questionId));
      
      // Calculate averages
      const avgRiskScore = driver.riskScores.length > 0
        ? driver.riskScores.reduce((a, b) => a + b, 0) / driver.riskScores.length
        : 0;
      const avgAQ = driver.AQs.length > 0
        ? driver.AQs.reduce((a, b) => a + b, 0) / driver.AQs.length
        : 0;
      const avgRW = driver.RWs.length > 0
        ? driver.RWs.reduce((a, b) => a + b, 0) / driver.RWs.length
        : 0;
      const avgUnmitigatedRisk = driver.unmitigatedRisks.length > 0
        ? driver.unmitigatedRisks.reduce((a, b) => a + b, 0) / driver.unmitigatedRisks.length
        : 0;

      return {
        questionId: driver.questionId,
        questionCode: driver.questionCode || question?.code || '',
        questionText: question?.text?.en || question?.text?.tr || '',
        principle: driver.principle,
        avgRiskScore: Math.round(avgRiskScore * 100) / 100,
        AQ: Math.round(avgAQ * 100) / 100,
        RW: Math.round(avgRW * 100) / 100,
        unmitigatedRisk: Math.round(avgUnmitigatedRisk * 100) / 100,
        roles: Array.from(driver.roles),
        answerSnippet: answerSnippet?.snippets?.[0] || null, // Use first snippet (truncated to 200 chars)
        answerRoles: answerSnippet ? Array.from(answerSnippet.roles) : []
      };
    })
    .sort((a, b) => b.unmitigatedRisk - a.unmitigatedRisk) // Sort by unmitigatedRisk descending
    .slice(0, 20); // Top 20 drivers

  return topDriversTable;
}

module.exports = {
  buildTopRiskDriversTable
};

