/**
 * Check current state of questionnaires and questions
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI);

const Questionnaire = require('../models/questionnaire');
const Question = require('../models/question');

async function checkState() {
  try {
    console.log('📊 Current State Check\n');
    
    // Check questionnaires
    const questionnaires = await Questionnaire.find({}).lean();
    console.log('📋 Questionnaires:');
    if (questionnaires.length === 0) {
      console.log('  ⚠️  No questionnaires found');
    } else {
      questionnaires.forEach(q => {
        console.log(`  - ${q.key}: ${q.title} (v${q.version}, active: ${q.isActive})`);
      });
    }
    
    // Check questions
    console.log('\n📝 Questions by questionnaireKey:');
    const ethical = await Question.countDocuments({ questionnaireKey: 'ethical-v1' });
    const medical = await Question.countDocuments({ questionnaireKey: 'medical-v1' });
    const general = await Question.countDocuments({ questionnaireKey: 'general-v1' });
    const ethicalExpert = await Question.countDocuments({ questionnaireKey: 'ethical-expert-v1' });
    const medicalExpert = await Question.countDocuments({ questionnaireKey: 'medical-expert-v1' });
    
    console.log(`  ethical-v1: ${ethical}`);
    console.log(`  medical-v1: ${medical}`);
    console.log(`  general-v1: ${general}`);
    console.log(`  ethical-expert-v1: ${ethicalExpert}`);
    console.log(`  medical-expert-v1: ${medicalExpert}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkState();



