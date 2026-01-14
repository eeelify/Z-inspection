/**
 * Backfill Script: Recompute all scores using RPN model
 * 
 * G) Recompute scores for all existing projects and overwrite prior scores docs
 * 
 * This script:
 * 1. Finds all projects with responses
 * 2. For each project, recomputes scores using RPN model
 * 3. Overwrites existing scores with new RPN-based scores
 * 
 * Usage: node backend/scripts/recomputeScoresRPN.js [--projectId=xxx]
 */

const mongoose = require('mongoose');
const path = require('path');
// Load .env from backend root (script is in backend/scripts)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 1. Load Service FIRST (it will load its own dependencies like Response, Score, Question)
const { computeEthicalScores, computeProjectEthicalScores } = require('../services/ethicalScoringService');

// 2. Check and Load/Define missing models required by THIS script
// We check mongoose.models to see what's already legit loaded.

// Helper to try loading a model file if the model isn't registered
const ensureModel = (modelName, fileName) => {
  if (mongoose.models[modelName]) return;
  try {
    require(`../models/${fileName}`);
  } catch (e) {
    // Only define dummy if NOT Project (handled specifically below) or if genuinely missing
    if (!mongoose.models[modelName]) {
      console.log(`⚠️  Defining dummy schema for missing model file: ${modelName}`);
      mongoose.model(modelName, new mongoose.Schema({}, { strict: false }));
    }
  }
};

ensureModel('Response', 'response');
// ensureModel('Project', 'project'); // SKIP: File does not exist, defined manually below
ensureModel('ProjectAssignment', 'projectAssignment');
ensureModel('User', 'User'); // Casing might vary

// Explicitly define Project if missing (since no file exists)
if (!mongoose.models.Project) {
  console.log('📝 Defining Project schema inline');
  mongoose.model('Project', new mongoose.Schema({ title: String }, { strict: false }));
}

const Response = mongoose.model('Response');
const Project = mongoose.model('Project');

const isValidObjectId = (id) => {
  if (!id) return false;
  try {
    return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id.toString();
  } catch {
    return false;
  }
};

async function recomputeAllScoresRPN(projectIdFilter = null) {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/z-inspection';
    await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));
    console.log('✅ Connected to MongoDB');

    // Get all projects with responses
    let projectIds;
    if (projectIdFilter) {
      const projectIdObj = isValidObjectId(projectIdFilter)
        ? new mongoose.Types.ObjectId(projectIdFilter)
        : projectIdFilter;
      projectIds = [projectIdObj];
      console.log(`📊 Recomputing scores for single project: ${projectIdFilter}`);
    } else {
      const responses = await Response.find({ status: 'submitted' })
        .select('projectId')
        .distinct('projectId')
        .lean();
      projectIds = responses;
      console.log(`📊 Found ${projectIds.length} projects with submitted responses`);
    }

    let recomputed = 0;
    let errors = 0;

    for (const projectId of projectIds) {
      try {
        console.log(`\n🔄 Processing project: ${projectId}`);

        // Get all unique userId/questionnaireKey combinations for this project
        // Include 'draft' status because ethicalScoringService supports scoring drafts
        const responses = await Response.find({
          projectId: projectId,
          status: { $in: ['submitted', 'draft'] }
        })
          .select('userId questionnaireKey')
          .lean();

        const uniqueCombinations = new Set();
        responses.forEach(r => {
          if (r.userId && r.questionnaireKey) {
            const userIdStr = r.userId.toString ? r.userId.toString() : String(r.userId);
            uniqueCombinations.add(`${userIdStr}_${r.questionnaireKey}`);
          }
        });

        console.log(`   Found ${uniqueCombinations.size} unique user/questionnaire combinations`);

        // Compute scores for all combinations using RPN model
        for (const combo of uniqueCombinations) {
          const [userId, questionnaireKey] = combo.split('_');
          try {
            await computeEthicalScores(projectId, userId, questionnaireKey);
            console.log(`   ✅ Computed RPN scores for user ${userId}, questionnaire ${questionnaireKey}`);
          } catch (error) {
            console.warn(`   ⚠️  Could not compute RPN scores for ${userId}/${questionnaireKey}:`, error.message);
          }
        }

        // Compute project-level scores
        try {
          await computeProjectEthicalScores(projectId);
          console.log(`   ✅ Computed project-level RPN scores`);
        } catch (error) {
          console.warn(`   ⚠️  Could not compute project-level RPN scores:`, error.message);
        }

        recomputed++;
        console.log(`   ✅ Completed project: ${projectId}`);

      } catch (error) {
        console.error(`   ❌ Error processing project ${projectId}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Recomputation Summary:');
    console.log(`   ✅ Recomputed: ${recomputed}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total: ${projectIds.length}`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Recomputation failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let projectIdFilter = null;

for (const arg of args) {
  if (arg.startsWith('--projectId=')) {
    projectIdFilter = arg.split('=')[1];
  }
}

// Run recomputation
if (require.main === module) {
  recomputeAllScoresRPN(projectIdFilter)
    .then(() => {
      console.log('✅ Recomputation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Recomputation failed:', error);
      process.exit(1);
    });
}

module.exports = { recomputeAllScoresRPN };

