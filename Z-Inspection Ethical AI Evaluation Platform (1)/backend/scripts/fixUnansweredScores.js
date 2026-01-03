/**
 * Migration Script: Fix Unanswered Question Scores
 * 
 * This script updates all Response documents to set score=null for unanswered questions
 * (where answer.answer === null or undefined).
 * 
 * Run with: node backend/scripts/fixUnansweredScores.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Response = require('../models/response');

async function fixUnansweredScores() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/z-inspection';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all responses
    const responses = await Response.find({}).lean();
    console.log(`📊 Found ${responses.length} responses to check`);

    let updatedCount = 0;
    let fixedCount = 0;

    for (const response of responses) {
      let needsUpdate = false;
      const updatedAnswers = response.answers.map(answer => {
        // Check if question is unanswered
        const isUnanswered = 
          answer.answer === null || 
          answer.answer === undefined ||
          (typeof answer.answer === 'object' && Object.keys(answer.answer).length === 0) ||
          (answer.answer && typeof answer.answer === 'object' && 
           !answer.answer.choiceKey && 
           !answer.answer.text && 
           !answer.answer.numeric && 
           (!answer.answer.multiChoiceKeys || answer.answer.multiChoiceKeys.length === 0));

        if (isUnanswered && answer.score !== null && answer.score !== undefined) {
          needsUpdate = true;
          fixedCount++;
          return {
            ...answer,
            score: null
          };
        }
        return answer;
      });

      if (needsUpdate) {
        await Response.findByIdAndUpdate(response._id, {
          $set: { answers: updatedAnswers }
        });
        updatedCount++;
        console.log(`✅ Fixed response ${response._id} (${response.questionnaireKey}) - ${fixedCount} unanswered scores set to null`);
      }
    }

    console.log('\n✅ Migration complete!');
    console.log(`   - Updated ${updatedCount} responses`);
    console.log(`   - Fixed ${fixedCount} unanswered question scores`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
fixUnansweredScores();

