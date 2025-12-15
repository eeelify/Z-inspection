/**
 * Verify question order is correct:
 * - General questions should come first (order 1-12)
 * - Role-specific questions should come after (order 13+)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI);

const Question = require('../models/question');

async function verifyOrder() {
  try {
    console.log('🔍 Verifying Question Order...\n');
    
    // Check general questions
    const general = await Question.find({ questionnaireKey: 'general-v1' })
      .sort({ order: 1 })
      .select('code order')
      .lean();
    
    const generalOrders = general.map(q => q.order);
    const maxGeneralOrder = Math.max(...generalOrders);
    const minGeneralOrder = Math.min(...generalOrders);
    
    console.log(`📋 General Questions (general-v1):`);
    console.log(`   Order range: ${minGeneralOrder} - ${maxGeneralOrder}`);
    console.log(`   Count: ${general.length}`);
    
    // Check ethical expert questions
    const ethical = await Question.find({ questionnaireKey: 'ethical-expert-v1' })
      .sort({ order: 1 })
      .select('code order')
      .lean();
    
    const ethicalOrders = ethical.map(q => q.order);
    const minEthicalOrder = Math.min(...ethicalOrders);
    const maxEthicalOrder = Math.max(...ethicalOrders);
    
    console.log(`\n📋 Ethical Expert Questions (ethical-expert-v1):`);
    console.log(`   Order range: ${minEthicalOrder} - ${maxEthicalOrder}`);
    console.log(`   Count: ${ethical.length}`);
    
    // Check medical expert questions
    const medical = await Question.find({ questionnaireKey: 'medical-expert-v1' })
      .sort({ order: 1 })
      .select('code order')
      .lean();
    
    const medicalOrders = medical.map(q => q.order);
    const minMedicalOrder = medical.length > 0 ? Math.min(...medicalOrders) : null;
    const maxMedicalOrder = medical.length > 0 ? Math.max(...medicalOrders) : null;
    
    console.log(`\n📋 Medical Expert Questions (medical-expert-v1):`);
    console.log(`   Order range: ${minMedicalOrder || 'N/A'} - ${maxMedicalOrder || 'N/A'}`);
    console.log(`   Count: ${medical.length}`);
    
    // Verify
    console.log('\n✅ Verification:');
    let allPassed = true;
    
    if (minEthicalOrder && minEthicalOrder <= maxGeneralOrder) {
      console.log(`   ❌ Ethical questions start at ${minEthicalOrder}, but should be > ${maxGeneralOrder}`);
      allPassed = false;
    } else if (minEthicalOrder) {
      console.log(`   ✅ Ethical questions come AFTER general (${minEthicalOrder} > ${maxGeneralOrder})`);
    }
    
    if (minMedicalOrder && minMedicalOrder <= maxGeneralOrder) {
      console.log(`   ❌ Medical questions start at ${minMedicalOrder}, but should be > ${maxGeneralOrder}`);
      allPassed = false;
    } else if (minMedicalOrder) {
      console.log(`   ✅ Medical questions come AFTER general (${minMedicalOrder} > ${maxGeneralOrder})`);
    }
    
    if (allPassed) {
      console.log('\n✅ All checks passed! Questions are correctly ordered.');
    } else {
      console.log('\n❌ Some checks failed. Please fix the order values.');
    }
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyOrder();



