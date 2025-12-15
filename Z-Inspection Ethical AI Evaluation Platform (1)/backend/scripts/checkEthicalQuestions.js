/**
 * Check ethical expert questions in database
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

const Question = require('../models/question');

async function checkQuestions() {
  try {
    console.log('📋 Ethical Expert Questions (ethical-expert-v1):\n');
    
    const questions = await Question.find({ questionnaireKey: 'ethical-expert-v1' })
      .sort({ order: 1 })
      .lean();
    
    // Group by principle
    const byPrinciple = {};
    questions.forEach(q => {
      if (!byPrinciple[q.principle]) {
        byPrinciple[q.principle] = [];
      }
      byPrinciple[q.principle].push(q);
    });
    
    // Print grouped
    Object.keys(byPrinciple).sort().forEach(principle => {
      console.log(`\n${principle}:`);
      byPrinciple[principle].forEach((q, idx) => {
        console.log(`  ${idx + 1}. Code: ${q.code}, Order: ${q.order}`);
        console.log(`     EN: ${q.text.en.substring(0, 100)}...`);
        console.log(`     Type: ${q.answerType}`);
        if (q.options && q.options.length > 0) {
          console.log(`     Options: ${q.options.map(o => o.label.en).join(', ')}`);
        }
        console.log('');
      });
    });
    
    console.log(`\nTotal: ${questions.length} questions`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkQuestions();



