/**
 * Analyze "test use case deneme" project
 * Shows expected report output based on:
 * - Question importance (riskScore 0-4)
 * - Answer quality (answerQuality 0-1)
 * - Final Score = Importance × Answer Quality
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI not found!');
}

mongoose.connect(MONGO_URI).catch((err) => {
  console.error('❌ MongoDB connection failed:', err);
  process.exit(1);
});

const Response = require('../models/response');
const Question = require('../models/question');

async function analyzeTestProject() {
  try {
    console.log('🔍 Searching for "test use case deneme" project...\n');
    
    // Query projects collection directly
    const projectsCollection = mongoose.connection.collection('projects');
    const project = await projectsCollection.findOne({
      title: { $regex: /test.*use.*case.*deneme/i }
    });
    
    if (!project) {
      console.log('❌ Project not found. Searching for similar names...');
      const allProjects = await projectsCollection.find({}).project({ title: 1, _id: 1 }).toArray();
      console.log('\n📋 Available projects:');
      allProjects.forEach(p => console.log(`   - ${p.title} (${p._id})`));
      return;
    }
    
    console.log(`✅ Found project: "${project.title}"`);
    console.log(`   ID: ${project._id}\n`);
    
    // Get all responses for this project
    const responses = await Response.find({
      projectId: project._id
    }).lean();
    
    if (responses.length === 0) {
      console.log('⚠️  No responses found for this project');
      return;
    }
    
    console.log(`📝 Found ${responses.length} response(s)\n`);
    
    // Get all question IDs
    const questionIds = new Set();
    for (const response of responses) {
      for (const answer of (response.answers || [])) {
        if (answer.questionId) {
          questionIds.add(answer.questionId.toString());
        }
      }
    }
    
    // Fetch all questions
    const questions = await Question.find({
      _id: { $in: Array.from(questionIds).map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();
    
    const questionMap = new Map();
    for (const q of questions) {
      questionMap.set(q._id.toString(), q);
    }
    
    console.log(`📊 Analyzing ${questionMap.size} questions...\n`);
    console.log('='.repeat(100));
    console.log('📈 EXPECTED REPORT OUTPUT');
    console.log('='.repeat(100) + '\n');
    
    // Principle groups
    const principleScores = {
      'TRANSPARENCY': { scores: [], total: 0 },
      'HUMAN AGENCY & OVERSIGHT': { scores: [], total: 0 },
      'TECHNICAL ROBUSTNESS & SAFETY': { scores: [], total: 0 },
      'PRIVACY & DATA GOVERNANCE': { scores: [], total: 0 },
      'DIVERSITY, NON-DISCRIMINATION & FAIRNESS': { scores: [], total: 0 },
      'SOCIETAL & INTERPERSONAL WELL-BEING': { scores: [], total: 0 },
      'ACCOUNTABILITY': { scores: [], total: 0 }
    };
    
    // Principle mapping
    const principleMapping = {
      'TRANSPARENCY & EXPLAINABILITY': 'TRANSPARENCY',
      'HUMAN OVERSIGHT & CONTROL': 'HUMAN AGENCY & OVERSIGHT',
      'PRIVACY & DATA PROTECTION': 'PRIVACY & DATA GOVERNANCE',
      'ACCOUNTABILITY & RESPONSIBILITY': 'ACCOUNTABILITY',
    };
    
    let totalScore = 0;
    let questionCount = 0;
    
    // Analyze each response
    for (const response of responses) {
      console.log(`\n👤 User: ${response.userId}`);
      console.log(`📋 Questionnaire: ${response.questionnaireKey}`);
      console.log(`👔 Role: ${response.role}`);
      console.log('-'.repeat(100));
      
      for (const answer of (response.answers || [])) {
        const question = questionMap.get(answer.questionId?.toString());
        if (!question) continue;
        
        // Get importance (riskScore 0-4)
        const importance = question.riskScore !== undefined ? question.riskScore : 
                          (answer.score !== undefined ? answer.score : 2);
        
        // Get answer value
        let answerQuality = 0.5; // default
        let answerDisplay = 'N/A';
        
        if (answer.answer) {
          const choiceKey = answer.answer.choiceKey;
          
          if (choiceKey) {
            answerDisplay = choiceKey;
            
            // Check optionScores first
            if (question.optionScores && question.optionScores[choiceKey] !== undefined) {
              answerQuality = question.optionScores[choiceKey];
            } 
            // Check option.answerQuality
            else if (question.options) {
              const option = question.options.find(opt => opt.key === choiceKey);
              if (option && option.answerQuality !== undefined) {
                answerQuality = option.answerQuality;
              }
            }
          } else if (answer.answer.text) {
            answerDisplay = answer.answer.text.substring(0, 50) + '...';
            answerQuality = 0.5; // Free text default
          }
        }
        
        // Calculate score
        const score = importance * answerQuality;
        
        // Add to principle
        let principle = question.principle;
        if (principleMapping[principle]) {
          principle = principleMapping[principle];
        }
        
        if (principleScores[principle]) {
          principleScores[principle].scores.push(score);
          principleScores[principle].total += score;
        }
        
        totalScore += score;
        questionCount++;
        
        // Display
        console.log(`\n   📌 ${question.code}: ${question.text?.en?.substring(0, 60)}...`);
        console.log(`      Principle: ${principle}`);
        console.log(`      Importance: ${importance}/4`);
        console.log(`      Answer: ${answerDisplay}`);
        console.log(`      Answer Quality: ${answerQuality}/1`);
        console.log(`      ➡️  Score: ${importance} × ${answerQuality} = ${score.toFixed(2)}`);
      }
    }
    
    // === SUMMARY ===
    console.log('\n' + '='.repeat(100));
    console.log('📊 EXPECTED REPORT SUMMARY');
    console.log('='.repeat(100) + '\n');
    
    // Overall score
    const averageScore = questionCount > 0 ? (totalScore / questionCount).toFixed(2) : 0;
    const maxPossibleScore = questionCount * 4; // Max importance per question
    const percentageScore = questionCount > 0 ? ((totalScore / maxPossibleScore) * 100).toFixed(1) : 0;
    
    console.log(`📈 Overall Performance:`);
    console.log(`   Total Score: ${totalScore.toFixed(2)}`);
    console.log(`   Average Score per Question: ${averageScore}`);
    console.log(`   Maximum Possible: ${maxPossibleScore}`);
    console.log(`   Performance: ${percentageScore}% of maximum`);
    console.log();
    
    // Principle breakdown
    console.log('📊 Scores by Ethical Principle:\n');
    
    const sortedPrinciples = Object.entries(principleScores)
      .filter(([_, data]) => data.scores.length > 0)
      .sort(([_, a], [__, b]) => b.total - a.total);
    
    for (const [principle, data] of sortedPrinciples) {
      const avg = (data.total / data.scores.length).toFixed(2);
      const maxForPrinciple = data.scores.length * 4;
      const percentage = ((data.total / maxForPrinciple) * 100).toFixed(1);
      
      console.log(`   ${principle}:`);
      console.log(`      Questions: ${data.scores.length}`);
      console.log(`      Total Score: ${data.total.toFixed(2)}`);
      console.log(`      Average: ${avg}/4`);
      console.log(`      Performance: ${percentage}%`);
      console.log();
    }
    
    // === INTERPRETATION ===
    console.log('='.repeat(100));
    console.log('💡 INTERPRETATION');
    console.log('='.repeat(100) + '\n');
    
    if (parseFloat(percentageScore) >= 75) {
      console.log('✅ EXCELLENT: Project shows strong ethical AI practices (75%+)');
    } else if (parseFloat(percentageScore) >= 50) {
      console.log('⚠️  GOOD: Project has adequate ethical practices but room for improvement (50-75%)');
    } else if (parseFloat(percentageScore) >= 25) {
      console.log('⚠️  NEEDS IMPROVEMENT: Significant ethical concerns identified (25-50%)');
    } else {
      console.log('❌ CRITICAL: Major ethical issues require immediate attention (<25%)');
    }
    
    console.log('\n📝 NOTE: This is the EXPECTED output based on:');
    console.log('   - Question Importance (riskScore 0-4)');
    console.log('   - Answer Quality (answerQuality 0-1)');
    console.log('   - Score Formula: Importance × Answer Quality');
    console.log('\n👉 Compare this with the actual report to verify correct calculation!\n');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB\n');
  }
}

// Run analysis
analyzeTestProject()
  .then(() => {
    console.log('✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
