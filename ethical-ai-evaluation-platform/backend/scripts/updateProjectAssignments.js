/**
 * Update existing project assignments to use new questionnaire keys:
 * - ethical-expert: ["general-v1", "ethical-expert-v1"]
 * - medical-expert: ["general-v1", "medical-expert-v1"]
 * 
 * Run with: node backend/scripts/updateProjectAssignments.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI environment variable bulunamadı!');
}

mongoose.connect(MONGO_URI).catch((err) => {
  console.error('❌ MongoDB bağlantısı başarısız:', err);
  process.exit(1);
});

const ProjectAssignment = require('../models/projectAssignment');

async function updateAssignments() {
  try {
    console.log('🔄 Updating project assignments...\n');

    // Update ethical-expert assignments
    const ethicalAssignments = await ProjectAssignment.find({ role: 'ethical-expert' });
    console.log(`Found ${ethicalAssignments.length} ethical-expert assignments`);
    
    let ethicalUpdated = 0;
    for (const assignment of ethicalAssignments) {
      const newQuestionnaires = ['general-v1', 'ethical-expert-v1'];
      const needsUpdate = !assignment.questionnaires || 
        !assignment.questionnaires.includes('ethical-expert-v1') ||
        JSON.stringify(assignment.questionnaires.sort()) !== JSON.stringify(newQuestionnaires.sort());
      
      if (needsUpdate) {
        await ProjectAssignment.findByIdAndUpdate(assignment._id, {
          questionnaires: newQuestionnaires
        });
        ethicalUpdated++;
        console.log(`  ✅ Updated assignment for user ${assignment.userId}`);
      }
    }
    console.log(`  ✅ Updated ${ethicalUpdated} ethical-expert assignments\n`);

    // Update medical-expert assignments
    const medicalAssignments = await ProjectAssignment.find({ role: 'medical-expert' });
    console.log(`Found ${medicalAssignments.length} medical-expert assignments`);
    
    let medicalUpdated = 0;
    for (const assignment of medicalAssignments) {
      const newQuestionnaires = ['general-v1', 'medical-expert-v1'];
      const needsUpdate = !assignment.questionnaires || 
        !assignment.questionnaires.includes('medical-expert-v1') ||
        JSON.stringify(assignment.questionnaires.sort()) !== JSON.stringify(newQuestionnaires.sort());
      
      if (needsUpdate) {
        await ProjectAssignment.findByIdAndUpdate(assignment._id, {
          questionnaires: newQuestionnaires
        });
        medicalUpdated++;
        console.log(`  ✅ Updated assignment for user ${assignment.userId}`);
      }
    }
    console.log(`  ✅ Updated ${medicalUpdated} medical-expert assignments\n`);

    // Verify
    console.log('📊 Verification:');
    const allAssignments = await ProjectAssignment.find({
      role: { $in: ['ethical-expert', 'medical-expert'] }
    }).lean();
    
    allAssignments.forEach(assignment => {
      console.log(`  ${assignment.role}: ${assignment.questionnaires?.join(', ') || 'none'}`);
    });

    console.log('\n✅ Update complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  }
}

updateAssignments();



