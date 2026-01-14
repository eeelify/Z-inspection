/**
 * Phase 2: Database Remediation - Fix Duplicate Ethical-Expert
 * 
 * This script:
 * 1. Identifies duplicate ethical-experts
 * 2. Determines legitimate one (has ethical-expert-v1 questionnaire)
 * 3. Reassigns incorrect user's role
 * 4. Updates response metadata
 * 5. Deletes scores for this project only
 * 6. Recomputes scores with versioned methodology
 * 7. Validates final state
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = '6964d4e9d7a6755353c39e4b';

async function remediate() {
    const log = [];
    const logMsg = (msg) => {
        console.log(msg);
        log.push(msg);
    };

    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));
        logMsg('✅ Connected to MongoDB\n');

        const User = require('./models/User');
        const ProjectAssignment = require('./models/projectAssignment');
        const Response = require('./models/response');
        const Score = require('./models/score');

        const projectIdObj = new mongoose.Types.ObjectId(PROJECT_ID);

        // ============================================================
        // STEP 1: Identify Duplicate Ethical-Experts
        // ============================================================
        logMsg('=' + '='.repeat(60));
        logMsg('STEP 1: Identify Duplicate Ethical-Experts');
        logMsg('='.repeat(61) + '\n');

        const responses = await Response.find({
            projectId: projectIdObj,
            role: 'ethical-expert'
        }).lean();

        const ethicalExpertUsers = {};

        for (const response of responses) {
            const userId = response.userId.toString();
            if (!ethicalExpertUsers[userId]) {
                const user = await User.findById(userId).select('name email').lean();
                ethicalExpertUsers[userId] = {
                    userId,
                    name: user?.name || 'Unknown',
                    email: user?.email,
                    questionnaires: new Set()
                };
            }
            ethicalExpertUsers[userId].questionnaires.add(response.questionnaireKey);
        }

        const userList = Object.values(ethicalExpertUsers);
        logMsg(`Found ${userList.length} users with ethical-expert responses:\n`);

        for (const user of userList) {
            logMsg(`  - ${user.name} (${user.email})`);
            logMsg(`    Questionnaires: ${Array.from(user.questionnaires).join(', ')}`);
            logMsg('');
        }

        if (userList.length !== 2) {
            throw new Error(`Expected exactly 2 ethical-experts, found ${userList.length}`);
        }

        // ============================================================
        // STEP 2: Determine Legitimate Ethical-Expert
        // ============================================================
        logMsg('=' + '='.repeat(60));
        logMsg('STEP 2: Determine Legitimate Ethical-Expert');
        logMsg('='.repeat(61) + '\n');

        let legitimateUser = null;
        let incorrectUser = null;

        for (const user of userList) {
            if (user.questionnaires.has('ethical-expert-v1')) {
                legitimateUser = user;
            } else {
                incorrectUser = user;
            }
        }

        if (!legitimateUser || !incorrectUser) {
            // Both have ethical-expert-v1 or neither has it - use different logic
            logMsg('⚠️  Cannot determine based on questionnaires alone');
            logMsg('Using fallback: User with MORE questionnaires is legitimate\n');

            userList.sort((a, b) => b.questionnaires.size - a.questionnaires.size);
            legitimateUser = userList[0];
            incorrectUser = userList[1];
        }

        logMsg(`✅ LEGITIMATE: ${legitimateUser.name} (${legitimateUser.email})`);
        logMsg(`   Questionnaires: ${Array.from(legitimateUser.questionnaires).join(', ')}\n`);
        logMsg(`❌ INCORRECT: ${incorrectUser.name} (${incorrectUser.email})`);
        logMsg(`   Questionnaires: ${Array.from(incorrectUser.questionnaires).join(', ')}`);
        logMsg(`   Will reassign to role: "evaluator"\n`);

        // ============================================================
        // STEP 3: Reassign Incorrect User's Role
        // ============================================================
        logMsg('=' + '='.repeat(60));
        logMsg('STEP 3: Reassign Incorrect User Role');
        logMsg('='.repeat(61) + '\n');

        const assignment = await ProjectAssignment.findOne({
            projectId: projectIdObj,
            userId: new mongoose.Types.ObjectId(incorrectUser.userId)
        });

        if (assignment) {
            assignment.role = 'evaluator';
            await assignment.save();
            logMsg(`✅ Updated ProjectAssignment: ${incorrectUser.userId} → role="evaluator"`);
        } else {
            logMsg(`⚠️  No ProjectAssignment found for ${incorrectUser.userId}`);
        }

        // ============================================================
        // STEP 4: Update Response Role Metadata
        // ============================================================
        logMsg('\n' + '='.repeat(61));
        logMsg('STEP 4: Update Response Role Metadata');
        logMsg('='.repeat(61) + '\n');

        const updateResult = await Response.updateMany(
            {
                projectId: projectIdObj,
                userId: new mongoose.Types.ObjectId(incorrectUser.userId),
                role: 'ethical-expert'
            },
            {
                $set: { role: 'evaluator' }
            }
        );

        logMsg(`✅ Updated ${updateResult.modifiedCount} Response document(s)`);

        // ============================================================
        // STEP 5: Delete Score Documents (Project-Scoped)
        // ============================================================
        logMsg('\n' + '='.repeat(61));
        logMsg('STEP 5: Delete Stale Score Documents');
        logMsg('='.repeat(61) + '\n');

        const scoreDeleteResult = await Score.deleteMany({ projectId: projectIdObj });
        logMsg(`✅ Deleted ${scoreDeleteResult.deletedCount} Score document(s) for project ${PROJECT_ID}`);

        // ============================================================
        // STEP 6: Recompute Scores with Versioned Methodology
        // ============================================================
        logMsg('\n' + '='.repeat(61));
        logMsg('STEP 6: Recompute Scores (Versioned)');
        logMsg('='.repeat(61) + '\n');

        const { safeRecomputeScores } = require('./services/safeScoreRecompute');
        const recomputeResult = await safeRecomputeScores(PROJECT_ID, { force: true });

        logMsg(`✅ Recomputation complete:`);
        logMsg(`   New score count: ${recomputeResult.newScoreCount}`);
        logMsg(`   Scoring version: ${recomputeResult.currentVersion}`);
        logMsg(`   Thresholds version: ${recomputeResult.thresholdsVersion}`);
        logMsg(`   Versions correct: ${recomputeResult.versionsCorrect ? '✅' : '❌'}`);

        // ============================================================
        // STEP 7: Validate Final State
        // ============================================================
        logMsg('\n' + '='.repeat(61));
        logMsg('STEP 7: Validate Final State');
        logMsg('='.repeat(61) + '\n');

        const { validateProjectForReporting } = require('./services/reportValidationService');
        const validation = await validateProjectForReporting(PROJECT_ID);

        logMsg(`Validation Status: ${validation.validityStatus}`);
        logMsg(`Is Valid: ${validation.isValid ? '✅' : '❌'}\n`);

        if (validation.errors.length > 0) {
            logMsg('ERRORS:');
            validation.errors.forEach(err => logMsg(`  ❌ ${err}`));
            logMsg('');
        }

        if (validation.warnings.length > 0) {
            logMsg('WARNINGS:');
            validation.warnings.forEach(warn => logMsg(`  ⚠️  ${warn}`));
            logMsg('');
        }

        logMsg('Evaluator Counts:');
        logMsg(`  Total: ${validation.metadata.evaluatorCount.total}`);
        logMsg(`  Ethical-Experts: ${validation.metadata.evaluatorCount.ethicalExperts}`);
        logMsg(`  Submitted: ${validation.metadata.evaluatorCount.submitted}`);
        logMsg(`  Scored: ${validation.metadata.evaluatorCount.scored}\n`);

        // ============================================================
        // FINAL SUMMARY
        // ============================================================
        logMsg('=' + '='.repeat(60));
        logMsg('✅ REMEDIATION COMPLETE');
        logMsg('='.repeat(61) + '\n');

        const summary = {
            success: validation.isValid,
            legitimateEthicalExpert: {
                userId: legitimateUser.userId,
                name: legitimateUser.name,
                email: legitimateUser.email
            },
            reassignedUser: {
                userId: incorrectUser.userId,
                name: incorrectUser.name,
                email: incorrectUser.email,
                newRole: 'evaluator'
            },
            scoresRecomputed: recomputeResult.newScoreCount,
            validityStatus: validation.validityStatus,
            isValid: validation.isValid
        };

        fs.writeFileSync('remediation_result.json', JSON.stringify(summary, null, 2));
        logMsg('📝 Results saved to remediation_result.json');

        fs.writeFileSync('remediation_log.txt', log.join('\n'));

        await mongoose.disconnect();
        logMsg('\n✅ Disconnected from MongoDB');

        process.exit(validation.isValid ? 0 : 1);

    } catch (error) {
        logMsg(`\n❌ REMEDIATION FAILED: ${error.message}`);
        logMsg(error.stack);

        fs.writeFileSync('remediation_log.txt', log.join('\n'));
        fs.writeFileSync('remediation_error.txt', error.stack);

        process.exit(1);
    }
}

remediate();
