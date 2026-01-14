const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = '6964d4e9d7a6755353c39e4b'; // AI DESTEKLİ CV TARAMA SİSTEMİ

/**
 * Migration Script: Calculate answerSeverity from option scores
 * 
 * OPTION SCORE SYSTEM (0-4 scale):
 *   - 4 = Best answer / Very clear / No concern
 *   - 3 = Good  
 *   - 2 = Fair
 *   - 1 = Poor
 *   - 0 = Worst answer / Major concern
 * 
 * NEW SEVERITY SYSTEM (0-1 scale):
 *   - 0.0 = Safe / No risk
 *   - 0.5 = Moderate risk
 *   - 1.0 = Critical risk
 * 
 * CONVERSION FORMULA: answerSeverity = (4 - optionScore) / 4
 *   - Score 4 → Severity 0.0 (safe)
 *   - Score 3 → Severity 0.25 (low risk)
 *   - Score 2 → Severity 0.5 (moderate risk)
 *   - Score 1 → Severity 0.75 (high risk)
 *   - Score 0 → Severity 1.0 (critical risk)
 */

async function migrate() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));
        console.log('✅ Connected to MongoDB\n');

        const Response = require('./models/response');
        const Question = require('./models/question');

        // Build question map for fast lookup
        const questions = await Question.find({}).lean();
        const questionMap = new Map();
        questions.forEach(q => {
            questionMap.set(q._id.toString(), q);
            if (q.code) {
                questionMap.set(q.code, q);
            }
        });
        console.log(`📚 Loaded ${questions.length} questions\n`);

        // Find all responses for this project
        const responses = await Response.find({
            projectId: new mongoose.Types.ObjectId(PROJECT_ID)
        });

        console.log(`📊 Found ${responses.length} response documents\n`);

        let totalAnswers = 0;
        let calculatedSeverity = 0;
        let alreadyHasSeverity = 0;
        let noOptionScore = 0;
        let skippedNoChoice = 0;

        for (const response of responses) {
            let responseModified = false;

            if (!response.answers || !Array.isArray(response.answers)) {
                continue;
            }

            for (const answer of response.answers) {
                totalAnswers++;

                // Check if already has answerSeverity (non-null)
                if (answer.answerSeverity !== null && answer.answerSeverity !== undefined) {
                    alreadyHasSeverity++;
                    continue;
                }

                // Get question
                const questionId = answer.questionId?.toString() || answer.questionCode;
                const question = questionMap.get(questionId) || questionMap.get(answer.questionCode);

                if (!question) {
                    console.warn(`⚠️  Question not found for ${answer.questionCode}`);
                    continue;
                }

                // Only process single_choice and multi_choice questions
                if (question.answerType !== 'single_choice' && question.answerType !== 'multi_choice') {
                    skippedNoChoice++;
                    continue;
                }

                // Get selected choice key
                const choiceKey = answer.answer?.choiceKey;
                if (!choiceKey) {
                    skippedNoChoice++;
                    continue;
                }

                // Find matching option
                const option = question.options?.find(opt => opt.key === choiceKey);
                if (!option) {
                    console.warn(`⚠️  Option not found: ${choiceKey} in question ${question.code}`);
                    noOptionScore++;
                    continue;
                }

                // Get option score (0-4 scale)
                const optionScore = option.score !== undefined ? Number(option.score) : null;
                if (optionScore === null || isNaN(optionScore)) {
                    console.warn(`⚠️  Option ${choiceKey} has no valid score in question ${question.code}`);
                    noOptionScore++;
                    continue;
                }

                // Calculate severity: (4 - score) / 4
                const severity = (4 - optionScore) / 4;
                const clampedSeverity = Math.max(0, Math.min(1, severity));

                // Set answerSeverity
                answer.answerSeverity = clampedSeverity;
                responseModified = true;
                calculatedSeverity++;

                console.log(`  ✓ ${question.code} [${choiceKey}]: score=${optionScore} → severity=${clampedSeverity.toFixed(2)}`);
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
        console.log(`Total answers processed:       ${totalAnswers}`);
        console.log(`Calculated severity:           ${calculatedSeverity}`);
        console.log(`Already had severity:          ${alreadyHasSeverity}`);
        console.log(`Skipped (no choice/text):      ${skippedNoChoice}`);
        console.log(`Skipped (no option score):     ${noOptionScore}`);
        console.log('='.repeat(60));

        if (calculatedSeverity > 0) {
            console.log('\n✅ Migration completed successfully!');
            console.log('\n🔄 NEXT STEPS:');
            console.log('   1. Recompute scores: node scripts/recomputeScoresRPN.js');
            console.log('   2. Test dashboard and report generation');
        } else {
            console.log('\n⚠️  No severities were calculated.');
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
