const mongoose = require('mongoose');
const ProjectAssignment = require('../models/projectAssignment');
const Response = require('../models/response');
const Question = require('../models/question');
const Score = require('../models/score');

// Helper function for ObjectId validation (compatible with Mongoose v9+)
const isValidObjectId = (id) => {
  if (typeof mongoose.isValidObjectId === 'function') {
    return mongoose.isValidObjectId(id);
  }
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Create or update a project assignment
 */
async function createAssignment(projectId, userId, role, questionnaires, actorId = null, actorRole = 'admin') {
  try {
    const assignment = await ProjectAssignment.findOneAndUpdate(
      { projectId, userId },
      {
        projectId,
        userId,
        role,
        questionnaires: questionnaires || [],
        status: 'assigned',
        assignedAt: new Date()
      },
      { new: true, upsert: true }
    );

    // Initialize responses for all assigned questionnaires
    await initializeResponses(projectId, userId, role, questionnaires || []);

    // Notify assigned expert (non-blocking)
    try {
      const { notifyProjectAssigned } = require('./notificationService');
      await notifyProjectAssigned(
        projectId,
        userId,
        assignment._id,
        role,
        actorId,
        actorRole
      );
    } catch (notifError) {
      console.error('Error sending project assignment notification:', notifError);
      // Don't fail assignment creation if notification fails
    }

    return assignment;
  } catch (error) {
    throw new Error(`Failed to create assignment: ${error.message}`);
  }
}

/**
 * Initialize responses for all assigned questionnaires with all questions as unanswered
 * This ensures data integrity - every assigned question has an entry, even if unanswered
 */
async function initializeResponses(projectId, userId, role, questionnaires) {
  try {
    const Questionnaire = require('../models/questionnaire');
    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // Get assignment
    const assignment = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj });
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Initialize responses for each questionnaire
    for (const questionnaireKey of questionnaires) {
      // Get questionnaire version
      const questionnaire = await Questionnaire.findOne({ key: questionnaireKey, isActive: true });
      if (!questionnaire) {
        console.warn(`⚠️ Questionnaire ${questionnaireKey} not found or inactive, skipping initialization`);
        continue;
      }

      // Get all questions for this questionnaire
      const questions = await Question.find({ questionnaireKey }).sort({ order: 1 }).lean();

      if (questions.length === 0) {
        console.warn(`⚠️ No questions found for questionnaire ${questionnaireKey}`);
        continue;
      }

      // Check if response already exists
      const existingResponse = await Response.findOne({
        projectId: projectIdObj,
        userId: userIdObj,
        questionnaireKey
      });

      if (existingResponse) {
        // Merge existing answers with missing questions
        const existingQuestionCodes = new Set(existingResponse.answers.map(a => a.questionCode));
        const missingQuestions = questions.filter(q => !existingQuestionCodes.has(q.code));

        if (missingQuestions.length > 0) {
          const unansweredAnswers = missingQuestions.map(question => ({
            questionId: question._id,
            questionCode: question.code,
            answer: null, // Unanswered
            answerScore: null, // Unanswered questions should have null score
            notes: null,
            evidence: []
          }));

          existingResponse.answers.push(...unansweredAnswers);
          await existingResponse.save();
          console.log(`✅ Added ${missingQuestions.length} missing questions to existing response for ${questionnaireKey}`);
        }
      } else {
        // Create new response with all questions as unanswered
        const unansweredAnswers = questions.map(question => ({
          questionId: question._id,
          questionCode: question.code,
          answer: null, // Unanswered
          answerScore: null, // Unanswered questions should have null score
          notes: null,
          evidence: []
        }));

        await Response.create({
          projectId: projectIdObj,
          assignmentId: assignment._id,
          userId: userIdObj,
          role: role,
          questionnaireKey: questionnaireKey,
          questionnaireVersion: questionnaire.version,
          answers: unansweredAnswers,
          status: 'draft',
          updatedAt: new Date()
        });

        console.log(`✅ Initialized response for ${questionnaireKey} with ${questions.length} unanswered questions`);
      }
    }
  } catch (error) {
    console.error(`❌ Error initializing responses: ${error.message}`);
    throw error;
  }
}

/**
 * Save a draft response
 */
