/**
 * Migration: Convert question scale labels from quality-based to risk-based
 * 
 * This script updates any questions that have quality-based scale labels
 * (Excellent/Good/Moderate/Poor/Unacceptable) to risk-based labels
 * (High risk/Medium-High risk/Medium risk/Low risk/No risk).
 * 
 * IMPORTANT: This migration is optional since scale labels are currently
 * hardcoded in the frontend UI components (GeneralQuestions.tsx and EvaluationForm.tsx).
 * 
 * If scale options are stored in the database in the future, this script
 * can be used to migrate existing data.
 * 
 * Usage:
 *   node backend/migrations/migrateRiskScaleLabels.js
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const Question = require('../models/question');

// New risk-based scale options
const RISK_SCALE_OPTIONS = [
  {
    value: 4,
    labelEn: 'High risk',
    labelTr: 'Yüksek risk',
    descEn: 'High likelihood of harm / major ethical concern. Immediate mitigation required.',
    descTr: 'Zarar olasılığı yüksek / ciddi etik sorun. Acil azaltım gerekli.'
  },
  {
    value: 3,
    labelEn: 'Medium–High risk',
    labelTr: 'Orta–yüksek risk',
    descEn: 'Meaningful risk; mitigation required before wider deployment.',
    descTr: 'Anlamlı risk; yaygın kullanımdan önce azaltım gerekli.'
  },
  {
    value: 2,
    labelEn: 'Medium risk',
    labelTr: 'Orta risk',
    descEn: 'Some risk; monitor and improve safeguards.',
    descTr: 'Bir miktar risk; izleme ve güvenlik önlemleri güçlendirilmeli.'
  },
  {
    value: 1,
    labelEn: 'Low risk',
    labelTr: 'Düşük risk',
    descEn: 'Minor risk; acceptable with basic controls.',
    descTr: 'Küçük risk; temel kontrollerle kabul edilebilir.'
  },
  {
    value: 0,
    labelEn: 'No / Negligible risk',
    labelTr: 'Risk yok / ihmal edilebilir',
    descEn: 'No meaningful ethical risk identified for this question.',
    descTr: 'Bu soru için anlamlı etik risk tespit edilmedi.'
  }
];

// Old quality-based labels to detect
const OLD_LABELS_EN = ['Excellent', 'Good', 'Moderate', 'Poor', 'Unacceptable'];
const OLD_LABELS_TR = ['Mükemmel', 'İyi', 'Orta', 'Zayıf', 'Kabul Edilmez'];

async function migrateRiskScaleLabels() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find questions that might have old scale labels
    // Note: Currently, scale labels are hardcoded in UI, so this migration
    // is primarily for future-proofing if scale options are stored in DB
    const questions = await Question.find({}).lean();
    console.log(`📊 Found ${questions.length} questions to check`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const question of questions) {
      let needsUpdate = false;

      // Check if question has options array with old labels
      if (question.options && Array.isArray(question.options)) {
        for (const option of question.options) {
          const labelEn = option.label?.en || option.labelEn || '';
          const labelTr = option.label?.tr || option.labelTr || '';
          
          // Check if any old labels are present
          const hasOldLabel = OLD_LABELS_EN.some(old => 
            labelEn.includes(old) || labelTr.includes(OLD_LABELS_TR[OLD_LABELS_EN.indexOf(old)])
          );

          if (hasOldLabel) {
            needsUpdate = true;
            break;
          }
        }
      }

      // Check if question has scaleOptions field (if it exists in future schema)
      if (question.scaleOptions && Array.isArray(question.scaleOptions)) {
        for (const scaleOption of question.scaleOptions) {
          const labelEn = scaleOption.labelEn || scaleOption.label?.en || '';
          const labelTr = scaleOption.labelTr || scaleOption.label?.tr || '';
          
          const hasOldLabel = OLD_LABELS_EN.some(old => 
            labelEn.includes(old) || labelTr.includes(OLD_LABELS_TR[OLD_LABELS_EN.indexOf(old)])
          );

          if (hasOldLabel) {
            needsUpdate = true;
            break;
          }
        }
      }

      if (needsUpdate) {
        // Update question with new risk-based scale options
        const updateData = {
          $set: {
            scaleOptions: RISK_SCALE_OPTIONS,
            migratedAt: new Date(),
            updatedAt: new Date()
          }
        };

        await Question.findByIdAndUpdate(question._id, updateData);
        updatedCount++;
        console.log(`✅ Updated question ${question.code || question._id}`);
      } else {
        skippedCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Updated: ${updatedCount} questions`);
    console.log(`   Skipped: ${skippedCount} questions`);
    console.log(`   Total: ${questions.length} questions`);

    if (updatedCount === 0) {
      console.log('\nℹ️  No questions needed updating. Scale labels are currently hardcoded in UI components.');
      console.log('   This migration script is for future-proofing if scale options are stored in DB.');
    }

    console.log('\n✅ Migration completed successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateRiskScaleLabels()
    .then(() => {
      console.log('✅ Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateRiskScaleLabels, RISK_SCALE_OPTIONS };


