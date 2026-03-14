require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function verifyReportCalculations() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Access collections directly
    const projectsCollection = mongoose.connection.collection('projects');
    const scoresCollection = mongoose.connection.collection('scores');
    const reportsCollection = mongoose.connection.collection('reports');

    // Find test project
    const project = await projectsCollection.findOne({ 
      title: { $regex: /test.*use.*case.*deneme/i } 
    });
    if (!project) {
      console.log('❌ Project "test use case deneme" not found');
      return;
    }

    console.log(`🔍 Project: ${project.title}`);
    console.log(`   ID: ${project._id}\n`);

    // Get all scores for this project
    const scores = await scoresCollection.find({ projectId: project._id })
      .project({ userId: 1, questionnaireKey: 1, byPrinciple: 1, totals: 1 })
      .toArray();

    console.log(`📊 Found ${scores.length} score documents\n`);

    // Analyze each score document
    for (const score of scores) {
      console.log(`\n📌 Score ID: ${score._id}`);
      console.log(`   User: ${score.userId}`);
      console.log(`   Questionnaire: ${score.questionnaireKey}`);
      
      if (score.totals) {
        console.log(`\n   💡 TOTALS:`);
        console.log(`      overallPerformance: ${score.totals.overallPerformance || 'N/A'}`);
        console.log(`      performancePercentage: ${score.totals.performancePercentage || 'N/A'}%`);
        console.log(`      avg: ${score.totals.avg || 'N/A'}`);
        console.log(`      overallRisk: ${score.totals.overallRisk || 'N/A'}`);
      }

      if (score.byPrinciple && Object.keys(score.byPrinciple).length > 0) {
        console.log(`\n   📊 BY PRINCIPLE (Performance Scores):`);
        for (const [principle, data] of Object.entries(score.byPrinciple)) {
          console.log(`      ${principle}:`);
          console.log(`         avg: ${data.avg || 'N/A'}`);
          console.log(`         overallPerformance: ${data.overallPerformance || 'N/A'}`);
          console.log(`         overallRisk: ${data.overallRisk || 'N/A'}`);
        }
      }
    }

    // Check if report exists
    console.log('\n\n🔍 Checking Report...\n');
    const report = await reportsCollection.findOne(
      { projectId: project._id },
      { projection: { createdAt: 1, scoring: 1 } }
    );

    if (report) {
      console.log(`✅ Report exists (created: ${report.createdAt})`);
      
      if (report.scoring) {
        console.log('\n📊 REPORT SCORING DATA:');
        
        if (report.scoring.totalsOverall) {
          console.log('\n   TOTALS OVERALL:');
          console.log(`      overallPerformance: ${report.scoring.totalsOverall.overallPerformance || 'N/A'}`);
          console.log(`      performancePercentage: ${report.scoring.totalsOverall.performancePercentage || 'N/A'}%`);
          console.log(`      avg: ${report.scoring.totalsOverall.avg || 'N/A'}`);
          console.log(`      overallRisk: ${report.scoring.totalsOverall.overallRisk || 'N/A'}`);
        }

        if (report.scoring.byPrinciple && Object.keys(report.scoring.byPrinciple).length > 0) {
          console.log('\n   BY PRINCIPLE:');
          for (const [principle, data] of Object.entries(report.scoring.byPrinciple)) {
            console.log(`\n      ${principle}:`);
            console.log(`         avg: ${data.avg || 'N/A'}`);
            console.log(`         overallPerformance: ${data.overallPerformance || 'N/A'}`);
            console.log(`         overallRisk: ${data.overallRisk || 'N/A'}`);
          }
        }
      } else {
        console.log('⚠️  Report has no scoring data');
      }
    } else {
      console.log('❌ No report found for this project');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyReportCalculations();
