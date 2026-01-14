const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = '6964d4e9d7a6755353c39e4b'; // AI DESTEKLİ CV TARAMA SİSTEMİ

/**
 * Migration Script: Convert legacy answerScore to answerSeverity
 * 
 * LEGACY SYSTEM: answerScore (0-1 scale)
 *   - 0 = High risk / Bad performance
 *   - 1 = Low risk / Good performance
 * 
 * NEW SYSTEM: answerSeverity (0-1 scale)  
 *   - 0 = Safe / No risk
 *   - 1 = Critical risk
 * 
 * CONVERSION FORMULA: answerSeverity = 1 - answerScore
 */

async function migrate() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));
        console.log('✅ Connected to MongoDB\n');

        const Response = require('./models/response');

        // Find all responses for this project
        const responses = await Response.find({
            projectId: new mongoose.Types.ObjectId(PROJECT_ID)
        });

        console.log(`📊 Found ${responses.length} response documents for project ${PROJECT_ID}\n`);

        let totalAnswers = 0;
        let migratedAnswers = 0;
        let skippedAnswers = 0;
        let alreadyMigrated = 0;

        for (const response of responses) {
            let responseModified = false;

            if (!response.answers || !Array.isArray(response.answers)) {
                continue;
            }

            for (const answer of response.answers) {
                totalAnswers++;

                // Check if this answer needs migration
                if (answer.answerSeverity !== undefined && answer.answerSeverity !== null) {
                    // Already has answerSeverity, skip
                    alreadyMigrated++;
                    continue;
                }

                if (answer.answerScore === undefined || answer.answerScore === null) {
                    // No answerScore to migrate from, skip
                    skippedAnswers++;
                    continue;
                }

                // MIGRATE: answerSeverity = 1 - answerScore
                const legacyScore = Number(answer.answerScore);
                if (isNaN(legacyScore)) {
                    console.warn(`⚠️  Invalid answerScore for question ${answer.questionCode}: ${answer.answerScore}`);
                    skippedAnswers++;
                    continue;
                }

                // Clamp to 0-1 range
                const clampedScore = Math.max(0, Math.min(1, legacyScore));
                const newSeverity = 1 - clampedScore;

                // Set the new field
                answer.answerSeverity = newSeverity;
                responseModified = true;
                migratedAnswers++;

                console.log(`  ✓ ${answer.questionCode}: answerScore=${legacyScore.toFixed(2)} → answerSeverity=${newSeverity.toFixed(2)}`);
            }

            // Save the response if modified
            if (responseModified) {
                await response.save();
                console.log(`  💾 Saved response ${response._id}\n`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total answers processed:     ${totalAnswers}`);
        console.log(`Migrated (score → severity): ${migratedAnswers}`);
        console.log(`Already had severity:        ${alreadyMigrated}`);
        console.log(`Skipped (no answerScore):    ${skippedAnswers}`);
        console.log('='.repeat(60));

        if (migratedAnswers > 0) {
            console.log('\n✅ Migration completed successfully!');
            console.log('\n🔄 NEXT STEP: Recompute scores for this project');
            console.log('   Run: node scripts/recomputeScoresRPN.js');
        } else {
            console.log('\n⚠️  No answers were migrated. All answers already have answerSeverity or missing answerScore.');
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('\n❌ Migration Failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

migrate();
