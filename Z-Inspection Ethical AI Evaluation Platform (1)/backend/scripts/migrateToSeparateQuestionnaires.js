/**
 * Migrate ethical and medical expert questions to separate questionnaires
 * This will:
 * 1. Create ethical-v1 and medical-v1 questionnaires
 * 2. Move ethical expert questions from general-v1 to ethical-v1
 * 3. Move medical expert questions from general-v1 to medical-v1
 * 4. Keep general questions in general-v1
 * 
 * Run with: node backend/scripts/migrateToSeparateQuestionnaires.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI);

const Questionnaire = require('../models/questionnaire');
const Question = require('../models/question');

async function migrateToSeparateQuestionnaires() {
  try {
    console.log('🔄 Starting migration to separate questionnaires...\n');

    // Step 1: Create ethical-v1 questionnaire
    let ethicalQuestionnaire = await Questionnaire.findOne({ key: 'ethical-v1' });
    if (!ethicalQuestionnaire) {
      ethicalQuestionnaire = await Questionnaire.create({
        key: 'ethical-v1',
        title: 'Ethical Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      });
      console.log('✅ Created questionnaire: ethical-v1');
    } else {
      console.log('ℹ️ Questionnaire ethical-v1 already exists');
    }

    // Step 2: Create medical-v1 questionnaire
    let medicalQuestionnaire = await Questionnaire.findOne({ key: 'medical-v1' });
    if (!medicalQuestionnaire) {
      medicalQuestionnaire = await Questionnaire.create({
        key: 'medical-v1',
        title: 'Medical Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      });
      console.log('✅ Created questionnaire: medical-v1');
    } else {
      console.log('ℹ️ Questionnaire medical-v1 already exists');
    }

    // Step 3: Find all ethical expert questions in general-v1
    const ethicalQuestions = await Question.find({
      questionnaireKey: 'general-v1',
      appliesToRoles: { $in: ['ethical-expert'] }
    });

    console.log(`\n📋 Found ${ethicalQuestions.length} ethical expert questions in general-v1`);

    // Step 4: Move ethical questions to ethical-v1
    let ethicalMoved = 0;
    for (const question of ethicalQuestions) {
      // Check if question already exists in ethical-v1
      const existing = await Question.findOne({
        questionnaireKey: 'ethical-v1',
        code: question.code
      });

      if (!existing) {
        // Create new question in ethical-v1
        await Question.create({
          questionnaireKey: 'ethical-v1',
          code: question.code,
          principle: question.principle,
          appliesToRoles: question.appliesToRoles,
          text: question.text,
          answerType: question.answerType,
          options: question.options,
          scoring: question.scoring,
          required: question.required,
          order: question.order,
          tags: question.tags,
          description: question.description
        });
        ethicalMoved++;
        console.log(`  ✅ Moved question ${question.code} to ethical-v1`);
      } else {
        console.log(`  ⏭️ Question ${question.code} already exists in ethical-v1, skipping`);
      }
    }

    // Step 5: Find all medical expert questions in general-v1
    const medicalQuestions = await Question.find({
      questionnaireKey: 'general-v1',
      appliesToRoles: { $in: ['medical-expert'] }
    });

    console.log(`\n📋 Found ${medicalQuestions.length} medical expert questions in general-v1`);

    // Step 6: Move medical questions to medical-v1
    let medicalMoved = 0;
    for (const question of medicalQuestions) {
      // Check if question already exists in medical-v1
      const existing = await Question.findOne({
        questionnaireKey: 'medical-v1',
        code: question.code
      });

      if (!existing) {
        // Create new question in medical-v1
        await Question.create({
          questionnaireKey: 'medical-v1',
          code: question.code,
          principle: question.principle,
          appliesToRoles: question.appliesToRoles,
          text: question.text,
          answerType: question.answerType,
          options: question.options,
          scoring: question.scoring,
          required: question.required,
          order: question.order,
          tags: question.tags,
          description: question.description
        });
        medicalMoved++;
        console.log(`  ✅ Moved question ${question.code} to medical-v1`);
      } else {
        console.log(`  ⏭️ Question ${question.code} already exists in medical-v1, skipping`);
      }
    }

    // Step 7: Summary
    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Ethical questions moved: ${ethicalMoved}`);
    console.log(`  ✅ Medical questions moved: ${medicalMoved}`);
    
    // Count remaining questions in general-v1
    const remainingInGeneral = await Question.countDocuments({
      questionnaireKey: 'general-v1',
      appliesToRoles: { $ne: ['ethical-expert'], $ne: ['medical-expert'] }
    });
    
    // Count questions that apply to 'any' role (general questions)
    const generalQuestions = await Question.countDocuments({
      questionnaireKey: 'general-v1',
      $or: [
        { appliesToRoles: 'any' },
        { appliesToRoles: { $in: ['any'] } }
      ]
    });

    console.log(`  📋 Remaining in general-v1: ${generalQuestions} (general questions for all roles)`);
    console.log(`\n✅ Migration complete!`);
    console.log('\n💡 Note: Original questions in general-v1 are kept for backward compatibility.');
    console.log('   You can delete them later if everything works correctly.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateToSeparateQuestionnaires();




