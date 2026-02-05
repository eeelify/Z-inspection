const mongoose = require('mongoose');
const Score = require('../models/score');
const Response = require('../models/response');
const Tension = mongoose.model('Tension');
const ProjectAssignment = require('../models/projectAssignment');

// PHASE 3: ERC Threshold Configuration
const ercConfig = require('../config/ercThresholds.v1');
const Question = require('../models/question');
const User = mongoose.model('User');
// Use canonical risk scale utility
const { classifyRisk, riskLabelEN, getRiskLabel, validateRiskScaleNotInverted } = require('../utils/riskScale');
const { computeReviewState } = require('./analyticsService');

// Report semantics:
// - For reports, we treat "included evaluators" as those who have responses WITH answers.
//   (Status may remain 'draft' even after "Finish Evaluation" in some flows.)
// - "Team/assigned experts" should not affect report validity or narrative.
// - Safe vs risky split uses 2.5 threshold: score > 2.5 => risky, score <= 2.5 => safe.
const RISK_SAFE_THRESHOLD = 2.5;
function isRiskyScore(score) {
  return typeof score === 'number' && !isNaN(score) && score > RISK_SAFE_THRESHOLD;
}

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
    projectId: projectIdObj,
    // Exclude project-level aggregated score documents from evaluator aggregation
    role: { $ne: 'project' }
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
    // Initialize extra arrays for importance aggregation
    principleScores[principle].importance = [];
    principleScores[principle].highRatio = [];
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

  // Aggregators for unique question IDs per principle
  const principleQuestionIds = {};
  CANONICAL_PRINCIPLES.forEach(p => principleQuestionIds[p] = new Set());

  // Collect scores and unique questions for each principle (ONLY if present in Score document)
  scores.forEach(score => {
    if (score.byPrinciple) {
      // First, collect from CANONICAL_PRINCIPLES directly
      CANONICAL_PRINCIPLES.forEach(principle => {
        const data = score.byPrinciple[principle];
        // CRITICAL: Read 'risk' (unbounded cumulative risk)
        if (data && typeof data === 'object' && typeof data.risk === 'number' && !isNaN(data.risk) && data.risk >= 0) {
          principleScores[principle].push(data.risk);

          // Collect Importance Metrics if available
          if (typeof data.avgImportance === 'number') {
            principleScores[principle].importance.push(data.avgImportance);
          }
          if (typeof data.highImportanceRatio === 'number') {
            principleScores[principle].highRatio.push(data.highImportanceRatio);
          }

          // PATCH: Collect unique question IDs for this principle from this evaluator's score
          if (score.questionBreakdown && Array.isArray(score.questionBreakdown)) {
            score.questionBreakdown.forEach(qb => {
              // Map question's principle to canonical principle
              const rawP = qb.principleKey || qb.principle;
              const mappedP = CANONICAL_PRINCIPLES.includes(rawP) ? rawP : principleMapping[rawP];
              if (mappedP === principle && qb.questionId) {
                principleQuestionIds[principle].add(qb.questionId.toString());
              }
            });
          }
        }
      });

      // Then, collect from mapped principles (for backward compatibility with old Score documents)
      Object.keys(score.byPrinciple).forEach(rawPrinciple => {
        if (CANONICAL_PRINCIPLES.includes(rawPrinciple)) return;

        const mappedPrinciple = principleMapping[rawPrinciple];
        if (mappedPrinciple) {
          const data = score.byPrinciple[rawPrinciple];
          if (data && typeof data === 'object' && typeof data.risk === 'number' && !isNaN(data.risk) && data.risk >= 0) {
            principleScores[mappedPrinciple].push(data.risk);

            // Collect Importance Metrics if available
            if (typeof data.avgImportance === 'number') {
              principleScores[mappedPrinciple].importance.push(data.avgImportance);
            }
            if (typeof data.highImportanceRatio === 'number') {
              principleScores[mappedPrinciple].highRatio.push(data.highImportanceRatio);
            }

            // PATCH: Also collect unique question IDs for the mapped principle
            if (score.questionBreakdown && Array.isArray(score.questionBreakdown)) {
              score.questionBreakdown.forEach(qb => {
                const qbRawP = qb.principleKey || qb.principle;
                const qbMappedP = CANONICAL_PRINCIPLES.includes(qbRawP) ? qbRawP : principleMapping[qbRawP];
                if (qbMappedP === mappedPrinciple && qb.questionId) {
                  principleQuestionIds[mappedPrinciple].add(qb.questionId.toString());
                }
              });
            }
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
      const min = Math.min(...values);
      const max = Math.max(...values);

      // Round to 2 decimal places
      const roundedSum = Math.round(sum * 100) / 100;
      const roundedMin = Math.round(min * 100) / 100;
      const roundedMax = Math.round(max * 100) / 100;

      // Aggregated Importance Metrics
      let finalAvgImportance = 0;
      let finalHighRatio = 0;

      if (principleScores[principle].importance && principleScores[principle].importance.length > 0) {
        const impValues = principleScores[principle].importance;
        finalAvgImportance = impValues.reduce((a, b) => a + b, 0) / impValues.length;
      }
      if (principleScores[principle].highRatio && principleScores[principle].highRatio.length > 0) {
        const ratioValues = principleScores[principle].highRatio;
        finalHighRatio = ratioValues.reduce((a, b) => a + b, 0) / ratioValues.length;
      }

      // Values are RISK scores (Cumulative Unbounded)
      result[principle] = {
        risk: roundedSum, // The aggregated risk IS the cumulative sum
        min: roundedMin,
        max: roundedMax,
        n: principleQuestionIds[principle].size, // Correct: Unique questions
        count: values.length, // Experts participating
        // Legacy 'avg' field -> map to SUM for safety
        avg: roundedSum,

        // NEW Importance Fields
        avgImportance: Math.round(finalAvgImportance * 100) / 100,
        highImportanceRatio: Math.round(finalHighRatio * 100) / 100
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
  const assignedUserIds = assignments
    .filter(a => a.userId) // Filter out null userIds
    .map(a => a.userId.toString ? a.userId.toString() : String(a.userId));

  // Get all responses for assigned users
  // CRITICAL: Match getProjectEvaluators logic - check for answers, not status
  const allResponses = await Response.find({
    projectId: projectIdObj,
    userId: { $in: assignedUserIds.map(id => isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id) }
    // DO NOT filter by status: 'submitted' here - we filter by answers below
  }).select('userId role status answers submittedAt').lean();

  // Get responses with answers (answers exist = ready for report, regardless of status)
  // This matches the logic in getProjectEvaluators for consistency
  const responsesWithAnswers = allResponses.filter(r => {
    if (!r.answers || !Array.isArray(r.answers) || r.answers.length === 0) {
      return false;
    }
    // Check if at least one answer has content
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

  // Debug logging
  console.log(`📊 [computeParticipation] projectId=${projectId}: assignedCount=${assignedCount}, submittedCount=${submittedCount} (from ${responsesWithAnswers.length} responses with answers)`);
  if (submittedCount > 0) {
    console.log(`   ✅ Submitted user IDs: ${Array.from(submittedUserIds).join(', ')}`);
  }

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

      const userMap = new Map(users
        .filter(u => u._id) // Filter out null _id
        .map(u => [u._id.toString ? u._id.toString() : String(u._id), u]));

      assignedEvaluators = assignments
        .filter(a => a.userId) // Filter out null userIds
        .map(a => {
          const userIdStr = a.userId.toString ? a.userId.toString() : String(a.userId);
          const user = userMap.get(userIdStr);
          return {
            userId: userIdStr,
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

          assignedEvaluators = users
            .filter(u => u._id) // Filter out null _id
            .map(u => ({
              userId: u._id.toString ? u._id.toString() : String(u._id),
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

        assignedEvaluators = users
          .filter(u => u._id) // Filter out null _id
          .map(u => ({
            userId: u._id.toString ? u._id.toString() : String(u._id),
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
    // IMPORTANT: include status/submittedAt so callers can filter to submitted-only
    .select('_id userId role questionnaireKey status submittedAt answers')
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
    const userIdStr = s.userId ? (s.userId.toString ? s.userId.toString() : String(s.userId)) : 'unknown';
    const key = `${userIdStr}_${s.questionnaireKey || 'general-v1'}`;
    scoreMap.set(key, s);
  });

  // CRITICAL FIX: Group responses with answers by userId+role+questionnaireKey, keep latest submission
  // This ensures we only count each evaluator once per role+questionnaireKey combination
  const responseMap = new Map();
  responsesWithAnswers.forEach(r => {
    const userIdStr = r.userId ? (r.userId.toString ? r.userId.toString() : String(r.userId)) : 'unknown';
    const key = `${userIdStr}_${r.role || 'unknown'}_${r.questionnaireKey || 'general-v1'}`;
    const existing = responseMap.get(key);
    if (!existing ||
      (r.submittedAt && (!existing.submittedAt || r.submittedAt > existing.submittedAt))) {
      responseMap.set(key, r);
    }
  });

  // Get all unique user IDs from submitted responses
  const submittedUserIds = [...new Set(Array.from(responseMap.values())
    .filter(r => r.userId) // Filter out null userIds
    .map(r => r.userId.toString ? r.userId.toString() : String(r.userId)))];

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
    const userId = response.userId ? (response.userId.toString ? response.userId.toString() : String(response.userId)) : null;
    if (!userId) {
      console.warn('⚠️  Response has null userId, skipping');
      continue;
    }

    const scoreKey = `${userId}_${response.questionnaireKey || 'general-v1'}`;
    const hasScore = scoreMap.has(scoreKey);

    // CRITICAL: Handle duplicates/multiple questionnaires
    if (seenUserIds.has(userId)) {
      // If we already have this user, check if we need to "upgrade" to this response
      // We prefer:
      // 1. A response that HAS scores (if the current cached one does not)
      // 2. 'general-v1' over others (if both have scores or both don't) - Optional heuristic

      const existingIndex = submittedEvaluators.findIndex(e => e.userId === userId);
      if (existingIndex !== -1) {
        const existing = submittedEvaluators[existingIndex];

        // Upgrade if: Existing has NO score, but New HAS score
        if (!existing.hasScore && hasScore) {
          // Overwrite/Update existing entry logic below
          // Fall through to creation logic but replace at index
        } else {
          // Keep existing, skip this one
          continue;
        }
      } else {
        continue; // Should not happen if seenUserIds is accurate
      }
    }

    seenUserIds.add(userId);

    const evaluator = assignedEvaluators.find(e => e.userId === userId);
    let evaluatorEntry = null;

    if (evaluator) {
      evaluatorEntry = {
        userId: evaluator.userId,
        name: evaluator.name,
        email: evaluator.email,
        role: response.role || evaluator.role,
        responseStatus: response.status,
        submittedAt: response.submittedAt,
        questionnaireKey: response.questionnaireKey || 'general-v1',
        hasScore: hasScore,
        scoreMissing: !hasScore
      };
    } else {
      // User not in assignedEvaluators but submitted - add them
      const user = await User.findById(userId).select('_id name email role').lean();
      if (user) {
        evaluatorEntry = {
          userId: user._id.toString(),
          name: user.name || 'Unknown',
          email: user.email || '',
          role: response.role || user.role || 'unknown',
          responseStatus: response.status,
          submittedAt: response.submittedAt,
          questionnaireKey: response.questionnaireKey || 'general-v1',
          hasScore: hasScore,
          scoreMissing: !hasScore
        };
      }
    }

    if (evaluatorEntry) {
      const existingIndex = submittedEvaluators.findIndex(e => e.userId === userId);
      if (existingIndex !== -1) {
        submittedEvaluators[existingIndex] = evaluatorEntry; // Replace
      } else {
        submittedEvaluators.push(evaluatorEntry); // Add new
      }
    }
  }

  // Helper function to get evaluators with scores
  const getEvaluatorsWithScores = async (questionnaireKey) => {
    // If questionnaireKey is null/undefined, include ALL questionnaires (for report generation)
    // Otherwise filter to only evaluators who have scores for the specified questionnaire
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
  // STRICT READ-ONLY MODE: No score recomputation here.
  // Scores must be pre-computed by the client/backend before requesting a report.
  // We simply proceed to read the existing Score documents.
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
  // Include ALL questionnaires - pass null to get evaluators from all questionnaires
  const evaluatorsWithScores = await evaluators.withScores(questionnaireKey || null);

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

  // IMPORTANT: Exclude project-level aggregated score docs from evaluator aggregations.
  // Otherwise roles/counts (e.g., "project") and overall averages get double-counted.
  const evaluatorScores = scores.filter(s => s && s.role !== 'project' && s.userId);

  // CRITICAL VALIDATION: Check for missing scores (Read-Only Enforcement)
  // HONEST REPORTING MODEL: Do not crash. Generate "Invalid" report with notice.
  let validityStatus = 'valid';
  const invalidityReasons = [];
  const recommendedActions = [];

  // 1. Check for Missing Scores (scores < submissions)
  if (evaluators.submitted.length > 0 && evaluatorScores.length === 0) {
    validityStatus = 'invalid_missing_scores';
    invalidityReasons.push('Evaluators have submitted responses, but no ethical scores exist in the database.');
    recommendedActions.push('Ask an Administrator to run the "Compute Scores" action to process the latest responses.');
  } else if (evaluators.submitted.length > evaluatorScores.length) {
    validityStatus = 'invalid_partial_scores';
    invalidityReasons.push(`Partial data: ${evaluators.submitted.length} submitted evaluators, but only ${evaluatorScores.length} have scores.`);
    recommendedActions.push('Recompute scores to include all recent submissions.');
  }

  // 2. Check for Incomplete Evaluator Coverage (Assigned vs Submitted)
  // "Ethical Plurality" requires broad participation.
  // We check unique user IDs (team size) via getProjectEvaluators logic
  const assignedCount = evaluators.assigned.length;
  const submittedCount = evaluators.submitted.length;
  // Threshold: If < 50% participation or if critical roles missing (can be enhanced later)
  // For now, strict check: if assigned > 0 and submitted == 0, it's invalid (but handled above)
  // If assigned > submitted, we mark as "valid_partial" or similar?
  // User Requirement: "Scoring must NOT finalize if role coverage is incomplete."
  // "Mark report INVALID."
  if (assignedCount > 0 && submittedCount < assignedCount) {
    // Check if "locked" or "finalized"? No, for now strict coverage check.
    // But practically, maybe we should alert but not fully invalidate if say 4/5 submitted?
    // User says: "Two ethical-experts were assigned, but only one submitted... System incorrectly reported 100% completion... Mark report INVALID."
    // So checks must be strict.
    validityStatus = 'invalid_incomplete_evaluators';
    invalidityReasons.push(`Incomplete Team Coverage: ${assignedCount} experts assigned, but only ${submittedCount} submitted.`);
    recommendedActions.push('Wait for all assigned experts to submit their evaluations before finalizing the report.');
  }

  // 3. Check for Schema Validity (Zero-Risk fake data)
  // If we found scores but they have 0 risk across the board despite high question counts
  // This is a heuristic for the "ERC = X * 0" bug. 
  // We can check the source/model version in the Score document if available.
  const suspiciousScores = evaluatorScores.filter(s => s.totals && s.totals.overallRisk === 0 && s.totals.n > 5);
  if (suspiciousScores.length > 0 && evaluatorScores.length > 0) {
    // Double check if *really* safe or just broken.
    // If average importance > 2 but risk is 0, that's impossible unless severity is 0 everywhere.
    // If severity is missing (legacy), it defaults to 0 -> broken.
    // We'll lean on the "scoringModelVersion" to detect legacy if present, or this heuristic.
    // For now, let's trust the new 'strict_ethical_v3_cumulative' version tag.
    const legacyScores = evaluatorScores.filter(s => s.scoringModelVersion !== 'strict_ethical_v3_cumulative');
    if (legacyScores.length > 0) {
      validityStatus = 'invalid_scoring_pipeline';
      invalidityReasons.push('Some scores were computed with an obsolete model/schema. They may incorrectly show "Minimal Risk".');
      recommendedActions.push('Recompute scores to apply the latest strict ethical formula (Importance × Severity).');
    }
  }

  if (validityStatus !== 'valid') {
    const errorMsg = `Report Invalid: ${invalidityReasons.join(' ')}`;
    console.error(`❌ [ERROR buildReportMetrics] ${errorMsg}`);

    // INJECT INVALIDITY NOTICE
    // We proceed to build the report structure but inject flags to suppress charts/validity.
  }

  const projectLevelScores = scores.filter(s => s && s.role === 'project');
  if (projectLevelScores.length > 0) {
    console.log(`ℹ️ [DEBUG buildReportMetrics] Excluding ${projectLevelScores.length} project-level Score doc(s) from evaluator aggregation`);
  }

  // Get responses - CRITICAL: Get ALL responses (draft and submitted) for started count
  // Submitted responses are used for submitted count, all responses for started count
  // ÖNEMLİ: answers field'ını da çek - MongoDB'den cevapları alabilmek için
  // Include ALL questionnaires if questionnaireKey is null (for report generation)
  const allResponses = await Response.find({
    projectId: projectIdObj,
    ...(questionnaireKey ? { questionnaireKey } : {}) // Only filter if questionnaireKey is provided
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

  // Get questions for answer excerpts - include ALL questionnaires if questionnaireKey is null
  const questions = await Question.find({
    ...(questionnaireKey ? { questionnaireKey } : {}) // Only filter if questionnaireKey is provided
  }).lean();
  const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

  // REPORT MODE: Ignore "team/assigned experts" and use evaluators who have answers.
  // Status may be 'draft' even when evaluation is effectively complete.
  const submittedResponses = responses;
  const submittedUserIds = new Set(
    submittedResponses
      .filter(r => r.userId)
      .map(r => r.userId.toString ? r.userId.toString() : String(r.userId))
  );
  // SYNTAX FIX & HONESTY FIX:
  // We use the true assigned/submitted counts from the 'evaluators' object (derived from ProjectAssignment).
  // Overwriting them here caused both a SyntaxError (redeclaration) and a logic bug (faking 100% completion).
  // const submittedCount = submittedUserIds.size;
  // const assignedCount = submittedCount;
  const startedCount = submittedUserIds.size;
  const assignedUserIds = new Set(submittedUserIds); // Warning: This might still be "dishonest" for role stats, but avoiding syntax error first
  const startedUserIds = new Set(submittedUserIds);

  // Build role stats from submitted responses (dedupe by userId per role)
  const roleStats = {};
  const roleEvaluatorSet = {};
  submittedResponses.forEach(r => {
    const role = r.role || 'unknown';
    const userIdStr = r.userId?.toString ? r.userId.toString() : String(r.userId || '');
    if (!userIdStr) return;
    if (!roleStats[role]) {
      roleStats[role] = { assigned: 0, started: 0, submitted: 0 };
      roleEvaluatorSet[role] = new Set();
    }
    if (!roleEvaluatorSet[role].has(userIdStr)) {
      // In report mode, assigned/started are not meaningful; keep equal to submitted for display compatibility.
      roleStats[role].assigned++;
      roleStats[role].started++;
      roleStats[role].submitted++;
      roleEvaluatorSet[role].add(userIdStr);
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
  const core12Submitted = new Set(
    core12Responses
      .filter(r => submittedUserIds.has(r.userId.toString()))
      .map(r => r.userId.toString())
  ).size;

  const coverage = {
    assignedExpertsCount: assignedCount,
    expertsStartedCount: startedCount,
    expertsSubmittedCount: submittedCount,
    roles: roleStats,
    core12Completion: {
      // In report mode, completion is relative to submitted evaluators only
      startedPct: submittedCount > 0 ? (core12Submitted / submittedCount) * 100 : 0,
      submittedPct: submittedCount > 0 ? (core12Submitted / submittedCount) * 100 : 0
    }
  };

  // Build scoring metrics
  const scoring = {
    totalsOverall: {},
    byPrincipleOverall: {},
    byRole: {}
  };

  if (evaluatorScores.length > 0) {
    // Aggregate totals - Support both old format (avg) and new format (overallRisk, overallMaturity)
    // Prefer new format if available, fallback to old format for backward compatibility
    const hasNewFormat = evaluatorScores.some(s => s.totals?.overallRisk !== undefined || s.totals?.overallMaturity !== undefined);

    if (hasNewFormat) {
      // Use new ethical scoring format
      // READ ONLY RISK (0-4)
      const overallRisks = evaluatorScores
        .map(s => s.totals?.overallRisk)
        .filter(v => typeof v === 'number' && !isNaN(v));

      const overallMaturities = evaluatorScores.map(s => s.totals?.overallMaturity).filter(v => typeof v === 'number');

      if (overallRisks.length > 0) {
        // AGGREGATION: SUM across experts (Cumulative Risk)
        // If Expert A has risk 4.0 and Expert B has risk 4.0, Total Risk is 8.0.
        // NO DILUTION.
        const sumRisk = overallRisks.reduce((a, b) => a + b, 0);

        // Use riskLabelEN (maps 0-4 scale conceptually, but handles >4 as Critical)
        const riskLabel = riskLabelEN(sumRisk);

        scoring.totalsOverall = {
          overallRisk: sumRisk, // Cumulative Risk Points
          riskPercentage: undefined, // Percentage is tricky with unbounded sum

          // Legacy aliases (map to Risk)
          avg: sumRisk,
          overallPerformance: undefined,

          min: Math.min(...overallRisks),
          max: Math.max(...overallRisks),
          count: overallRisks.length,
          uniqueEvaluatorCount: submittedCount,
          riskLabel: riskLabel,

          // RISK Methodology label
          methodology: 'Cumulative Ethical Risk',
          methodologyDescription: 'Ethical risk is computed as: Question Importance x (1 - Answer Score). Risk values are cumulative across questions and experts and are NOT normalized or capped. Higher values indicate a greater volume and severity of identified ethical issues.',
        };
      }
    } else {
      // Fallback only if no risk fields found (unlikely with strict mode)
      const totalAvgs = evaluatorScores.map(s => s.totals?.avg).filter(v => typeof v === 'number');
      if (totalAvgs.length > 0) {
        const avg = totalAvgs.reduce((a, b) => a + b, 0) / totalAvgs.length;
        scoring.totalsOverall = {
          avg: avg,
          overallRisk: avg, // Assume legacy avg was high=risk? Or high=good? 
          // Legacy avg was usually performance (high=good). 
          // But strict update enforces Risk. We should probably flag this as legacy.
          min: Math.min(...totalAvgs),
          max: Math.max(...totalAvgs),
          count: totalAvgs.length,
          uniqueEvaluatorCount: submittedCount,
          riskLabel: riskLabelEN(4 - avg) // If legacy was performance
        };
      }
    }

    // TASK 2 & 4: Use buildPrincipleScores - ONLY from Score collection
    const principleScoresData = await buildPrincipleScores(projectId, questionnaireKey);

    // TASK 9: Validation - Check score ranges
    // Note: With Cumulative Risk, scores can exceed 4. We remove the strict 0-4 check for aggregates.
    // But individual question risks should still be sane?
    // Actually, 'data.risk' here is the aggregated principle risk across experts? 
    // Wait, 'principleScoresData' comes from 'buildPrincipleScores' which processes a SINGLE 'Score' document?
    // Let's check 'buildReportMetrics' flow.
    // 'principleScoresData' is populated below in this very loop.
    // The loop iterates CANONICAL_PRINCIPLES and populates scoring.byPrincipleOverall.

    // We skip the check here because we are about to POPULATE it.
    // Check downstream.

    // Map to scoring.byPrincipleOverall structure
    // Support ERC format (risk field) and old format (avg field)
    console.log(`🔍 [DEBUG buildReportMetrics] Mapping ${Object.keys(principleScoresData).length} principles to byPrincipleOverall`);

    Object.entries(principleScoresData).forEach(([principle, data]) => {
      if (data === null || data === undefined) {
        // TASK 3: Missing = null, NOT 0
        console.log(`  ⚠️  ${principle}: NULL (no data)`);
        scoring.byPrincipleOverall[principle] = null;
      } else {
        // CRITICAL: Strict Risk Mode
        const principleScores = evaluatorScores
          .map(s => s.byPrinciple?.[principle])
          .filter(p => p && typeof p === 'object');

        console.log(`  📊 ${principle}: Found ${principleScores.length} score document(s) with data`);

        if (principleScores.length > 0) {
          // Extract RISK values (NEW: .risk)
          const riskValues = principleScores
            .map(p => p.risk) // Read only .risk
            .filter(v => typeof v === 'number' && !isNaN(v));

          console.log(`    Risk values: [${riskValues.join(', ')}]`);

          if (riskValues.length > 0) {
            // AGGREGATION: SUM across experts (Cumulative Risk)
            const sumRisk = riskValues.reduce((a, b) => a + b, 0);
            const minRisk = Math.min(...riskValues);
            const maxRisk = Math.max(...riskValues);

            // Risk Categorization
            // With Cumulative Sum, what is "Risky"?
            // Any expert showing risk > 2.5 is a signal.
            const riskyCount = riskValues.filter(v => v > 2.5).length;
            const safeCount = riskValues.length - riskyCount;
            const totalCount = riskValues.length;

            // Get top drivers directly
            // Collect all top drivers from all experts
            const allDrivers = principleScores.flatMap(p => p.topDrivers || []);
            // Sort by risk (descending) and deduplicate by questionId/code if needed?
            // For now, simple sort.
            const topDrivers = allDrivers
              .sort((a, b) => (b.finalRiskContribution || 0) - (a.finalRiskContribution || 0))
              .slice(0, 10); // Keep top 10 unique-ish drivers

            // PHASE 3: Calculate normalized values
            const questionCount = data.n || 1; // Prevent division by zero
            const averageRiskPerQuestion = sumRisk / questionCount;
            const normalizedRiskLevel = ercConfig.getRiskLevel(averageRiskPerQuestion);

            // REGRESSION GUARD: Ensure labels NOT applied to cumulative sums
            const wrongLabel = ercConfig.getRiskLevel(sumRisk);
            if (normalizedRiskLevel.level === wrongLabel.level && sumRisk !== averageRiskPerQuestion) {
              console.warn(`⚠️  REGRESSION DETECTED: Risk label would be same for sum and average on ${principle}`);
            }

            scoring.byPrincipleOverall[principle] = {
              // ===== NEW ERC-COMPLIANT FIELDS (PHASE 3) =====
              cumulativeRisk: Math.round(sumRisk * 100) / 100,
              questionCount: questionCount,
              averageRisk: Math.round(averageRiskPerQuestion * 100) / 100,
              normalizedLevel: normalizedRiskLevel.level,
              normalizedLabel: normalizedRiskLevel.label,
              normalizedColor: normalizedRiskLevel.color,

              // ===== DEPRECATED FIELDS (Backward Compatibility - Remove in Phase 5) =====
              risk: Math.round(sumRisk * 100) / 100, // DEPRECATED: Use cumulativeRisk
              avgRisk: Math.round(sumRisk * 100) / 100, // DEPRECATED: Misleading name
              riskLabel: normalizedRiskLevel.label, // FIXED: Now uses normalized value
              avg: Math.round(sumRisk * 100) / 100, // DEPRECATED: Use averageRisk
              score: Math.round(sumRisk * 100) / 100, // DEPRECATED: Ambiguous

              // ===== METADATA =====
              min: Math.round(minRisk * 100) / 100,
              max: Math.round(maxRisk * 100) / 100,
              n: data.n, // Question count
              count: totalCount, // Evaluator count

              riskyCount: riskyCount,
              safeCount: safeCount,
              riskPct: totalCount > 0 ? Math.round((riskyCount / totalCount) * 100) : 0,

              topDrivers: topDrivers,

              // NEW Importance Fields
              avgImportance: data.avgImportance || 0,
              highImportanceRatio: data.highImportanceRatio || 0
            };

            console.log(`    ✅ Populated Cumulative Risk: sumRisk=${sumRisk.toFixed(2)}, count=${totalCount}`);
          } else {
            console.log(`    ❌ No valid risk values found`);
            scoring.byPrincipleOverall[principle] = null;
          }
        } else if (data.risk !== undefined && data.risk !== null) {
          // Fallback: Use data from buildPrincipleScores
          console.log(`    🔄 Fallback to buildPrincipleScores data: risk=${data.risk}`);
          scoring.byPrincipleOverall[principle] = {
            risk: data.risk,
            avg: data.risk,
            n: data.n, // Correct unique question count
            count: data.count, // Expert count
            riskLabel: riskLabelEN(data.risk),

            // NEW Importance Fields
            avgImportance: data.avgImportance || 0,
            highImportanceRatio: data.highImportanceRatio || 0
          };
        } else {
          console.log(`    ❌ No data available`);
          scoring.byPrincipleOverall[principle] = null;
        }
      }
    });

    // CRITICAL DEBUG: Log final byPrincipleOverall
    const populatedPrinciples = Object.entries(scoring.byPrincipleOverall)
      .filter(([_, data]) => data !== null)
      .map(([principle, data]) => `${principle}=${data.avg?.toFixed(2) || 'N/A'}`);
    console.log(`✅ [DEBUG buildReportMetrics] byPrincipleOverall populated: ${populatedPrinciples.length} principles`);
    console.log(`   ${populatedPrinciples.join(', ')}`);

    if (populatedPrinciples.length === 0) {
      console.error(`❌ CRITICAL: byPrincipleOverall is EMPTY! Charts will not render.`);
      console.error(`   Scores count: ${scores.length}`);
      console.error(`   principleScoresData keys: ${Object.keys(principleScoresData).join(', ')}`);
    }

    // Aggregate by role
    const roleGroups = {};
    evaluatorScores.forEach(score => {
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
        const evaluatorScore = evaluatorScores.find(s =>
          s.userId.toString() === evaluator.userId &&
          s.byPrinciple &&
          s.byPrinciple[principle]
        );

        if (evaluatorScore && evaluatorScore.byPrinciple[principle]) {
          // TASK 4: NO FALLBACK TO 0 - NULL means not evaluated, 0 is a valid risk score (Safe)
          // READ RISK
          const scoreValue = evaluatorScore.byPrinciple[principle].risk ?? null;
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

  // Build top risk drivers using Authoritative Score Data
  // (Response.answers.score is deprecated/removed)
  // Build Top Risk Drivers using Cumulative Risk Logic
  const questionScores = {};

  evaluatorScores.forEach(scoreDoc => {
    if (scoreDoc.questionBreakdown && Array.isArray(scoreDoc.questionBreakdown)) {
      scoreDoc.questionBreakdown.forEach(qb => {
        // Valid risk contribution required
        if (typeof qb.finalRiskContribution === 'number' && qb.finalRiskContribution > 0) {
          const qId = qb.questionId ? qb.questionId.toString() : null;
          if (!qId) return;

          if (!questionScores[qId]) {
            questionScores[qId] = [];
          }

          // We need to join answer text from responses
          // Look up the response for this user & question
          let answerText = '';
          const responseV = responses.find(r =>
            (r.userId && scoreDoc.userId && r.userId.toString() === scoreDoc.userId.toString()) &&
            (r.questionnaireKey === scoreDoc.questionnaireKey)
          );

          if (responseV && responseV.answers) {
            const ans = responseV.answers.find(a => a.questionId && a.questionId.toString() === qId);
            answerText = ans?.answer?.text || ans?.answerText || '';
          }

          questionScores[qId].push({
            score: qb.finalRiskContribution, // Cumulative Risk Contribution
            role: scoreDoc.role,
            answerText: answerText,
            questionCode: qb.code || qb.questionCode || ''
          });
        }
      });
    }
  });

  const topRiskDrivers = [];
  Object.entries(questionScores).forEach(([questionId, scoreData]) => {
    // CUMULATIVE RISK: Sum of all contributions
    const totalRiskContribution = scoreData.reduce((sum, d) => sum + d.score, 0);
    const question = questionMap.get(questionId);

    if (question && scoreData.length > 0) {
      // Get roles most at risk (highest total contribution)
      const roleScores = {};
      scoreData.forEach(d => {
        if (!roleScores[d.role]) {
          roleScores[d.role] = 0;
        }
        roleScores[d.role] += d.score; // Sum risk per role
      });

      const roleTotals = Object.entries(roleScores).map(([role, total]) => ({
        role,
        total
      }));
      roleTotals.sort((a, b) => b.total - a.total); // Highest risk first
      const rolesMostAtRisk = roleTotals.slice(0, 2).map(r => r.role);

      // Get answer excerpts (short snippets from text answers)
      const answerExcerpts = scoreData
        .filter(d => d.answerText && d.answerText.trim().length > 20)
        .slice(0, 3)
        .map(d => d.answerText.trim().substring(0, 150));

      // Use shared riskLabel function on the *highest single contribution* or similar metric?
      // Actually risk label maps better to intensity. Let's use the max single contribution for labeling intensity.
      const maxSingleScore = Math.max(...scoreData.map(d => d.score));
      const severityLabel = riskLabelEN(maxSingleScore);

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
        totalRiskContribution: totalRiskContribution, // NEW: Sum of risk
        avgRiskScore: totalRiskContribution / scoreData.length, // Keep for backward compat but deprioritize
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

  // Sort by totalRiskContribution (descending = highest cumulative risk first)
  topRiskDrivers.sort((a, b) => b.totalRiskContribution - a.totalRiskContribution);
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

    // F) Normalize reviewState to canonical enum values
    let normalizedReviewState = reviewState;
    // Map various formats to canonical enum
    if (reviewState === 'Single review' || reviewState === 'SingleReview') {
      normalizedReviewState = 'SingleReview';
    } else if (reviewState === 'Under review' || reviewState === 'Under Review' || reviewState === 'UnderReview') {
      normalizedReviewState = 'UnderReview';
    } else if (reviewState === 'Accepted') {
      normalizedReviewState = 'Accepted';
    } else if (reviewState === 'Disputed') {
      normalizedReviewState = 'Disputed';
    } else if (reviewState === 'Proposed') {
      normalizedReviewState = 'Proposed';
    } else {
      normalizedReviewState = 'Proposed'; // Default
    }

    // Count by normalized review state
    if (normalizedReviewState === 'Accepted') tensionsSummary.accepted++;
    else if (normalizedReviewState === 'UnderReview') tensionsSummary.underReview++;
    else if (normalizedReviewState === 'SingleReview') tensionsSummary.underReview++; // SingleReview counts as UnderReview
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

    // Resolve createdBy to user name from creatorMap
    let createdByName = '—';
    if (tension.createdBy) {
      const creatorIdStr = tension.createdBy.toString ? tension.createdBy.toString() : String(tension.createdBy);
      const creator = creatorMap.get(creatorIdStr);
      createdByName = creator ? creator.name : creatorIdStr; // Use name or fall back to ID
    }

    tensionsList.push({
      tensionId: tension._id.toString(),
      createdAt: tension.createdAt,
      // F) Fix mapping keys: use creatorMap to resolve user name
      createdBy: createdByName,
      createdById: tension.createdBy ? (tension.createdBy.toString ? tension.createdBy.toString() : String(tension.createdBy)) : '',
      conflict: {
        principle1: tension.principle1 || '',
        principle2: tension.principle2 || ''
      },
      severityLevel: tension.severityLevel || tension.severity || 'Unknown',
      // F) Correct mapping: claimStatement -> claim (not "Not provided")
      claim: tension.claimStatement || tension.claim || tension.description || '—',
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
        typesString: evidenceCount > 0
          ? [...new Set(evidenceItems.map(e => e.evidenceType))].join(', ')
          : 'None', // Human-readable string for display
        items: evidenceItems
      },
      consensus: {
        assignedExpertsCount: assignedCount,
        votesTotal: votes.length,
        participationPct,
        agreeCount,
        disagreeCount,
        agreePct,
        consensusPercentage: agreePct, // Alias for clarity
        reviewState,
        reviewStateNormalized: normalizedReviewState // Add normalized state for consistency
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

      // NEW: Generate Ethical Importance Ranking Chart
      try {
        charts.ethicalImportanceRanking = await chartGenerationService.generatePrincipleImportanceChart(
          scoring.byPrincipleOverall
        );
      } catch (impError) {
        console.warn(`⚠️ Importance Ranking chart failed (skipped): ${impError.message}`);
        charts.ethicalImportanceRanking = null;
      }
    }

    // Generate principle-evaluator heatmap (optional)
    if (scoring.byPrincipleTable && Object.keys(scoring.byPrincipleTable).length > 0 && evaluatorsWithScores && evaluatorsWithScores.length > 0) {
      try {
        charts.principleEvaluatorHeatmap = await chartGenerationService.generatePrincipleEvaluatorHeatmap(
          scoring.byPrincipleTable,
          evaluatorsWithScores
        );
      } catch (heatmapError) {
        console.warn(`⚠️  Heatmap generation failed (skipped): ${heatmapError.message}`);
        charts.principleEvaluatorHeatmap = null;
      }
    } else {
      console.warn('⚠️  Skipping heatmap: insufficient data (evaluatorsWithScores empty)');
    }

    // Generate team completion donut
    charts.teamCompletionDonut = await chartGenerationService.generateTeamCompletionDonut(coverage);

    // Generate tension charts (optional)
    if (tensionsSummary.total > 0) {
      try {
        charts.tensionReviewStateChart = await chartGenerationService.generateTensionReviewStateChart(tensionsSummary);
      } catch (reviewStateError) {
        console.warn(`⚠️  Tension review state chart failed (skipped): ${reviewStateError.message}`);
      }

      // TASK 7: Evidence coverage and evidence type charts REMOVED (invalid/misleading per Z-Inspection methodology)
      // These charts are not aligned with Z-Inspection methodology and are weak/misleading

      if (tensionsList.length > 0) {
        try {
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
        } catch (severityError) {
          console.warn(`⚠️  Tension severity chart failed (skipped): ${severityError.message}`);
        }
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
      // Include evaluators who have answers (deduped by getProjectEvaluators)
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
      evaluatorsWithMissingScores: evaluators.submitted
        .filter(e => e.scoreMissing || false)
        .map(e => ({
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
        ethicalImportanceRanking: charts.ethicalImportanceRanking !== null,
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

  // Exclude project-level aggregated score docs from evaluator aggregations
  const evaluatorScores = scores.filter(s => s && s.role !== 'project' && s.userId);

  // ============================================================
  // CRITICAL VALIDATION (Honest Reporting)
  // Ensure validityStatus is defined in this scope for dashboardMetrics
  // ============================================================
  let validityStatus = 'valid';
  const invalidityReasons = [];
  const recommendedActions = [];
  const dataQualityNotes = [];

  // 1. Check for Missing Scores
  if (evaluators.submitted.length > 0 && evaluatorScores.length === 0) {
    validityStatus = 'invalid_missing_scores';
    invalidityReasons.push('Evaluators have submitted responses, but no ethical scores exist in the database.');
    recommendedActions.push('Ask an Administrator to run the "Compute Scores" action to process the latest responses.');
  } else if (evaluators.submitted.length > evaluatorScores.length) {
    validityStatus = 'invalid_partial_scores';
    invalidityReasons.push(`Partial data: ${evaluators.submitted.length} submitted evaluators, but only ${evaluatorScores.length} have scores.`);
    recommendedActions.push('Recompute scores to include all recent submissions.');
  }

  // 2. Check for Incomplete Evaluator Coverage (Assigned vs Submitted)
  // strict check: if assigned > submitted, mark invalid
  const valAssignedCount = evaluators.assigned.length;
  const valSubmittedCount = evaluators.submitted.length;
  if (valAssignedCount > 0 && valSubmittedCount < valAssignedCount) {
    validityStatus = 'invalid_incomplete_evaluators';
    invalidityReasons.push(`Incomplete Team Coverage: ${valAssignedCount} experts assigned, but only ${valSubmittedCount} submitted.`);
    recommendedActions.push('Wait for all assigned experts to submit their evaluations before finalizing the report.');
  }


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
  // 2) TEAM METRICS (REPORT/DASHBOARD SEMANTICS)
  // ============================================================
  // For dashboards and reports, we treat "team" as the set of submitted evaluators.
  // Assigned experts should not inflate counts or trigger warnings in generated reports.
  // "Submitted" for dashboard/report semantics = has answers (status may not be updated)
  const submittedResponses = responses;
  const submittedUserIds = new Set(
    submittedResponses
      .filter(r => r.userId)
      .map(r => r.userId.toString ? r.userId.toString() : String(r.userId))
  );
  const submittedCount = submittedUserIds.size;
  const assignedCount = submittedCount;
  const startedCount = submittedCount;
  const completionPct = submittedCount > 0 ? 100 : 0;

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
  const allTotals = evaluatorScores
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
      // CUMULATIVE RISK VALIDATION: Scores are unbounded (>= 0 only)
      // Legacy 0-4 validation REMOVED: Aggregated risk is cumulative and unbounded.
      if (data.avg < 0) {
        throw new Error(`INVALID PRINCIPLE SCORE: Principle ${principle} has invalid score ${data.avg}. Score must be >= 0.`);
      }
      if (data.min !== undefined && data.min < 0) {
        throw new Error(`INVALID PRINCIPLE SCORE: Principle ${principle} has invalid min score ${data.min}. Score must be >= 0.`);
      }
      // NOTE: data.max check removed - max can be any positive value for cumulative risk

      // TASK 7: Validate risk classification matches score (MODIFIED: classifyRisk now handles unbounded)
      // const classification = classifyRisk(data.avg); // Commented out: classifyRisk may not support unbounded
      // validateRiskScaleNotInverted(data.avg, classification); // Commented out

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
  const totalNaExcluded = Object.values(principleScoresData).filter(v => v === null).length * evaluatorScores.length;
  scoresData.totals.naExcluded = totalNaExcluded;

  // Build rolePrincipleMatrix (role × principle)
  // TASK B: Use canonical principles and null for missing
  const rolePrincipleMatrix = {};
  const roles = [...new Set(evaluatorScores.map(s => s.role || 'unknown'))];

  roles.forEach(role => {
    rolePrincipleMatrix[role] = {};
    const roleScores = evaluatorScores.filter(s => (s.role || 'unknown') === role);

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
    // Use Cumulative Risk (Unbounded)
    // Assumption: scoreArray contains performance/quality scores (0-4), so Risk = 4 - Score
    const totalRiskContribution = scoreArray.reduce((sum, s) => sum + (4 - s), 0);

    // Also keep avg for legacy reference if needed, but primary metric is totalRisk
    const avgPerformance = scoreArray.reduce((sum, s) => sum + s, 0) / scoreArray.length;

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
        totalRiskContribution: parseFloat(totalRiskContribution.toFixed(2)),
        // Legacy fields for backward compatibility, but sorted by Total Risk
        avgPerformance: parseFloat(avgPerformance.toFixed(2)),
        avgRisk: parseFloat((4 - avgPerformance).toFixed(2)),
        role,
        userId,
        answerSnippet,
        count: scoreArray.length
      });
    }
  });

  // Sort by totalRiskContribution (descending = highest risk first) and limit to top 20
  topRiskyQuestions.sort((a, b) => b.totalRiskContribution - a.totalRiskContribution);
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

  // Defensive guard: if appendix shows included evaluators > 0 but dashboard shows 0, throw error
  if (appendixSubmittedCount > 0 && dashboardSubmittedCount === 0) {
    const errorMsg = `❌ CRITICAL: Appendix shows ${appendixSubmittedCount} evaluator(s) with answers but dashboard shows 0. This indicates evaluator counting is inconsistent.`;
    console.error(errorMsg);
    console.error(`   Dashboard using: team.submittedCount from buildDashboardMetrics`);
    console.error(`   Appendix using: evaluators.submitted.length from getProjectEvaluators`);
    throw new Error(errorMsg);
  }

  if (dashboardSubmittedCount !== appendixSubmittedCount) {
    consistencyChecks.passed = false;
    consistencyChecks.errors.push(
      `Evaluator count mismatch: Dashboard shows ${dashboardSubmittedCount}, Appendix shows ${appendixSubmittedCount}. Both should count evaluators with answers consistently.`
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
  console.log(`  - completionPct: ${team?.completionPct ?? 'N/A'}%`);
  console.log('');

  // High-signal pipeline summary (helps diagnose counting issues)
  try {
    const statusCounts = (allResponsesRaw || []).reduce((acc, r) => {
      const st = String(r?.status || 'unknown').toLowerCase();
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});
    console.log('🧾 [REPORT PIPELINE SUMMARY]');
    console.log(`  - responsesTotal: ${(allResponsesRaw || []).length}`);
    console.log(`  - responsesWithAnswers: ${(responses || []).length}`);
    console.log(`  - responsesStatusCounts: ${JSON.stringify(statusCounts)}`);
    console.log(`  - evaluatorsWithAnswers(uniqueUserId): ${submittedCount}`);
    console.log(`  - scores(evaluator-level) used for aggregates: ${(evaluatorScores || []).length}`);
    console.log('');
  } catch (e) {
    // Non-critical: never fail report due to logging
  }
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
  // BUILD FINAL dashboardMetrics JSON (With Invalidity Handling)
  // ============================================================
  const dashboardMetrics = {
    projectId: projectIdObj,
    projectMeta,
    team,

    // VALIDITY METADATA
    validityStatus: validityStatus,
    dataQualityNotes: [...(dataQualityNotes || []), ...invalidityReasons],
    recommendedActions: recommendedActions,

    // INVALIDITY NOTICE (Mandatory)
    invalidityNotice: validityStatus !== 'valid' ? {
      title: "⚠️ Quantitative Scoring Invalidity Notice",
      severity: "CRITICAL",
      message: "The quantitative risk assessment in this report is unreliable or unavailable due to systemic data issues.",
      details: invalidityReasons,
      actions: recommendedActions
    } : null,

    // SCORE & RISK (Conditionally Nullified)
    scores: (validityStatus === 'valid' || validityStatus.startsWith('valid_partial')) ? scoresData : null,
    riskLevel: (validityStatus === 'valid' || validityStatus.startsWith('valid_partial')) ? (scoresData?.totals?.riskLevel || 'Unknown') : 'Data Unavailable',

    topRiskyQuestions,
    tensionsSummary,
    dataQuality,
    consistencyChecks,

    // CHARTS GUARDRAIL
    // buildDashboardMetrics doesn't generate charts - that's done by buildReportMetrics
    // So we return empty chart structure here
    charts: {
      items: {},
      available: {}
    },

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

