// ARCHIVED: Violates no-inference ethical scoring rules.
// DO NOT USE. Preserved for historical reference only.

/**
 * Script to set answerQuality values for all question options
 * answerQuality (0-1): Quality/appropriateness of the answer
 * 
 * Final Score = Importance (0-4) × Answer Quality (0-1)
 * 
 * Run with: node backend/scripts/setAnswerQualityValues.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    throw new Error('❌ MONGO_URI environment variable not found!');
}

mongoose.connect(MONGO_URI).catch((err) => {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
});

const Question = require('../models/question');

/**
 * Common answer pattern mappings
 * These cover most standard questionnaire patterns
 */
const ANSWER_QUALITY_PATTERNS = {
    // Clarity patterns
    'very_clear': 1.0,
    'very clear': 1.0,
    'mostly_clear': 0.75,
    'mostly clear': 0.75,
    'somewhat_unclear': 0.5,
    'somewhat unclear': 0.5,
    'completely_unclear': 0.25,
    'completely unclear': 0.25,
    'unclear': 0.25,

    // Confidence patterns
    'very_confident': 1.0,
    'very confident': 1.0,
    'somewhat_confident': 0.67,
    'somewhat confident': 0.67,
    'not_very_confident': 0.33,
    'not very confident': 0.33,
    'not_at_all': 0.0,
    'not at all': 0.0,

    // Yes/No/Depends patterns
    'yes': 1.0,
    'evet': 1.0,
    'no': 0.0,
    'hayır': 0.0,
    'depends': 0.5,
    'bağlı': 0.5,
    'partially': 0.5,
    'kısmen': 0.5,

    // Compliance/Implementation patterns
    'fully_implemented': 1.0,
    'fully implemented': 1.0,
    'tam uygulanan': 1.0,
    'mostly_implemented': 0.75,
    'mostly implemented': 0.75,
    'çoğunlukla uygulanan': 0.75,
    'partially_implemented': 0.5,
    'partially implemented': 0.5,
    'kısmen uygulanan': 0.5,
    'not_implemented': 0.0,
    'not implemented': 0.0,
    'uygulanmayan': 0.0,

    // Adequacy patterns
    'adequate': 1.0,
    'yeterli': 1.0,
    'sufficient': 1.0,
    'inadequate': 0.0,
    'yetersiz': 0.0,
    'insufficient': 0.0,

    // Frequency patterns
    'always': 1.0,
    'her zaman': 1.0,
    'frequently': 0.75,
    'sık sık': 0.75,
    'sometimes': 0.5,
    'bazen': 0.5,
    'rarely': 0.25,
    'nadiren': 0.25,
    'never': 0.0,
    'hiçbir zaman': 0.0,

    // Strength patterns
    'strong': 1.0,
    'güçlü': 1.0,
    'moderate': 0.5,
    'orta': 0.5,
    'weak': 0.25,
    'zayıf': 0.25,

    // Agreement patterns
    'strongly_agree': 1.0,
    'strongly agree': 1.0,
    'kesinlikle katılıyorum': 1.0,
    'agree': 0.75,
    'katılıyorum': 0.75,
    'neutral': 0.5,
    'tarafsız': 0.5,
    'disagree': 0.25,
    'katılmıyorum': 0.25,
    'strongly_disagree': 0.0,
    'strongly disagree': 0.0,
    'kesinlikle katılmıyorum': 0.0,

    // Degree/Extent patterns (NEW - from user feedback)
    'fully': 1.0,
    'tamamen': 1.0,
    'mostly': 0.75,
    'çoğunlukla': 0.75,
    'slightly': 0.25,
    'hafifçe': 0.25,
    'biraz': 0.25,

    // Likelihood patterns (NEW - from user feedback)
    'very_likely': 1.0,
    'very likely': 1.0,
    'çok muhtemel': 1.0,
    'likely': 0.75,
    'muhtemel': 0.75,
    'possible': 0.5,
    'mümkün': 0.5,
    'olası': 0.5,
    'unlikely': 0.25,
    'olası değil': 0.25,
    'pek muhtemel değil': 0.25,
};

/**
 * Infer answer quality from option key and labels
 */
