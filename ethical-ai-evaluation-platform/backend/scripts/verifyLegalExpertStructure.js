/**
 * Verify legal expert structure in MongoDB
 * Checks questionnaires, questions, responses, and scores collections
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

async function verifyLegalExpertStructure() {
  try {
    console.log('🔍 Verifying Legal Expert Structure...\n');

    // 1. Check questionnaire
    console.log('1️⃣ Checking questionnaire...');
    const questionnaire = await Questionnaire.findOne({ key: 'legal-expert-v1' });
    if (questionnaire) {
      console.log(`✅ Questionnaire found: ${questionnaire.key}`);
      console.log(`   Title: ${questionnaire.title}`);
      console.log(`   Version: ${questionnaire.version}`);
      console.log(`   Active: ${questionnaire.isActive}`);
    } else {
      console.log('❌ Questionnaire legal-expert-v1 not found!');
    }

    // 2. Check questions
    console.log('\n2️⃣ Checking questions...');
    const questions = await Question.find({ questionnaireKey: 'legal-expert-v1' })
      .sort({ order: 1 })
      .select('code principle text.en order answerType');
    
    console.log(`✅ Found ${questions.length} legal expert questions:`);
    questions.forEach((q, idx) => {
      console.log(`   ${idx + 1}. [${q.code}] ${q.principle} - ${q.text.en.substring(0, 60)}... (Order: ${q.order})`);
    });

    // 3. Check responses
    console.log('\n3️⃣ Checking responses...');
    const responses = await Response.find({ questionnaireKey: 'legal-expert-v1' })
      .select('projectId userId role questionnaireKey answers status submittedAt')
      .populate('projectId', 'title')
      .populate('userId', 'name email');
    
    console.log(`✅ Found ${responses.length} legal-expert-v1 responses:`);
    if (responses.length > 0) {
      responses.forEach((r, idx) => {
        const projectTitle = r.projectId?.title || 'Unknown';
        const userName = r.userId?.name || r.userId?.email || 'Unknown';
        console.log(`   ${idx + 1}. Project: ${projectTitle}, User: ${userName}, Answers: ${r.answers.length}, Status: ${r.status}`);
      });
    } else {
      console.log('   ℹ️ No responses found yet (this is expected if no answers have been saved)');
    }

    // 4. Check scores
    console.log('\n4️⃣ Checking scores...');
    const scores = await Score.find({ questionnaireKey: 'legal-expert-v1' })
      .select('projectId userId role questionnaireKey overallScore principleScores')
      .populate('projectId', 'title')
      .populate('userId', 'name email');
    
    console.log(`✅ Found ${scores.length} legal-expert-v1 scores:`);
    if (scores.length > 0) {
      scores.forEach((s, idx) => {
        const projectTitle = s.projectId?.title || 'Unknown';
        const userName = s.userId?.name || s.userId?.email || 'Unknown';
        console.log(`   ${idx + 1}. Project: ${projectTitle}, User: ${userName}, Overall Score: ${s.overallScore}`);
      });
    } else {
      console.log('   ℹ️ No scores found yet (this is expected if no answers have been saved)');
    }

    // 5. Summary
    console.log('\n📊 Summary:');
    console.log(`   Questionnaire: ${questionnaire ? '✅' : '❌'}`);
    console.log(`   Questions: ${questions.length} (expected: 21)`);
    console.log(`   Responses: ${responses.length}`);
    console.log(`   Scores: ${scores.length}`);

    if (questionnaire && questions.length === 21) {
      console.log('\n✅ Legal Expert structure is correctly set up!');
    } else {
      console.log('\n⚠️ Some issues detected. Please check the output above.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyLegalExpertStructure();


