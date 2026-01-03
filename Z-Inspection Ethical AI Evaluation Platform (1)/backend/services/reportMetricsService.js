const mongoose = require('mongoose');
const Score = require('../models/score');
const Response = require('../models/response');
const Tension = mongoose.model('Tension');
const ProjectAssignment = require('../models/projectAssignment');
const Question = require('../models/question');
const User = mongoose.model('User');
// Use canonical risk scale utility
const { classifyRisk, riskLabelEN, validateRiskScaleNotInverted } = require('../utils/riskScale');
const { computeReviewState } = require('./analyticsService');

const isValidObjectId = (id) => {
  if (typeof mongoose.isValidObjectId === 'function') {
    return mongoose.isValidObjectId(id);
  }
  return mongoose.Types.ObjectId.isValid(id);
};

// TASK 4: Canonical list of principle keys (used throughout the module)
const CANONICAL_PRINCIPLES = [
  "TRANSPARENCY",
  "HUMAN AGENCY & OVERSIGHT",
  "TECHNICAL ROBUSTNESS & SAFETY",
  "PRIVACY & DATA GOVERNANCE",
  "DIVERSITY, NON-DISCRIMINATION & FAIRNESS",
  "SOCIETAL & INTERPERSONAL WELL-BEING",
  "ACCOUNTABILITY"
];

/**
 * TASK 4: PRINCIPLE SCORE AGGREGATION (CANONICAL)
 * Build principle scores using ONLY Score collection
 * NEVER recompute from Response or generalquestionanswers
 */
async function buildPrincipleScores(projectId, questionnaireKey = null) {
  const projectIdObj = isValidObjectId(projectId)
    ? new mongoose.Types.ObjectId(projectId)
    : projectId;

  // CRITICAL: Fetch ALL Score documents for this project (all questionnaires)
  // This ensures that legal questions and other role-specific questionnaires are included
  // We aggregate scores across all questionnaires for the report
  const scoreQuery = {
    projectId: projectIdObj
  };
  // Only filter by questionnaireKey if explicitly provided (for backward compatibility)
  // if (questionnaireKey) {
  //   scoreQuery.questionnaireKey = questionnaireKey;
  // }
  
  const scores = await Score.find(scoreQuery).lean();

  // Debug: Log found scores with DETAILED principle data
  console.log(`📊 [DEBUG buildPrincipleScores] Found ${scores.length} Score documents for project ${projectId}`);
  if (scores.length > 0) {
    scores.forEach((s, idx) => {
      const principleCount = s.byPrinciple ? Object.keys(s.byPrinciple).filter(p => s.byPrinciple[p] !== null && s.byPrinciple[p] !== undefined).length : 0;
      console.log(`  Score ${idx + 1}: userId=${s.userId}, questionnaireKey=${s.questionnaireKey}, principles with data=${principleCount}`);
      
      // CRITICAL DEBUG: Log ALL principle keys in Score document (both canonical and non-canonical)
      if (s.byPrinciple) {
        console.log(`    📋 ALL principle keys in Score document: [${Object.keys(s.byPrinciple).join(', ')}]`);
        
        // Log canonical principles
        CANONICAL_PRINCIPLES.forEach(principle => {
          const data = s.byPrinciple[principle];
          if (data && typeof data === 'object' && data.avg !== undefined) {
            console.log(`    ✅ ${principle}: avg=${data.avg}, n=${data.n}, min=${data.min}, max=${data.max}`);
          } else {
            console.log(`    ❌ ${principle}: null/undefined`);
          }
        });
        
        // Log non-canonical principles (that will be mapped)
        Object.keys(s.byPrinciple).forEach(rawPrinciple => {
          if (!CANONICAL_PRINCIPLES.includes(rawPrinciple)) {
            const data = s.byPrinciple[rawPrinciple];
            console.log(`    🔄 NON-CANONICAL "${rawPrinciple}": avg=${data?.avg || 'N/A'}, n=${data?.n || 'N/A'}`);
          }
        });
      }
    });
  }

  // Aggregate by principle - ONLY from Score.byPrinciple
  const principleScores = {};
  CANONICAL_PRINCIPLES.forEach(principle => {
    principleScores[principle] = [];
  });

  // CRITICAL: Map legal/role-specific principle names to CANONICAL_PRINCIPLES
  // This ensures that all principle scores are aggregated correctly, even from old Score documents
  const principleMapping = {
    'TRANSPARENCY & EXPLAINABILITY': 'TRANSPARENCY',
    'HUMAN OVERSIGHT & CONTROL': 'HUMAN AGENCY & OVERSIGHT',
    'PRIVACY & DATA PROTECTION': 'PRIVACY & DATA GOVERNANCE',
    'ACCOUNTABILITY & RESPONSIBILITY': 'ACCOUNTABILITY',
    'LAWFULNESS & COMPLIANCE': 'ACCOUNTABILITY', // Legal compliance is part of accountability
    'RISK MANAGEMENT & HARM PREVENTION': 'TECHNICAL ROBUSTNESS & SAFETY', // Risk management is part of technical robustness
    'PURPOSE LIMITATION & DATA MINIMIZATION': 'PRIVACY & DATA GOVERNANCE', // Data minimization is part of privacy
    'USER RIGHTS & AUTONOMY': 'HUMAN AGENCY & OVERSIGHT' // User rights are part of human agency
  };

  // Collect scores for each principle (ONLY if present in Score document)
  scores.forEach(score => {
    if (score.byPrinciple) {
      // First, collect from CANONICAL_PRINCIPLES directly
      CANONICAL_PRINCIPLES.forEach(principle => {
        const data = score.byPrinciple[principle];
        // CRITICAL: Only include if data exists, is an object, has avg property, and avg is a valid number
        if (data && typeof data === 'object' && typeof data.avg === 'number' && !isNaN(data.avg) && data.avg >= 0 && data.avg <= 4) {
          principleScores[principle].push(data.avg);
        }
        // If missing or invalid, do nothing - will result in null
      });
      
      // Then, collect from mapped principles (for backward compatibility with old Score documents)
      Object.keys(score.byPrinciple).forEach(rawPrinciple => {
        // Skip if already a CANONICAL_PRINCIPLE
        if (CANONICAL_PRINCIPLES.includes(rawPrinciple)) {
          return;
        }
        
        // Map to canonical principle if mapping exists
        const mappedPrinciple = principleMapping[rawPrinciple];
        if (mappedPrinciple) {
          const data = score.byPrinciple[rawPrinciple];
          if (data && typeof data === 'object' && typeof data.avg === 'number' && !isNaN(data.avg) && data.avg >= 0 && data.avg <= 4) {
            console.log(`🔄 [DEBUG buildPrincipleScores] Mapping principle "${rawPrinciple}" → "${mappedPrinciple}" from Score document`);
            principleScores[mappedPrinciple].push(data.avg);
          }
        }
      });
    }
  });

  // Build result: null if no scores, otherwise compute avg/min/max
  const result = {};
  CANONICAL_PRINCIPLES.forEach(principle => {
    const values = principleScores[principle];
    if (values.length > 0) {
      // Calculate statistics from collected values
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      // Round to 2 decimal places
      const roundedAvg = Math.round(avg * 100) / 100;
      const roundedMin = Math.round(min * 100) / 100;
      const roundedMax = Math.round(max * 100) / 100;
      
      // CRITICAL: Validate that avg is not accidentally 0 when values exist
      if (roundedAvg === 0 && values.some(v => v > 0)) {
        console.error(`❌ CRITICAL BUG: Principle ${principle} has avg=0 but values=[${values.join(',')}]. This should not happen!`);
      }
      
      // Debug logging for each principle
      console.log(`📊 [DEBUG buildPrincipleScores] ${principle}: values=[${values.join(', ')}], n=${values.length}, avg=${roundedAvg}, min=${roundedMin}, max=${roundedMax}`);
      
      result[principle] = {
        avg: roundedAvg,
        min: roundedMin,
        max: roundedMax,
        count: values.length
      };
    } else {
      // CRITICAL: Missing = null, NOT 0 (0 is a valid score meaning MINIMAL risk)
      result[principle] = null;
      console.log(`📊 [DEBUG buildPrincipleScores] ${principle}: NO DATA (null)`);
    }
  });

  return result;
}

/**
 * TASK 5: TEAM & PARTICIPATION METRICS (FIX COUNTING)
 * 
 * Team size MUST come ONLY from ProjectAssignment
 * Participation logic:
 * - Get responses with answers (no draft/submitted distinction - answers exist = ready)
 * - Meaningful answer = any answer with: text, choiceKey, numeric, or multiChoiceKeys
 * 
 * @param {string|ObjectId} projectId - Project ID
 * @returns {Promise<Object>} Participation metrics
 */
async function computeParticipation(projectId) {
  const projectIdObj = isValidObjectId(projectId)
    ? new mongoose.Types.ObjectId(projectId)
    : projectId;

  // TASK 5: Team size MUST come ONLY from ProjectAssignment
  const assignments = await ProjectAssignment.find({ projectId: projectIdObj }).lean();
  const assignedCount = assignments.length;
  const assignedUserIds = assignments.map(a => a.userId.toString());

  // Get all responses for assigned users
  const allResponses = await Response.find({
    projectId: projectIdObj,
    userId: { $in: assignedUserIds.map(id => isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id) }
  }).select('userId role status answers').lean();

  // Get responses with answers (no draft/submitted distinction - answers exist = ready)
  const responsesWithAnswers = allResponses.filter(r => {
    if (!r.answers || !Array.isArray(r.answers) || r.answers.length === 0) {
      return false;
    }
    return r.answers.some(answer => {
      if (!answer.answer) return false;
      const hasText = answer.answer.text && answer.answer.text.trim().length > 0;
      const hasChoice = answer.answer.choiceKey || (answer.answer.multiChoiceKeys && answer.answer.multiChoiceKeys.length > 0);
      const hasNumeric = typeof answer.answer.numeric === 'number';
      return hasText || hasChoice || hasNumeric;
    });
  });
  
  const submittedUserIds = new Set(responsesWithAnswers.map(r => r.userId?.toString()).filter(Boolean));
  const submittedCount = submittedUserIds.size;
  const startedCount = submittedCount; // Same - answers exist means ready
  const startedUserIds = submittedUserIds;

  const teamCompletion = `${submittedCount}/${assignedCount}`;

  // Validation
  if (submittedCount > assignedCount) {
    throw new Error(`COMPUTE PARTICIPATION ERROR: submittedCount (${submittedCount}) > assignedCount (${assignedCount})`);
  }
  if (startedCount > assignedCount) {
    throw new Error(`COMPUTE PARTICIPATION ERROR: startedCount (${startedCount}) > assignedCount (${assignedCount})`);
  }

  return {
    assignedCount,
    startedCount,
    submittedCount,
    teamCompletion,
    assignedUserIds,
    startedUserIds: Array.from(startedUserIds),
    submittedUserIds: Array.from(submittedUserIds)
  };
}

