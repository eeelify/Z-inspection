/**
 * Check question order for general and ethical expert questions
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI);

const Question = require('../models/question');

async function checkOrder() {
  try {
    console.log('📋 General Questions (general-v1):\n');
    const general = await Question.find({ questionnaireKey: 'general-v1' })
      .sort({ order: 1 })
      .select('code order principle')
      .lean();
    
    general.forEach(q => {
      console.log(`  Order ${q.order}: ${q.code} (${q.principle})`);
    });
    
    const maxGeneralOrder = Math.max(...general.map(q => q.order));
    console.log(`\nMax order in general-v1: ${maxGeneralOrder}\n`);
    
    console.log('📋 Ethical Expert Questions (ethical-expert-v1):\n');
    const ethical = await Question.find({ questionnaireKey: 'ethical-expert-v1' })
      .sort({ order: 1 })
      .select('code order principle')
      .lean();
    
    ethical.forEach(q => {
      console.log(`  Order ${q.order}: ${q.code} (${q.principle})`);
    });
    
    const minEthicalOrder = Math.min(...ethical.map(q => q.order));
    console.log(`\nMin order in ethical-expert-v1: ${minEthicalOrder}`);
    
    if (minEthicalOrder > maxGeneralOrder) {
      console.log(`\n✅ Ethical questions come AFTER general questions (${minEthicalOrder} > ${maxGeneralOrder})`);
    } else {
      console.log(`\n⚠️  Ethical questions overlap with general questions!`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkOrder();



