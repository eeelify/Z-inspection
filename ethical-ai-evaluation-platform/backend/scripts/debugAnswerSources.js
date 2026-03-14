const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Response = require('../models/response');
const Question = require('../models/question');
const { calculateAnswerSeverity } = require('../services/answerRiskService');

async function debugAnswerSources() {
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

    console.log(`📊 Debugging Answer Sources for: ${project.title}\n`);

    // Get medical-expert general-v1 response (the problematic one)
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

    console.log(`\n${'='.repeat(100)}`);
    console.log(`MEDICAL-EXPERT GENERAL-V1 - Answer Sources Analysis`);
    console.log(`${'='.repeat(100)}\n`);

    // Get all questions
    const questions = await Question.find({}).lean();
    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    const transparencyAnswers = [];

    for (const answer of response.answers) {
      const question = questionMap.get(answer.questionId?.toString());
      if (!question) continue;

      if (question.principle !== 'TRANSPARENCY') continue;

      const importance = answer.score || question.riskScore || 2;
      const answerSeverityResult = calculateAnswerSeverity(question, answer);

      transparencyAnswers.push({
        code: question.code,
        choiceKey: answer.answer?.choiceKey,
        importance,
        answerValue: answerSeverityResult.answerSeverity,
        isQuality: answerSeverityResult.isQuality || false,
        source: answerSeverityResult.source,
        calculatedScore: importance * answerSeverityResult.answerSeverity,
        expectedPerformance: answerSeverityResult.isQuality 
          ? (importance * answerSeverityResult.answerSeverity)
          : (importance - (importance * answerSeverityResult.answerSeverity))
      });
    }

    console.log('TRANSPARENCY Questions:\n');
    transparencyAnswers.forEach(ans => {
      console.log(`📍 ${ans.code}:`);
      console.log(`   Choice: ${ans.choiceKey}`);
      console.log(`   Importance: ${ans.importance}`);
      console.log(`   Answer Value: ${ans.answerValue}`);
      console.log(`   Is Quality?: ${ans.isQuality ? 'YES ✅' : 'NO (severity)'}`);
      console.log(`   Source: ${ans.source}`);
      console.log(`   Raw Score: ${ans.calculatedScore}`);
      console.log(`   Expected Performance: ${ans.expectedPerformance}`);
      console.log();
    });

    const avgExpected = transparencyAnswers.reduce((sum, a) => sum + a.expectedPerformance, 0) / transparencyAnswers.length;
    console.log(`\n➡️  Expected Transparency Average: ${avgExpected.toFixed(2)}`);
    console.log(`   MongoDB shows: 1.75`);
    console.log(`   Difference: ${Math.abs(avgExpected - 1.75).toFixed(2)}\n`);

    // Check one question in detail
    const t1Question = questions.find(q => q.code === 'T1');
    if (t1Question) {
      console.log(`\n${'='.repeat(100)}`);
      console.log(`DETAILED CHECK: T1 Question`);
      console.log(`${'='.repeat(100)}\n`);
      console.log(`Question Code: ${t1Question.code}`);
      console.log(`Principle: ${t1Question.principle}`);
      console.log(`Risk Score (importance): ${t1Question.riskScore}`);
      console.log(`\nOptions:`);
      t1Question.options?.forEach(opt => {
        console.log(`   ${opt.key}: answerQuality=${opt.answerQuality || 'N/A'}, answerSeverity=${opt.answerSeverity || 'N/A'}`);
        console.log(`      Label EN: ${opt.label?.en}`);
      });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugAnswerSources();
