const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Response = require('../models/response');
const Question = require('../models/question');
const { computeEthicalScores } = require('../services/ethicalScoringService');

async function debugEthicalScoring() {
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

    console.log(`📊 Debugging Ethical Scoring for: ${project.title}\n`);

    // Get medical-expert general-v1 response
    const responses = await Response.find({ 
      projectId: project._id,
      role: 'medical-expert',
      questionnaireKey: 'general-v1'
    }).lean();

    if (responses.length === 0) {
      console.log('❌ No responses found');
      return;
    }

    console.log(`Found ${responses.length} response(s)\n`);

    // Call computeEthicalScores with debugging
    console.log(`${'='.repeat(100)}`);
    console.log(`CALLING computeEthicalScores()`);
    console.log(`${'='.repeat(100)}\n`);

    const firstResponse = responses[0];
    console.log(`Using userId: ${firstResponse.userId}`);
    console.log(`Using questionnaireKey: ${firstResponse.questionnaireKey}\n`);

    const originalLog = console.log;
    let logBuffer = [];

    // Temporarily intercept console.log
    console.log = function(...args) {
      logBuffer.push(args.join(' '));
      originalLog.apply(console, args);
    };

    // CORRECT USAGE: computeEthicalScores(projectId, userId, questionnaireKey)
    const scoreDocsArray = await computeEthicalScores(
      project._id.toString(), 
      firstResponse.userId?.toString(), 
      firstResponse.questionnaireKey
    );
    
    const scoreDoc = scoreDocsArray && scoreDocsArray.length > 0 ? scoreDocsArray[0] : null;

    // Restore console.log
    console.log = originalLog;

    console.log(`\n${'='.repeat(100)}`);
    console.log(`RESULT FROM computeEthicalScores()`);
    console.log(`${'='.repeat(100)}\n`);

    console.log(`scoreDoc type: ${typeof scoreDoc}`);
    console.log(`scoreDoc value:`, scoreDoc ? 'EXISTS' : 'NULL/UNDEFINED');
    
    if (!scoreDoc) {
      console.log('❌ computeEthicalScores returned null/undefined!');
      await mongoose.disconnect();
      process.exit(1);
    }

    if (scoreDoc && scoreDoc.byPrinciple) {
      console.log('TRANSPARENCY Principle:');
      const transp = scoreDoc.byPrinciple['TRANSPARENCY'];
      if (transp) {
        console.log(`   Performance: ${transp.performance || transp.score || transp.avg}`);
        console.log(`   Answered Count: ${transp.answeredCount || transp.n}`);
        console.log(`   Missing Count: ${transp.missingCount || 0}`);
        console.log(`   Top Drivers:`, transp.topDrivers);
        console.log();
      } else {
        console.log('   ❌ TRANSPARENCY not found in byPrinciple!\n');
      }

      console.log('Overall Performance:');
      console.log(`   overallPerformance: ${scoreDoc.totals?.overallPerformance}`);
      console.log(`   avg: ${scoreDoc.totals?.avg}`);
      console.log(`   overallRisk: ${scoreDoc.totals?.overallRisk}`);
      console.log();
    }

    // Now save it and check what's actually in MongoDB
    console.log(`\n${'='.repeat(100)}`);
    console.log(`SAVING TO MONGODB AND RE-READING`);
    console.log(`${'='.repeat(100)}\n`);

    if (scoreDoc) {
      const Score = require('../models/score');
      
      // Delete old scores
      const deleteResult = await Score.deleteMany({ 
        projectId: project._id,
        role: 'medical-expert',
        questionnaireKey: 'general-v1'
      });
      console.log(`Deleted ${deleteResult.deletedCount} old score(s)\n`);
      
      // Save new score
      console.log('Attempting to create new score...');
      console.log(`scoreDoc keys:`, Object.keys(scoreDoc));
      
      const savedScore = await Score.create(scoreDoc);
      console.log(`✅ Saved with ID: ${savedScore._id}\n`);
      
      // Re-read from MongoDB
      const readBack = await Score.findById(savedScore._id).lean();
      
      if (!readBack) {
        console.log('❌ readBack is null!\n');
      } else {
        console.log('TRANSPARENCY (re-read from MongoDB):');
        const transpRead = readBack.byPrinciple?.['TRANSPARENCY'];
        if (transpRead) {
          console.log(`   Performance: ${transpRead.performance || transpRead.score || transpRead.avg}`);
          console.log(`   Answered Count: ${transpRead.answeredCount || transpRead.n}`);
          console.log(`   Missing Count: ${transpRead.missingCount || 0}`);
          console.log();
        } else {
          console.log('   ❌ TRANSPARENCY not found!\n');
        }
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

debugEthicalScoring();