async function saveDraftResponse(projectId, userId, questionnaireKey, answers) {
  try {
    // Find or create assignment
    const assignment = await ProjectAssignment.findOne({ projectId, userId });
    if (!assignment) {
      throw new Error('Assignment not found. Please create assignment first.');
    }

    // Get questionnaire version
    const Questionnaire = require('../models/questionnaire');
    const questionnaire = await Questionnaire.findOne({ key: questionnaireKey, isActive: true });
    if (!questionnaire) {
      throw new Error(`Questionnaire ${questionnaireKey} not found or inactive`);
    }

    // CRITICAL DEBUG: Log incoming answers from frontend
    console.log(`📥 [DEBUG saveDraftResponse] Received ${answers?.length || 0} answers from frontend for ${questionnaireKey}`);
    if (answers && answers.length > 0) {
      answers.slice(0, 3).forEach((ans, idx) => {
        console.log(`   Answer ${idx + 1}: questionCode=${ans.questionCode}, choiceKey=${ans.answer?.choiceKey}, score=${ans.score || 'undefined'}`);
      });
    }

    // Validate and map answers
    const validatedAnswers = await validateAndMapAnswers(questionnaireKey, answers);

    // CRITICAL DEBUG: Log validated answers
    console.log(`✅ [DEBUG saveDraftResponse] Validated ${validatedAnswers?.length || 0} answers`);
    if (validatedAnswers && validatedAnswers.length > 0) {
      validatedAnswers.slice(0, 3).forEach((ans, idx) => {
        console.log(`   Validated ${idx + 1}: questionCode=${ans.questionCode}, answerScore=${ans.answerScore}, answer=${JSON.stringify(ans.answer)}`);
      });
    }

    // Save or update response
    const response = await Response.findOneAndUpdate(
      { projectId, userId, questionnaireKey },
      {
        projectId,
        assignmentId: assignment._id,
        userId,
        role: assignment.role,
        questionnaireKey,
        questionnaireVersion: questionnaire.version,
        answers: validatedAnswers,
        status: 'draft',
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    // Update assignment status
    if (assignment.status === 'assigned') {
      await ProjectAssignment.findByIdAndUpdate(assignment._id, { status: 'in_progress' });
    }

    // Recalculate and save project progress
    try {
      await calculateProjectProgress(projectId);
    } catch (progressError) {
      console.error('Failed to update project progress on draft save:', progressError);
    }

    return response;
  } catch (error) {
    throw new Error(`Failed to save draft: ${error.message}`);
  }
}

/**
 * Submit a response (finalize)
 */
async function submitResponse(projectId, userId, questionnaireKey) {
  try {
    const response = await Response.findOne({ projectId, userId, questionnaireKey, status: 'draft' });
    if (!response) {
      throw new Error('Draft response not found');
    }

    // Validate all required questions are answered
    const questions = await Question.find({
      questionnaireKey,
      required: true
    }).sort({ order: 1 });

    const answeredCodes = new Set(response.answers.map(a => a.questionCode));
    const missingRequired = questions.filter(q => !answeredCodes.has(q.code));

    if (missingRequired.length > 0) {
      throw new Error(`Missing required questions: ${missingRequired.map(q => q.code).join(', ')}`);
    }

    // Update response status
    response.status = 'submitted';
    response.submittedAt = new Date();
    await response.save();

    // Update assignment status
    const assignment = await ProjectAssignment.findOne({ projectId, userId });
    if (assignment) {
      // Check if all questionnaires are submitted
      const allResponses = await Response.find({
        projectId,
        userId,
        questionnaireKey: { $in: assignment.questionnaires }
      });
      const allSubmitted = allResponses.every(r => r.status === 'submitted');

      if (allSubmitted) {
        assignment.status = 'submitted';
        assignment.completedAt = new Date();
        await assignment.save();
      }
    }

    // Compute and save scores for THIS user immediately
    // This ensures that even if project-level scoring fails or isn't ready, the individual score exists.
    try {
      const { computeEthicalScores } = require('./ethicalScoringService');
      console.log(`📊 Computing individual scores for ${projectId}/${userId}...`);
      await computeEthicalScores(projectId, userId, questionnaireKey);
    } catch (scoreError) {
      console.error(`❌ Failed to compute individual scores for ${userId}:`, scoreError.message);
      // We do NOT rollback submission, but we log strictly.
      // Admin can re-run via script if needed.
    }

    // Check project completion for Project-Level Scoring
    // Logic: If all assigned users have submitted -> Recompute Project Scores
    try {
      const allAssigned = await ProjectAssignment.find({ projectId }).lean();
      const allSubmitted = allAssigned.every(a => a.status === 'submitted'); // Assignment status tracks responses

      if (allSubmitted) {
        console.log(`🏁 All experts submitted for project ${projectId}. Computing project-level scores...`);
        const { computeProjectEthicalScores } = require('./ethicalScoringService');
        await computeProjectEthicalScores(projectId);
      } else {
        console.log(`⏳ Project ${projectId} incomplete. Waiting for invalid experts.`);
      }
    } catch (err) {
      console.warn('⚠️ Failed to check/compute project-level scores:', err.message);
    }

    // Notify admins that evaluation is completed (non-blocking)
    try {
      const User = require('../models/User');
      const user = await User.findById(userId);
      const { notifyEvaluationCompleted, checkAndNotifyAllExpertsCompleted } = require('./notificationService');

      await notifyEvaluationCompleted(
        projectId,
        userId,
        questionnaireKey,
        response.questionnaireVersion || 1,
        assignment?.role || user?.role || 'expert',
        user?.name || user?.email || 'User'
      );

      // Check if all experts have completed and notify
      await checkAndNotifyAllExpertsCompleted(
        projectId,
        questionnaireKey,
        response.questionnaireVersion || 1
      );
    } catch (notifError) {
      console.error('Error sending evaluation completed notification:', notifError);
      // Don't fail submission if notification fails
    }

    return response;
  } catch (error) {
    throw new Error(`Failed to submit response: ${error.message}`);
  }
}

/**
 * Validate answers and compute scores
 */
async function validateAndMapAnswers(questionnaireKey, answers) {
  const questions = await Question.find({ questionnaireKey }).lean();
  const questionMap = new Map(questions.map(q => [q.code, q]));

  const validatedAnswers = [];

  for (const answer of answers) {
    const question = questionMap.get(answer.questionCode);
    if (!question) {
      throw new Error(`Question ${answer.questionCode} not found in questionnaire ${questionnaireKey}`);
    }

    let answerScore = 0;

    // Compute score based on answer type
    if (question.answerType === 'single_choice') {
      if (!answer.answer?.choiceKey) {
        throw new Error(`Missing choiceKey for question ${answer.questionCode}`);
      }

      // CRITICAL DEBUG: Log all available options
      console.log(`🔍 [DEBUG validateAndMapAnswers] Question ${answer.questionCode}: Looking for choiceKey="${answer.answer.choiceKey}"`);
      // console.log(`🔍 [DEBUG validateAndMapAnswers] Available options: ${JSON.stringify(question.options.map(o => ({ key: o.key, answerScore: o.answerScore })))}`);

      // Try exact match first
      let option = question.options.find(opt => opt.key === answer.answer.choiceKey);

      // If not found, try case-insensitive and normalize spaces/underscores
      if (!option) {
        const normalizedChoiceKey = answer.answer.choiceKey.toLowerCase().replace(/\s+/g, '_');
        option = question.options.find(opt => {
          const normalizedOptKey = opt.key.toLowerCase().replace(/\s+/g, '_');
          return normalizedOptKey === normalizedChoiceKey;
        });

        if (option) {
          console.warn(`⚠️ [WARNING validateAndMapAnswers] Question ${answer.questionCode}: Found option using normalized matching. Original: "${answer.answer.choiceKey}" → Matched: "${option.key}"`);
        }
      }

      if (!option) {
        console.error(`❌ [ERROR validateAndMapAnswers] Question ${answer.questionCode}: No matching option found for choiceKey="${answer.answer.choiceKey}". Available options: ${question.options.map(o => o.key).join(', ')}`);
        throw new Error(`Invalid choiceKey ${answer.answer.choiceKey} for question ${answer.questionCode}. Available options: ${question.options.map(o => o.key).join(', ')}`);
      }

      // CRITICAL: Strictly read answerScore. If missing, THROW ERROR.
      // Do NOT default to 0. Do NOT infer.
      if (option.answerScore === undefined || option.answerScore === null) {
        console.error(`❌ [ERROR validateAndMapAnswers] Question ${answer.questionCode}: Option "${option.key}" is missing 'answerScore'. This violates the ethical scoring model.`);
        throw new Error(`Option ${option.key} for question ${answer.questionCode} is missing required 'answerScore'. Seed data must be fixed.`);
      }

      answerScore = option.answerScore;
      console.log(`✅ [DEBUG validateAndMapAnswers] Question ${answer.questionCode}: Found option key="${option.key}", answerScore=${answerScore}`);

    } else if (question.answerType === 'multi_choice') {
      if (!answer.answer?.multiChoiceKeys || answer.answer.multiChoiceKeys.length === 0) {
        throw new Error(`Missing multiChoiceKeys for question ${answer.questionCode}`);
      }
      // Average score of selected options
      const selectedOptions = question.options.filter(opt =>
        answer.answer.multiChoiceKeys.includes(opt.key)
      );

      if (selectedOptions.length === 0) {
        throw new Error(`Invalid multiChoiceKeys for ${answer.questionCode}`);
      }

      // Check for missing answerScores in selected options
      const missingScoreOpts = selectedOptions.filter(o => o.answerScore === undefined || o.answerScore === null);
      if (missingScoreOpts.length > 0) {
        throw new Error(`Missing 'answerScore' for options: ${missingScoreOpts.map(o => o.key).join(', ')} in question ${answer.questionCode}`);
      }

      const sum = selectedOptions.reduce((acc, opt) => acc + opt.answerScore, 0);
      answerScore = sum / selectedOptions.length;

    } else if (question.answerType === 'open_text') {
      // For open_text, answerScore must be provided explicitly via manual review or rubric
      // Ideally this starts as null until reviewed. 
      // User says: "Scripts must require manual risk / answerScore input"

      if (answer.answerScore !== undefined) {
        answerScore = answer.answerScore;
      } else if (answer.score !== undefined) {
        // Backward compat or manual input from UI
        answerScore = answer.score;
      } else {
        answerScore = 0; // Default or null? User says "DO NOT default to 0". 
        // But for a new answer it might be null.
        // Let's set it to null if not provided, allowing manual scoring later
        answerScore = null;
      }

      // Handle review overrides
      if (answer.scoreFinal !== undefined) {
        answerScore = answer.scoreFinal;
      }
    } else if (question.answerType === 'numeric') {
      // Numeric questions not fully specified in prompt for mapping. 
      // Assuming they might be legacy or handled elsewhere. 
      // Setting to null to avoid invalid 0.
      answerScore = null;
    }

    validatedAnswers.push({
      questionId: question._id,
      questionCode: answer.questionCode,
      answer: answer.answer,
      answerScore: answerScore !== null ? Math.round(answerScore * 100) / 100 : null, // Store as answerScore
      // Legacy score field for compatibility if needed, otherwise ignore or set to null
      score: null,
      scoreSuggested: answer.scoreSuggested,
      scoreFinal: answer.scoreFinal,
      reviewerId: answer.reviewerId,
      notes: answer.notes,
      evidence: answer.evidence || []
    });
  }

  return validatedAnswers;
}

/**
 * Compute aggregated scores for a project/user/questionnaire
 */
/**
 * Compute aggregated scores for a project/user/questionnaire
 * DELEGATES TO ETHICAL SCORING SERVICE - STRICT MODE
 */
async function computeScores(projectId, userId = null, questionnaireKey = null) {
  // Pass-through to the single authority
  const { computeEthicalScores } = require('./ethicalScoringService');
  return await computeEthicalScores(projectId, userId, questionnaireKey);
}

/**
 * Get hotspot questions (score <= 1) for a project
 */
/**
 * Get hotspot questions (answerScore <= 0.2)
 */
async function getHotspotQuestions(projectId, questionnaireKey = null) {
  try {
    const projectIdObj = isValidObjectId(projectId)
      ? new mongoose.Types.ObjectId(projectId)
      : projectId;

    const matchStage = {
      projectId: projectIdObj,
      status: 'submitted',
      'answers.answerScore': { $lte: 0.2 } // High risk is low score (<= 0.2 is reasonable threshold for 0.0-1.0 scale, finding 0.0s)
    };

    if (questionnaireKey) {
      matchStage.questionnaireKey = questionnaireKey;
    }

    // Ensure we select answerScore so we can check it
    const responses = await Response.find(matchStage);
    const hotspots = [];

    for (const response of responses) {
      for (const answer of response.answers) {
        // Strict check: answerScore must be present and <= threshold
        if (answer.answerScore !== undefined && answer.answerScore !== null && answer.answerScore <= 0.2) {
          hotspots.push({
            projectId: response.projectId,
            userId: response.userId,
            role: response.role,
            questionnaireKey: response.questionnaireKey,
            questionCode: answer.questionCode,
            answerScore: answer.answerScore, // Use explicit answerScore
            answer: answer.answer
          });
        }
      }
    }

    return hotspots;
  } catch (error) {
    throw new Error(`Failed to get hotspots: ${error.message}`);
  }
}

/**
 * Ensure all assigned questions are present in response, even if unanswered
 * This is called when saving answers to ensure data integrity
 */
async function ensureAllQuestionsPresent(projectId, userId, questionnaireKey) {
  try {
    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // Get all questions for this questionnaire
    const questions = await Question.find({ questionnaireKey }).sort({ order: 1 }).lean();

    // Get existing response
    const response = await Response.findOne({
      projectId: projectIdObj,
      userId: userIdObj,
      questionnaireKey
    });

    if (!response) {
      // Response should have been initialized, but if not, initialize it now
      const assignment = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj });
      if (!assignment) {
        throw new Error('Assignment not found');
      }

      const Questionnaire = require('../models/questionnaire');
      const questionnaire = await Questionnaire.findOne({ key: questionnaireKey, isActive: true });
      if (!questionnaire) {
        throw new Error(`Questionnaire ${questionnaireKey} not found`);
      }

      const unansweredAnswers = questions.map(question => ({
        questionId: question._id,
        questionCode: question.code,
        answer: null,
        answerScore: null, // Default score for unanswered questions must be null to avoid skewing risk
        notes: null,
        evidence: []
      }));

      await Response.create({
        projectId: projectIdObj,
        assignmentId: assignment._id,
        userId: userIdObj,
        role: assignment.role,
        questionnaireKey: questionnaireKey,
        questionnaireVersion: questionnaire.version,
        answers: unansweredAnswers,
        status: 'draft',
        updatedAt: new Date()
      });

      return;
    }

    // Check for missing questions
    const existingQuestionCodes = new Set(response.answers.map(a => a.questionCode));
    const missingQuestions = questions.filter(q => !existingQuestionCodes.has(q.code));

    if (missingQuestions.length > 0) {
      const unansweredAnswers = missingQuestions.map(question => ({
        questionId: question._id,
        questionCode: question.code,
        answer: null,
        answerScore: null, // Default score for unanswered questions must be null
        notes: null,
        evidence: []
      }));

      response.answers.push(...unansweredAnswers);
      await response.save();
      console.log(`✅ Added ${missingQuestions.length} missing questions to response for ${questionnaireKey}`);
    }
  } catch (error) {
    console.error(`❌ Error ensuring all questions present: ${error.message}`);
    throw error;
  }
}

