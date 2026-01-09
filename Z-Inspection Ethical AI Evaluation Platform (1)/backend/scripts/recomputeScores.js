const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { computeEthicalScores } = require('../services/ethicalScoringService');

async function recomputeProjectScores() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment');
    }
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find "test use case deneme" project
    const Project = mongoose.connection.collection('projects');
    const project = await Project.findOne({
      title: { $regex: /test.*use.*case.*deneme/i }
    });

    if (!project) {
      console.log('❌ Project not found');
      return;
    }

    console.log(`\n🔄 Recomputing scores for: ${project.title}`);
    console.log(`   Project ID: ${project._id}\n`);

    // Delete old scores
    const Score = mongoose.connection.collection('scores');
    const deleteResult = await Score.deleteMany({ projectId: project._id });
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} old score document(s)\n`);

    // Recompute scores
    console.log('🔄 Computing new scores with Performance model...\n');
    const scores = await computeEthicalScores(project._id);
    
    console.log(`✅ Created ${scores.length} new score document(s)\n`);
    
    // Show summary
    for (const score of scores) {
      console.log(`📊 ${score.role}:`);
      console.log(`   overallPerformance field: ${score.totals?.overallPerformance}`);
      console.log(`   avg field: ${score.totals?.avg}`);
      console.log(`   overallRisk field: ${score.totals?.overallRisk}`);
      console.log(`   Full totals:`, JSON.stringify(score.totals, null, 2));
      console.log();
    }

    console.log('✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

recomputeProjectScores();
