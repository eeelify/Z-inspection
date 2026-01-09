const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Response = require('../models/response');
const Question = require('../models/question');
const Score = require('../models/score');
const { calculateAnswerSeverity } = require('../services/answerRiskService');

async function debugPrincipleMapping() {
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

    // Get all questions
    const questions = await Question.find({}).lean();
    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    // Principle mapping (from ethicalScoringService.js)
    const principleMapping = {
      'TRANSPARENCY & EXPLAINABILITY': 'TRANSPARENCY',
      'HUMAN OVERSIGHT & CONTROL': 'HUMAN AGENCY & OVERSIGHT',
      'PRIVACY & DATA PROTECTION': 'PRIVACY & DATA GOVERNANCE',
      'ACCOUNTABILITY & RESPONSIBILITY': 'ACCOUNTABILITY',
      'LAWFULNESS & COMPLIANCE': 'ACCOUNTABILITY',
      'RISK MANAGEMENT & HARM PREVENTION': 'TECHNICAL ROBUSTNESS & SAFETY',
      'PURPOSE LIMITATION & DATA MINIMIZATION': 'PRIVACY & DATA GOVERNANCE',
      'USER RIGHTS & AUTONOMY': 'HUMAN AGENCY & OVERSIGHT'
    };

    const CANONICAL_PRINCIPLES = [
      'TRANSPARENCY',
      'HUMAN AGENCY & OVERSIGHT',
      'TECHNICAL ROBUSTNESS & SAFETY',
      'PRIVACY & DATA GOVERNANCE',
      'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
      'SOCIETAL & INTERPERSONAL WELL-BEING',
      'ACCOUNTABILITY'
    ];

    console.log(`${'='.repeat(100)}`);
    console.log(`MANUAL CALCULATION WITH CANONICAL MAPPING`);
    console.log(`${'='.repeat(100)}\n`);

    const byCanonicalPrinciple = {};
    for (const principle of CANONICAL_PRINCIPLES) {
      byCanonicalPrinciple[principle] = {
        scores: [],
        sum: 0,
        count: 0
      };
    }

    for (const answer of response.answers) {
      const question = questionMap.get(answer.questionId?.toString());
      if (!question) continue;

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

      // Map to canonical principle
      const originalPrinciple = question.principle;
      const canonicalPrinciple = principleMapping[originalPrinciple] || originalPrinciple;

      byCanonicalPrinciple[canonicalPrinciple].scores.push(performanceScore);
      byCanonicalPrinciple[canonicalPrinciple].sum += performanceScore;
      byCanonicalPrinciple[canonicalPrinciple].count++;
    }

    console.log('Principle Averages (after canonical mapping):\n');
    const principleAvgs = [];
    for (const principle of CANONICAL_PRINCIPLES) {
      const data = byCanonicalPrinciple[principle];
      if (data.count > 0) {
        const avg = data.sum / data.count;
        principleAvgs.push(avg);
        console.log(`${principle}: ${data.count} questions, avg = ${avg.toFixed(2)}`);
      }
    }

    const overallAvgManual = principleAvgs.length > 0 
      ? principleAvgs.reduce((a, b) => a + b) / principleAvgs.length 
      : 0;

    console.log(`\n➡️  Manual Overall (with canonical mapping): ${overallAvgManual.toFixed(2)}\n`);

    // Get from MongoDB
    const score = await Score.findOne({
      projectId: project._id,
      role: 'legal-expert',
      questionnaireKey: 'legal-expert-v1'
    }).lean();

    if (score) {
      console.log(`${'='.repeat(100)}`);
      console.log(`MONGODB SCORES`);
      console.log(`${'='.repeat(100)}\n`);

      console.log('Principle Scores from MongoDB:\n');
      for (const principle of CANONICAL_PRINCIPLES) {
        const data = score.byPrinciple?.[principle];
        if (data) {
          const avg = data.performance || data.score || data.avg;
          console.log(`${principle}: ${data.answeredCount || data.n} questions, avg = ${avg?.toFixed(2) || 'N/A'}`);
        }
      }

      console.log(`\n➡️  MongoDB Overall: ${score.totals?.overallPerformance?.toFixed(2) || 'N/A'}\n`);

      console.log(`${'='.repeat(100)}`);
      console.log(`COMPARISON`);
      console.log(`${'='.repeat(100)}\n`);
      console.log(`Manual:  ${overallAvgManual.toFixed(2)}`);
      console.log(`MongoDB: ${score.totals?.overallPerformance?.toFixed(2) || 'N/A'}`);
      console.log(`Difference: ${Math.abs(overallAvgManual - (score.totals?.overallPerformance || 0)).toFixed(3)}\n`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

debugPrincipleMapping();
