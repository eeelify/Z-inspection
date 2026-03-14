const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Response = require('../models/response');
const Question = require('../models/question');
const { calculateAnswerSeverity } = require('../services/answerRiskService');

async function debugLegalExpertMismatch() {
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

    console.log(`📊 Debugging legal-expert legal-expert-v1 mismatch\n`);
    console.log(`Project: ${project.title}`);
    console.log(`Expected: 1.38`);
    console.log(`MongoDB: 1.14`);
    console.log(`Difference: 0.236\n`);

    // Get legal-expert legal-expert-v1 response
    const response = await Response.findOne({ 
      projectId: project._id,
      role: 'legal-expert',
      questionnaireKey: 'legal-expert-v1',
      status: 'draft'
    }).lean();

    if (!response) {
      console.log('❌ Response not found');
      return;
    }

    console.log(`Found response with ${response.answers.length} answers\n`);

    // Get all questions
    const questions = await Question.find({}).lean();
    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    console.log(`${'='.repeat(100)}`);
    console.log(`DETAILED ANSWER ANALYSIS`);
    console.log(`${'='.repeat(100)}\n`);

    const byPrinciple = {};
    let issueCount = 0;

    for (const answer of response.answers) {
      const question = questionMap.get(answer.questionId?.toString());
      if (!question) {
        console.log(`⚠️  Question not found for ID: ${answer.questionId}`);
        continue;
      }

      // Get importance
      let importance;
      if (answer.score !== undefined && answer.score !== null) {
        importance = answer.score;
      } else if (question.riskScore !== undefined && question.riskScore !== null) {
        importance = question.riskScore;
      } else {
        importance = 2;
      }

      // Get answer quality
      const answerSeverityResult = calculateAnswerSeverity(question, answer);
      const answerValue = answerSeverityResult.answerSeverity;
      const isQuality = answerSeverityResult.isQuality || false;

      const performanceScore = isQuality 
        ? (importance * answerValue)
        : (importance - (importance * answerValue));

      // Check for issues
      const hasIssue = !isQuality || answerValue === 0.5;
      if (hasIssue) {
        issueCount++;
        console.log(`⚠️  POTENTIAL ISSUE - ${question.code}:`);
        console.log(`   Principle: ${question.principle}`);
        console.log(`   Answer Type: ${question.answerType}`);
        console.log(`   Choice Key: ${answer.answer?.choiceKey || 'N/A'}`);
        console.log(`   Text Answer: ${answer.answer?.text ? 'YES' : 'NO'}`);
        console.log(`   Importance (answer.score): ${answer.score}`);
        console.log(`   Importance (question.riskScore): ${question.riskScore}`);
        console.log(`   Importance (used): ${importance}`);
        console.log(`   Answer Value: ${answerValue}`);
        console.log(`   Is Quality?: ${isQuality ? 'YES' : 'NO (severity/fallback)'}`);
        console.log(`   Source: ${answerSeverityResult.source}`);
        console.log(`   Performance Score: ${performanceScore.toFixed(2)}`);
        console.log();
      }

      // Aggregate by principle
      const principle = question.principle;
      if (!byPrinciple[principle]) {
        byPrinciple[principle] = {
          scores: [],
          sum: 0,
          count: 0
        };
      }
      byPrinciple[principle].scores.push(performanceScore);
      byPrinciple[principle].sum += performanceScore;
      byPrinciple[principle].count++;
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`PRINCIPLE-LEVEL SUMMARY`);
    console.log(`${'='.repeat(100)}\n`);

    const principleAvgs = [];
    Object.entries(byPrinciple).forEach(([principle, data]) => {
      const avg = data.sum / data.count;
      principleAvgs.push(avg);
      console.log(`${principle}: ${data.count} questions, avg = ${avg.toFixed(2)}`);
    });

    const overallAvg = principleAvgs.length > 0 
      ? principleAvgs.reduce((a, b) => a + b) / principleAvgs.length 
      : 0;

    console.log(`\n➡️  Manual Overall Performance: ${overallAvg.toFixed(2)}`);
    console.log(`   MongoDB Overall Performance: 1.14`);
    console.log(`   Difference: ${Math.abs(overallAvg - 1.14).toFixed(2)}`);

    console.log(`\n${'='.repeat(100)}`);
    console.log(`SUMMARY`);
    console.log(`${'='.repeat(100)}\n`);
    console.log(`Total Answers: ${response.answers.length}`);
    console.log(`Potential Issues: ${issueCount}`);
    console.log(`Issues: Answers using fallback (severity) or default (0.5) values\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

debugLegalExpertMismatch();
