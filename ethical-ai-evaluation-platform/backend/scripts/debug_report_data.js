const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Register models from files (These files exist and are verified)
require('../models/score');
require('../models/response');
// require('../models/question'); // Might fail too? Inline it if needed
// require('../models/projectAssignment'); // Fails?
// require('../models/useCase'); // Fails?

// Define inline models to avoid file path issues

if (!mongoose.models.ProjectAssignment) {
    const ProjectAssignmentSchema = new mongoose.Schema({
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: String,
        status: String,
        questionnaires: [String]
    });
    mongoose.model('ProjectAssignment', ProjectAssignmentSchema);
}

if (!mongoose.models.UseCase) {
    const UseCaseSchema = new mongoose.Schema({
        title: String,
        assignedExperts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    });
    mongoose.model('UseCase', UseCaseSchema);
}

if (!mongoose.models.Question) {
    const QuestionSchema = new mongoose.Schema({
        questionnaireKey: String,
        code: String,
        text: String,
        principle: String
    });
    mongoose.model('Question', QuestionSchema);
}

if (!mongoose.models.User) {
    const UserSchema = new mongoose.Schema({
        name: { type: String, required: true },
        email: { type: String, required: true },
        role: { type: String, required: true }
    });
    mongoose.model('User', UserSchema);
}

if (!mongoose.models.Project) {
    const ProjectSchema = new mongoose.Schema({
        title: String,
        assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        useCase: { type: String },
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    });
    mongoose.model('Project', ProjectSchema);
}

if (!mongoose.models.Tension) {
    const TensionSchema = new mongoose.Schema({
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        principle1: String,
        principle2: String,
        votes: [{ userId: String, voteType: String }],
        createdBy: String, // ID or Name
        evidences: [{ type: String }] // simplified
    });
    mongoose.model('Tension', TensionSchema);
}

// Import service AFTER models are registered
const reportMetricsService = require('../services/reportMetricsService');
const Project = mongoose.model('Project');
const Score = mongoose.model('Score');

async function debugReportData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. List Projects
        const projects = await Project.find({}).sort({ createdAt: -1 }).limit(1);
        if (projects.length === 0) {
            console.log('❌ No projects found');
            return;
        }

        const project = projects[0];
        console.log(`\n🔍 Analyzing Project: ${project.title} (${project._id})`);

        // 2. Check Raw Scores
        const rawScores = await Score.find({ projectId: project._id });
        console.log(`\n📊 Raw Score Documents: ${rawScores.length}`);
        if (rawScores.length > 0) {
            console.log('Sample Score (keys):', Object.keys(rawScores[0].toObject()));
            if (rawScores[0].byPrinciple) {
                console.log('Sample Score.byPrinciple:', Object.keys(rawScores[0].byPrinciple));
            } else {
                console.log('❌ Score.byPrinciple is missing in sample');
            }
        }

        // 3. Run metric generation (logic from buildDashboardMetrics)
        console.log('\n🔄 Running reportMetricsService.getProjectEvaluators...');
        const evaluators = await reportMetricsService.getProjectEvaluators(project._id);
        const evaluatorsWithScores = await evaluators.withScores();

        console.log(`Evaluators (Submitted): ${evaluators.submitted.length}`);
        console.log(`Evaluators (With Scores): ${evaluatorsWithScores.length}`);
        if (evaluatorsWithScores.length > 0) {
            console.log('Sample Evaluator:', evaluatorsWithScores[0]);
        }

        console.log('\n🔄 Running reportMetricsService.buildDashboardMetrics...');
        try {
            const metrics = await reportMetricsService.buildDashboardMetrics(project._id);

            console.log('\n📈 Metrics Result - Scoring Data:');
            // Using logic from generating report
            // reportMetricsService.js: line 610 buildReportMetrics returns 'reportMetrics' which contains 'scoring'

            if (metrics.scoring) {
                console.log('scoring.totals:', metrics.scoring.totalsOverall);
                console.log('scoring.byPrincipleOverall keys:', Object.keys(metrics.scoring.byPrincipleOverall || {}));

                // Check table for heatmap
                if (metrics.scoring.byPrincipleTable) {
                    console.log('✅ scoring.byPrincipleTable EXISTS');
                    console.log('  Keys:', Object.keys(metrics.scoring.byPrincipleTable));

                    const firstPrinciple = Object.keys(metrics.scoring.byPrincipleTable)[0];
                    if (firstPrinciple) {
                        console.log(`  Sample (${firstPrinciple}):`, metrics.scoring.byPrincipleTable[firstPrinciple]);
                    }
                } else {
                    console.log('❌ scoring.byPrincipleTable is MISSING');
                }
            } else {
                console.log('❌ metrics.scoring is missing');
            }

        } catch (e) {
            console.error('Error building metrics:', e);
        }

        console.log('\n🔄 Running reportMetricsService.buildReportMetrics (Full Report Data)...');
        try {
            const reportMetrics = await reportMetricsService.buildReportMetrics(project._id);
            console.log('✅ buildReportMetrics SUCCESS');
            if (reportMetrics.overallTotals) {
                console.log('Cumulative Risk:', reportMetrics.overallTotals.cumulativeRiskVolume);
                console.log('Quantitative Questions:', reportMetrics.overallTotals.quantitativeQuestions);
            } else {
                console.log('❌ reportMetrics.overallTotals is MISSING');
            }
        } catch (e) {
            console.error('❌ buildReportMetrics FAILED:', e);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugReportData();
