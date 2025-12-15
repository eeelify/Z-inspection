/**
 * Check current state of MongoDB collections
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI);

const Questionnaire = require('../models/questionnaire');
const Question = require('../models/question');
const Response = require('../models/response');
const Score = require('../models/score');

async function checkState() {
  try {
    console.log('🔍 Checking MongoDB State...\n');
    
    // Check Questionnaires
    console.log('📋 Questionnaires:');
    const questionnaires = await Questionnaire.find({}).lean();
    if (questionnaires.length === 0) {
      console.log('  ⚠️  No questionnaires found!');
    } else {
      questionnaires.forEach(q => {
        console.log(`  ✅ ${q.key}: ${q.title} (v${q.version}, active: ${q.isActive})`);
      });
    }
    
    // Check Questions
    console.log('\n📝 Questions:');
    const questionCounts = {
      'general-v1': await Question.countDocuments({ questionnaireKey: 'general-v1' }),
      'ethical-expert-v1': await Question.countDocuments({ questionnaireKey: 'ethical-expert-v1' }),
      'medical-expert-v1': await Question.countDocuments({ questionnaireKey: 'medical-expert-v1' })
    };
    
    Object.entries(questionCounts).forEach(([key, count]) => {
      console.log(`  ${key}: ${count} questions`);
    });
    
    // Check Responses
    console.log('\n💾 Responses:');
    const responseCounts = {
      'general-v1': await Response.countDocuments({ questionnaireKey: 'general-v1' }),
      'ethical-expert-v1': await Response.countDocuments({ questionnaireKey: 'ethical-expert-v1' }),
      'medical-expert-v1': await Response.countDocuments({ questionnaireKey: 'medical-expert-v1' })
    };
    
    Object.entries(responseCounts).forEach(([key, count]) => {
      console.log(`  ${key}: ${count} responses`);
    });
    
    // Check Scores
    console.log('\n📊 Scores:');
    const scoreCounts = {
      'general-v1': await Score.countDocuments({ questionnaireKey: 'general-v1' }),
      'ethical-expert-v1': await Score.countDocuments({ questionnaireKey: 'ethical-expert-v1' }),
      'medical-expert-v1': await Score.countDocuments({ questionnaireKey: 'medical-expert-v1' })
    };
    
    Object.entries(scoreCounts).forEach(([key, count]) => {
      console.log(`  ${key}: ${count} scores`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkState();



