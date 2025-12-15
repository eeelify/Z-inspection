/**
 * Clean general-v1 questionnaire - remove role-specific questions
 * Keep only questions that apply to 'any' role
 * Run with: node backend/scripts/cleanGeneralV1Questions.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI);

const Question = require('../models/question');

async function cleanGeneralV1() {
  try {
    console.log('🧹 Cleaning general-v1 questionnaire...\n');

    // Find all questions in general-v1
    const allGeneralQuestions = await Question.find({ questionnaireKey: 'general-v1' }).lean();
    console.log(`📋 Total questions in general-v1: ${allGeneralQuestions.length}`);

    // Find questions that are NOT for 'any' role (role-specific questions)
    const roleSpecificQuestions = await Question.find({
      questionnaireKey: 'general-v1',
      appliesToRoles: { $ne: 'any', $nin: [['any']] }
    }).lean();

    console.log(`\n🔍 Found ${roleSpecificQuestions.length} role-specific questions in general-v1:`);
    roleSpecificQuestions.forEach(q => {
      console.log(`  - ${q.code}: ${q.appliesToRoles.join(', ')}`);
    });

    // Delete role-specific questions from general-v1
    if (roleSpecificQuestions.length > 0) {
      const result = await Question.deleteMany({
        questionnaireKey: 'general-v1',
        appliesToRoles: { $ne: 'any', $nin: [['any']] }
      });
      
      console.log(`\n✅ Deleted ${result.deletedCount} role-specific questions from general-v1`);
    } else {
      console.log('\n✅ No role-specific questions found in general-v1');
    }

    // Verify: Count remaining questions in general-v1
    const remaining = await Question.countDocuments({
      questionnaireKey: 'general-v1',
      $or: [
        { appliesToRoles: 'any' },
        { appliesToRoles: { $in: ['any'] } }
      ]
    });

    console.log(`\n📊 Remaining questions in general-v1: ${remaining} (should be 12)`);
    
    // List remaining questions
    const remainingQuestions = await Question.find({
      questionnaireKey: 'general-v1',
      $or: [
        { appliesToRoles: 'any' },
        { appliesToRoles: { $in: ['any'] } }
      ]
    }).select('code').lean();
    
    console.log(`\n📝 Remaining question codes: ${remainingQuestions.map(q => q.code).join(', ')}`);

    console.log('\n✅ Cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanGeneralV1();



