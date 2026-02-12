const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Manual .env loader
// Assuming script is in backend/scripts, .env is in backend/.env
const envPath = path.join(__dirname, '..', '.env');
console.log('Loading .env from:', envPath);

try {
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const parts = trimmed.split('=');
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, ''); // Remove quotes
                if (key === 'MONGODB_URI' || key === 'MONGO_URI') {
                    process.env.MONGODB_URI = val;
                    console.log('✅ Loaded MONGODB_URI');
                }
            }
        }
    } else {
        console.log('❌ .env file not found at:', envPath);
    }
} catch (e) {
    console.log('❌ Error reading .env:', e.message);
}

if (!process.env.MONGODB_URI) {
    fs.writeFileSync('sim_output.json', JSON.stringify({ error: 'MONGODB_URI not found in .env' }));
    process.exit(1);
}

async function debugChartSimulation() {
    try {
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);

        // Define models that are normally in server.js but missing in models/
        // Use strict: false to accommodate any schema
        if (!mongoose.models.Project) mongoose.model('Project', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.User) mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.Tension) mongoose.model('Tension', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.UseCase) mongoose.model('UseCase', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.Evaluation) mongoose.model('Evaluation', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.GeneralQuestionsAnswers) mongoose.model('GeneralQuestionsAnswers', new mongoose.Schema({}, { strict: false }));

        // Use REAL models where they exist (and are required by service)
        // We don't need to manually require them if reportMetricsService does it,
        // BUT reportMetricsService does require them, so we just let it happen.
        // We only provide the ones it EXPECTS to be there (from server.js).

        const Project = mongoose.model('Project');
        // Score and Response will be loaded by reportMetricsService
        // But we need to access them for this script
        const Score = require('../models/score');
        const Response = require('../models/response');
        const User = mongoose.model('User');


        const projects = await Project.find({}).sort({ createdAt: -1 }).limit(1);
        if (!projects.length) throw new Error('No project found');
        const project = projects[0];

        // 2. Fetch full metrics using the service (uses strict read-only mode)
        const reportMetricsService = require('../services/reportMetricsService');
        // We know .env is loaded now
        console.log('🚀 Calling reportMetricsService.buildReportMetrics...');
        const metrics = await reportMetricsService.buildReportMetrics(project._id, null);

        const responses = await Response.find({ projectId: project._id }).lean();
        const scores = await Score.find({ projectId: project._id }).lean();

        // TEST: Check if overallTotals is defined (the original bug)
        const hasOverallTotals = metrics && metrics.overallTotals !== undefined;
        const hasScoringDisclosure = metrics && metrics.scoringDisclosure !== undefined;

        const result = {
            project: { title: project.title, id: project._id },
            counts: { responses: responses.length, scores: scores.length },
            responseStatuses: responses.map(r => r.status),
            // Critical test results
            testResults: {
                metricsReturned: !!metrics,
                hasOverallTotals,
                hasScoringDisclosure,
                overallTotalsKeys: hasOverallTotals ? Object.keys(metrics.overallTotals) : [],
                scoringKeys: metrics?.scoring ? Object.keys(metrics.scoring) : []
            },
            message: hasOverallTotals
                ? "✅ SUCCESS: buildReportMetrics returned valid metrics with overallTotals!"
                : "❌ FAIL: overallTotals is still undefined"
        };

        fs.writeFileSync('sim_output.json', JSON.stringify(result, null, 2));
        console.log('✅ Wrote sim_output.json');

    } catch (error) {
        console.error('Error:', error);
        fs.writeFileSync('sim_output.json', JSON.stringify({ error: error.message }, null, 2));
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

debugChartSimulation();
