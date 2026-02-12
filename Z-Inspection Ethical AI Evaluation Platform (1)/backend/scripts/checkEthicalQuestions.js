/**
 * Check ethical expert questions in database
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI environment variable bulunamadı!');
}

mongoose.connect(MONGO_URI).catch((err) => {
  console.error('❌ MongoDB bağlantısı başarısız:', err);
  process.exit(1);
});

const Question = require('../models/question');

async function checkQuestions() {
  try {
    const ethicalQs = await Question.find({ questionnaireKey: 'ethical-expert-v1' }).lean();
    const technicalQs = await Question.find({ questionnaireKey: 'technical-expert-v1' }).lean();

    console.log('--- COUNTS ---');
    console.log(`Ethical Expert (ethical-expert-v1): ${ethicalQs.length}`);
    console.log(`Technical Expert (technical-expert-v1): ${technicalQs.length}`);
    console.log('--- END COUNTS ---');

    console.log('Ethical Codes:', ethicalQs.map(q => q.code).join(', '));
    console.log('Technical Codes:', technicalQs.map(q => q.code).join(', '));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkQuestions();



