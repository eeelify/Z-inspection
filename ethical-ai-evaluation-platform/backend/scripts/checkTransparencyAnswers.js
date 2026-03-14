const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Response = require('../models/response');
const Question = require('../models/question');

async function checkTransparencyAnswers() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find "test use case deneme" project
    const Project = mongoose.connection.collection('projects');
    const project = await Project.findOne({
      title: { $regex: /test.*use.*case.*deneme/i }
    });

    if (!project) {
      console.log('❌ Project not found');
      return;
    }

    console.log(`📊 Analyzing Transparency answers for: ${project.title}`);
    console.log(`   Project ID: ${project._id}\n`);

    // Find all responses for this project
    const responses = await Response.find({ 
      projectId: project._id 
    }).lean();

    console.log(`Found ${responses.length} response document(s)\n`);

    // Find all Transparency questions
    const transparencyQuestions = await Question.find({
      principle: 'TRANSPARENCY'
    }).select('code text textTR options riskScore').lean();

    console.log(`📋 Transparency Questions:\n`);
    for (const q of transparencyQuestions) {
      const qText = typeof q.text === 'string' ? q.text : (q.text?.en || 'N/A');
      console.log(`${q.code}: ${qText}`);
      console.log(`   Importance: ${q.riskScore}/4`);
      console.log(`   Options:`);
      if (q.options) {
        q.options.forEach(opt => {
          const optLabel = typeof opt.label === 'string' ? opt.label : (opt.label?.en || opt.key);
          console.log(`      - ${opt.key}: ${optLabel} (AQ: ${opt.answerQuality || 'N/A'})`);
        });
      }
      console.log();
    }

    // Analyze answers for each response
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📝 ANSWERS BY EVALUATOR`);
    console.log(`${'='.repeat(80)}\n`);

    for (const resp of responses) {
      console.log(`\n👤 ${resp.role || 'Unknown Role'} (User: ${resp.userId})`);
      console.log(`   Questionnaire: ${resp.questionnaireKey}`);
      console.log(`   Status: ${resp.status}\n`);

      const transparencyAnswers = resp.answers.filter(a => {
        const qId = a.questionId?.toString();
        return transparencyQuestions.some(tq => tq._id.toString() === qId);
      });

      if (transparencyAnswers.length === 0) {
        console.log('   ⚠️  No Transparency answers found\n');
        continue;
      }

      for (const answer of transparencyAnswers) {
        const question = transparencyQuestions.find(
          q => q._id.toString() === answer.questionId?.toString()
        );

        if (!question) continue;

        const questionText = typeof question.text === 'string' ? question.text : (question.text?.en || 'N/A');
        console.log(`   📌 ${question.code}: ${questionText.substring(0, 60)}...`);
        console.log(`      Importance (riskScore): ${answer.score || question.riskScore}/4`);
        
        if (answer.answer?.choiceKey) {
          const selectedOption = question.options?.find(o => o.key === answer.answer.choiceKey);
          console.log(`      Answer: "${answer.answer.choiceKey}" = ${selectedOption?.label || 'Unknown'}`);
          console.log(`      Answer Quality: ${selectedOption?.answerQuality || 'N/A'}/1`);
          
          if (selectedOption?.answerQuality !== undefined) {
            const score = (answer.score || question.riskScore) * selectedOption.answerQuality;
            console.log(`      ➡️  Performance Score: ${answer.score || question.riskScore} × ${selectedOption.answerQuality} = ${score.toFixed(2)}`);
          }
        } else if (answer.answer?.text) {
          console.log(`      Answer: TEXT = "${answer.answer.text.substring(0, 50)}..."`);
          console.log(`      (Text answers use default quality)`);
        }
        console.log();
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Analysis complete`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTransparencyAnswers();
