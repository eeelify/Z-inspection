const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
// Manual env loading hack for Windows scripts
try {
    const envPath = path.join(__dirname, '../.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            process.env[key.trim()] = values.join('=').trim();
        }
    });
    console.log('✅ Loaded .env manually');
    if (process.env.MONGODB_URI) {
        console.log(`Masked URI: ${process.env.MONGODB_URI.substring(0, 20)}...`);
    } else {
        console.error('❌ MONGODB_URI is MISSING from process.env');
    }
} catch (e) {
    console.warn('⚠️ Could not load .env:', e.message);
}

// 1. Define missing schemas inline (based on server.js analysis)
// These files were NOT in the list_dir output, so they must be inlined in server.js or elsewhere
const ProjectSchema = new mongoose.Schema({
    title: String,
    shortDescription: String,
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    useCase: { type: String },
    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

const UseCaseSchema = new mongoose.Schema({
    title: String,
    assignedExperts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { strict: false });

const TensionSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    principle1: String,
    principle2: String
}, { strict: false });

// 2. Register models (Safe order)
// Re-register if not already registered (to handle partial runs)
if (!mongoose.models.Project) mongoose.model('Project', ProjectSchema);
if (!mongoose.models.UseCase) mongoose.model('UseCase', UseCaseSchema);
if (!mongoose.models.Tension) mongoose.model('Tension', TensionSchema);

// Require existing model files
try {
    // Only require if not already compiled to avoid OverwriteModelError
    if (!mongoose.models.User) require('../models/User');
    if (!mongoose.models.Score) require('../models/score');
    if (!mongoose.models.Response) require('../models/response');
    if (!mongoose.models.Question) require('../models/question');
    if (!mongoose.models.ProjectAssignment) require('../models/projectAssignment');
} catch (e) {
    console.error('Warning loading models:', e.message);
}

// 3. Import Service
const reportMetricsService = require('../services/reportMetricsService');

async function debugPipeline() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        // Get latest project
        const Project = mongoose.model('Project');
        const projects = await Project.find({}).sort({ createdAt: -1 }).limit(1);

        if (projects.length === 0) {
            console.log('❌ No projects found.');
            return;
        }

        const project = projects[0];
        console.log(`\n🔍 Analyzing Project: "${project.title}" (ID: ${project._id})`);

        // 4. Run buildReportMetrics
        console.log('\n🚀 Running buildReportMetrics (This invokes the exact logic used in reports)...');
        console.time('buildMetrics');

        // We pass null for questionnaireKey to get ALL data (like the report does)
        const metrics = await reportMetricsService.buildReportMetrics(project._id, null);
        console.timeEnd('buildMetrics');

        // 5. Inspect Heatmap Data
        console.log('\n📊 Inspecting Heatmap Data (scoring.byPrincipleTable):');

        const table = metrics.scoring?.byPrincipleTable;
        if (!table) {
            console.log('❌ metrics.scoring.byPrincipleTable is UNDEFINED');
        } else {
            const principles = Object.keys(table);
            console.log(`Found ${principles.length} principles.`);

            principles.forEach(p => {
                const pData = table[p];
                console.log(`\nPrinciple: ${p}`);
                if (pData.evaluators && Array.isArray(pData.evaluators)) {
                    console.log(`  Evaluators count: ${pData.evaluators.length}`);
                    pData.evaluators.forEach(e => {
                        console.log(`    - User: ${e.name} (${e.role}) | Score: ${e.score}`);
                    });
                } else {
                    console.log('  ❌ No evaluators array in this principle object');
                }
            });
        }

        // 6. Inspect Evaluators List
        console.log('\n👥 Inspecting Evaluator List used for Columns:');
        const evaluators = await reportMetricsService.getProjectEvaluators(project._id);
        const withScores = await evaluators.withScores(null);

        console.log(`Total Evaluators with Scores: ${withScores.length}`);
        withScores.forEach(e => {
            console.log(`  - ${e.name} (${e.role}) [ID: ${e.userId}] HasScore: ${e.hasScore}`);
        });

        // Write metrics object to a file named 'debug_output.json'
        console.log('\n📊 Writing output to debug_output.json...');
        const output = {
            metrics_byPrincipleTable: metrics.scoring?.byPrincipleTable,
            evaluators_withScores: withScores
        };
        fs.writeFileSync('debug_output.json', JSON.stringify(output, null, 2));
        console.log('✅ File written.');

    } catch (error) {
        console.error('❌ FATAL ERROR in pipeline:', error);
        if (error.stack) console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\nDone.');
        process.exit(0);
    }
}

debugPipeline();
