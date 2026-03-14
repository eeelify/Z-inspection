/**
 * Test script to check if medical and ethical expert answers are saved correctly
 * Run with: node backend/scripts/testMedicalEthicalAnswers.js
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

// Use the same schema as server.js
const GeneralQuestionsAnswersSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userRole: { type: String, required: true },
  principles: { type: mongoose.Schema.Types.Mixed, default: {} },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  risks: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });

const GeneralQuestionsAnswers = mongoose.models.GeneralQuestionsAnswers || 
  mongoose.model('GeneralQuestionsAnswers', GeneralQuestionsAnswersSchema);
const Question = require('../models/question');

async function testAnswers() {
  try {
    console.log('🔍 Checking medical and ethical expert answers in MongoDB...\n');

    // Get all general questions answers (without populate for simplicity)
    const allAnswers = await GeneralQuestionsAnswers.find({}).lean();
    
    console.log(`📊 Total answers found: ${allAnswers.length}\n`);

    // Group by role
    const byRole = {};
    allAnswers.forEach(answer => {
      const role = answer.userRole || 'unknown';
      if (!byRole[role]) {
        byRole[role] = [];
      }
      byRole[role].push(answer);
    });

    // Check each role
    for (const [role, answers] of Object.entries(byRole)) {
      console.log(`\n👤 Role: ${role} (${answers.length} answer set(s))`);
      
      for (const answer of answers) {
        console.log(`\n  📝 User ID: ${answer.userId}`);
        console.log(`  📅 Updated: ${answer.updatedAt}`);
        
        // Check principles structure
        if (answer.principles) {
          console.log(`  ✅ Principles structure exists`);
          
          let totalAnswers = 0;
          let totalRisks = 0;
          
          Object.keys(answer.principles).forEach(principle => {
            const answersCount = Object.keys(answer.principles[principle].answers || {}).length;
            const risksCount = Object.keys(answer.principles[principle].risks || {}).length;
            
            if (answersCount > 0 || risksCount > 0) {
              console.log(`    - ${principle}: ${answersCount} answers, ${risksCount} risks`);
              totalAnswers += answersCount;
              totalRisks += risksCount;
            }
          });
          
          console.log(`  📊 Total: ${totalAnswers} answers, ${totalRisks} risks in principles structure`);
        } else {
          console.log(`  ⚠️ No principles structure found`);
        }
        
        // Check flat structure
        const flatAnswers = Object.keys(answer.answers || {}).length;
        const flatRisks = Object.keys(answer.risks || {}).length;
        if (flatAnswers > 0 || flatRisks > 0) {
          console.log(`  📊 Flat structure: ${flatAnswers} answers, ${flatRisks} risks`);
        }
      }
    }

    // Check question codes for medical and ethical experts
    console.log('\n\n🔍 Checking question codes for medical and ethical experts...\n');
    
    const medicalQuestions = await Question.find({ 
      questionnaireKey: 'general-v1',
      appliesToRoles: { $in: ['medical-expert'] }
    }).select('code principle').lean();
    
    const ethicalQuestions = await Question.find({ 
      questionnaireKey: 'general-v1',
      appliesToRoles: { $in: ['ethical-expert'] }
    }).select('code principle').lean();
    
    console.log(`📋 Medical Expert Questions: ${medicalQuestions.length}`);
    medicalQuestions.forEach(q => {
      console.log(`  - ${q.code}: ${q.principle}`);
    });
    
    console.log(`\n📋 Ethical Expert Questions: ${ethicalQuestions.length}`);
    ethicalQuestions.forEach(q => {
      console.log(`  - ${q.code}: ${q.principle}`);
    });

    // Check if answers contain these question codes
    console.log('\n\n🔍 Checking if answers contain medical/ethical question codes...\n');
    
    const medicalCodes = medicalQuestions.map(q => q.code);
    const ethicalCodes = ethicalQuestions.map(q => q.code);
    
    for (const answer of allAnswers) {
      if (answer.userRole === 'medical-expert' || answer.userRole === 'ethical-expert') {
        console.log(`\n👤 ${answer.userRole}: User ID ${answer.userId}`);
        
        let foundMedical = [];
        let foundEthical = [];
        
        // Check in principles structure
        if (answer.principles) {
          Object.keys(answer.principles).forEach(principle => {
            Object.keys(answer.principles[principle].answers || {}).forEach(code => {
              if (medicalCodes.includes(code)) {
                foundMedical.push(code);
              }
              if (ethicalCodes.includes(code)) {
                foundEthical.push(code);
              }
            });
          });
        }
        
        // Check in flat structure
        Object.keys(answer.answers || {}).forEach(code => {
          if (medicalCodes.includes(code)) {
            foundMedical.push(code);
          }
          if (ethicalCodes.includes(code)) {
            foundEthical.push(code);
          }
        });
        
        if (answer.userRole === 'medical-expert') {
          console.log(`  ✅ Found ${foundMedical.length} medical question codes: ${foundMedical.join(', ')}`);
        }
        if (answer.userRole === 'ethical-expert') {
          console.log(`  ✅ Found ${foundEthical.length} ethical question codes: ${foundEthical.join(', ')}`);
        }
      }
    }

    console.log('\n\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAnswers();