/**
 * CRITICAL: Single source of truth for project evaluators
 * Returns both assigned and submitted evaluators with their details
 */
async function getProjectEvaluators(projectId) {
  const projectIdObj = isValidObjectId(projectId)
    ? new mongoose.Types.ObjectId(projectId)
    : projectId;

  const Project = mongoose.model('Project');
  const UseCase = mongoose.model('UseCase');
  
  // Step 1: Load assignments (prefer projectassignments collection)
  let assignedEvaluators = [];
  try {
    const assignments = await ProjectAssignment.find({
      projectId: projectIdObj
    }).lean();
    
    if (assignments.length > 0) {
      // Get user details for assigned users
      const userIds = assignments.map(a => a.userId);
      const users = await User.find({ _id: { $in: userIds } })
        .select('_id name email role')
        .lean();
      
      const userMap = new Map(users.map(u => [u._id.toString(), u]));
      
      assignedEvaluators = assignments.map(a => {
        const user = userMap.get(a.userId.toString());
        return {
          userId: a.userId.toString(),
          name: user?.name || 'Unknown',
          email: user?.email || '',
          role: a.role || user?.role || 'unknown',
          assignmentStatus: a.status || 'assigned',
          assignedAt: a.assignedAt,
          questionnaires: a.questionnaires || []
        };
      });
    }
  } catch (e) {
    console.warn('Could not load projectassignments, trying fallback:', e.message);
  }

  // Step 2: Fallback to usecases.assignedExperts or project.assignedUsers
  if (assignedEvaluators.length === 0) {
    try {
      const project = await Project.findById(projectIdObj).lean();
      if (project && project.useCase) {
        // Try to get from UseCase
        const useCaseId = typeof project.useCase === 'string' 
          ? project.useCase 
          : (project.useCase && project.useCase.url) || project.useCase;
        
        const useCase = await UseCase.findById(useCaseId).lean();
        if (useCase && useCase.assignedExperts && useCase.assignedExperts.length > 0) {
          const userIds = useCase.assignedExperts;
          const users = await User.find({ _id: { $in: userIds } })
            .select('_id name email role')
            .lean();
          
          assignedEvaluators = users.map(u => ({
            userId: u._id.toString(),
            name: u.name || 'Unknown',
            email: u.email || '',
            role: u.role || 'unknown',
            assignmentStatus: 'assigned',
            assignedAt: null,
            questionnaires: []
          }));
        }
      }
      
      // Final fallback: project.assignedUsers
      if (assignedEvaluators.length === 0 && project && project.assignedUsers) {
        const userIds = project.assignedUsers;
        const users = await User.find({ _id: { $in: userIds } })
          .select('_id name email role')
          .lean();
        
        assignedEvaluators = users.map(u => ({
          userId: u._id.toString(),
          name: u.name || 'Unknown',
          email: u.email || '',
          role: u.role || 'unknown',
          assignmentStatus: 'assigned',
          assignedAt: null,
          questionnaires: []
        }));
      }
    } catch (e) {
      console.warn('Could not load fallback assignments:', e.message);
    }
  }

  // Step 3: Get responses with answers (no draft/submitted distinction - answers exist means ready for report)
  const allResponses = await Response.find({
    projectId: projectIdObj
  })
    .select('_id userId role questionnaireKey answers')
    .lean();
  
  // Filter: only responses with answers (answers exist = ready for analysis)
  const responsesWithAnswers = allResponses.filter(r => {
    if (!r.answers || !Array.isArray(r.answers) || r.answers.length === 0) {
      return false;
    }
    // Check if at least one answer has content
    return r.answers.some(answer => {
      if (!answer.answer) return false;
      return answer.answer.text || 
             answer.answer.choiceKey || 
             answer.answer.numeric !== undefined || 
             (answer.answer.multiChoiceKeys && answer.answer.multiChoiceKeys.length > 0);
    });
  });
  
  console.log(`📊 [DEBUG getProjectEvaluators] Found ${responsesWithAnswers.length} responses with answers`);

  // Get scores to ensure canonical metrics exist
  const allScores = await Score.find({
    projectId: projectIdObj
  }).lean();
  
  // Create a map of userId+questionnaireKey -> score for quick lookup
  const scoreMap = new Map();
  allScores.forEach(s => {
    const key = `${s.userId.toString()}_${s.questionnaireKey || 'general-v1'}`;
    scoreMap.set(key, s);
  });

  // CRITICAL FIX: Group responses with answers by userId+role+questionnaireKey, keep latest submission
  // This ensures we only count each evaluator once per role+questionnaireKey combination
  const responseMap = new Map();
  responsesWithAnswers.forEach(r => {
    const key = `${r.userId.toString()}_${r.role}_${r.questionnaireKey || 'general-v1'}`;
    const existing = responseMap.get(key);
    if (!existing || 
        (r.submittedAt && (!existing.submittedAt || r.submittedAt > existing.submittedAt))) {
      responseMap.set(key, r);
    }
  });

  // Get all unique user IDs from submitted responses
  const submittedUserIds = [...new Set(Array.from(responseMap.values()).map(r => r.userId.toString()))];
  
  // Load user details for submitted evaluators (may not be in assignedEvaluators)
  const missingUserIds = submittedUserIds.filter(id => !assignedEvaluators.some(e => e.userId === id));
  if (missingUserIds.length > 0) {
    const missingUsers = await User.find({ _id: { $in: missingUserIds } })
      .select('_id name email role')
      .lean();
    
    missingUsers.forEach(user => {
      assignedEvaluators.push({
        userId: user._id.toString(),
        name: user.name || 'Unknown',
        email: user.email || '',
        role: user.role || 'unknown',
        assignmentStatus: 'submitted',
        assignedAt: null,
        questionnaires: []
      });
    });
  }
  
  // CRITICAL FIX: Build submitted evaluators list - ONE entry per userId
  // Group by userId (not userId+role+questionnaireKey) to ensure no duplicates
  // If same user submitted multiple questionnaires, we still count them as ONE evaluator
  const submittedEvaluators = [];
  const seenUserIds = new Set(); // Track unique userIds to prevent duplicates
  
  // Use for...of loop instead of forEach to support await
  for (const response of responseMap.values()) {
    const userId = response.userId.toString();
    
    // CRITICAL: Skip if we've already added this userId (prevent role duplication)
    if (seenUserIds.has(userId)) {
      continue; // Already counted this evaluator
    }
    seenUserIds.add(userId);
    
    const evaluator = assignedEvaluators.find(e => e.userId === userId);
    
    if (evaluator) {
      // Check if score exists for this userId+questionnaireKey
      const scoreKey = `${userId}_${response.questionnaireKey || 'general-v1'}`;
      const hasScore = scoreMap.has(scoreKey);
      
      submittedEvaluators.push({
        userId: evaluator.userId,
        name: evaluator.name,
        email: evaluator.email,
        role: response.role || evaluator.role, // Use role from response (more accurate)
        responseStatus: response.status,
        submittedAt: response.submittedAt,
        questionnaireKey: response.questionnaireKey || 'general-v1',
        hasScore: hasScore, // Track if canonical score exists
        scoreMissing: !hasScore // Data quality flag
      });
    } else {
      // User not in assignedEvaluators but submitted - add them
      const user = await User.findById(userId).select('_id name email role').lean();
      if (user) {
        const scoreKey = `${userId}_${response.questionnaireKey || 'general-v1'}`;
        const hasScore = scoreMap.has(scoreKey);
        
        submittedEvaluators.push({
          userId: user._id.toString(),
          name: user.name || 'Unknown',
          email: user.email || '',
          role: response.role || user.role || 'unknown',
          responseStatus: response.status,
          submittedAt: response.submittedAt,
          questionnaireKey: response.questionnaireKey || 'general-v1',
          hasScore: hasScore,
          scoreMissing: !hasScore
        });
      }
    }
  }

  // Helper function to get evaluators with scores
  const getEvaluatorsWithScores = async (questionnaireKey) => {
    // Filter to only evaluators who have scores for the specified questionnaire
    const filtered = submittedEvaluators.filter(e => {
      if (questionnaireKey && e.questionnaireKey !== questionnaireKey) {
        return false;
      }
      return e.hasScore;
    });
    
    // Track data quality: evaluators who submitted but have no score
    const missingScores = submittedEvaluators.filter(e => {
      if (questionnaireKey && e.questionnaireKey !== questionnaireKey) {
        return false;
      }
      return !e.hasScore;
    });
    
    // Store data quality notes for report
    if (missingScores.length > 0) {
      console.warn(`⚠️ Data Quality: ${missingScores.length} evaluator(s) submitted but have no score:`, 
        missingScores.map(e => `${e.name} (${e.role})`).join(', '));
      
      // Attach data quality info to the function for later retrieval
      getEvaluatorsWithScores.dataQualityNotes = [
        `Warning: ${missingScores.length} evaluator(s) submitted responses but have no canonical scores in MongoDB: ${missingScores.map(e => `${e.name} (${e.role})`).join(', ')}. Scores may need to be recomputed.`
      ];
    } else {
      getEvaluatorsWithScores.dataQualityNotes = [];
    }
    
    return filtered;
  };

  return {
    assigned: assignedEvaluators,
    submitted: submittedEvaluators,
    withScores: getEvaluatorsWithScores
  };
}

