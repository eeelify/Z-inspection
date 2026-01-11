// ARCHIVED: Violates no-inference ethical scoring rules.
// DO NOT USE. Preserved for historical reference only.

/**
 * Migration script to backfill optionScores for existing select-based questions
 * Maps existing option.score (risk score 0-4) to answerQuality (AQ 0-1)
 * 
 * Run with: node backend/scripts/migrateOptionScores.js
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

const Question = require('../models/question');

/**
 * Map risk score (0-4) to answer quality (0-1)
 * Higher risk score = lower answer quality (if not handled well)
 * This is a default mapping - can be customized per question
 */
function mapRiskScoreToAnswerQuality(riskScore) {
    // Default mapping: inverse relationship
    // Risk score 4 (critical) -> AQ 0.2 (needs attention)
    // Risk score 0 (no risk) -> AQ 1.0 (handled well)
    if (riskScore === 0) return 1.0;
    if (riskScore === 1) return 0.8;
    if (riskScore === 2) return 0.6;
    if (riskScore === 3) return 0.4;
    if (riskScore === 4) return 0.2;
    return 0.5; // Default
}

/**
 * Alternative: Map based on option meaning
 * "Good" options -> high AQ, "Bad" options -> low AQ
 */
function inferAnswerQualityFromOption(option) {
    const key = (option.key || '').toLowerCase();
    const labelEn = (option.label?.en || '').toLowerCase();
    const labelTr = (option.label?.tr || '').toLowerCase();

    // Positive indicators
    if (key.includes('yes') || key.includes('compliant') || key.includes('fully') ||
        key.includes('strong') || key.includes('adequate') || key.includes('clear') ||
        labelEn.includes('yes') || labelEn.includes('compliant') || labelEn.includes('fully') ||
        labelTr.includes('evet') || labelTr.includes('uyumlu') || labelTr.includes('tam')) {
        return 0.8; // Good answer
    }

    // Negative indicators
    if (key.includes('no') || key.includes('non') || key.includes('not') ||
        key.includes('weak') || key.includes('unclear') || key.includes('missing') ||
        labelEn.includes('no') || labelEn.includes('non') || labelEn.includes('not') ||
        labelTr.includes('hayır') || labelTr.includes('yok') || labelTr.includes('değil')) {
        return 0.2; // Poor answer
    }

    // Neutral/partial
    if (key.includes('partial') || key.includes('mostly') || key.includes('some') ||
        labelEn.includes('partial') || labelEn.includes('mostly') ||
        labelTr.includes('kısmen') || labelTr.includes('çoğunlukla')) {
        return 0.5; // Neutral answer
    }

    // Default: use risk score mapping
    return mapRiskScoreToAnswerQuality(option.score || 2);
}

async function migrateOptionScores() {
    try {
        console.log('🔄 Starting optionScores migration...\n');

        // Get all select-based questions
        const questions = await Question.find({
            answerType: { $in: ['single_choice', 'multi_choice'] }
        });

        console.log(`📊 Found ${questions.length} select-based questions to migrate\n`);

        let updated = 0;
        let skipped = 0;

        for (const question of questions) {
            let needsUpdate = false;
            const optionScores = {};

            // Check if options have answerQuality already
            const hasAnswerQuality = question.options?.some(opt => opt.answerQuality !== undefined);

            // If answerQuality exists, use it; otherwise infer from option
            for (const option of (question.options || [])) {
                if (!option.key) continue;

                let aq;
                if (option.answerQuality !== undefined && option.answerQuality !== null) {
                    // Already has answerQuality
                    aq = option.answerQuality;
                } else {
                    // Infer from option
                    aq = inferAnswerQualityFromOption(option);
                    // Update option.answerQuality
                    option.answerQuality = aq;
                    needsUpdate = true;
                }

                // Also set in optionScores map
                optionScores[option.key] = aq;
            }

            // Update question if needed
            if (needsUpdate || Object.keys(optionScores).length > 0) {
                const updateData = {
                    options: question.options,
                    updatedAt: new Date()
                };

                // Set optionScores as Map or plain object
                if (Object.keys(optionScores).length > 0) {
                    updateData.optionScores = optionScores;
                }

                await Question.findByIdAndUpdate(question._id, updateData);
                updated++;
                console.log(`✅ Updated question ${question.code}: ${Object.keys(optionScores).length} option scores`);
            } else {
                skipped++;
                console.log(`⏭️  Skipped question ${question.code}: already has answerQuality`);
            }
        }

        console.log(`\n✅ Migration complete!`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Skipped: ${skipped}`);
        console.log(`   Total: ${questions.length}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateOptionScores();
