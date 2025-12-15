/**
 * Migrate to new questionnaire structure:
 * - Create ethical-expert-v1 and medical-expert-v1 questionnaires
 * - Migrate questions from ethical-v1 to ethical-expert-v1
 * - Migrate questions from medical-v1 to medical-expert-v1
 * - Keep general-v1 unchanged
 * 
 * Run with: node backend/scripts/migrateToExpertQuestionnaires.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI);

const Questionnaire = require('../models/questionnaire');
const Question = require('../models/question');

async function migrate() {
  try {
    console.log('🔄 Starting migration to expert questionnaires...\n');

    // Step 1: Create new questionnaires
    console.log('📋 Step 1: Creating new questionnaires...');
    
    const ethicalExpertQuestionnaire = await Questionnaire.findOneAndUpdate(
      { key: 'ethical-expert-v1' },
      {
        key: 'ethical-expert-v1',
        title: 'Ethical Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      },
      { new: true, upsert: true }
    );
    console.log(`  ✅ Created/Updated: ${ethicalExpertQuestionnaire.key}`);

    const medicalExpertQuestionnaire = await Questionnaire.findOneAndUpdate(
      { key: 'medical-expert-v1' },
      {
        key: 'medical-expert-v1',
        title: 'Medical Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      },
      { new: true, upsert: true }
    );
    console.log(`  ✅ Created/Updated: ${medicalExpertQuestionnaire.key}`);

    // Step 2: Migrate ethical questions
    console.log('\n📝 Step 2: Migrating ethical questions...');
    const ethicalQuestions = await Question.find({ questionnaireKey: 'ethical-v1' }).lean();
    console.log(`  Found ${ethicalQuestions.length} questions in ethical-v1`);
    
    if (ethicalQuestions.length > 0) {
      let migrated = 0;
      for (const question of ethicalQuestions) {
        // Check if question already exists in ethical-expert-v1
        const existing = await Question.findOne({
          questionnaireKey: 'ethical-expert-v1',
          code: question.code
        });
        
        if (!existing) {
          // Create new question in ethical-expert-v1
          await Question.create({
            ...question,
            _id: undefined, // Let MongoDB create new ID
            questionnaireKey: 'ethical-expert-v1'
          });
          migrated++;
        } else {
          console.log(`    ⚠️  Question ${question.code} already exists in ethical-expert-v1, skipping`);
        }
      }
      console.log(`  ✅ Migrated ${migrated} questions to ethical-expert-v1`);
    }

    // Step 3: Migrate medical questions
    console.log('\n📝 Step 3: Migrating medical questions...');
    const medicalQuestions = await Question.find({ questionnaireKey: 'medical-v1' }).lean();
    console.log(`  Found ${medicalQuestions.length} questions in medical-v1`);
    
    if (medicalQuestions.length > 0) {
      let migrated = 0;
      for (const question of medicalQuestions) {
        // Check if question already exists in medical-expert-v1
        const existing = await Question.findOne({
          questionnaireKey: 'medical-expert-v1',
          code: question.code
        });
        
        if (!existing) {
          // Create new question in medical-expert-v1
          await Question.create({
            ...question,
            _id: undefined, // Let MongoDB create new ID
            questionnaireKey: 'medical-expert-v1'
          });
          migrated++;
        } else {
          console.log(`    ⚠️  Question ${question.code} already exists in medical-expert-v1, skipping`);
        }
      }
      console.log(`  ✅ Migrated ${migrated} questions to medical-expert-v1`);
    }

    // Step 4: Verify migration
    console.log('\n✅ Step 4: Verifying migration...');
    const ethicalExpertCount = await Question.countDocuments({ questionnaireKey: 'ethical-expert-v1' });
    const medicalExpertCount = await Question.countDocuments({ questionnaireKey: 'medical-expert-v1' });
    const generalCount = await Question.countDocuments({ questionnaireKey: 'general-v1' });
    
    console.log(`  ethical-expert-v1: ${ethicalExpertCount} questions`);
    console.log(`  medical-expert-v1: ${medicalExpertCount} questions`);
    console.log(`  general-v1: ${generalCount} questions`);
    
    // List all questionnaires
    const allQuestionnaires = await Questionnaire.find({ isActive: true }).lean();
    console.log('\n📋 Active Questionnaires:');
    allQuestionnaires.forEach(q => {
      console.log(`  - ${q.key}: ${q.title}`);
    });

    console.log('\n✅ Migration complete!');
    console.log('\n⚠️  Note: Old questionnaires (ethical-v1, medical-v1) are kept for backward compatibility.');
    console.log('   You can deactivate them later if needed.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();