function inferAnswerQuality(option) {
    const key = (option.key || '').toLowerCase().trim();
    const labelEn = (option.label?.en || '').toLowerCase().trim();
    const labelTr = (option.label?.tr || '').toLowerCase().trim();

    // Check exact matches first
    if (ANSWER_QUALITY_PATTERNS[key] !== undefined) {
        return ANSWER_QUALITY_PATTERNS[key];
    }
    if (ANSWER_QUALITY_PATTERNS[labelEn] !== undefined) {
        return ANSWER_QUALITY_PATTERNS[labelEn];
    }
    if (ANSWER_QUALITY_PATTERNS[labelTr] !== undefined) {
        return ANSWER_QUALITY_PATTERNS[labelTr];
    }

    // Keyword-based inference (broader matching)
    const allText = `${key} ${labelEn} ${labelTr}`.toLowerCase();

    // Very positive (1.0)
    if (allText.match(/\b(yes|evet|fully|tam|tamamen|complete|strong|excellent|always|her zaman|very likely|çok muhtemel|very clear)\b/)) {
        return 1.0;
    }

    // Positive (0.75)
    if (allText.match(/\b(mostly|çoğunlukla|frequently|sık|adequate|yeterli|good|iyi|likely|muhtemel)\b/)) {
        return 0.75;
    }

    // Negative (0.25)
    if (allText.match(/\b(rarely|nadiren|weak|zayıf|poor|kötü|inadequate|yetersiz|unclear|belirsiz|slightly|hafifçe|biraz|unlikely|olası değil)\b/)) {
        return 0.25;
    }

    // Very negative (0.0)
    if (allText.match(/\b(no|hayır|never|hiçbir|none|yok|not at all|hiç|missing|completely unclear)\b/)) {
        return 0.0;
    }

    // Neutral/partial (0.5)
    if (allText.match(/\b(partially|kısmen|sometimes|bazen|moderate|orta|depends|bağlı|neutral|possible|mümkün|olası|somewhat)\b/)) {
        return 0.5;
    }

    // Default: neutral
    console.warn(`⚠️  Could not infer answerQuality for option: ${key} / ${labelEn} / ${labelTr}. Using default 0.5`);
    return 0.5;
}

/**
 * Main migration function
 */
async function setAnswerQualityValues() {
    try {
        console.log('🚀 Starting answerQuality migration...\n');

        const questions = await Question.find({
            answerType: { $in: ['single_choice', 'multi_choice'] }
        });

        console.log(`📊 Found ${questions.length} select-based questions\n`);

        let updated = 0;
        let skipped = 0;
        let optionsUpdated = 0;

        for (const question of questions) {
            if (!question.options || question.options.length === 0) {
                skipped++;
                continue;
            }

            let needsUpdate = false;
            let optionUpdates = [];

            for (const option of question.options) {
                if (!option.key) continue;

                // Check if answerQuality already exists and is reasonable
                if (option.answerQuality !== undefined && option.answerQuality !== null &&
                    option.answerQuality >= 0 && option.answerQuality <= 1) {
                    // Already has valid answerQuality
                    continue;
                }

                // Infer and set answerQuality
                const aq = inferAnswerQuality(option);
                option.answerQuality = aq;
                needsUpdate = true;
                optionsUpdated++;
                optionUpdates.push(`  ${option.key}: ${aq}`);
            }

            if (needsUpdate) {
                // Also populate optionScores for backward compatibility
                const optionScores = {};
                for (const option of question.options) {
                    if (option.key && option.answerQuality !== undefined) {
                        optionScores[option.key] = option.answerQuality;
                    }
                }
                question.optionScores = optionScores;

                await question.save();
                updated++;
                console.log(`✅ Updated question ${question.code} (${question.questionnaireKey}):`);
                optionUpdates.forEach(u => console.log(u));
                console.log('');
            } else {
                skipped++;
            }
        }

        console.log('\n📊 Migration Complete!');
        console.log(`✅ Updated: ${updated} questions`);
        console.log(`⏭️  Skipped: ${skipped} questions (already have answerQuality)`);
        console.log(`🔢 Total options updated: ${optionsUpdated}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run the migration
setAnswerQualityValues()
    .then(() => {
        console.log('✅ Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    });
