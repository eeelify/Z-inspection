/**
 * Restore questionnaires that were deleted
 * Creates: general-v1, ethical-expert-v1, medical-expert-v1
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

const Questionnaire = require('../models/questionnaire');

async function restoreQuestionnaires() {
  try {
    console.log('🔄 Restoring Questionnaires...\n');
    
    // Create general-v1
    const general = await Questionnaire.findOneAndUpdate(
      { key: 'general-v1' },
      {
        key: 'general-v1',
        title: 'General Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      },
      { new: true, upsert: true }
    );
    console.log(`✅ Created/Updated: ${general.key} - ${general.title}`);
    
    // Create ethical-expert-v1
    const ethical = await Questionnaire.findOneAndUpdate(
      { key: 'ethical-expert-v1' },
      {
        key: 'ethical-expert-v1',
        title: 'Ethical Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      },
      { new: true, upsert: true }
    );
    console.log(`✅ Created/Updated: ${ethical.key} - ${ethical.title}`);
    
    // Create medical-expert-v1
    const medical = await Questionnaire.findOneAndUpdate(
      { key: 'medical-expert-v1' },
      {
        key: 'medical-expert-v1',
        title: 'Medical Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      },
      { new: true, upsert: true }
    );
    console.log(`✅ Created/Updated: ${medical.key} - ${medical.title}`);
    
    // Verify
    console.log('\n📋 Verification:');
    const all = await Questionnaire.find({ isActive: true }).lean();
    all.forEach(q => {
      console.log(`  - ${q.key}: ${q.title}`);
    });
    
    console.log('\n✅ Questionnaires restored successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

restoreQuestionnaires();