/**
 * Validate that all required questions are answered before submission
 */
async function validateSubmission(projectId, userId, questionnaireKey) {
  try {
    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // Get response
    const response = await Response.findOne({
      projectId: projectIdObj,
      userId: userIdObj,
      questionnaireKey
    });

    if (!response) {
      throw new Error('Response not found');
    }

    // Get all required questions
    const requiredQuestions = await Question.find({
      questionnaireKey,
      required: true
    }).lean();

    // Check which required questions are answered
    const answeredQuestionCodes = new Set();
    response.answers.forEach(answer => {
      // Check if answer is actually answered (not null)
      if (answer.answer !== null && answer.answer !== undefined) {
        // Check if answer has content
        const hasContent =
          (answer.answer.choiceKey !== null && answer.answer.choiceKey !== undefined) ||
          (answer.answer.text !== null && answer.answer.text !== undefined && answer.answer.text.trim() !== '') ||
          (answer.answer.numeric !== null && answer.answer.numeric !== undefined) ||
          (answer.answer.multiChoiceKeys && answer.answer.multiChoiceKeys.length > 0);

        if (hasContent) {
          answeredQuestionCodes.add(answer.questionCode);
        }
      }
    });

    // Find missing required questions
    const missingRequired = requiredQuestions.filter(q => !answeredQuestionCodes.has(q.code));

    if (missingRequired.length > 0) {
      throw new Error(`Missing required questions: ${missingRequired.map(q => q.code).join(', ')}`);
    }

    // Validate data integrity: all assigned questions should be present
    const allQuestions = await Question.find({ questionnaireKey }).lean();
    const responseQuestionCodes = new Set(response.answers.map(a => a.questionCode));
    const missingQuestions = allQuestions.filter(q => !responseQuestionCodes.has(q.code));

    if (missingQuestions.length > 0) {
      console.error(`⚠️ DATA INTEGRITY WARNING: ${missingQuestions.length} assigned questions missing from response: ${missingQuestions.map(q => q.code).join(', ')}`);
      // Auto-fix: add missing questions as unanswered
      await ensureAllQuestionsPresent(projectId, userId, questionnaireKey);
    }

    return true;
  } catch (error) {
    throw new Error(`Validation failed: ${error.message}`);
  }
}

