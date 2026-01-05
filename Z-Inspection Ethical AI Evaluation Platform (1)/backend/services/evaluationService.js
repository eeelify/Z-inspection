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
            score: null, // Unanswered questions should have null score (will be filtered out in computeScores)
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
          score: null, // Unanswered questions should have null score (will be filtered out in computeScores)
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
        console.log(`   Validated ${idx + 1}: questionCode=${ans.questionCode}, score=${ans.score}, answer=${JSON.stringify(ans.answer)}`);
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

    // Compute and save scores using new ethical scoring system
    const { computeEthicalScores } = require('./ethicalScoringService');
    await computeEthicalScores(projectId, userId, questionnaireKey);
    
    // Also compute project-level scores if this is the last questionnaire for this user
    // (This is a simple trigger - in production you might want a more sophisticated approach)
    try {
      const { computeProjectEthicalScores } = require('./ethicalScoringService');
      await computeProjectEthicalScores(projectId);
    } catch (err) {
      console.warn('Failed to compute project-level scores:', err.message);
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

    let score = 0;

    // Compute score based on answer type
    if (question.answerType === 'single_choice') {
      if (!answer.answer?.choiceKey) {
        throw new Error(`Missing choiceKey for question ${answer.questionCode}`);
      }
      
      // CRITICAL DEBUG: Log all available options
      console.log(`🔍 [DEBUG validateAndMapAnswers] Question ${answer.questionCode}: Looking for choiceKey="${answer.answer.choiceKey}"`);
      console.log(`🔍 [DEBUG validateAndMapAnswers] Available options: ${JSON.stringify(question.options.map(o => ({ key: o.key, score: o.score })))}`);
      
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
      
      // CRITICAL DEBUG: Log option score values
      console.log(`✅ [DEBUG validateAndMapAnswers] Question ${answer.questionCode}: Found option key="${option.key}", score=${option.score}`);
      
      score = option.score !== undefined ? option.score : 0;
      
      // WARNING: If score is 0 but option exists, it might be incorrectly set
      if (score === 0 && option) {
        console.warn(`⚠️ [WARNING validateAndMapAnswers] Question ${answer.questionCode}: Selected option "${answer.answer.choiceKey}" → "${option.key}" has score=0. This might be correct (MINIMAL risk) or incorrect (missing score).`);
      }
    } else if (question.answerType === 'multi_choice') {
      if (!answer.answer?.multiChoiceKeys || answer.answer.multiChoiceKeys.length === 0) {
        throw new Error(`Missing multiChoiceKeys for question ${answer.questionCode}`);
      }
      // Average score of selected options
      const selectedOptions = question.options.filter(opt => 
        answer.answer.multiChoiceKeys.includes(opt.key)
      );
      if (selectedOptions.length > 0) {
        score = selectedOptions.reduce((sum, opt) => sum + (opt.score || 0), 0) / selectedOptions.length;
      }
    } else if (question.answerType === 'open_text') {
      // For open_text, score must be provided explicitly
      score = answer.score !== undefined ? answer.score : 0;
      if (answer.scoreSuggested !== undefined) {
        score = answer.scoreSuggested; // Use suggested if provided
      }
      if (answer.scoreFinal !== undefined) {
        score = answer.scoreFinal; // Final score overrides
      }
    } else if (question.answerType === 'numeric') {
      // For numeric, map to 0-4 scale (implementation depends on question definition)
      score = answer.answer?.numeric !== undefined ? answer.answer.numeric : 0;
    }

    validatedAnswers.push({
      questionId: question._id,
      questionCode: answer.questionCode,
      answer: answer.answer,
      score: Math.round(score * 100) / 100, // Round to 2 decimals
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
async function computeScores(projectId, userId = null, questionnaireKey = null) {
  try {
    const matchStage = { 
      projectId: isValidObjectId(projectId) 
        ? new mongoose.Types.ObjectId(projectId) 
        : projectId,
      status: { $in: ['draft', 'submitted'] } // Include both draft and submitted responses
    };

    if (userId) {
      matchStage.userId = isValidObjectId(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;
    }

    if (questionnaireKey) {
      matchStage.questionnaireKey = questionnaireKey;
    }

    // Get all submitted responses
    const responses = await Response.find(matchStage).populate('answers.questionId');

    if (responses.length === 0) {
      return null;
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
      grouped[key].answers.push(...response.answers);
    }

    // Compute scores for each group
    const scores = [];
    for (const key in grouped) {
      const group = grouped[key];
      const scoresByPrinciple = {};
      const allScores = [];

      // Group answers by principle and build byQuestion array
      const byQuestion = [];
      console.log(`📊 [DEBUG computeScores] Processing ${group.answers.length} answers for userId=${group.userId}, role=${group.role}`);
      
      for (const answer of group.answers) {
        const question = await Question.findById(answer.questionId);
        if (!question) {
          console.warn(`⚠️ [DEBUG computeScores] Question not found for answer.questionId=${answer.questionId}`);
          continue;
        }

        let principle = question.principle;
        
        // CRITICAL: Map legal/role-specific principle names to CANONICAL_PRINCIPLES
        // This ensures that all principle scores are aggregated correctly
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
        
        // Map to canonical principle if needed
        if (principleMapping[principle]) {
          const mappedPrinciple = principleMapping[principle];
          console.log(`🔄 [DEBUG computeScores] Mapping principle "${principle}" → "${mappedPrinciple}" for question ${question.code}`);
          principle = mappedPrinciple;
        }
        
        // CRITICAL: Skip unanswered questions (answer.answer === null or empty)
        // Unanswered questions should NOT be included in score calculations
        const isUnanswered = 
          answer.answer === null || 
          answer.answer === undefined ||
          (typeof answer.answer === 'object' && answer.answer !== null && Object.keys(answer.answer).length === 0) ||
          (answer.answer && typeof answer.answer === 'object' && 
           !answer.answer.choiceKey && 
           !answer.answer.text && 
           !answer.answer.numeric && 
           (!answer.answer.multiChoiceKeys || answer.answer.multiChoiceKeys.length === 0));
        
        if (isUnanswered) {
          console.log(`⏭️ [DEBUG computeScores] Skipping unanswered question ${question.code} (${principle}): answer.answer is null/empty`);
          continue;
        }
        
        // CRITICAL DEBUG: Log answer score values
        console.log(`📊 [DEBUG computeScores] Question ${question.code} (${principle}): answer.score=${answer.score}, answer.answer=${JSON.stringify(answer.answer)}`);
        
        // Filter out null/undefined/NaN scores
        if (answer.score === null || answer.score === undefined || isNaN(answer.score)) {
          console.warn(`⚠️ [DEBUG computeScores] Skipping invalid score for question ${question.code}: ${answer.score}`);
          continue;
        }
        
        if (!scoresByPrinciple[principle]) {
          scoresByPrinciple[principle] = [];
        }
        scoresByPrinciple[principle].push(answer.score);
        allScores.push(answer.score);
        
        // Add to byQuestion array for analytics
        byQuestion.push({
          questionId: answer.questionId,
          principleKey: principle,
          score: answer.score,
          weight: question.weight || 1,
          isNA: answer.score === null || answer.score === undefined || isNaN(answer.score)
        });
      }

      // Calculate averages
      const byPrinciple = {};
      for (const principle in scoresByPrinciple) {
        const principleScores = scoresByPrinciple[principle];
        const avg = principleScores.reduce((a, b) => a + b, 0) / principleScores.length;
        const min = Math.min(...principleScores);
        const max = Math.max(...principleScores);
        
        console.log(`📊 [DEBUG computeScores] Principle "${principle}": scores=[${principleScores.join(', ')}], avg=${avg.toFixed(2)}, n=${principleScores.length}, min=${min}, max=${max}`);
        
        byPrinciple[principle] = {
          avg: Math.round(avg * 100) / 100, // Round to 2 decimal places
          n: principleScores.length,
          min: min,
          max: max
        };
      }
      
      console.log(`📊 [DEBUG computeScores] Final byPrinciple object:`, JSON.stringify(byPrinciple, null, 2));

      const totalAvg = allScores.length > 0 
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
        : 0;

      const scoreDoc = {
        projectId,
        userId: group.userId,
        role: group.role,
        questionnaireKey: group.questionnaireKey,
        computedAt: new Date(),
        totals: {
          avg: totalAvg,
          min: Math.min(...allScores),
          max: Math.max(...allScores),
          n: allScores.length
        },
        byPrinciple,
        byQuestion // Store per-question scores for analytics
      };

      // Save or update score
      const savedScore = await Score.findOneAndUpdate(
        { projectId, userId: group.userId, questionnaireKey: group.questionnaireKey },
        scoreDoc,
        { new: true, upsert: true }
      );
      
      console.log(`✅ [DEBUG computeScores] Saved Score document: _id=${savedScore._id}, byPrinciple keys: [${Object.keys(savedScore.byPrinciple || {}).join(', ')}]`);
      console.log(`📊 [DEBUG computeScores] Saved Score byPrinciple content:`, JSON.stringify(savedScore.byPrinciple, null, 2));

      scores.push(scoreDoc);
    }

    return scores;
  } catch (error) {
    throw new Error(`Failed to compute scores: ${error.message}`);
  }
}

/**
 * Get hotspot questions (score <= 1) for a project
 */
async function getHotspotQuestions(projectId, questionnaireKey = null) {
  try {
    const projectIdObj = isValidObjectId(projectId) 
      ? new mongoose.Types.ObjectId(projectId) 
      : projectId;
    
    const matchStage = {
      projectId: projectIdObj,
      status: 'submitted',
      'answers.score': { $lte: 1 }
    };

    if (questionnaireKey) {
      matchStage.questionnaireKey = questionnaireKey;
    }

    const responses = await Response.find(matchStage);
    const hotspots = [];

    for (const response of responses) {
      for (const answer of response.answers) {
        if (answer.score <= 1) {
          hotspots.push({
            projectId: response.projectId,
            userId: response.userId,
            role: response.role,
            questionnaireKey: response.questionnaireKey,
            questionCode: answer.questionCode,
            score: answer.score,
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
        score: 2, // Default score for unanswered questions (required field)
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
        score: 2, // Default score for unanswered questions (required field)
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
async function calculateProjectProgress(projectId) {
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
    }).lean();
    
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
    }).lean();
    
    // Group responses by userId and questionnaireKey
    const responsesByUser = {};
    allResponses.forEach(r => {
      const userIdStr = r.userId.toString();
      if (!responsesByUser[userIdStr]) {
        responsesByUser[userIdStr] = {};
      }
      responsesByUser[userIdStr][r.questionnaireKey] = r;
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
      const hasGeneralResponse = existingQuestionnaireKeys.has('general-v1');
      const hasRoleSpecificResponse = questionnaires.some(key => 
        key.includes('-expert-v1') && existingQuestionnaireKeys.has(key)
      );
      
      // If both general-v1 and role-specific responses exist, count both
      // If only role-specific exists and has 30+ questions, it likely includes general questions
      if (!hasGeneralResponse && hasRoleSpecificResponse) {
        const roleSpecificKey = questionnaires.find(key => 
          key.includes('-expert-v1') && existingQuestionnaireKeys.has(key)
        );
        
        if (roleSpecificKey) {
          const roleSpecificQuestions = questionsByQuestionnaire[roleSpecificKey] || [];
          if (roleSpecificQuestions.length >= 30) {
            questionnairesToCount = questionnairesToCount.filter(key => key !== 'general-v1');
          }
        }
      }
      
      // Count questions and answers for all questionnaires (use questionnairesToCount for question count)
      for (const qKey of questionnairesToCount) {
        // Get total questions for this questionnaire
        const questions = questionsByQuestionnaire[qKey] || [];
        totalQuestions += questions.length;
      }
      
      // Count answered questions from ALL assigned questionnaires (not just questionnairesToCount)
      // This ensures we count answers from both general-v1 and role-specific responses
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
      
      // Also check custom questions from Evaluation
      // Evaluation model is defined in server.js, we need to get it from mongoose
      // Try to get it from mongoose models, fallback to require if needed
      let Evaluation;
      try {
        Evaluation = mongoose.model('Evaluation');
      } catch (e) {
        // If model not registered, try to require it
        Evaluation = require('../models/evaluation');
      }
      const evaluation = await Evaluation.findOne({
        projectId: projectIdObj,
        userId: userId
      }).select('customQuestions answers').lean();
      
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
    
    return Math.max(0, Math.min(100, progress)); // Clamp between 0-100
  } catch (error) {
    console.error('Error calculating project progress:', error);
    return 0; // Return 0 on error
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

