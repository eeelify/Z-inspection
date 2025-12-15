/**
 * Verify medical expert structure is correct:
 * - Questionnaires: general-v1, medical-expert-v1
 * - Questions: general-v1 (12), medical-expert-v1 (25)
 * - Responses should save to both questionnaires
 * - Scores should be computed for both questionnaires
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

const Questionnaire = require('../models/questionnaire');
const Question = require('../models/question');
const Response = require('../models/response');
const Score = require('../models/score');

async function verifyMedicalStructure() {
  try {
    console.log('🔍 Verifying Medical Expert Structure...\n');
    let allPassed = true;
    
    // 1. Check Questionnaires
    console.log('1️⃣ Questionnaires:');
    const generalQ = await Questionnaire.findOne({ key: 'general-v1' });
    const medicalQ = await Questionnaire.findOne({ key: 'medical-expert-v1' });
    
    if (generalQ) {
      console.log(`  ✅ general-v1: ${generalQ.title} (active: ${generalQ.isActive})`);
    } else {
      console.log('  ❌ general-v1: NOT FOUND');
      allPassed = false;
    }
    
    if (medicalQ) {
      console.log(`  ✅ medical-expert-v1: ${medicalQ.title} (active: ${medicalQ.isActive})`);
    } else {
      console.log('  ❌ medical-expert-v1: NOT FOUND');
      allPassed = false;
    }
    
    // 2. Check Questions
    console.log('\n2️⃣ Questions:');
    const generalQuestions = await Question.find({ questionnaireKey: 'general-v1' }).select('code').lean();
    const medicalQuestions = await Question.find({ questionnaireKey: 'medical-expert-v1' }).select('code').lean();
    
    console.log(`  general-v1: ${generalQuestions.length} questions`);
    if (generalQuestions.length === 12) {
      console.log('    ✅ Correct count (12)');
    } else {
      console.log('    ❌ Expected 12 questions');
      allPassed = false;
    }
    
    console.log(`  medical-expert-v1: ${medicalQuestions.length} questions`);
    if (medicalQuestions.length === 25) {
      console.log('    ✅ Correct count (25)');
    } else {
      console.log('    ❌ Expected 25 questions');
      allPassed = false;
    }
    
    // Check for overlap (should be none)
    const generalCodes = new Set(generalQuestions.map(q => q.code));
    const medicalCodes = new Set(medicalQuestions.map(q => q.code));
    const overlap = [...generalCodes].filter(code => medicalCodes.has(code));
    
    if (overlap.length === 0) {
      console.log('    ✅ No code overlap between general and medical questions');
    } else {
      console.log(`    ❌ Code overlap found: ${overlap.join(', ')}`);
      allPassed = false;
    }
    
    // 3. Check Responses (for medical experts)
    console.log('\n3️⃣ Responses (medical-expert role):');
    const medicalResponses = await Response.find({ role: 'medical-expert' })
      .select('questionnaireKey status answers createdAt')
      .sort({ createdAt: -1 })
      .lean();
    
    const byQuestionnaire = {};
    medicalResponses.forEach(r => {
      if (!byQuestionnaire[r.questionnaireKey]) {
        byQuestionnaire[r.questionnaireKey] = [];
      }
      byQuestionnaire[r.questionnaireKey].push(r);
    });
    
    if (byQuestionnaire['general-v1']) {
      console.log(`  ✅ general-v1: ${byQuestionnaire['general-v1'].length} responses`);
    } else {
      console.log('  ⚠️  general-v1: No responses yet');
    }
    
    if (byQuestionnaire['medical-expert-v1']) {
      console.log(`  ✅ medical-expert-v1: ${byQuestionnaire['medical-expert-v1'].length} responses`);
    } else {
      console.log('  ⚠️  medical-expert-v1: No responses yet (will be created when medical expert answers questions)');
    }
    
    // 4. Check Scores (for medical experts)
    console.log('\n4️⃣ Scores (medical-expert role):');
    const medicalScores = await Score.find({ role: 'medical-expert' })
      .select('questionnaireKey computedAt totals')
      .sort({ computedAt: -1 })
      .lean();
    
    const scoresByQuestionnaire = {};
    medicalScores.forEach(s => {
      if (!scoresByQuestionnaire[s.questionnaireKey]) {
        scoresByQuestionnaire[s.questionnaireKey] = [];
      }
      scoresByQuestionnaire[s.questionnaireKey].push(s);
    });
    
    if (scoresByQuestionnaire['general-v1']) {
      console.log(`  ✅ general-v1: ${scoresByQuestionnaire['general-v1'].length} scores`);
    } else {
      console.log('  ⚠️  general-v1: No scores yet');
    }
    
    if (scoresByQuestionnaire['medical-expert-v1']) {
      console.log(`  ✅ medical-expert-v1: ${scoresByQuestionnaire['medical-expert-v1'].length} scores`);
    } else {
      console.log('  ⚠️  medical-expert-v1: No scores yet (will be computed when medical expert responses are saved)');
    }
    
    // 5. Verify question codes
    console.log('\n5️⃣ Medical Expert Question Codes:');
    console.log(`  Medical questions: ${medicalQuestions.map(q => q.code).join(', ')}`);
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('✅ Medical Expert Structure is CORRECT!');
      console.log('\n📋 Summary:');
      console.log('  - Questionnaires: ✅ general-v1, medical-expert-v1');
      console.log('  - Questions: ✅ general-v1 (12), medical-expert-v1 (25)');
      console.log('  - Responses: Will be saved to both questionnaires');
      console.log('  - Scores: Will be computed for both questionnaires');
    } else {
      console.log('❌ Some issues found. Please review above.');
    }
    console.log('='.repeat(50));
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyMedicalStructure();