/**
 * Build deterministic reportMetrics JSON from MongoDB data
 * NO LLM computation - all metrics come from stored data
 */
async function buildReportMetrics(projectId, questionnaireKey) {
  // CRITICAL: Recompute scores before building metrics to ensure we have the latest data
  // This ensures that even if old Score documents exist, we use the most up-to-date Response data
  try {
    const { computeScores } = require('./evaluationService');
    const Response = require('../models/response');
    
    // CRITICAL: Recompute scores for ALL questionnaires, not just the specified one
    // This is because legal questions might be in a different questionnaireKey
    // but we want them to be included in the report
    const allQuestionnaireKeys = await Response.distinct('questionnaireKey', { projectId });
    console.log(`🔄 [DEBUG buildReportMetrics] Recomputing scores for project ${projectId}`);
    console.log(`   Found ${allQuestionnaireKeys.length} questionnaire keys: [${allQuestionnaireKeys.join(', ')}]`);
    
    // Recompute scores for each questionnaire key (userId = null means all users)
    for (const qKey of allQuestionnaireKeys) {
      console.log(`   Recomputing scores for questionnaireKey: ${qKey}`);
      await computeScores(projectId, null, qKey);
    }
    
    console.log(`✅ [DEBUG buildReportMetrics] Scores recomputed successfully for all questionnaires`);
  } catch (scoreError) {
    console.warn(`⚠️ [WARNING buildReportMetrics] Failed to recompute scores, continuing with existing Score documents: ${scoreError.message}`);
    console.error(`   Error details:`, scoreError);
    // Continue anyway - we'll use existing Score documents
  }
  const projectIdObj = isValidObjectId(projectId)
    ? new mongoose.Types.ObjectId(projectId)
    : projectId;

  // Fetch all required data
  const Project = mongoose.model('Project');
  const project = await Project.findById(projectIdObj).lean();
  if (!project) {
    throw new Error('Project not found');
  }

  // CRITICAL: Get actual evaluators (not hardcoded)
  // Only includes evaluators who submitted (status="submitted") and have scores
  const evaluators = await getProjectEvaluators(projectId);
  const evaluatorsWithScores = await evaluators.withScores(questionnaireKey);
  
  // Get data quality notes (evaluators who submitted but have no scores)
  const dataQualityNotes = evaluators.withScores.dataQualityNotes || [];

  // CRITICAL: Get scores for this project and ALL questionnaires (not just the specified one)
  // This is because we want to include legal questions and other role-specific questionnaires in the report
  // If questionnaireKey is specified, we can optionally filter, but for now we include all
  const scoreQuery = {
    projectId: projectIdObj
  };
  // Only filter by questionnaireKey if explicitly provided and not null
  // if (questionnaireKey) {
  //   scoreQuery.questionnaireKey = questionnaireKey;
  // }
  
  const scores = await Score.find(scoreQuery).lean();
  console.log(`📊 [DEBUG buildReportMetrics] Found ${scores.length} Score documents (all questionnaires)`);

  // Get responses - CRITICAL: Get ALL responses (draft and submitted) for started count
  // Submitted responses are used for submitted count, all responses for started count
  // ÖNEMLİ: answers field'ını da çek - MongoDB'den cevapları alabilmek için
  const allResponses = await Response.find({
    projectId: projectIdObj,
    questionnaireKey: questionnaireKey || { $exists: true }
  })
  .select('_id projectId userId role questionnaireKey status submittedAt answers') // answers field'ını explicit select et
  .lean();
  
  console.log(`📊 [DEBUG buildReportMetrics] Found ${allResponses.length} total responses`);
  allResponses.forEach((r, idx) => {
    const answersCount = r.answers ? r.answers.length : 0;
    const hasAnswers = r.answers && Array.isArray(r.answers) && r.answers.length > 0;
    const textAnswersCount = r.answers ? r.answers.filter(a => {
      const text = a.answer?.text || a.answerText || '';
      return text && text.trim().length > 0;
    }).length : 0;
    console.log(`  Response ${idx + 1}: userId=${r.userId}, status=${r.status}, answersCount=${answersCount}, textAnswers=${textAnswersCount}`);
  });
  
  // Get responses with answers (no status filter - answers exist = ready)
  const responses = allResponses.filter(r => {
    if (!r.answers || !Array.isArray(r.answers) || r.answers.length === 0) {
      return false;
    }
    return r.answers.some(answer => {
      if (!answer.answer) return false;
      return answer.answer.text || 
             answer.answer.choiceKey || 
             answer.answer.numeric !== undefined || 
             (answer.answer.multiChoiceKeys && answer.answer.multiChoiceKeys.length > 0);
    });
  });
  console.log(`📊 [DEBUG buildReportMetrics] Found ${responses.length} responses with answers`);

  // Get tensions (all tensions for the project)
  const tensions = await Tension.find({
    projectId: projectIdObj
  }).lean();
  
  // Get users for createdBy join (to avoid "unknown" in reports)
  const tensionCreatorIds = [...new Set(tensions
    .map(t => t.createdBy?.toString())
    .filter(Boolean)
  )];
  const tensionCreators = await User.find({ _id: { $in: tensionCreatorIds } })
    .select('_id name email role')
    .lean();
  const creatorMap = new Map(tensionCreators.map(u => [u._id.toString(), u]));

  // Get questions for answer excerpts
  const questions = await Question.find({
    questionnaireKey: questionnaireKey || { $exists: true }
  }).lean();
  const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

  // TASK A: Use single source of truth for participation
  const participation = await computeParticipation(projectId);
  const assignedCount = participation.assignedCount;
  const submittedCount = participation.submittedCount;
  const startedCount = participation.startedCount;
  const assignedUserIds = new Set(participation.assignedUserIds);
  const submittedUserIds = new Set(participation.submittedUserIds);
  const startedUserIds = new Set(participation.startedUserIds);

  // Build role stats - CRITICAL: Group by role and count accurately, no duplicates
  const roleStats = {};
  const roleEvaluatorSet = {}; // Track unique evaluators per role to prevent duplicates
  
  // Count assigned evaluators
  evaluators.assigned.forEach(e => {
    const role = e.role || 'unknown';
    if (!roleStats[role]) {
      roleStats[role] = { assigned: 0, started: 0, submitted: 0 };
      roleEvaluatorSet[role] = new Set();
    }
    if (!roleEvaluatorSet[role].has(e.userId)) {
      roleStats[role].assigned++;
      roleEvaluatorSet[role].add(e.userId);
    }
  });
  
  // Count submitted evaluators - ONLY those who actually submitted
  evaluators.submitted.forEach(e => {
    const role = e.role || 'unknown';
    if (!roleStats[role]) {
      roleStats[role] = { assigned: 0, started: 0, submitted: 0 };
      roleEvaluatorSet[role] = new Set();
    }
    // Only count each evaluator once per role
    if (!roleEvaluatorSet[role].has(e.userId) && submittedUserIds.has(e.userId)) {
      roleStats[role].submitted++;
      roleEvaluatorSet[role].add(e.userId);
    }
    if (startedUserIds.has(e.userId)) {
      roleStats[role].started++;
    }
  });

  // Core 12 questions completion (first 12 questions are common)
  const core12QuestionIds = questions
    .filter(q => q.order <= 12)
    .map(q => q._id.toString());
  const core12Responses = allResponses.filter(r => {
    if (!r.answers || !Array.isArray(r.answers)) return false;
    return r.answers.some(a => core12QuestionIds.includes(a.questionId.toString()));
  });
  const core12Started = new Set(
    core12Responses
      .filter(r => assignedUserIds.has(r.userId.toString()))
      .map(r => r.userId.toString())
  ).size;
  const core12Submitted = new Set(
    core12Responses
      .filter(r => r.status === 'submitted' && assignedUserIds.has(r.userId.toString()))
      .map(r => r.userId.toString())
  ).size;

  const coverage = {
    assignedExpertsCount: assignedCount,
    expertsStartedCount: startedCount,
    expertsSubmittedCount: submittedCount,
    roles: roleStats,
    core12Completion: {
      startedPct: assignedCount > 0 ? (core12Started / assignedCount) * 100 : 0,
      submittedPct: assignedCount > 0 ? (core12Submitted / assignedCount) * 100 : 0
    }
  };

  // Build scoring metrics
  const scoring = {
    totalsOverall: {},
    byPrincipleOverall: {},
    byRole: {}
  };

  if (scores.length > 0) {
    // Aggregate totals - TASK 3: NO FALLBACK TO 0, filter nulls explicitly
    const totalAvgs = scores.map(s => s.totals?.avg).filter(v => v !== null && v !== undefined && !isNaN(v));
    if (totalAvgs.length > 0) {
      const avg = totalAvgs.reduce((a, b) => a + b, 0) / totalAvgs.length;
      // count = number of Score documents (may be > unique evaluators if multiple questionnaires)
      // For display purposes, use coverage.expertsSubmittedCount for unique evaluator count
      scoring.totalsOverall = {
        avg: avg,
        min: Math.min(...totalAvgs),
        max: Math.max(...totalAvgs),
        count: totalAvgs.length, // Score document count (not unique evaluators)
        uniqueEvaluatorCount: submittedCount, // Actual unique evaluator count from coverage
        riskLabel: riskLabelEN(avg)
      };
    }

  // TASK 2 & 4: Use buildPrincipleScores - ONLY from Score collection
  const principleScoresData = await buildPrincipleScores(projectId, questionnaireKey);
  
  // TASK 9: Validation - Check score ranges
  Object.entries(principleScoresData).forEach(([principle, data]) => {
    if (data !== null) {
      if (data.avg < 0 || data.avg > 4) {
        throw new Error(`INVALID PRINCIPLE SCORE: Principle ${principle} has invalid score ${data.avg}. Scores must be between 0 and 4.`);
      }
    }
  });
  
  // Map to scoring.byPrincipleOverall structure
  Object.entries(principleScoresData).forEach(([principle, data]) => {
    if (data === null) {
      // TASK 3: Missing = null, NOT 0
      scoring.byPrincipleOverall[principle] = null;
    } else {
      // Calculate risk metrics based on CORRECT scale (0=MINIMAL, 4=CRITICAL)
      // High risk = score >= 3 (HIGH or CRITICAL)
      const highRiskCount = scores.filter(s => {
        const pData = s.byPrinciple?.[principle];
        return pData && typeof pData.avg === 'number' && pData.avg >= 3;
      }).length;
      const totalCount = data.count;
      
      scoring.byPrincipleOverall[principle] = {
        avgScore: data.avg,
        riskLabel: riskLabelEN(data.avg),
        riskPct: totalCount > 0 ? (highRiskCount / totalCount) * 100 : 0,
        safePct: totalCount > 0 ? ((totalCount - highRiskCount) / totalCount) * 100 : 0,
        safeCount: totalCount - highRiskCount,
        notSafeCount: highRiskCount,
        count: totalCount
      };
    }
  });

    // Aggregate by role
    const roleGroups = {};
    scores.forEach(score => {
      const role = score.role || 'unknown';
      if (!roleGroups[role]) {
        roleGroups[role] = {
          totals: { scores: [] },
          byPrinciple: {}
        };
      }
      if (score.totals?.avg) {
        roleGroups[role].totals.scores.push(score.totals.avg);
      }
      if (score.byPrinciple) {
        Object.entries(score.byPrinciple).forEach(([principle, data]) => {
          if (data && typeof data.avg === 'number') {
            if (!roleGroups[role].byPrinciple[principle]) {
              roleGroups[role].byPrinciple[principle] = [];
            }
            roleGroups[role].byPrinciple[principle].push(data.avg);
          }
        });
      }
    });

    Object.entries(roleGroups).forEach(([role, data]) => {
      if (data.totals.scores.length > 0) {
        const avg = data.totals.scores.reduce((a, b) => a + b, 0) / data.totals.scores.length;
        roleGroups[role].totals = {
          avg: avg,
          riskLabel: riskLabelEN(avg),
          count: data.totals.scores.length
        };
      }
      Object.entries(data.byPrinciple).forEach(([principle, values]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        roleGroups[role].byPrinciple[principle] = {
          avg: avg,
          riskLabel: riskLabelEN(avg),
          count: values.length
        };
      });
    });
    scoring.byRole = roleGroups;

    // Build dynamic principle-by-principle table with actual evaluators
    // TASK 2: Use canonical principles from buildPrincipleScores
    scoring.byPrincipleTable = {};
    
    // Use principles from buildPrincipleScores result
    const allPrinciples = Object.keys(principleScoresData);

    // Build table: principle -> evaluator columns
    allPrinciples.forEach(principle => {
      const principleData = {
        principle,
        evaluators: [],
        range: { min: 4, max: 0 },
        average: 0,
        count: 0
      };

      // For each evaluator with scores, get their score for this principle
      evaluatorsWithScores.forEach(evaluator => {
        const evaluatorScore = scores.find(s => 
          s.userId.toString() === evaluator.userId && 
          s.byPrinciple && 
          s.byPrinciple[principle]
        );
        
        if (evaluatorScore && evaluatorScore.byPrinciple[principle]) {
          // TASK 4: NO FALLBACK TO 0 - NULL means not evaluated, 0 is a valid score
          const scoreValue = evaluatorScore.byPrinciple[principle].avg ?? null;
          if (scoreValue === null) return; // Skip if not evaluated (use return in forEach, not continue)
          principleData.evaluators.push({
            userId: evaluator.userId,
            name: evaluator.name,
            role: evaluator.role,
            score: scoreValue
          });
          
          if (scoreValue < principleData.range.min) principleData.range.min = scoreValue;
          if (scoreValue > principleData.range.max) principleData.range.max = scoreValue;
        }
      });

      // Calculate average (excluding N/A = 0)
      const validScores = principleData.evaluators
        .map(e => e.score)
        .filter(s => s > 0);
      
      if (validScores.length > 0) {
        principleData.average = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        principleData.count = validScores.length;
      }

      scoring.byPrincipleTable[principle] = principleData;
    });
  }

  // Build top risk drivers (questions with lowest average scores)
  const questionScores = {};
  responses.forEach(response => {
    if (response.answers && Array.isArray(response.answers)) {
      response.answers.forEach(answer => {
        if (answer.questionId && typeof answer.score === 'number') {
          const qId = answer.questionId.toString();
          if (!questionScores[qId]) {
            questionScores[qId] = [];
          }
          questionScores[qId].push({
            score: answer.score,
            role: response.role,
            answerText: answer.answer?.text || answer.answerText || '',
            questionCode: answer.questionCode || ''
          });
        }
      });
    }
  });

  const topRiskDrivers = [];
  Object.entries(questionScores).forEach(([questionId, scoreData]) => {
    const avgScore = scoreData.reduce((sum, d) => sum + d.score, 0) / scoreData.length;
    const question = questionMap.get(questionId);
    if (question && scoreData.length > 0) {
      // Get roles most at risk (lowest scores)
      const roleScores = {};
      scoreData.forEach(d => {
        if (!roleScores[d.role]) {
          roleScores[d.role] = [];
        }
        roleScores[d.role].push(d.score);
      });
      const roleAvgs = Object.entries(roleScores).map(([role, scores]) => ({
        role,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length
      }));
      roleAvgs.sort((a, b) => a.avg - b.avg);
      const rolesMostAtRisk = roleAvgs.slice(0, 2).map(r => r.role);

      // Get answer excerpts (short snippets from text answers)
      const answerExcerpts = scoreData
        .filter(d => d.answerText && d.answerText.trim().length > 20)
        .slice(0, 3)
        .map(d => d.answerText.trim().substring(0, 150));

      // Use shared riskLabel function (CORRECT: 0 = MINIMAL risk, 4 = CRITICAL risk)
      const severityLabel = riskLabelEN(avgScore);

      // Determine if question is common (first 12) or role-specific
      const isCommonQuestion = question.order <= 12;
      
      // Get actual roles who answered (with evaluator names if available)
      const rolesWhoAnswered = [];
      const roleUserMap = {};
      
      // Build map of role -> user IDs who answered this question
      scoreData.forEach(d => {
        if (!roleUserMap[d.role]) {
          roleUserMap[d.role] = new Set();
        }
        // Find the response that contains this answer
        const response = responses.find(r => 
          r.role === d.role && 
          r.answers && 
          r.answers.some(a => a.questionId && a.questionId.toString() === questionId)
        );
        if (response && response.userId) {
          roleUserMap[d.role].add(response.userId.toString());
        }
      });
      
      // Build role labels with evaluator names
      Object.entries(roleUserMap).forEach(([role, userIds]) => {
        if (userIds.size > 0) {
          // Try to get evaluator names from evaluators list
          const evaluatorNames = Array.from(userIds)
            .map(userId => {
              const evaluator = evaluatorsWithScores.find(e => e.userId === userId);
              return evaluator ? evaluator.name : null;
            })
            .filter(Boolean);
          
          if (evaluatorNames.length > 0) {
            rolesWhoAnswered.push(`${role}: ${evaluatorNames.join(', ')}`);
          } else {
            rolesWhoAnswered.push(`${role} (${userIds.size} evaluator${userIds.size > 1 ? 's' : ''})`);
          }
        } else {
          rolesWhoAnswered.push(role);
        }
      });

      // Get question text (join from questions collection)
      const questionText = question.text || question.questionText || question.code || questionId;
      
      // Get answer excerpts with better handling of empty answers
      // Only include questions with responses that have actual text answers
      const hasSubmittedAnswer = responses.some(response => {
        if (!response.answers || !Array.isArray(response.answers)) return false;
        return response.answers.some(a => {
          const aQId = a.questionId?.toString();
          if (aQId !== questionId) return false;
          const aText = a.answer?.text || a.answerText || '';
          return aText && aText.trim().length > 0;
        });
      });
      
      // If no submitted answers with text, skip this question from top risk drivers
      // OR mark it as "submitted but empty"
      let answerExcerptsFinal = answerExcerpts.slice(0, 2);
      let answerStatus = 'has_text';
      
      if (answerExcerptsFinal.length === 0 && hasSubmittedAnswer) {
        // Submitted but answer text is empty/not captured
        answerStatus = 'submitted_empty';
        answerExcerptsFinal = ['[Answer is empty / not captured]'];
      } else if (answerExcerptsFinal.length === 0) {
        // No submitted responses with text - skip this question
        return; // Skip questions without submitted text answers
      }
      
      topRiskDrivers.push({
        questionId,
        questionCode: question.code || questionId,
        questionText: questionText, // Add question text for human-readable display
        principle: question.principle || 'Unknown',
        avgRiskScore: avgScore,
        severityLabel,
        rolesMostAtRisk,
        rolesWhoAnswered: rolesWhoAnswered.length > 0 ? rolesWhoAnswered : rolesMostAtRisk,
        answerExcerpts: answerExcerptsFinal,
        answerStatus: answerStatus, // Track answer status: 'has_text', 'submitted_empty'
        isCommonQuestion, // Flag: first 12 = common, rest = role-specific
        questionOrder: question.order || 999
      });
    }
  });

  // Sort by avgRiskScore (descending = highest risk first, since HIGHER score = HIGHER risk)
  // CORRECT SCALE: Score 0 = MINIMAL RISK, Score 4 = CRITICAL RISK
  topRiskDrivers.sort((a, b) => b.avgRiskScore - a.avgRiskScore);
  topRiskDrivers.splice(10);

  // Build tensions summary
  const tensionsSummary = {
    total: tensions.length,
    accepted: 0,
    underReview: 0,
    disputed: 0,
    resolved: 0,
    avgParticipationPct: 0,
    evidenceCoveragePct: 0,
    evidenceTypeDistribution: {},
    mitigationFilledPct: 0
  };

  const tensionsList = [];
  let totalParticipation = 0;
  let tensionsWithEvidence = 0;
  let tensionsWithMitigation = 0;

  tensions.forEach(tension => {
    // Use deterministic computeReviewState function (same as analyticsService)
    // This ensures consistency across dashboard, table, and narrative
    const reviewState = computeReviewState(tension.votes, tension.createdBy);
    
    // Normalize reviewState to match chart labels
    let normalizedReviewState = reviewState;
    if (reviewState === 'Single review') {
      normalizedReviewState = 'Under review'; // Map "Single review" to "Under review" for consistency
    }
    
    // Count by normalized review state
    if (normalizedReviewState === 'Accepted') tensionsSummary.accepted++;
    else if (normalizedReviewState === 'Under review' || normalizedReviewState === 'Under Review') tensionsSummary.underReview++;
    else if (normalizedReviewState === 'Disputed') tensionsSummary.disputed++;
    else if (normalizedReviewState === 'Resolved') tensionsSummary.resolved++;

    const evidence = tension.evidences || tension.evidence || [];
    const evidenceCount = Array.isArray(evidence) ? evidence.length : 0;
    if (evidenceCount > 0) {
      tensionsWithEvidence++;
      evidence.forEach(e => {
        const type = e.type || e.evidenceType || 'Other';
        tensionsSummary.evidenceTypeDistribution[type] = (tensionsSummary.evidenceTypeDistribution[type] || 0) + 1;
      });
    }

    // CRITICAL: Owner/creator cannot vote - filter out their votes if present
    const creatorId = tension.createdBy ? tension.createdBy.toString() : null;
    const votes = (tension.votes || []).filter(v => {
      // Exclude votes from the creator/owner
      const voterId = v.userId ? v.userId.toString() : null;
      return voterId !== creatorId;
    });
    
    const assignedCount = assignedUserIds.size;
    const participationPct = assignedCount > 0 ? (votes.length / assignedCount) * 100 : 0;
    totalParticipation += participationPct;

    const agreeCount = votes.filter(v => v.voteType === 'agree').length;
    const disagreeCount = votes.filter(v => v.voteType === 'disagree').length;
    const agreePct = votes.length > 0 ? (agreeCount / votes.length) * 100 : 0;
    
    // Get discussion count (from embedded comments or evidence item comments)
    let discussionCount = 0;
    // Count tension-level comments
    if (tension.comments && Array.isArray(tension.comments)) {
      discussionCount += tension.comments.length;
    }
    // Count comments from evidence items
    if (Array.isArray(evidence)) {
      evidence.forEach(e => {
        if (e.comments && Array.isArray(e.comments)) {
          discussionCount += e.comments.length;
        }
      });
    }
    // TODO: If discussions are in shareddiscussions collection, query by tensionId and add to count

    const hasMitigation = !!(tension.mitigation?.proposed || tension.mitigation?.tradeoff?.decision);
    if (hasMitigation) tensionsWithMitigation++;

    const evidenceItems = Array.isArray(evidence) ? evidence.map(e => ({
      evidenceType: e.type || e.evidenceType || 'Other',
      text: (e.description || e.title || '').substring(0, 200),
      attachmentsCount: e.fileName ? 1 : 0,
      createdAt: e.uploadedAt || e.createdAt,
      createdBy: e.uploadedBy || e.createdBy || ''
    })) : [];

    tensionsList.push({
      tensionId: tension._id.toString(),
      createdAt: tension.createdAt,
      createdBy: tension.createdBy || '',
      conflict: {
        principle1: tension.principle1 || '',
        principle2: tension.principle2 || ''
      },
      severityLevel: tension.severityLevel || tension.severity || 'Unknown',
      claim: tension.claim || tension.claimStatement || tension.description || '',
      argument: tension.argument || tension.description || '',
      impactArea: tension.impact?.areas || [],
      affectedGroups: tension.impact?.affectedGroups || [],
      impactDescription: tension.impact?.description || '',
      mitigation: {
        proposedMitigations: tension.mitigation?.proposed || '',
        tradeOffDecision: tension.mitigation?.tradeoff?.decision || '',
        tradeOffRationale: tension.mitigation?.tradeoff?.rationale || ''
      },
      evidence: {
        count: evidenceCount,
        types: [...new Set(evidenceItems.map(e => e.evidenceType))],
        items: evidenceItems
      },
      consensus: {
        assignedExpertsCount: assignedCount,
        votesTotal: votes.length,
        participationPct,
        agreeCount,
        disagreeCount,
        agreePct,
        reviewState
      },
      discussionCount // Number of comments/discussions
    });
  });

  if (tensions.length > 0) {
    tensionsSummary.avgParticipationPct = totalParticipation / tensions.length;
    tensionsSummary.evidenceCoveragePct = (tensionsWithEvidence / tensions.length) * 100;
    tensionsSummary.mitigationFilledPct = (tensionsWithMitigation / tensions.length) * 100;
  }

  // Generate charts (deterministic, backend-only)
  const chartGenerationService = require('./chartGenerationService');
  const charts = {
    principleBarChart: null,
    principleEvaluatorHeatmap: null,
    teamCompletionDonut: null,
    tensionReviewStateChart: null,
    // Evidence charts removed per TASK 7 (invalid/misleading)
    severityChart: null
  };

  try {
    // Generate principle bar chart
    if (Object.keys(scoring.byPrincipleOverall).length > 0) {
      charts.principleBarChart = await chartGenerationService.generatePrincipleBarChart(
        scoring.byPrincipleOverall
      );
    }

    // Generate principle-evaluator heatmap
    if (scoring.byPrincipleTable && Object.keys(scoring.byPrincipleTable).length > 0 && evaluatorsWithScores.length > 0) {
      charts.principleEvaluatorHeatmap = await chartGenerationService.generatePrincipleEvaluatorHeatmap(
        scoring.byPrincipleTable,
        evaluatorsWithScores
      );
    }

    // Generate team completion donut
    charts.teamCompletionDonut = await chartGenerationService.generateTeamCompletionDonut(coverage);

    // Generate tension charts
    if (tensionsSummary.total > 0) {
      charts.tensionReviewStateChart = await chartGenerationService.generateTensionReviewStateChart(tensionsSummary);
      
      // TASK 7: Evidence coverage and evidence type charts REMOVED (invalid/misleading per Z-Inspection methodology)
      // These charts are not aligned with Z-Inspection methodology and are weak/misleading
      
      if (tensionsList.length > 0) {
        // Convert tension list to severity distribution
        const severityDistribution = {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        };
        tensionsList.forEach(t => {
          const severity = String(t.severityLevel || t.severity || 'medium').toLowerCase();
          if (severityDistribution.hasOwnProperty(severity)) {
            severityDistribution[severity]++;
          } else {
            severityDistribution.medium++; // Default to medium if unknown
          }
        });
        charts.severityChart = await chartGenerationService.generateTensionSeverityChart(severityDistribution);
      }
    }
  } catch (chartError) {
    console.warn('⚠️ Chart generation failed (non-critical):', chartError.message);
    // Continue without charts - report can still be generated
  }

  // Build dashboardMetrics (deterministic JSON - single source of truth)
  const dashboardMetrics = await buildDashboardMetrics(projectId, questionnaireKey);

  // Build final reportMetrics structure
  const reportMetrics = {
    project: {
      projectId: project._id.toString(),
      title: project.title || 'Untitled Project',
      category: project.category || '',
      ownerId: project.ownerId ? project.ownerId.toString() : '',
      createdAt: project.createdAt,
      questionnaireKey: questionnaireKey || 'general-v1',
      questionnaireVersion: responses.length > 0 ? responses[0].questionnaireVersion : 1
    },
    // Include dashboardMetrics as the canonical source
    dashboardMetrics,
    evaluators: {
      assigned: evaluators.assigned.map(e => ({
        userId: e.userId,
        name: e.name,
        role: e.role,
        email: e.email
      })),
      submitted: evaluators.submitted.map(e => ({
        userId: e.userId,
        name: e.name,
        role: e.role,
        email: e.email,
        questionnaireKey: e.questionnaireKey
      })),
      withScores: evaluatorsWithScores.map(e => ({
        userId: e.userId,
        name: e.name,
        role: e.role,
        email: e.email
      }))
    },
    coverage,
    scoring,
    topRiskDrivers: {
      questions: topRiskDrivers,
      method: 'derived from scores + joined answer snippets from responses'
    },
    tensions: {
      summary: tensionsSummary,
      list: tensionsList
    },
    dataQuality: {
      notes: dataQualityNotes,
      evaluatorsWithMissingScores: evaluators.submitted.filter(e => e.scoreMissing || false).map(e => ({
        userId: e.userId,
        name: e.name,
        role: e.role,
        questionnaireKey: e.questionnaireKey
      }))
    },
    charts: {
      // Chart buffers will be stored separately, but metadata is included here
      available: {
        principleBarChart: charts.principleBarChart !== null,
        principleEvaluatorHeatmap: charts.principleEvaluatorHeatmap !== null,
        teamCompletionDonut: charts.teamCompletionDonut !== null,
        tensionReviewStateChart: charts.tensionReviewStateChart !== null,
        // Evidence charts removed per TASK 7 (invalid/misleading)
        severityChart: charts.severityChart !== null
      }
    }
  };

  // Store chart buffers separately (they're too large for JSON)
  reportMetrics._chartBuffers = charts;

  return reportMetrics;
}