/**
 * Calculate project progress based on current assignments and individual user progress
 * Single source of truth for progress calculation
 * Formula: Average of individual user progress (answered questions / total questions for each user)
 * 
 * This matches the calculation used in ProjectDetail component:
 * - Each user's progress is calculated individually (answered/total questions)
 * - Project progress = average of all assigned users' individual progress
 * 
 * @param {string|ObjectId} projectId - Project ID
 * @returns {Promise<number>} Progress percentage (0-100)
 */
async function calculateProjectProgress_OLD(projectId) {
  try {
    const Question = require('../models/question');
    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;

    // Get all current assignments for this project (single source of truth)
    const assignments = await ProjectAssignment.find({ projectId: projectIdObj }).lean();

    if (assignments.length === 0) {
      return 0; // No assignments = 0% progress
    }

    // Collect all unique questionnaire keys
    const allQuestionnaireKeys = new Set();
    assignments.forEach(a => {
      if (a.questionnaires && Array.isArray(a.questionnaires)) {
        a.questionnaires.forEach(q => allQuestionnaireKeys.add(q));
      }
    });

    // Pre-fetch all questions for all questionnaires (optimization)
    const allQuestions = await Question.find({
      questionnaireKey: { $in: Array.from(allQuestionnaireKeys) }
    }).select('questionnaireKey').lean();

    // Group questions by questionnaire key
    const questionsByQuestionnaire = {};
    allQuestions.forEach(q => {
      if (!questionsByQuestionnaire[q.questionnaireKey]) {
        questionsByQuestionnaire[q.questionnaireKey] = [];
      }
      questionsByQuestionnaire[q.questionnaireKey].push(q);
    });

    // Get all responses for all assigned users in one query
    const assignedUserIds = assignments.map(a => a.userId);
    const allResponses = await Response.find({
      projectId: projectIdObj,
      userId: { $in: assignedUserIds }
    }).select('userId questionnaireKey answers').lean();

    // Group responses by userId and questionnaireKey
    const responsesByUser = {};
    allResponses.forEach(r => {
      const userIdStr = r.userId.toString();
      if (!responsesByUser[userIdStr]) {
        responsesByUser[userIdStr] = {};
      }
      responsesByUser[userIdStr][r.questionnaireKey] = r;
    });

    // OPTIMIZATION: Batch fetch all Evaluations for custom questions (Avoid N+1 query in loop)
    let Evaluation;
    try {
      Evaluation = mongoose.model('Evaluation');
    } catch (e) {
      Evaluation = require('../models/evaluation');
    }

    const allEvaluations = await Evaluation.find({
      projectId: projectIdObj,
      userId: { $in: assignedUserIds }
    }).select('userId customQuestions answers').lean();

    const evaluationsByUser = {};
    allEvaluations.forEach(e => {
      if (e.userId) {
        evaluationsByUser[e.userId.toString()] = e;
      }
    });

    // Calculate individual progress for each assigned user
    let totalProgress = 0;
    let validUserCount = 0;

    for (const assignment of assignments) {
      const userId = assignment.userId;
      const userIdStr = userId.toString();
      const questionnaires = assignment.questionnaires || [];

      if (questionnaires.length === 0) {
        continue; // No questionnaires assigned, skip
      }

      // Calculate total questions and answered questions across all questionnaires
      let totalQuestions = 0;
      let answeredQuestions = 0;

      const userResponses = responsesByUser[userIdStr] || {};

      // Check which questionnaires actually have responses in the database
      // userResponses is an object where keys are questionnaire keys and values are response objects
      const existingQuestionnaireKeys = new Set(Object.keys(userResponses).filter(key => userResponses[key]));

      let questionnairesToCount = questionnaires.slice();

      // Count questions and answers for all questionnaires
      for (const qKey of questionnairesToCount) {
        // Get total questions for this questionnaire
        const questions = questionsByQuestionnaire[qKey] || [];
        totalQuestions += questions.length;
      }

      // Count answered questions from ALL assigned questionnaires
      for (const qKey of questionnaires) {
        const response = userResponses[qKey];
        if (response && response.answers && Array.isArray(response.answers)) {
          // Count answered questions (those with actual answers)
          const answered = response.answers.filter(a => {
            if (!a.answer) return false;
            const ans = a.answer;
            return (ans.choiceKey !== null && ans.choiceKey !== undefined && ans.choiceKey !== '') ||
              (ans.text !== null && ans.text !== undefined && String(ans.text).trim().length > 0) ||
              (ans.numeric !== null && ans.numeric !== undefined) ||
              (Array.isArray(ans.multiChoiceKeys) && ans.multiChoiceKeys.length > 0);
          }).length;
          answeredQuestions += answered;
        }
      }

      // Get custom questions from pre-fetched map (Optimized)
      const evaluation = evaluationsByUser[userIdStr];

      const customQuestions = evaluation?.customQuestions || [];
      let customQuestionsTotal = 0;
      let customQuestionsAnswered = 0;

      for (const customQuestion of customQuestions) {
        if (customQuestion.required !== false) {
          customQuestionsTotal++;
          const customQuestionId = customQuestion.id;
          if (customQuestionId && evaluation?.answers) {
            const customAnswer = evaluation.answers[customQuestionId];
            if (customAnswer !== undefined && customAnswer !== null) {
              if (typeof customAnswer === 'string' && customAnswer.trim().length > 0) {
                customQuestionsAnswered++;
              } else if (typeof customAnswer !== 'string') {
                customQuestionsAnswered++;
              }
            }
          }
        }
      }

      // Total = regular questions + custom questions
      const totalWithCustom = totalQuestions + customQuestionsTotal;
      const answeredWithCustom = answeredQuestions + customQuestionsAnswered;

      if (totalWithCustom > 0) {
        const userProgress = (answeredWithCustom / totalWithCustom) * 100;
        totalProgress += userProgress;
        validUserCount++;
      }
    }

    // Calculate average progress across all assigned users (same as ProjectDetail)
    const progress = validUserCount > 0
      ? Math.round(totalProgress / validUserCount)
      : 0;

    const finalProgress = Math.max(0, Math.min(100, progress));

    // Save to Project model (using mongoose.model since Project isn't in a separate file)
    try {
      const Project = mongoose.model('Project');
      await Project.findByIdAndUpdate(projectIdObj, { progress: finalProgress });
    } catch (updateError) {
      console.error('Error updating project progress in DB:', updateError);
    }

    return finalProgress;
  } catch (error) {
    console.error('Error calculating project progress:', error);
    return 0; // Return 0 on error
  }
}


