const express = require('express');
const router = express.Router();
const {
  createAssignment,
  saveDraftResponse,
  submitResponse,
  computeScores,
  getHotspotQuestions
} = require('../services/evaluationService');
const {
  projectLevelScoresByPrinciple,
  roleLevelScoresByPrinciple,
  hotspotQuestions,
  expertCompletionStatus
} = require('../services/aggregationPipelines');
const Response = require('../models/response');
const ProjectAssignment = require('../models/projectAssignment');
const Question = require('../models/question');
const Questionnaire = require('../models/questionnaire');

// Cache for questions (similar to use-case-questions)
const questionsCache = new Map(); // Map<questionnaireKey-role, {data, time}>
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Create or update assignment
 * POST /api/evaluations/assignments
 */
router.post('/assignments', async (req, res) => {
  try {
    const { projectId, userId, role, questionnaires, actorId, actorRole } = req.body;

    // PHASE 4/5: Role Cardinality Guard
    if (role === 'ethical-expert') {
      const { ETHICAL_EXPERT_CARDINALITY } = require('../config/roles.config');
      const mongoose = require('mongoose');

      console.log(`🔒 [PHASE 4/5] Checking ethical-expert cardinality for project ${projectId}...`);

      const projectIdObj = mongoose.Types.ObjectId(projectId);
      const existingCount = await ProjectAssignment.countDocuments({
        projectId: projectIdObj,
        role: 'ethical-expert'
      });

      console.log(`📊 [PHASE 4/5] Current ethical-expert count: ${existingCount}`);
      console.log(`📏 [PHASE 4/5] Maximum allowed: ${ETHICAL_EXPERT_CARDINALITY.max}`);

      if (existingCount >= ETHICAL_EXPERT_CARDINALITY.max) {
        console.log(`❌ [PHASE 4/5] BLOCKED: Cannot assign duplicate ethical-expert`);

        return res.status(400).json({
          success: false,
          error: 'ROLE_CARDINALITY_EXCEEDED',
          message: `Only ${ETHICAL_EXPERT_CARDINALITY.max} ethical-expert allowed per project (Ethical AI Analysis methodology requirement)`,
          details: {
            role: 'ethical-expert',
            currentCount: existingCount,
            maxAllowed: ETHICAL_EXPERT_CARDINALITY.max,
            projectId: projectId
          },
          action: 'Remove existing ethical-expert before assigning a new one, or assign a different role'
        });
      }

      console.log(`✅ [PHASE 4/5] Cardinality check PASSED - proceeding with assignment`);
    }

    // actorId and actorRole are optional - if not provided, assume it's an admin action
    // In a real scenario, you'd get this from req.user (authentication middleware)
    const assignment = await createAssignment(
      projectId,
      userId,
      role,
      questionnaires,
      actorId || null,
      actorRole || 'admin'
    );
    res.json(assignment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Save draft response
 * POST /api/evaluations/responses/draft
 */
router.post('/responses/draft', async (req, res) => {
  try {
    const { projectId, userId, questionnaireKey, answers } = req.body;
    const response = await saveDraftResponse(projectId, userId, questionnaireKey, answers);
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Submit response
 * POST /api/evaluations/responses/submit
 */
router.post('/responses/submit', async (req, res) => {
  try {
    const { projectId, userId, questionnaireKey } = req.body;
    const response = await submitResponse(projectId, userId, questionnaireKey);
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get response
 * GET /api/evaluations/responses
 */
router.get('/responses', async (req, res) => {
  try {
    const { projectId, userId, questionnaireKey } = req.query;

    if (!projectId || !userId || !questionnaireKey) {
      return res.status(400).json({ error: 'projectId, userId, and questionnaireKey are required' });
    }

    const mongoose = require('mongoose');
    const isValidObjectId = (id) => {
      if (!id) return false;
      try {
        return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id.toString();
      } catch {
        return false;
      }
    };

    // Convert to ObjectId if valid
    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    console.log(`📥 GET /api/evaluations/responses: projectId=${projectId}, userId=${userId}, questionnaireKey=${questionnaireKey}`);

    const response = await Response.findOne({
      projectId: projectIdObj,
      userId: userIdObj,
      questionnaireKey: questionnaireKey
    })
      .populate('answers.questionId', 'code text answerType options')
      .lean();

    if (response) {
      console.log(`✅ Found response with ${response.answers?.length || 0} answers`);
      // Ensure answers array exists
      if (!response.answers) {
        response.answers = [];
      }
    } else {
      console.log(`⚠️ No response found for projectId=${projectId}, userId=${userId}, questionnaireKey=${questionnaireKey}`);
    }

    res.json(response || null);
  } catch (error) {
    console.error('❌ Error fetching response:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get questions for a questionnaire
 * GET /api/evaluations/questions
 */
router.get('/questions', async (req, res) => {
  try {
    const { questionnaireKey, role } = req.query;
    const query = { questionnaireKey };

    // Return ALL questions for the questionnaire (no role filtering, no cache to avoid stale data)
    const questions = await Question.find(query)
      .select('code principle principleLabel text answerType options scoring required order description appliesToRoles') // Added mostly useful fields for UI
      .sort({ order: 1 })
      .lean()
      .maxTimeMS(5000); // 5 second timeout for query

    console.log(`📡 Returning ${questions.length} questions for ${questionnaireKey}. Codes: ${questions.map(q => q.code).join(', ')}`);

    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add a new question to a questionnaire
 * POST /api/evaluations/questions
 */
router.post('/questions', async (req, res) => {
  try {
    const questionData = req.body;

    // Auto increment order if not provided
    if (questionData.order === undefined || questionData.order === null) {
      const highestOrderQ = await Question.findOne({ questionnaireKey: questionData.questionnaireKey })
        .sort({ order: -1 })
        .select('order');
      questionData.order = highestOrderQ ? highestOrderQ.order + 1 : 1;
    }

    const newQuestion = new Question(questionData);
    await newQuestion.save();

    // Clear cache
    const keysToDelete = [];
    for (const key of questionsCache.keys()) {
      if (key.startsWith(`${questionData.questionnaireKey}-`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => questionsCache.delete(key));

    res.status(201).json(newQuestion);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A question with this code already exists in the selected questionnaire.' });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * Update an existing question
 * PUT /api/evaluations/questions/:id
 */
router.put('/questions/:id', async (req, res) => {
  try {
    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Clear cache
    const keysToDelete = [];
    for (const key of questionsCache.keys()) {
      if (key.startsWith(`${updatedQuestion.questionnaireKey}-`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => questionsCache.delete(key));

    res.json(updatedQuestion);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A question with this code already exists in the selected questionnaire.' });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * Delete a question
 * DELETE /api/evaluations/questions/:id
 */
router.delete('/questions/:id', async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    await Question.findByIdAndDelete(req.params.id);

    // Clear cache
    const keysToDelete = [];
    for (const key of questionsCache.keys()) {
      if (key.startsWith(`${question.questionnaireKey}-`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => questionsCache.delete(key));

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear questions cache (for admin use when questions are updated)
 * POST /api/evaluations/questions/clear-cache
 */
router.post('/questions/clear-cache', (req, res) => {
  try {
    const { questionnaireKey } = req.body;

    if (questionnaireKey) {
      // Clear specific questionnaire cache
      const keysToDelete = [];
      for (const key of questionsCache.keys()) {
        if (key.startsWith(`${questionnaireKey}-`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => questionsCache.delete(key));
      res.json({ message: `Cleared cache for ${questionnaireKey}`, cleared: keysToDelete.length });
    } else {
      // Clear all cache
      const size = questionsCache.size;
      questionsCache.clear();
      res.json({ message: 'Cleared all questions cache', cleared: size });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Compute scores
 * POST /api/evaluations/scores/compute
 */
router.post('/scores/compute', async (req, res) => {
  try {
    const { projectId, userId, questionnaireKey } = req.body;
    // Use new ethical scoring system
    const { computeEthicalScores } = require('../services/ethicalScoringService');
    const scores = await computeEthicalScores(projectId, userId, questionnaireKey);
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get project-level scores by principle
 * GET /api/evaluations/scores/project/:projectId
 */
router.get('/scores/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { questionnaireKey } = req.query;
    const pipeline = projectLevelScoresByPrinciple(projectId, questionnaireKey);
    const scores = await Response.aggregate(pipeline);
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get role-level scores by principle
 * GET /api/evaluations/scores/role/:projectId
 */
router.get('/scores/role/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { questionnaireKey } = req.query;
    const pipeline = roleLevelScoresByPrinciple(projectId, questionnaireKey);
    const scores = await Response.aggregate(pipeline);
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get hotspot questions
 * GET /api/evaluations/hotspots/:projectId
 */
router.get('/hotspots/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { questionnaireKey, threshold } = req.query;
    const hotspots = await getHotspotQuestions(projectId, questionnaireKey);
    res.json(hotspots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get expert completion status
 * GET /api/evaluations/completion/:projectId
 */
router.get('/completion/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const pipeline = expertCompletionStatus(projectId);
    const status = await Response.aggregate(pipeline);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

