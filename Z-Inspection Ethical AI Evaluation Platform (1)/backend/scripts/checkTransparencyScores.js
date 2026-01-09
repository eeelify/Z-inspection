require('dotenv').config();
const mongoose = require('mongoose');
const Score = require('../models/score');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  
  const project = await mongoose.connection.collection('projects').findOne({ 
    title: /test.*use.*case.*deneme/i 
  });
  
  const scores = await Score.find({ projectId: project._id })
    .select('role questionnaireKey totals byPrinciple.TRANSPARENCY')
    .lean();
  
  console.log('📊 Transparency Scores by Role:\n');
  
  scores.forEach(s => {
    const trans = s.byPrinciple?.TRANSPARENCY;
    console.log(`${s.role} (${s.questionnaireKey}):`);
    console.log(`  Overall Performance: ${s.totals?.overallPerformance || 'N/A'}`);
    console.log(`  Transparency.avg: ${trans?.avg || 'N/A'}`);
    console.log(`  Transparency.performance: ${trans?.performance || 'N/A'}`);
    console.log(`  Transparency.score: ${trans?.score || 'N/A'}`);
    console.log();
  });
  
  process.exit();
}

check();
