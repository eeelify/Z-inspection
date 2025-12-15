/**
 * Verify the architecture is correctly implemented:
 * 1. Verify questionnaires exist: general-v1, ethical-expert-v1, medical-expert-v1
 * 2. Verify questions are correctly linked via questionnaireKey
 * 3. Verify responses use correct questionnaireKey
 * 4. Verify project assignments use correct questionnaires
 * 
 * Run with: node backend/scripts/verifyArchitecture.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI);

const Questionnaire = require('../models/questionnaire');
const Question = require('../models/question');
const ProjectAssignment = require('../models/projectAssignment');
const Response = require('../models/response');

async function verify() {
  try {
    console.log('🔍 Verifying Architecture...\n');
    let allPassed = true;

    // 1. Verify questionnaires
    console.log('1️⃣ Checking Questionnaires...');
    const requiredQuestionnaires = ['general-v1', 'ethical-expert-v1', 'medical-expert-v1'];
    const questionnaires = await Questionnaire.find({ key: { $in: requiredQuestionnaires } }).lean();
    const foundKeys = questionnaires.map(q => q.key);
    
    requiredQuestionnaires.forEach(key => {
      if (foundKeys.includes(key)) {
        const q = questionnaires.find(q => q.key === key);
        console.log(`  ✅ ${key}: ${q.title} (v${q.version}, active: ${q.isActive})`);
      } else {
        console.log(`  ❌ ${key}: NOT FOUND`);
        allPassed = false;
      }
    });

    // 2. Verify questions
    console.log('\n2️⃣ Checking Questions...');
    const generalCount = await Question.countDocuments({ questionnaireKey: 'general-v1' });
    const ethicalCount = await Question.countDocuments({ questionnaireKey: 'ethical-expert-v1' });
    const medicalCount = await Question.countDocuments({ questionnaireKey: 'medical-expert-v1' });
    
    console.log(`  general-v1: ${generalCount} questions`);
    console.log(`  ethical-expert-v1: ${ethicalCount} questions`);
    console.log(`  medical-expert-v1: ${medicalCount} questions`);
    
    if (generalCount === 0 || ethicalCount === 0 || medicalCount === 0) {
      console.log('  ⚠️  Some questionnaires have no questions');
      allPassed = false;
    }

    // Check for questions in old questionnaires
    const oldEthical = await Question.countDocuments({ questionnaireKey: 'ethical-v1' });
    const oldMedical = await Question.countDocuments({ questionnaireKey: 'medical-v1' });
    if (oldEthical > 0 || oldMedical > 0) {
      console.log(`  ⚠️  Found questions in old questionnaires: ethical-v1 (${oldEthical}), medical-v1 (${oldMedical})`);
      console.log('     These should be migrated to ethical-expert-v1 and medical-expert-v1');
    }

    // 3. Verify project assignments
    console.log('\n3️⃣ Checking Project Assignments...');
    const ethicalAssignments = await ProjectAssignment.find({ role: 'ethical-expert' }).lean();
    const medicalAssignments = await ProjectAssignment.find({ role: 'medical-expert' }).lean();
    
    console.log(`  ethical-expert assignments: ${ethicalAssignments.length}`);
    ethicalAssignments.forEach(assignment => {
      const hasGeneral = assignment.questionnaires?.includes('general-v1');
      const hasEthical = assignment.questionnaires?.includes('ethical-expert-v1');
      if (hasGeneral && hasEthical) {
        console.log(`    ✅ User ${assignment.userId}: ${assignment.questionnaires.join(', ')}`);
      } else {
        console.log(`    ❌ User ${assignment.userId}: Missing questionnaires (has: ${assignment.questionnaires?.join(', ') || 'none'})`);
        allPassed = false;
      }
    });
    
    console.log(`  medical-expert assignments: ${medicalAssignments.length}`);
    medicalAssignments.forEach(assignment => {
      const hasGeneral = assignment.questionnaires?.includes('general-v1');
      const hasMedical = assignment.questionnaires?.includes('medical-expert-v1');
      if (hasGeneral && hasMedical) {
        console.log(`    ✅ User ${assignment.userId}: ${assignment.questionnaires.join(', ')}`);
      } else {
        console.log(`    ❌ User ${assignment.userId}: Missing questionnaires (has: ${assignment.questionnaires?.join(', ') || 'none'})`);
        allPassed = false;
      }
    });

    // 4. Verify responses (if any exist)
    console.log('\n4️⃣ Checking Responses...');
    const responseCounts = {
      'general-v1': await Response.countDocuments({ questionnaireKey: 'general-v1' }),
      'ethical-expert-v1': await Response.countDocuments({ questionnaireKey: 'ethical-expert-v1' }),
      'medical-expert-v1': await Response.countDocuments({ questionnaireKey: 'medical-expert-v1' }),
      'ethical-v1': await Response.countDocuments({ questionnaireKey: 'ethical-v1' }),
      'medical-v1': await Response.countDocuments({ questionnaireKey: 'medical-v1' })
    };
    
    console.log('  Response counts by questionnaire:');
    Object.entries(responseCounts).forEach(([key, count]) => {
      if (count > 0) {
        const isOld = key === 'ethical-v1' || key === 'medical-v1';
        console.log(`    ${isOld ? '⚠️' : '✅'} ${key}: ${count} responses`);
        if (isOld) {
          console.log(`       ⚠️  Old questionnaire key - should migrate to ${key.replace('-v1', '-expert-v1')}`);
        }
      }
    });

    // 5. Verify no role-specific questions in general-v1
    console.log('\n5️⃣ Checking general-v1 for role-specific questions...');
    const roleSpecificInGeneral = await Question.find({
      questionnaireKey: 'general-v1',
      appliesToRoles: { $ne: 'any', $nin: [['any']] }
    }).lean();
    
    if (roleSpecificInGeneral.length > 0) {
      console.log(`  ❌ Found ${roleSpecificInGeneral.length} role-specific questions in general-v1:`);
      roleSpecificInGeneral.forEach(q => {
        console.log(`    - ${q.code}: ${q.appliesToRoles.join(', ')}`);
      });
      allPassed = false;
    } else {
      console.log('  ✅ No role-specific questions in general-v1');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('✅ All checks passed! Architecture is correct.');
    } else {
      console.log('❌ Some checks failed. Please review the issues above.');
    }
    console.log('='.repeat(50));

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verify();



