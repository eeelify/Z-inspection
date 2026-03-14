const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Response = require('../models/response');

async function checkResponseScoreField() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find "test use case deneme" project
    const project = await mongoose.connection.collection('projects').findOne({
      title: { $regex: /test.*use.*case.*deneme/i }
    });

    if (!project) {
      console.log('❌ Project not found');
      return;
    }

    console.log(`📊 Checking response score field for: ${project.title}\n`);

    // Get medical-expert general-v1 response
    const response = await Response.findOne({ 
      projectId: project._id,
      role: 'medical-expert',
      questionnaireKey: 'general-v1',
      status: 'draft'
    }).lean();

    if (!response) {
      console.log('❌ Response not found');
      return;
    }

    console.log(`\nResponse ID: ${response._id}`);
    console.log(`Role: ${response.role}`);
    console.log(`Questionnaire: ${response.questionnaireKey}\n`);

    console.log(`${'='.repeat(100)}`);
    console.log(`TRANSPARENCY ANSWERS - RAW DATA FROM RESPONSE`);
    console.log(`${'='.repeat(100)}\n`);

    const transparencyAnswers = response.answers.filter(a => {
      // We need to check which questions are TRANSPARENCY
      return a.questionCode && a.questionCode.startsWith('T');
    });

    console.log(`Found ${transparencyAnswers.length} Transparency answers\n`);

    transparencyAnswers.forEach((answer, idx) => {
      console.log(`📍 Answer ${idx + 1}:`);
      console.log(`   Question ID: ${answer.questionId}`);
      console.log(`   Question Code: ${answer.questionCode}`);
      console.log(`   Choice Key: ${answer.answer?.choiceKey || 'N/A'}`);
      console.log(`   answer.score field: ${answer.score !== undefined ? answer.score : 'UNDEFINED'}`);
      console.log(`   answer.text: ${answer.answer?.text || 'N/A'}`);
      console.log(`   Full answer object:`, JSON.stringify(answer, null, 2));
      console.log();
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkResponseScoreField();
