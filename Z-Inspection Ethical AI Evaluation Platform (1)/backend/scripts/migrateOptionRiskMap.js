/**
 * Migration Script: Add optionRiskMap to select-based questions
 * 
 * G) Backfill optionRiskMap for all select questions
 * 
 * This script:
 * 1. Finds all select-based questions (single_choice, multi_choice)
 * 2. For each question, creates optionRiskMap based on option.score
 * 3. Maps option.score (0-4) directly to answerRisk (0-4)
 * 
 * Usage: node backend/scripts/migrateOptionRiskMap.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

const Question = require('../models/question');

const isValidObjectId = (id) => {
  if (!id) return false;
  try {
    return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id.toString();
  } catch {
    return false;
  }
};

async function migrateOptionRiskMap() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ethical-ai-analysis', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Find all select-based questions
    const selectQuestions = await Question.find({
      answerType: { $in: ['single_choice', 'multi_choice'] }
    });

    console.log(`📊 Found ${selectQuestions.length} select-based questions to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const question of selectQuestions) {
      try {
        // Skip if optionRiskMap already exists
        if (question.optionRiskMap && Object.keys(question.optionRiskMap).length > 0) {
          console.log(`⏭️  Skipping ${question.code} (${question.questionnaireKey}): optionRiskMap already exists`);
          skipped++;
          continue;
        }

        // Build optionRiskMap from options array
        const optionRiskMap = {};
        let hasValidMapping = false;

        if (question.options && Array.isArray(question.options)) {
          for (const option of question.options) {
            if (option.key) {
              // Use option.score (0-4) as answerRisk (0-4)
              // If score is missing, default to 2 (baseline)
              const answerRisk = option.score !== undefined && option.score !== null
                ? Math.max(0, Math.min(4, option.score))
                : 2;
              
              optionRiskMap[option.key] = answerRisk;
              hasValidMapping = true;
            }
          }
        }

        if (!hasValidMapping) {
          console.warn(`⚠️  Question ${question.code} (${question.questionnaireKey}) has no options - cannot create optionRiskMap`);
          errors++;
          continue;
        }

        // Update question with optionRiskMap
        question.optionRiskMap = optionRiskMap;
        await question.save();

        console.log(`✅ Migrated ${question.code} (${question.questionnaireKey}): ${Object.keys(optionRiskMap).length} options mapped`);
        migrated++;

      } catch (error) {
        console.error(`❌ Error migrating question ${question.code} (${question.questionnaireKey}):`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total: ${selectQuestions.length}`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrateOptionRiskMap()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateOptionRiskMap };

