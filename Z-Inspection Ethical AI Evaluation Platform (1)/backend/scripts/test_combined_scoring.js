const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const parts = trimmed.split('=');
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^[\"']|[\"']$/g, '');
            if (key === 'MONGODB_URI' || key === 'MONGO_URI') {
                process.env.MONGODB_URI = val;
            }
        }
    }
}

async function testCombinedScoring() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Define models first
        if (!mongoose.models.Project) mongoose.model('Project', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.Response) mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.Tension) mongoose.model('Tension', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.User) mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.Question) mongoose.model('Question', new mongoose.Schema({}, { strict: false }));

        // Test the actual reportMetricsService
        const reportMetricsService = require('../services/reportMetricsService');

        // Call buildReportMetrics for Tutor AI with questionnaireKey = null
        const tutorAIProjectId = '6985dc9a9ff7bb6bcd9d528e';

        console.log('\n🔬 Testing buildReportMetrics with questionnaireKey = null');
        console.log('='.repeat(80));

        const metrics = await reportMetricsService.buildReportMetrics(tutorAIProjectId, null);

        console.log('\n✅ Metrics returned successfully\n');

        // Check if overallTotals exists
        const hasOverallTotals = metrics && metrics.overallTotals;
        const hasDashboardMetrics = metrics && metrics.dashboardMetrics;

        console.log('Results:');
        console.log(`  hasOverallTotals: ${!!hasOverallTotals}`);
        console.log(`  hasDashboardMetrics: ${!!hasDashboardMetrics}`);

        if (hasOverallTotals) {
            console.log('\noverallTotals:');
            console.log(`  cumulativeRiskVolume: ${metrics.overallTotals.cumulativeRiskVolume}`);
            console.log(`  quantitativeQuestionCount: ${metrics.overallTotals.quantitativeQuestionCount}`);
            console.log(`  averageERC: ${metrics.overallTotals.averageERC}`);
            console.log(`  normalizedRiskLevel: ${metrics.overallTotals.normalizedRiskLevel}`);
        }

        if (hasDashboardMetrics && hasDashboardMetrics.scoring) {
            console.log('\ndashboardMetrics.scoring keys:', Object.keys(metrics.dashboardMetrics.scoring || {}));
        }

        // Write detailed output
        const output = {
            hasOverallTotals,
            hasDashboardMetrics,
            overallTotals: metrics.overallTotals || null,
            dashboardMetricsKeys: hasDashboardMetrics ? Object.keys(metrics.dashboardMetrics) : [],
            scoringKeys: hasDashboardMetrics && metrics.dashboardMetrics.scoring
                ? Object.keys(metrics.dashboardMetrics.scoring)
                : []
        };

        fs.writeFileSync('combined_scoring_test.json', JSON.stringify(output, null, 2));
        console.log('\n✅ Test results written to combined_scoring_test.json');

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
        fs.writeFileSync('combined_scoring_test.json', JSON.stringify({ error: error.message, stack: error.stack }, null, 2));
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

testCombinedScoring();
