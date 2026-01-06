const mongoose = require('mongoose');
require('dotenv').config();

const Response = require('../models/response');

async function removeT1T2FromTechnical() {
  try {
    // MongoDB connection
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/z-inspection';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find technical-expert-v1 responses
    const responses = await Response.find({
      questionnaireKey: 'technical-expert-v1'
    });

    console.log(`📊 Found ${responses.length} technical-expert-v1 response(s)`);

    let totalRemoved = 0;

    for (const response of responses) {
      const beforeCount = response.answers.length;
      
      // Remove T1 and T2 questions
      response.answers = response.answers.filter(
        answer => answer.questionCode !== 'T1' && answer.questionCode !== 'T2'
      );

      const afterCount = response.answers.length;
      const removed = beforeCount - afterCount;

      if (removed > 0) {
        await response.save();
        console.log(`✅ Removed ${removed} question(s) from response ${response._id} (userId: ${response.userId})`);
        totalRemoved += removed;
      }
    }

    console.log(`\n✅ Total removed: ${totalRemoved} question(s) (T1 and T2)`);
    console.log('✅ Done!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

removeT1T2FromTechnical();

