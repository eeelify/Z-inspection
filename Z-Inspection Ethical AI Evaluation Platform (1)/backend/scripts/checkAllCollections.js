/**
 * Check all collections: questions, responses, scores
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI);

const Question = require('../models/question');
const Response = require('../models/response');
const Score = require('../models/score');

async function checkAll() {
  try {
    console.log('🔍 Checking All Collections...\n');
    
    // Questions
    console.log('📝 Questions by questionnaireKey:');
    const qCounts = await Question.aggregate([
      { $group: { _id: '$questionnaireKey', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    qCounts.forEach(q => {
      console.log(`  ${q._id}: ${q.count} questions`);
    });
    
    // Responses
    console.log('\n💾 Responses by questionnaireKey:');
    const rCounts = await Response.aggregate([
      { $group: { _id: '$questionnaireKey', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    if (rCounts.length === 0) {
      console.log('  ⚠️  No responses found');
    } else {
      rCounts.forEach(r => {
        console.log(`  ${r._id}: ${r.count} responses`);
      });
    }
    
    // Scores
    console.log('\n📊 Scores by questionnaireKey:');
    const sCounts = await Score.aggregate([
      { $group: { _id: '$questionnaireKey', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    if (sCounts.length === 0) {
      console.log('  ⚠️  No scores found');
    } else {
      sCounts.forEach(s => {
        console.log(`  ${s._id}: ${s.count} scores`);
      });
    }
    
    // Check for role-specific data
    console.log('\n🔍 Role-specific data check:');
    const ethicalResponses = await Response.countDocuments({ questionnaireKey: 'ethical-expert-v1' });
    const medicalResponses = await Response.countDocuments({ questionnaireKey: 'medical-expert-v1' });
    const ethicalScores = await Score.countDocuments({ questionnaireKey: 'ethical-expert-v1' });
    const medicalScores = await Score.countDocuments({ questionnaireKey: 'medical-expert-v1' });
    
    console.log(`  ethical-expert-v1 responses: ${ethicalResponses}`);
    console.log(`  medical-expert-v1 responses: ${medicalResponses}`);
    console.log(`  ethical-expert-v1 scores: ${ethicalScores}`);
    console.log(`  medical-expert-v1 scores: ${medicalScores}`);
    
    if (ethicalResponses === 0 && medicalResponses === 0) {
      console.log('\n⚠️  No role-specific responses found. This is expected if no new answers have been saved yet.');
      console.log('   When an expert answers questions, responses should be saved to both general-v1 and role-specific questionnaire.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAll();



