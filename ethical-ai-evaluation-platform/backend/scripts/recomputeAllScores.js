/**
 * Script to recompute all scores using the new ethical scoring system
 * This will update all existing scores to reflect the new AQ × RW calculation
 * 
 * Run with: node backend/scripts/recomputeAllScores.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI environment variable bulunamadı!');
}

mongoose.connect(MONGO_URI).catch((err) => {
  console.error('❌ MongoDB bağlantısı başarısız:', err);
  process.exit(1);
});

const { computeEthicalScores, computeProjectEthicalScores } = require('../services/ethicalScoringService');
const Response = require('../models/response');
const Project = require('../models/project');

async function recomputeAllScores() {
  try {
    console.log('🔄 Starting score recomputation...\n');

    // Get all unique project IDs
    const projects = await Project.find({}).select('_id').lean();
    console.log(`📊 Found ${projects.length} projects to process\n`);

    let processed = 0;
    let errors = 0;

    for (const project of projects) {
      try {
        const projectId = project._id;
        console.log(`📝 Processing project ${projectId}...`);

        // Get all unique user-questionnaire combinations for this project
        const responses = await Response.find({ projectId })
          .select('userId questionnaireKey')
          .lean();
        
        // Get unique combinations
        const uniqueCombinations = new Set();
        for (const response of responses) {
          uniqueCombinations.add(`${response.userId}_${response.questionnaireKey}`);
        }

        // Compute scores for each unique user-questionnaire combination
        for (const response of responses) {
          const key = `${response.userId}_${response.questionnaireKey}`;
          if (uniqueCombinations.has(key)) {
            uniqueCombinations.delete(key); // Process only once
            try {
              await computeEthicalScores(
                projectId,
                response.userId,
                response.questionnaireKey
              );
              console.log(`  ✅ Computed scores for user ${response.userId}, questionnaire ${response.questionnaireKey}`);
            } catch (err) {
              console.error(`  ❌ Error computing scores for user ${response.userId}, questionnaire ${response.questionnaireKey}:`, err.message);
              errors++;
            }
          }
        }

        // Compute project-level scores
        try {
          await computeProjectEthicalScores(projectId);
          console.log(`  ✅ Computed project-level scores`);
        } catch (err) {
          console.error(`  ❌ Error computing project-level scores:`, err.message);
          errors++;
        }

        processed++;
        console.log(`✅ Completed project ${projectId} (${processed}/${projects.length})\n`);
      } catch (err) {
        console.error(`❌ Error processing project ${project._id}:`, err.message);
        errors++;
      }
    }

    console.log(`\n✅ Recomputation complete!`);
    console.log(`   Processed: ${processed} projects`);
    console.log(`   Errors: ${errors}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Recomputation failed:', error);
    process.exit(1);
  }
}

recomputeAllScores();

