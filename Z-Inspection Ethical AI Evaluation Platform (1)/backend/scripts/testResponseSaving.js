/**
 * Test that responses and scores are being saved correctly
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

async function testSaving() {
  try {
    console.log('🧪 Testing Response and Score Saving...\n');
    
    // 1. Check Questionnaires
    console.log('1️⃣ Questionnaires:');
    const questionnaires = await Questionnaire.find({ isActive: true }).lean();
    const required = ['general-v1', 'ethical-expert-v1', 'medical-expert-v1'];
    const found = questionnaires.map(q => q.key);
    
    required.forEach(key => {
      if (found.includes(key)) {
        console.log(`  ✅ ${key}`);
      } else {
        console.log(`  ❌ ${key} - MISSING!`);
      }
    });
    
    // 2. Check Questions
    console.log('\n2️⃣ Questions:');
    const generalCount = await Question.countDocuments({ questionnaireKey: 'general-v1' });
    const ethicalCount = await Question.countDocuments({ questionnaireKey: 'ethical-expert-v1' });
    const medicalCount = await Question.countDocuments({ questionnaireKey: 'medical-expert-v1' });
    
    console.log(`  general-v1: ${generalCount} questions ${generalCount === 12 ? '✅' : '❌'}`);
    console.log(`  ethical-expert-v1: ${ethicalCount} questions ${ethicalCount === 12 ? '✅' : '❌'}`);
    console.log(`  medical-expert-v1: ${medicalCount} questions ${medicalCount === 25 ? '✅' : '❌'}`);
    
    // 3. Check Recent Responses
    console.log('\n3️⃣ Recent Responses (last 24 hours):');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentResponses = await Response.find({ createdAt: { $gte: oneDayAgo } })
      .select('role questionnaireKey status answers createdAt')
      .sort({ createdAt: -1 })
      .lean();
    
    if (recentResponses.length === 0) {
      console.log('  ⚠️  No recent responses found');
    } else {
      const byQuestionnaire = {};
      recentResponses.forEach(r => {
        if (!byQuestionnaire[r.questionnaireKey]) {
          byQuestionnaire[r.questionnaireKey] = [];
        }
        byQuestionnaire[r.questionnaireKey].push(r);
      });
      
      Object.keys(byQuestionnaire).sort().forEach(key => {
        const responses = byQuestionnaire[key];
        console.log(`  ${key}: ${responses.length} responses`);
        responses.forEach(r => {
          console.log(`    - ${r.role}: ${r.status} (${r.answers?.length || 0} answers)`);
        });
      });
    }
    
    // 4. Check Scores
    console.log('\n4️⃣ Scores:');
    const recentScores = await Score.find({ computedAt: { $gte: oneDayAgo } })
      .select('role questionnaireKey computedAt totals')
      .sort({ computedAt: -1 })
      .lean();
    
    if (recentScores.length === 0) {
      console.log('  ⚠️  No recent scores found');
    } else {
      const byQuestionnaire = {};
      recentScores.forEach(s => {
        if (!byQuestionnaire[s.questionnaireKey]) {
          byQuestionnaire[s.questionnaireKey] = [];
        }
        byQuestionnaire[s.questionnaireKey].push(s);
      });
      
      Object.keys(byQuestionnaire).sort().forEach(key => {
        const scores = byQuestionnaire[key];
        console.log(`  ${key}: ${scores.length} scores`);
        scores.forEach(s => {
          console.log(`    - ${s.role}: avg=${s.totals?.avg?.toFixed(2) || 0}, n=${s.totals?.n || 0}`);
        });
      });
    }
    
    // 5. Summary
    console.log('\n📊 Summary:');
    const totalResponses = await Response.countDocuments({});
    const totalScores = await Score.countDocuments({});
    console.log(`  Total Responses: ${totalResponses}`);
    console.log(`  Total Scores: ${totalScores}`);
    
    console.log('\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testSaving();



