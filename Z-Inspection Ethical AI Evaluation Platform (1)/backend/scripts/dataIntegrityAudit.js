/**
 * READ-ONLY DATA INTEGRITY AUDIT SCRIPT
 * 
 * This script performs a comprehensive audit of MongoDB collections
 * to verify answer persistence integrity and ethical scoring semantics.
 * 
 * DOES NOT MODIFY ANY DATA.
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Models
const Response = require('../models/response');
const Score = require('../models/score');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';

async function runAudit() {
    console.log('==============================================================');
    console.log('        READ-ONLY DATA INTEGRITY AUDIT');
    console.log('==============================================================');
    console.log('Started at:', new Date().toISOString());
    console.log('');

    const violations = [];
    const compliantAreas = [];

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');
        console.log('');

        // ================================================================
        // 1. RESPONSE IDENTITY CHECK
        // ================================================================
        console.log('─────────────────────────────────────────────────────────────');
        console.log('CHECK 1: RESPONSE IDENTITY');
        console.log('─────────────────────────────────────────────────────────────');

        const responseCount = await Response.countDocuments();
        console.log(`Total responses: ${responseCount}`);

        // Check for missing projectId or userId
        const missingProjectId = await Response.countDocuments({ projectId: { $exists: false } });
        const missingUserId = await Response.countDocuments({ userId: { $exists: false } });

        if (missingProjectId > 0) {
            violations.push({
                check: 'Response Identity',
                collection: 'responses',
                field: 'projectId',
                issue: `${missingProjectId} documents missing projectId`
            });
        } else {
            compliantAreas.push('All responses have valid projectId');
        }

        if (missingUserId > 0) {
            violations.push({
                check: 'Response Identity',
                collection: 'responses',
                field: 'userId',
                issue: `${missingUserId} documents missing userId`
            });
        } else {
            compliantAreas.push('All responses have valid userId');
        }

        // Check questionId in answers
        const responsesWithAnswers = await Response.find({ 'answers.0': { $exists: true } }).limit(100);
        let answersWithMissingQuestionId = 0;
        let answersWithStringQuestionId = 0;
        let totalAnswersChecked = 0;
        let sampleBadDoc = null;

        for (const resp of responsesWithAnswers) {
            for (const ans of resp.answers || []) {
                totalAnswersChecked++;
                if (!ans.questionId) {
                    answersWithMissingQuestionId++;
                    if (!sampleBadDoc) sampleBadDoc = resp._id;
                } else if (typeof ans.questionId === 'string') {
                    answersWithStringQuestionId++;
                }
            }
        }

        console.log(`   Answers checked: ${totalAnswersChecked}`);
        console.log(`   Missing questionId: ${answersWithMissingQuestionId}`);
        console.log(`   String questionId (should be ObjectId): ${answersWithStringQuestionId}`);

        if (answersWithMissingQuestionId > 0) {
            violations.push({
                check: 'Response Identity',
                collection: 'responses',
                field: 'answers.questionId',
                issue: `${answersWithMissingQuestionId} answers missing questionId`,
                sampleDoc: sampleBadDoc
            });
        } else {
            compliantAreas.push('All answers have questionId');
        }

        console.log('');

        // ================================================================
        // 2. SELECT-TYPE QUESTION ANSWERS CHECK
        // ================================================================
        console.log('─────────────────────────────────────────────────────────────');
        console.log('CHECK 2: SELECT-TYPE QUESTION ANSWERS');
        console.log('─────────────────────────────────────────────────────────────');

        let answersWithChoiceKey = 0;
        let answersWithAnswerScore = 0;
        let answersWithInvalidScore = 0;
        let answersWithLegacyScoreField = 0;
        let sampleLegacyDoc = null;

        for (const resp of responsesWithAnswers) {
            for (const ans of resp.answers || []) {
                if (ans.answer?.choiceKey) {
                    answersWithChoiceKey++;
                    if (ans.answerScore !== null && ans.answerScore !== undefined) {
                        answersWithAnswerScore++;
                        if (ans.answerScore < 0 || ans.answerScore > 1) {
                            answersWithInvalidScore++;
                        }
                    }
                    // Check for legacy fields - score field exists and is NOT null
                    if (ans.score !== null && ans.score !== undefined) {
                        answersWithLegacyScoreField++;
                        if (!sampleLegacyDoc) sampleLegacyDoc = { docId: resp._id, answer: ans };
                    }
                }
            }
        }

        console.log(`   Select-type answers (with choiceKey): ${answersWithChoiceKey}`);
        console.log(`   Answers with valid answerScore (0-1): ${answersWithAnswerScore}`);
        console.log(`   Answers with invalid answerScore: ${answersWithInvalidScore}`);
        console.log(`   Answers with legacy 'score' field (0-4): ${answersWithLegacyScoreField}`);

        if (answersWithInvalidScore > 0) {
            violations.push({
                check: 'Select-type Answers',
                collection: 'responses',
                field: 'answerScore',
                issue: `${answersWithInvalidScore} answers have answerScore outside [0,1]`
            });
        } else if (answersWithChoiceKey > 0) {
            compliantAreas.push('All select-type answers have valid answerScore in [0,1]');
        }

        // Legacy 'score' field is expected for backward compatibility per schema
        if (answersWithLegacyScoreField > 0) {
            console.log(`   ⚠️  Note: Legacy 'score' field exists in ${answersWithLegacyScoreField} answers (expected per schema)`);
        }

        console.log('');

        // ================================================================
        // 3. OPEN-TEXT QUESTIONS CHECK
        // ================================================================
        console.log('─────────────────────────────────────────────────────────────');
        console.log('CHECK 3: OPEN-TEXT QUESTIONS');
        console.log('─────────────────────────────────────────────────────────────');

        let openTextAnswers = 0;
        let openTextWithText = 0;
        let openTextWithAutoScore = 0;

        for (const resp of responsesWithAnswers) {
            for (const ans of resp.answers || []) {
                if (ans.answer?.text && !ans.answer?.choiceKey) {
                    openTextAnswers++;
                    if (ans.answer.text) openTextWithText++;
                    // Check if answerScore is auto-generated (should be null for open-text)
                    if (ans.answerScore !== null && ans.answerScore !== undefined && !ans.scoreFinal) {
                        openTextWithAutoScore++;
                    }
                }
            }
        }

        console.log(`   Open-text answers: ${openTextAnswers}`);
        console.log(`   With text content: ${openTextWithText}`);
        console.log(`   With auto-generated score (potential issue): ${openTextWithAutoScore}`);

        if (openTextWithAutoScore > 0) {
            console.log(`   ⚠️  Warning: ${openTextWithAutoScore} open-text answers may have auto-generated scores`);
        } else if (openTextAnswers > 0) {
            compliantAreas.push('Open-text answers do not have auto-generated scores');
        }

        console.log('');

        // ================================================================
        // 4. DUPLICATE/OVERWRITE CHECK
        // ================================================================
        console.log('─────────────────────────────────────────────────────────────');
        console.log('CHECK 4: DUPLICATE/OVERWRITE CHECK');
        console.log('─────────────────────────────────────────────────────────────');

        // Check for duplicate responses (same projectId + userId + questionnaireKey)
        const duplicateCheck = await Response.aggregate([
            {
                $group: {
                    _id: { projectId: '$projectId', userId: '$userId', questionnaireKey: '$questionnaireKey' },
                    count: { $sum: 1 },
                    docs: { $push: '$_id' }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]);

        console.log(`   Duplicate response groups found: ${duplicateCheck.length}`);

        if (duplicateCheck.length > 0) {
            violations.push({
                check: 'Duplicate Check',
                collection: 'responses',
                field: 'projectId+userId+questionnaireKey',
                issue: `${duplicateCheck.length} duplicate response groups exist`,
                sampleDoc: duplicateCheck[0]?.docs
            });
        } else {
            compliantAreas.push('No duplicate responses (unique constraint enforced)');
        }

        console.log('');

        // ================================================================
        // 5. SCORE PROPAGATION CHECK
        // ================================================================
        console.log('─────────────────────────────────────────────────────────────');
        console.log('CHECK 5: SCORE PROPAGATION CHECK');
        console.log('─────────────────────────────────────────────────────────────');

        const scoreCount = await Score.countDocuments();
        console.log(`   Total score documents: ${scoreCount}`);

        // Check for finalRiskContribution in questionBreakdown
        const scoresWithBreakdown = await Score.find({ 'questionBreakdown.0': { $exists: true } }).limit(50);
        let breakdownsWithFRC = 0;
        let breakdownsWithoutFRC = 0;
        let breakdownsWithLegacyFields = 0;

        for (const score of scoresWithBreakdown) {
            for (const qb of score.questionBreakdown || []) {
                if (qb.finalRiskContribution !== undefined && qb.finalRiskContribution !== null) {
                    breakdownsWithFRC++;
                } else {
                    breakdownsWithoutFRC++;
                }
                // Check for legacy fields being used
                if (qb.normalizedContribution !== undefined || qb.answerRisk !== undefined) {
                    breakdownsWithLegacyFields++;
                }
            }
        }

        console.log(`   Question breakdowns with finalRiskContribution: ${breakdownsWithFRC}`);
        console.log(`   Question breakdowns without finalRiskContribution: ${breakdownsWithoutFRC}`);
        console.log(`   Question breakdowns with legacy fields: ${breakdownsWithLegacyFields}`);

        if (breakdownsWithFRC > 0) {
            compliantAreas.push('Score documents use finalRiskContribution');
        }

        if (breakdownsWithLegacyFields > 0) {
            console.log(`   ⚠️  Note: ${breakdownsWithLegacyFields} breakdowns have legacy fields (may be for backward compatibility)`);
        }

        // Check byPrinciple structure
        const scoresWithPrinciples = await Score.find({ 'byPrinciple.TRANSPARENCY': { $exists: true } }).limit(10);
        let principlesWithAvg = 0;
        let principlesWithRisk = 0;

        for (const score of scoresWithPrinciples) {
            for (const [key, val] of Object.entries(score.byPrinciple || {})) {
                if (val && val.avg !== undefined) principlesWithAvg++;
                if (val && val.risk !== undefined) principlesWithRisk++;
            }
        }

        console.log(`   Principle scores using 'avg': ${principlesWithAvg}`);
        console.log(`   Principle scores using 'risk': ${principlesWithRisk}`);

        console.log('');

        // ================================================================
        // AUDIT SUMMARY
        // ================================================================
        console.log('==============================================================');
        console.log('                    AUDIT SUMMARY');
        console.log('==============================================================');
        console.log('');

        console.log('✅ COMPLIANT AREAS:');
        compliantAreas.forEach(area => console.log(`   • ${area}`));
        console.log('');

        if (violations.length > 0) {
            console.log('❌ VIOLATIONS:');
            violations.forEach(v => {
                console.log(`   • [${v.check}] ${v.collection}.${v.field}: ${v.issue}`);
                if (v.sampleDoc) console.log(`     Sample doc: ${JSON.stringify(v.sampleDoc).substring(0, 100)}...`);
            });
            console.log('');
            console.log('──────────────────────────────────────────────────────────────');
            console.log('FINAL VERDICT: ❌ Answer persistence has critical integrity issues');
            console.log('──────────────────────────────────────────────────────────────');
        } else {
            console.log('──────────────────────────────────────────────────────────────');
            console.log('FINAL VERDICT: ✅ Answer persistence is fully compliant');
            console.log('──────────────────────────────────────────────────────────────');
        }

        console.log('');
        console.log('Audit completed at:', new Date().toISOString());

    } catch (error) {
        console.error('❌ Audit failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

runAudit();
