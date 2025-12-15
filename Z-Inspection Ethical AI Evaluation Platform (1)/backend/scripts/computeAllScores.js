/**
 * Script to compute scores for all existing responses
 * 
 * Run with: node backend/scripts/computeAllScores.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error("❌ MONGO_URI environment variable bulunamadı!");
}

const Response = require('../models/response');
const Score = require('../models/score');
const Question = require('../models/question');
const { computeScores } = require('../services/evaluationService');

async function computeAllScores() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    console.log('Starting score computation...\n');

    // Get all unique projectId, userId, questionnaireKey combinations from submitted responses
    const responses = await Response.find({ status: 'submitted' }).distinct('projectId');
    const projectIds = [...new Set(responses.map(r => r.toString()))];

    console.log(`Found ${projectIds.length} projects with submitted responses\n`);

    let computed = 0;
    let errors = 0;

    for (const projectId of projectIds) {
      try {
        // Get all unique userId/questionnaireKey combinations for this project
        const projectResponses = await Response.find({ 
          projectId, 
          status: 'submitted' 
        }).distinct('userId');
        
        const userIds = [...new Set(projectResponses.map(r => r.toString()))];

        for (const userId of userIds) {
          // Get all questionnaires for this user/project
          const userResponses = await Response.find({ 
            projectId, 
            userId, 
            status: 'submitted' 
          }).distinct('questionnaireKey');
          
          const questionnaireKeys = [...new Set(userResponses.map(r => r.toString()))];

          for (const questionnaireKey of questionnaireKeys) {
            try {
              const result = await computeScores(projectId, userId, questionnaireKey);
              if (result) {
                computed++;
                console.log(`✅ Computed scores for project: ${projectId}, user: ${userId}, questionnaire: ${questionnaireKey}`);
              }
            } catch (error) {
              console.error(`❌ Error computing scores for ${projectId}/${userId}/${questionnaireKey}:`, error.message);
              errors++;
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing project ${projectId}:`, error.message);
        errors++;
      }
    }

    console.log('\n✅ Score computation complete!');
    console.log(`Computed: ${computed}`);
    console.log(`Errors: ${errors}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Score computation failed:', error);
    process.exit(1);
  }
}

// Run computation
computeAllScores();

