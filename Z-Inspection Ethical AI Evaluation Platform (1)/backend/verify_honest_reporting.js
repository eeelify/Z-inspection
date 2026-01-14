
const mongoose = require('mongoose');
const Response = require('./models/response');
const Score = require('./models/score');
const Question = require('./models/question');
const User = require('./models/user');
// const Project = require('./models/project'); // File does not exist, using mock below
const fs = require('fs');
const path = require('path');

// Mock Models if missing (BEFORE requiring services)
if (!mongoose.models.Project) mongoose.model('Project', new mongoose.Schema({ name: String, status: String }));
if (!mongoose.models.Tension) mongoose.model('Tension', new mongoose.Schema({}));
if (!mongoose.models.UseCase) mongoose.model('UseCase', new mongoose.Schema({}));

// NOW Require Services (Safe to load now)
const { computeEthicalScores } = require('./services/ethicalScoringService');
const { buildReportMetrics } = require('./services/reportMetricsService');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Or fallback to root .env if running from root?
// require('dotenv').config(); 

// Mock Models if missing (BEFORE requiring services)

async function runVerification() {
    console.log('🔍 Starting Honest Reporting Verification...');
    const uri = process.env.MONGO_URI;
    console.log('DEBUG: MONGO_URI is', uri ? (uri.substring(0, 15) + '...') : 'UNDEFINED');


    try {
        if (mongoose.connection.readyState === 0) {
            const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z_inspection_test';
            // Fix connection string issues by removing appName if present (matches diagnose script)
            await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));
        }

        // CLEANUP
        const testProjectId = new mongoose.Types.ObjectId();
        const testUserId1 = new mongoose.Types.ObjectId();
        const testUserId2 = new mongoose.Types.ObjectId(); // Assigned but missing

        await Response.deleteMany({ projectId: testProjectId });
        await Score.deleteMany({ projectId: testProjectId });

        console.log('✅ Cleanup complete.');

        // 1. SETUP DATA
        // Create Question with Importance
        const q1 = await Question.findOneAndUpdate(
            { code: 'TST-01' },
            {
                code: 'TST-01',
                text: 'Test Question',
                principle: 'TRANSPARENCY',
                riskScore: 3, // High Importance
                answerType: 'single_choice',
                options: [{ key: 'yes', label: 'Yes', value: 1 }, { key: 'no', label: 'No', value: 0 }]
            },
            { upsert: true, new: true }
        );

        // Create Evaluators (Mock)
        const assignedEvaluators = [
            { userId: testUserId1.toString(), name: 'Expert 1', role: 'legal', email: 'e1@test.com' },
            { userId: testUserId2.toString(), name: 'Expert 2', role: 'tech', email: 'e2@test.com' } // GHOST
        ];

        // Scenario A: Incomplete Coverage (2 Assigned, 1 Submitted)
        console.log('\n🧪 Test Case A: Incomplete Evaluator Coverage');

        // Submit Response for Expert 1
        await Response.create({
            projectId: testProjectId,
            userId: testUserId1,
            role: 'legal',
            questionnaireKey: 'general-v1',
            questionnaireVersion: 1,
            status: 'submitted',
            assignmentId: new mongoose.Types.ObjectId(),
            answers: [{
                questionId: q1._id,
                questionCode: 'TST-01',
                answer: { choiceKey: 'no' },
                importanceScore: 3, // Valid
                answerSeverity: 1.0 // High Risk
            }]
        });

        // Compute Scores
        await computeEthicalScores(testProjectId);

        // Generate Report
        try {
            const report = await buildReportMetrics(testProjectId, assignedEvaluators);

            // ASSERTIONS
            if (report.validityStatus === 'invalid_incomplete_evaluators') {
                console.log('✅ PASS: Report marked as invalid_incomplete_evaluators');
            } else {
                console.error(`❌ FAIL: Expected invalid_incomplete_evaluators, got ${report.validityStatus}`);
            }

            if (report.invalidityNotice) {
                console.log('✅ PASS: Invalidity Notice present');
                console.log('   Notice:', report.invalidityNotice.message);
            } else {
                console.error('❌ FAIL: Invalidity Notice MISSING');
            }

            if (report.charts.available === undefined || Object.keys(report.charts.available).length === 0) {
                console.log('✅ PASS: Charts suppressed');
            } else {
                console.error('❌ FAIL: Charts were generated for invalid report');
            }

        } catch (err) {
            console.error('❌ FAIL: Report generation crashed', err);
            fs.writeFileSync('verify_error.log', err.stack || String(err));
        }

        // Scenario B: Missing Severity (Legacy Data)
        console.log('\n🧪 Test Case B: Missing Severity (Legacy Data)');
        await Response.deleteMany({ projectId: testProjectId });
        await Score.deleteMany({ projectId: testProjectId });

        // Submit Legacy Response (No answerSeverity)
        await Response.create({
            projectId: testProjectId,
            userId: testUserId1,
            role: 'legal',
            questionnaireKey: 'general-v1',
            questionnaireVersion: 1,
            status: 'submitted',
            assignmentId: new mongoose.Types.ObjectId(),
            answers: [{
                questionId: q1._id,
                questionCode: 'TST-01',
                answer: { choiceKey: 'no' },
                importanceScore: 3,
                // answerSeverity MISSING
                answerScore: 0.2 // Legacy field, should be ignored/warned
            }]
        });

        await computeEthicalScores(testProjectId);

        // Here, computeEthicalScores should skip the question or produce 0 score with warning. 
        // If it produces 0 score, report validator might catch "Missing Scores" or "Partial".
        // Let's check report.

        try {
            // Only 1 assigned now to pass coverage check
            const singleEvaluator = [assignedEvaluators[0]];
            const report = await buildReportMetrics(testProjectId, singleEvaluator);

            // If scoring skipped the question, we might have a Score document with n=0 or very low risk?
            // Actually, if we skip all questions, we might have empty Score or Score with n=0.
            // Let's check validity.

            console.log('   Validity Status:', report.validityStatus);
            console.log('   Scoring N:', report.scoring?.totals?.n);

            // We expect likely "invalid_scoring_pipeline" or "valid" but with 0 questions if strict logic skipped it.
            // But wait, if n=0, then it's basically empty scpre. 

            if (report.scoring?.totals?.n === 0) {
                console.log('✅ PASS: Strict scoring skipped invalid legacy question (n=0)');
            } else {
                console.log('ℹ️ Check: Scoring processed legacy data?', report.scoring?.totals);
            }

        } catch (err) {
            console.error('❌ FAIL: Report generation crashed', err);
        }

    } catch (error) {
        console.error('Overall Failure:', error);
        fs.writeFileSync('verify_error.log', error.stack || String(error));
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
}

// Add logs collector
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const logs = [];
console.log = function (...args) {
    logs.push(args.join(' '));
    originalConsoleLog.apply(console, args);
};
console.error = function (...args) {
    logs.push("ERROR: " + args.join(' '));
    originalConsoleError.apply(console, args);
};

runVerification().then(() => {
    fs.writeFileSync('verify_result.txt', logs.join('\n'));
}).catch(err => {
    // console.error('TOP LEVEL CRASH:', err); // captured by logs
    originalConsoleError('CRASH_STACK:', err.stack); // Force to stdout
    fs.writeFileSync('verify_crash.log', err.stack || String(err));
});