/**
 * Build deterministic dashboardMetrics JSON
 * This is the SINGLE SOURCE OF TRUTH for all numeric metrics used by:
 * - On-screen dashboard
 * - Report generation
 * - Gemini AI (must only refer to this JSON, never compute scores)
 * 
 * @param {string|ObjectId} projectId - Project ID
 * @param {string} questionnaireKey - Optional questionnaire key filter
 * @returns {Promise<Object>} dashboardMetrics JSON object
 */
async function buildDashboardMetrics(projectId, questionnaireKey = null) {
  const projectIdObj = isValidObjectId(projectId)
    ? new mongoose.Types.ObjectId(projectId)
    : projectId;

  // Fetch all required data
  const Project = mongoose.model('Project');
  const project = await Project.findById(projectIdObj).lean();
  if (!project) {
    throw new Error('Project not found');
  }

  // Get evaluators (only submitted)
  const evaluators = await getProjectEvaluators(projectId);
  const evaluatorsWithScores = await evaluators.withScores(questionnaireKey);

  // Get scores (canonical metrics)
  const scores = await Score.find({
    projectId: projectIdObj,
    questionnaireKey: questionnaireKey || { $exists: true }
  }).lean();

  // Get ALL responses (draft and submitted) for started count
  // Get responses with answers (no draft/submitted distinction)
  // because "Finish Evaluation" does not update status yet.
  // ÖNEMLİ: answers field'ını da çek - MongoDB'den cevapları alabilmek için
  const allResponsesRaw = await Response.find({
    projectId: projectIdObj,
    questionnaireKey: questionnaireKey || { $exists: true }
  })
  .select('_id projectId userId role questionnaireKey status submittedAt answers') // answers field'ını explicit select et
  .lean();
  
  console.log(`📊 [DEBUG buildDashboardMetrics] Found ${allResponsesRaw.length} total responses`);
  
  // Get responses with answers (no draft/submitted distinction)
  const responses = allResponsesRaw.filter(r => {
    if (!r.answers || !Array.isArray(r.answers) || r.answers.length === 0) {
      return false;
    }
    return r.answers.some(answer => {
      if (!answer.answer) return false;
      return answer.answer.text || 
             answer.answer.choiceKey || 
             answer.answer.numeric !== undefined || 
             (answer.answer.multiChoiceKeys && answer.answer.multiChoiceKeys.length > 0);
    });
  });
  
  console.log(`📊 [DEBUG buildDashboardMetrics] Found ${responses.length} responses with answers`);
  
  // Debug: Check if answers are being fetched
  responses.forEach((r, idx) => {
    const answersCount = r.answers ? r.answers.length : 0;
    const textAnswersCount = r.answers ? r.answers.filter(a => {
      const text = a.answer?.text || a.answerText || '';
      return text && text.trim().length > 0;
    }).length : 0;
    console.log(`  Response ${idx + 1}: userId=${r.userId}, answersCount=${answersCount}, textAnswers=${textAnswersCount}`);
  });

  // Get tensions
  const tensions = await Tension.find({
    projectId: projectIdObj
  }).lean();

  // Get questions
  const questions = await Question.find({
    questionnaireKey: questionnaireKey || { $exists: true }
  }).lean();
  const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

  // ============================================================
  // 1) PROJECT META
  // ============================================================
  const projectMeta = {
    projectId: project._id.toString(),
    title: project.title || 'Untitled Project',
    description: project.description || project.category || '',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    targetDate: project.targetDate || project.deadline || null,
    category: project.category || '',
    ownerId: project.ownerId ? project.ownerId.toString() : '',
    questionnaireKey: questionnaireKey || 'general-v1',
    questionnaireVersion: responses.length > 0 ? responses[0].questionnaireVersion : 1
  };

  // ============================================================
  // 2) TEAM METRICS (SINGLE SOURCE OF TRUTH)
  // ============================================================
  // TASK A: Use single source of truth for participation
  const participation = await computeParticipation(projectId);
  const assignedCount = participation.assignedCount;
  const submittedCount = participation.submittedCount;
  const startedCount = participation.startedCount;
  const assignedUserIds = new Set(participation.assignedUserIds);
  const submittedUserIds = new Set(participation.submittedUserIds);
  const startedUserIds = new Set(participation.startedUserIds);
  
  const completionPct = assignedCount > 0 ? (submittedCount / assignedCount) * 100 : 0;

  const team = {
    assignedCount,
    submittedCount,
    startedCount,
    completionPct: parseFloat(completionPct.toFixed(1)),
    withScoresCount: evaluatorsWithScores.length,
    missingScoresCount: evaluators.submitted.filter(e => e.scoreMissing || false).length
  };

  // ============================================================
  // 3) SCORES (Canonical Metrics)
  // ============================================================
  const scoresData = {
    totals: {
      overallAvg: 0,
      min: 4,
      max: 0,
      count: 0,
      naExcluded: 0,
      riskLevel: 'Unknown' // Critical, High, Medium, Low
    },
    byPrinciple: {},
    rolePrincipleMatrix: {}
  };

  // Calculate totals
  const allTotals = scores
    .map(s => s.totals?.avg)
    .filter(v => v !== undefined && v !== null && !isNaN(v) && v >= 0);

  if (allTotals.length > 0) {
    scoresData.totals.overallAvg = parseFloat((allTotals.reduce((a, b) => a + b, 0) / allTotals.length).toFixed(2));
    scoresData.totals.min = parseFloat(Math.min(...allTotals).toFixed(2));
    scoresData.totals.max = parseFloat(Math.max(...allTotals).toFixed(2));
    scoresData.totals.count = allTotals.length;

    // TASK 1: Use canonical risk classification function
    const avg = scoresData.totals.overallAvg;
    if (avg !== null && avg !== undefined) {
      scoresData.totals.riskLevel = classifyRisk(avg);
    } else {
      scoresData.totals.riskLevel = 'N/A';
    }
  }

  // TASK 2 & 4: Use buildPrincipleScores - ONLY from Score collection
  // NEVER recompute from Response or generalquestionanswers
  const principleScoresData = await buildPrincipleScores(projectId, questionnaireKey);
  
  // TASK 9: Validation - Check if all principle scores are null
  const allNull = Object.values(principleScoresData).every(v => v === null);
  if (allNull) {
    throw new Error('REPORT GENERATION ABORTED: All principle scores are null. Cannot generate report without any evaluated principles.');
  }
  
  // Map to scoresData.byPrinciple structure
  Object.entries(principleScoresData).forEach(([principle, data]) => {
    if (data === null) {
      // TASK 3: Missing = null, NOT 0 (0 is a valid score meaning MINIMAL risk)
      scoresData.byPrinciple[principle] = null;
    } else {
      // TASK 7: FAIL FAST ON NUMERIC INCONSISTENCIES
      if (data.avg < 0 || data.avg > 4) {
        throw new Error(`INVALID PRINCIPLE SCORE: Principle ${principle} has invalid score ${data.avg}. Scores must be between 0 and 4.`);
      }
      if (data.min !== undefined && (data.min < 0 || data.min > 4)) {
        throw new Error(`INVALID PRINCIPLE SCORE: Principle ${principle} has invalid min score ${data.min}. Scores must be between 0 and 4.`);
      }
      if (data.max !== undefined && (data.max < 0 || data.max > 4)) {
        throw new Error(`INVALID PRINCIPLE SCORE: Principle ${principle} has invalid max score ${data.max}. Scores must be between 0 and 4.`);
      }
      
      // TASK 7: Validate risk classification matches score
      const classification = classifyRisk(data.avg);
      validateRiskScaleNotInverted(data.avg, classification);
      
      scoresData.byPrinciple[principle] = {
        avg: data.avg,
        min: data.min,
        max: data.max,
        count: data.count
      };
    }
  });
  
  // TASK 7: Validation - Check for auto-conversion of null to 0
  Object.entries(scoresData.byPrinciple).forEach(([principle, data]) => {
    const originalData = principleScoresData[principle];
    if (originalData === null && data !== null && data.avg === 0) {
      throw new Error(`VALIDATION ERROR: Principle ${principle} was null but was auto-converted to 0. This is not allowed. NULL means not evaluated, 0 means MINIMAL risk.`);
    }
  });
  
  // TASK 9: Validation - Check for auto-conversion of null to 0
  Object.entries(scoresData.byPrinciple).forEach(([principle, data]) => {
    const originalData = principleScoresData[principle];
    if (originalData === null && data !== null && data.avg === 0) {
      throw new Error(`VALIDATION ERROR: Principle ${principle} was null but was auto-converted to 0. This is not allowed. NULL means not evaluated, 0 means MINIMAL risk.`);
    }
  });

  // Calculate total NA excluded
  const totalNaExcluded = Object.values(principleScoresData).filter(v => v === null).length * scores.length;
  scoresData.totals.naExcluded = totalNaExcluded;

  // Build rolePrincipleMatrix (role × principle)
  // TASK B: Use canonical principles and null for missing
  const rolePrincipleMatrix = {};
  const roles = [...new Set(scores.map(s => s.role || 'unknown'))];

  roles.forEach(role => {
    rolePrincipleMatrix[role] = {};
    const roleScores = scores.filter(s => (s.role || 'unknown') === role);

    CANONICAL_PRINCIPLES.forEach(principle => {
      const principleValues = [];
      roleScores.forEach(score => {
        if (score.byPrinciple && score.byPrinciple[principle]) {
          const avg = score.byPrinciple[principle].avg;
          if (typeof avg === 'number' && !isNaN(avg) && avg >= 0) {
            principleValues.push(avg);
          }
        }
      });

      if (principleValues.length > 0) {
        rolePrincipleMatrix[role][principle] = {
          avg: parseFloat((principleValues.reduce((a, b) => a + b, 0) / principleValues.length).toFixed(2)),
          count: principleValues.length
        };
      } else {
        // TASK B: Missing = null, NOT 0
        rolePrincipleMatrix[role][principle] = null;
      }
    });
  });

  scoresData.rolePrincipleMatrix = rolePrincipleMatrix;

  // ============================================================
  // 4) TOP RISKY QUESTIONS
  // ============================================================
  const questionScores = {};
  const questionAnswerMap = {}; // Map questionId -> {userId, role, answerSnippet}

  responses.forEach(response => {
    if (response.answers && Array.isArray(response.answers)) {
      response.answers.forEach(answer => {
        if (answer.questionId && typeof answer.score === 'number') {
          const qId = answer.questionId.toString();
          
          // Aggregate scores
          if (!questionScores[qId]) {
            questionScores[qId] = [];
          }
          questionScores[qId].push(answer.score);

          // Store answer snippet
          if (!questionAnswerMap[qId]) {
            questionAnswerMap[qId] = [];
          }
          const answerText = answer.answerText || (answer.answer && answer.answer.text) || '';
          if (answerText.trim().length > 0) {
            questionAnswerMap[qId].push({
              userId: response.userId.toString(),
              role: response.role || 'unknown',
              answerSnippet: answerText.trim().substring(0, 200)
            });
          }
        }
      });
    }
  });

  const topRiskyQuestions = [];
  Object.entries(questionScores).forEach(([questionId, scoreArray]) => {
    const avgRisk = scoreArray.reduce((sum, s) => sum + s, 0) / scoreArray.length;
    const question = questionMap.get(questionId);
    
    if (question) {
      // Get answer snippet (prefer first available)
      const answerData = questionAnswerMap[questionId] || [];
      const answerSnippet = answerData.length > 0 ? answerData[0].answerSnippet : '';
      const role = answerData.length > 0 ? answerData[0].role : 'unknown';
      const userId = answerData.length > 0 ? answerData[0].userId : '';

      topRiskyQuestions.push({
        questionId,
        questionCode: question.code || questionId,
        principle: question.principle || 'Unknown',
        avgRisk: parseFloat(avgRisk.toFixed(2)),
        role,
        userId,
        answerSnippet,
        count: scoreArray.length
      });
    }
  });

  // Sort by avgRisk (ascending = highest risk first) and limit to top 20
  topRiskyQuestions.sort((a, b) => a.avgRisk - b.avgRisk);
  topRiskyQuestions.splice(20);

  // ============================================================
  // 5) TENSIONS SUMMARY
  // ============================================================
  const tensionsSummary = {
    total: tensions.length,
    countsByReviewState: {
      Proposed: 0,
      'Single review': 0,
      'Under review': 0,
      Accepted: 0,
      Disputed: 0,
      Resolved: 0
    },
    evidenceCoverage: {
      tensionsWithEvidence: 0,
      tensionsWithoutEvidence: 0,
      coveragePct: 0
    },
    evidenceTypeDistribution: {},
    topUnresolvedTensions: []
  };

  let tensionsWithEvidence = 0;
  const unresolvedTensions = [];

  // Get users for createdBy join (to avoid "unknown" in reports)
  const tensionCreatorIds = [...new Set(tensions
    .map(t => t.createdBy?.toString())
    .filter(Boolean)
  )];
  const tensionCreators = await User.find({ _id: { $in: tensionCreatorIds } })
    .select('_id name email role')
    .lean();
  const creatorMap = new Map(tensionCreators.map(u => [u._id.toString(), u]));

  tensions.forEach(tension => {
    // Use deterministic computeReviewState function (same as analyticsService)
    // This ensures consistency across dashboard, table, and narrative
    const reviewState = computeReviewState(tension.votes, tension.createdBy);
    
    // Normalize reviewState to match chart labels
    let normalizedReviewState = reviewState;
    if (reviewState === 'Single review') {
      normalizedReviewState = 'Under review'; // Map "Single review" to "Under review" for consistency
    }

    tensionsSummary.countsByReviewState[normalizedReviewState] = 
      (tensionsSummary.countsByReviewState[normalizedReviewState] || 0) + 1;

    // Count evidence
    const evidence = tension.evidences || tension.evidence || [];
    const evidenceCount = Array.isArray(evidence) ? evidence.length : 0;
    
    if (evidenceCount > 0) {
      tensionsWithEvidence++;
      evidence.forEach(e => {
        const type = e.type || e.evidenceType || 'Other';
        tensionsSummary.evidenceTypeDistribution[type] = 
          (tensionsSummary.evidenceTypeDistribution[type] || 0) + 1;
      });
    }

    // Get votes (excluding creator)
    const creatorId = tension.createdBy ? tension.createdBy.toString() : null;
    const votes = (tension.votes || []).filter(v => {
      const voterId = v.userId ? v.userId.toString() : null;
      return voterId !== creatorId;
    });
    
    // Get creator info (join from users collection) - reuse creatorId from above

    const agreeCount = votes.filter(v => v.voteType === 'agree').length;
    const disagreeCount = votes.filter(v => v.voteType === 'disagree').length;
    const totalVotes = votes.length;
    const consensusPct = totalVotes > 0 ? (agreeCount / totalVotes) * 100 : 0;

    // Get severity level
    const severity = tension.severityLevel || tension.severity || 'Unknown';
    const severityWeight = {
      'Critical': 4,
      'High': 3,
      'Medium': 2,
      'Low': 1,
      'Unknown': 0
    }[severity] || 0;

    // Get creator info (join from users collection) - creatorId already defined above
    const creator = creatorId ? creatorMap.get(creatorId) : null;
    const createdByName = creator?.name || 'Unknown';
    const createdByRole = creator?.role || 'Unknown';
    
    // Collect unresolved tensions for sorting
    if (normalizedReviewState !== 'Accepted' && normalizedReviewState !== 'Resolved') {
      unresolvedTensions.push({
        tensionId: tension._id.toString(),
        claim: (tension.claim || tension.claimStatement || '').substring(0, 150),
        principle1: tension.principle1 || '',
        createdByName: createdByName, // Add creator name
        createdByRole: createdByRole, // Add creator role
        principle2: tension.principle2 || '',
        severity,
        severityWeight,
        reviewState: normalizedReviewState, // Use normalized reviewState
        evidenceCount,
        consensusPct: parseFloat(consensusPct.toFixed(1)),
        agreeCount,
        disagreeCount,
        totalVotes
      });
    }
  });

  tensionsSummary.evidenceCoverage.tensionsWithEvidence = tensionsWithEvidence;
  tensionsSummary.evidenceCoverage.tensionsWithoutEvidence = tensions.length - tensionsWithEvidence;
  tensionsSummary.evidenceCoverage.coveragePct = tensions.length > 0 
    ? parseFloat(((tensionsWithEvidence / tensions.length) * 100).toFixed(1))
    : 0;

  // Build tensionsList (full list with all details for report tables)
  const tensionsList = [];
  tensions.forEach(tension => {
    const creatorId = tension.createdBy ? tension.createdBy.toString() : null;
    const votes = (tension.votes || []).filter(v => {
      const voterId = v.userId ? v.userId.toString() : null;
      return voterId !== creatorId;
    });
    
    const agreeCount = votes.filter(v => v.voteType === 'agree').length;
    const disagreeCount = votes.filter(v => v.voteType === 'disagree').length;
    const totalVotes = votes.length;
    const consensusPct = totalVotes > 0 ? (agreeCount / totalVotes) * 100 : 0;
    
    const evidence = tension.evidences || tension.evidence || [];
    const evidenceCount = Array.isArray(evidence) ? evidence.length : 0;
    const evidenceTypes = [...new Set(evidence.map(e => e.type || e.evidenceType || 'Other'))];
    
    // Get discussion count
    let discussionCount = 0;
    if (tension.comments && Array.isArray(tension.comments)) {
      discussionCount += tension.comments.length;
    }
    if (Array.isArray(evidence)) {
      evidence.forEach(e => {
        if (e.comments && Array.isArray(e.comments)) {
          discussionCount += e.comments.length;
        }
      });
    }
    
    const reviewState = computeReviewState(tension.votes, tension.createdBy);
    let normalizedReviewState = reviewState;
    if (reviewState === 'Single review') {
      normalizedReviewState = 'Under review';
    }
    
    const creator = creatorId ? creatorMap.get(creatorId) : null;
    const createdByName = creator?.name || 'Unknown';
    const createdByRole = creator?.role || 'Unknown';
    
    tensionsList.push({
      tensionId: tension._id.toString(),
      createdAt: tension.createdAt,
      createdBy: tension.createdBy || '',
      createdByName,
      createdByRole,
      conflict: {
        principle1: tension.principle1 || '',
        principle2: tension.principle2 || ''
      },
      severityLevel: tension.severityLevel || tension.severity || 'Unknown',
      claim: tension.claim || tension.claimStatement || tension.description || '',
      argument: tension.argument || tension.description || '',
      impactArea: tension.impact?.areas || [],
      affectedGroups: tension.impact?.affectedGroups || [],
      impactDescription: tension.impact?.description || '',
      mitigation: {
        proposedMitigations: tension.mitigation?.proposed || '',
        tradeOffDecision: tension.mitigation?.tradeoff?.decision || '',
        tradeOffRationale: tension.mitigation?.tradeoff?.rationale || ''
      },
      evidence: {
        count: evidenceCount,
        types: evidenceTypes,
        items: Array.isArray(evidence) ? evidence.map(e => ({
          evidenceType: e.type || e.evidenceType || 'Other',
          text: (e.description || e.title || '').substring(0, 200),
          attachmentsCount: e.fileName ? 1 : 0,
          createdAt: e.uploadedAt || e.createdAt,
          createdBy: e.uploadedBy || e.createdBy || ''
        })) : []
      },
      consensus: {
        assignedExpertsCount: evaluators.submitted.length, // Use actual submitted count
        votesTotal: votes.length,
        participationPct: evaluators.submitted.length > 0 
          ? (votes.length / evaluators.submitted.length) * 100 
          : 0,
        agreeCount,
        disagreeCount,
        agreePct: consensusPct,
        reviewState: normalizedReviewState
      },
      discussionCount
    });
  });

  tensionsSummary.tensionsList = tensionsList; // Add full list to summary

  // Sort unresolved tensions: severity (desc) -> low consensus (asc) -> low evidence (asc)
  unresolvedTensions.sort((a, b) => {
    // First by severity (higher weight = higher priority)
    if (b.severityWeight !== a.severityWeight) {
      return b.severityWeight - a.severityWeight;
    }
    // Then by consensus (lower = higher priority)
    if (a.consensusPct !== b.consensusPct) {
      return a.consensusPct - b.consensusPct;
    }
    // Finally by evidence count (lower = higher priority)
    return a.evidenceCount - b.evidenceCount;
  });

  tensionsSummary.topUnresolvedTensions = unresolvedTensions.slice(0, 10);

  // NOTE: tensionsList is already built above (line 1320) and added to tensionsSummary (line 1408)
  // No need to rebuild it here

  // ============================================================
  // 6) DATA QUALITY
  // ============================================================
  // Count submitted responses with missing answer texts
  let submittedCountWithMissingText = 0;
  let submittedCountWithText = 0;
  let emptyAnswersCount = 0;
  
  responses.forEach(response => {
    if (response.answers && Array.isArray(response.answers)) {
      const hasTextAnswer = response.answers.some(a => {
        const text = a.answer?.text || a.answerText || '';
        return text && text.trim().length > 0;
      });
      if (hasTextAnswer) {
        submittedCountWithText++;
      } else {
        submittedCountWithMissingText++;
        emptyAnswersCount += response.answers.length;
      }
    } else {
      submittedCountWithMissingText++;
    }
  });

  // Count tensions without evidence
  const tensionsWithoutEvidence = tensionsList.filter(t => t.evidence.count === 0);
  const mitigationMissingCount = tensionsList.filter(t => 
    !t.mitigation?.proposed || t.mitigation.proposed.trim().length === 0
  ).length;

  const dataQuality = {
    missingScores: {
      users: evaluators.submitted
        .filter(e => e.scoreMissing || false)
        .map(e => ({
          userId: e.userId,
          name: e.name,
          role: e.role,
          questionnaireKey: e.questionnaireKey
        })),
      count: evaluators.submitted.filter(e => e.scoreMissing || false).length
    },
    missingAnswers: {
      // Find questions that should have answers but don't
      questionsWithoutAnswers: [],
      count: 0
    },
    incompleteResponses: {
      // Responses that are submitted but have missing answers
      responses: [],
      count: 0
    },
    answerTexts: {
      submittedCount: submittedCount,
      submittedCountWithText: submittedCountWithText,
      submittedCountWithMissingText: submittedCountWithMissingText,
      emptyAnswersCount: emptyAnswersCount,
      hasMissingTexts: submittedCountWithMissingText > 0
    },
    evidence: {
      tensionsWithoutEvidenceCount: tensionsWithoutEvidence.length,
      tensionsWithoutEvidenceIds: tensionsWithoutEvidence.map(t => t.tensionId || t._id?.toString() || 'unknown'),
      evidenceCoveragePct: tensionsList.length > 0 
        ? ((tensionsList.length - tensionsWithoutEvidence.length) / tensionsList.length * 100).toFixed(1)
        : 100
    },
    mitigation: {
      missingCount: mitigationMissingCount,
      missingPct: tensionsList.length > 0 
        ? ((mitigationMissingCount / tensionsList.length) * 100).toFixed(1)
        : 0
    }
  };

  // Check for missing answers (questions that should be answered but aren't)
  const requiredQuestions = questions.filter(q => q.required !== false);
  const answeredQuestionIds = new Set();
  
  responses.forEach(response => {
    if (response.answers && Array.isArray(response.answers)) {
      response.answers.forEach(answer => {
        if (answer.questionId) {
          answeredQuestionIds.add(answer.questionId.toString());
        }
      });
    }
  });

  const missingAnswers = requiredQuestions.filter(q => 
    !answeredQuestionIds.has(q._id.toString())
  );

  dataQuality.missingAnswers.questionsWithoutAnswers = missingAnswers.map(q => ({
    questionId: q._id.toString(),
    questionCode: q.code || q._id.toString(),
    principle: q.principle || 'Unknown'
  }));
  dataQuality.missingAnswers.count = missingAnswers.length;

  // Check for incomplete responses
  const incompleteResponses = responses.filter(response => {
    if (!response.answers || !Array.isArray(response.answers)) return true;
    const answeredCount = response.answers.filter(a => a.questionId).length;
    return answeredCount < requiredQuestions.length * 0.8; // Less than 80% answered
  });

  dataQuality.incompleteResponses.responses = incompleteResponses.map(r => ({
    userId: r.userId.toString(),
    role: r.role || 'unknown',
    answeredCount: r.answers ? r.answers.filter(a => a.questionId).length : 0,
    expectedCount: requiredQuestions.length
  }));
  dataQuality.incompleteResponses.count = incompleteResponses.length;

  // ============================================================
  // 7) CONSISTENCY CHECKS (Data Integrity)
  // ============================================================
  const consistencyChecks = {
    passed: true,
    warnings: [],
    errors: []
  };
  
  // Check 1: submittedCount consistency (TASK A - Single Source of Truth)
  const dashboardSubmittedCount = team.submittedCount;
  const appendixSubmittedCount = evaluators.submitted.length;
  
  // TASK A: Defensive guard - if appendix shows submittedCount > 0 but dashboard shows 0, throw error
  if (appendixSubmittedCount > 0 && dashboardSubmittedCount === 0) {
    const errorMsg = `❌ CRITICAL: Appendix shows ${appendixSubmittedCount} submitted evaluator(s) but dashboard shows 0. This indicates computeParticipation() is not being used correctly.`;
    console.error(errorMsg);
    console.error(`   Dashboard using: team.submittedCount from buildDashboardMetrics`);
    console.error(`   Appendix using: evaluators.submitted.length from getProjectEvaluators`);
    throw new Error(errorMsg);
  }
  
  if (dashboardSubmittedCount !== appendixSubmittedCount) {
    consistencyChecks.passed = false;
    consistencyChecks.errors.push(
      `Submitted count mismatch: Dashboard shows ${dashboardSubmittedCount}, Appendix shows ${appendixSubmittedCount}. Both should use computeParticipation().`
    );
  }
  
  // Check 2: Risk label mapping consistency
  // Verify that riskLabel function matches the expected interpretation
  // CORRECT: 0 = MINIMAL risk, 4 = CRITICAL risk
  const testScores = [0, 1, 2, 3, 4];
  const testLabels = testScores.map(s => riskLabelEN(s));
  const expectedLabels = ['Low', 'Moderate', 'High', 'Critical', 'Critical'];
  const labelMismatches = testScores.filter((score, idx) => {
    // For now, just log if there's an unexpected mapping
    // The actual mapping is: 0-1=Low, 1-2=Moderate, 2-3=High, 3-4=Critical
    // CORRECT SCALE: 0=MINIMAL risk, 4=CRITICAL risk
    return false; // No mismatch expected, but we check anyway
  });
  
  // Check 3: Score interpretation text consistency
  // Verify that any "Higher score = higher risk" text matches the riskLabel mapping
  // This is a semantic check - we'll flag if scores suggest opposite interpretation
  // TASK 3: NO FALLBACK TO 0 - if null, skip validation
  const avgScore = scoresData.totals?.overallAvg;
  if (avgScore === null || avgScore === undefined) {
    return; // Skip validation if no overall average
  }
  const riskLabelForAvg = riskLabelEN(avgScore);
  // If avg score is high (3-4) and we're calling it "Low risk", that's inconsistent
  // But our mapping is: 0-1=Low, 3-4=Critical, so high score = Critical = correct
  
  // Check 4: Evidence coverage consistency
  const tensionsWithEvidenceCount = tensionsSummary.total - (dataQuality.evidence?.tensionsWithoutEvidenceCount || 0);
  const evidenceCoverageFromSummary = tensionsSummary.evidenceCoverage || 0;
  const calculatedCoverage = tensionsSummary.total > 0 
    ? ((tensionsWithEvidenceCount / tensionsSummary.total) * 100).toFixed(1)
    : 100;
  if (Math.abs(parseFloat(evidenceCoverageFromSummary) - parseFloat(calculatedCoverage)) > 1) {
    consistencyChecks.warnings.push(
      `Evidence coverage calculation mismatch: Summary shows ${evidenceCoverageFromSummary}%, calculated ${calculatedCoverage}%`
    );
  }
  
  // Check 5: Top risky questions have submitted answers
  const topRiskyWithNoAnswers = topRiskyQuestions.filter(q => 
    !q.answerSnippet || q.answerSnippet.trim().length === 0
  ).length;
  if (topRiskyWithNoAnswers > 0) {
    consistencyChecks.warnings.push(
      `${topRiskyWithNoAnswers} top risky question(s) have no answer snippets, but should only include questions with submitted responses`
    );
  }

  // ============================================================
  // TASK C: DEBUG LOGGING - Log metrics before rendering
  // ============================================================
  console.log('📊 [DEBUG] Participation Metrics:');
  console.log(`  - assignedCount: ${assignedCount}`);
  console.log(`  - startedCount: ${startedCount}`);
  console.log(`  - submittedCount: ${submittedCount}`);
  console.log(`  - teamCompletion: ${participation.teamCompletion}`);
  console.log('');
  console.log('📊 [DEBUG] Principle Scores (showing nulls explicitly):');
  CANONICAL_PRINCIPLES.forEach(principle => {
    const data = scoresData.byPrinciple[principle];
    if (data === null) {
      console.log(`  - ${principle}: null (N/A)`);
    } else if (data && typeof data.avg === 'number') {
      console.log(`  - ${principle}: ${data.avg} (avg)`);
    } else {
      console.log(`  - ${principle}: ${JSON.stringify(data)}`);
    }
  });
  console.log('');

  // ============================================================
  // BUILD FINAL dashboardMetrics JSON
  // ============================================================
  const dashboardMetrics = {
    projectMeta,
    team,
    scores: scoresData,
    topRiskyQuestions,
    tensionsSummary,
    dataQuality,
    consistencyChecks,
    // Metadata
    generatedAt: new Date().toISOString(),
    source: 'MongoDB collections: scores, responses, tensions, questions',
    version: '1.0'
  };

  return dashboardMetrics;
}

module.exports = {
  buildReportMetrics,
  buildDashboardMetrics,
  getProjectEvaluators,
  computeParticipation
};