// NEW: Corrected Project Progress Calculation (Matching /api/user-progress logic)
async function calculateProjectProgress(projectId) {
  try {
    const projectIdObj = (typeof projectId === 'string') ? new mongoose.Types.ObjectId(projectId) : projectId;

    // Import required models
    const Project = mongoose.model('Project');
    const ProjectAssignment = mongoose.model('ProjectAssignment');
    const Question = mongoose.model('Question');
    const Response = mongoose.model('Response');
    const User = mongoose.model('User');
    const Evaluation = mongoose.model('Evaluation');

    // 1. Get assignments for this project
    const assignments = await ProjectAssignment.find({ projectId: projectIdObj }).lean();

    if (!assignments || assignments.length === 0) {
      await Project.findByIdAndUpdate(projectIdObj, { progress: 0 });
      return 0;
    }

    let totalUserProgressSum = 0;
    let validUserCount = 0;

    // 2. Iterate through each assignment to calculate individual user progress
    for (const assignment of assignments) {
      // SKIP admins and use-case-owners from the AVERAGE calculation
      if (assignment.role === 'admin') continue;
      if (assignment.role === 'use-case-owner' || assignment.role === 'usecaseowner') continue;

      // Double check user role from User collection
      const user = await User.findById(assignment.userId).select('role').lean();
      if (!user) continue;
      if (user.role === 'admin' || user.role === 'use-case-owner' || user.role.includes('use-case-owner')) continue;

      const assignedQuestionnaireKeys = assignment.questionnaires || [];
      if (assignedQuestionnaireKeys.length === 0) continue;

      // 3. Count total assigned questions for this user
      const totalAssigned = await Question.countDocuments({
        questionnaireKey: { $in: assignedQuestionnaireKeys }
      });

      if (totalAssigned === 0) {
        continue;
      }

      // 4. Get all responses for this user and project
      const responses = await Response.find({
        projectId: projectIdObj,
        userId: assignment.userId,
        questionnaireKey: { $in: assignedQuestionnaireKeys }
      }).select('answers.questionCode answers.answer').lean();

      // 5. Count answered questions
      let answeredCount = 0;
      const answeredQuestionCodes = new Set();

      responses.forEach(response => {
        if (response.answers && Array.isArray(response.answers)) {
          response.answers.forEach(answer => {
            if (!answer.questionCode) return;
            if (answeredQuestionCodes.has(answer.questionCode)) return;

            let hasAnswer = false;
            // Robust check for answer content matching server.js logic
            if (answer.answer) {
              if (answer.answer.choiceKey !== null && answer.answer.choiceKey !== undefined && answer.answer.choiceKey !== '') {
                hasAnswer = true;
              } else if (answer.answer.text !== null && answer.answer.text !== undefined && String(answer.answer.text).trim().length > 0) {
                hasAnswer = true;
              } else if (answer.answer.numeric !== null && answer.answer.numeric !== undefined) {
                hasAnswer = true;
              } else if (answer.answer.multiChoiceKeys && Array.isArray(answer.answer.multiChoiceKeys) && answer.answer.multiChoiceKeys.length > 0) {
                hasAnswer = true;
              }
            }

            if (hasAnswer) {
              answeredQuestionCodes.add(answer.questionCode);
              answeredCount++;
            }
          });
        }
      });

      // 6. Custom questions logic
      let customQuestionsTotal = 0;
      let customQuestionsAnswered = 0;

      const evaluation = await Evaluation.findOne({
        projectId: projectIdObj,
        userId: assignment.userId
      }).select('customQuestions answers').lean();

      if (evaluation && evaluation.customQuestions && evaluation.customQuestions.length > 0) {
        customQuestionsTotal = evaluation.customQuestions.length;
        if (evaluation.answers) {
          for (const q of evaluation.customQuestions) {
            const customAns = evaluation.answers[q.id];
            if (customAns !== undefined && customAns !== null) {
              if (typeof customAns === 'string' && customAns.trim().length > 0) customQuestionsAnswered++;
              else if (typeof customAns !== 'string') customQuestionsAnswered++;
            }
          }
        }
      }

      const finalTotal = totalAssigned + customQuestionsTotal;
      const finalAnswered = answeredCount + customQuestionsAnswered;

      if (finalTotal > 0) {
        const userProgress = (finalAnswered / finalTotal) * 100;
        totalUserProgressSum += userProgress;
        validUserCount++;
      }
    }

    // 7. Calculate average progress
    const progress = validUserCount > 0
      ? Math.round(totalUserProgressSum / validUserCount)
      : 0;

    const finalProgress = Math.max(0, Math.min(100, progress));

    // Save to Project model
    await Project.findByIdAndUpdate(projectIdObj, { progress: finalProgress });
    console.log(`✅ Project ${projectIdObj} progress updated: ${finalProgress}% (Users: ${validUserCount})`);

    return finalProgress;
  } catch (error) {
    console.error('Error calculating project progress:', error);
    return 0;
  }
}

module.exports = {
  createAssignment,
  saveDraftResponse,
  submitResponse,
  computeScores,
  getHotspotQuestions,
  initializeResponses,
  ensureAllQuestionsPresent,
  validateSubmission,
  calculateProjectProgress
};

