require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function deleteOldReport() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const reportsCollection = mongoose.connection.collection('reports');
    const projectsCollection = mongoose.connection.collection('projects');

    // Find test project
    const project = await projectsCollection.findOne({ 
      title: { $regex: /test.*use.*case.*deneme/i } 
    });

    if (!project) {
      console.log('❌ Project not found');
      return;
    }

    console.log(`🔍 Project: ${project.title}`);
    console.log(`   ID: ${project._id}\n`);

    // Delete all reports for this project
    const result = await reportsCollection.deleteMany({ projectId: project._id });
    
    console.log(`✅ Deleted ${result.deletedCount} report(s)`);
    console.log('\n📝 Now generate a new report from the frontend!');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteOldReport();
