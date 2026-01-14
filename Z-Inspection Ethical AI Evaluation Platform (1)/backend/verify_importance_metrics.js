const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

async function run() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));
        console.log('✅ Connected to MongoDB');

        // Load Schemas Safely
        const safeLoad = (name) => {
            try {
                console.log(`Loading model: ${name}...`);
                require(`./models/${name}`);
            } catch (e) {
                console.warn(`⚠️ Failed to require model '${name}':`, e.message);
                if (!mongoose.models[name]) {
                    console.warn(`   Registering mock for '${name}'...`);
                    mongoose.model(name, new mongoose.Schema({}, { strict: false }));
                }
            }
        };
        safeLoad('response');
        safeLoad('score');
        safeLoad('User');
        safeLoad('question');

        // Mock missing models
        safeLoad('Project');
        safeLoad('Tension');
        safeLoad('UseCase');
        // Ensure Tension model is registered if not by safeLoad
        if (!mongoose.models.Tension) {
            console.log("Registering mock for 'Tension'...");
            mongoose.model('Tension', new mongoose.Schema({}, { strict: false }));
        }

        const Score = mongoose.model('Score');
        const Project = mongoose.model('Project');
        const Response = mongoose.model('Response');
        const User = mongoose.model('User');

        // Create Test Data
        console.log(`Creating test data for Project ${PROJECT_ID}...`);
        await Project.create({ _id: PROJECT_ID, title: "Importance Test Project" });
        await User.create({
            _id: USER_ID,
            name: "Test Expert",
            role: "expert",
            email: `test.expert.${Date.now()}@example.com`
        });

        // Create Response (Needed for 'submitted' check)
        // IMPORTANT: 'answers' must exist and have content for report service to count it
        await Response.create({
            projectId: PROJECT_ID, userId: USER_ID, role: "expert",
            status: "submitted",
            questionnaireVersion: 1,
            questionnaireKey: "general-v1",
            assignmentId: new mongoose.Types.ObjectId(),
            answers: [{
                answer: { text: "Test Answer" },
                questionId: new mongoose.Types.ObjectId(),
                questionCode: "Q1"
            }]
        });

        // Create Score with Importance metrics
        await Score.create({
            projectId: PROJECT_ID, userId: USER_ID, role: "expert", questionnaireKey: "general-v1",
            byPrinciple: {
                "TRANSPARENCY": {
                    risk: 1.5, n: 5, count: 1, min: 1, max: 2,
                    avg: 1.5, // legacy field required by some checks?
                    avgImportance: 3.5,
                    highImportanceRatio: 0.75
                }
            },
            totals: { overallRisk: 1.5, avg: 1.5 }
        });

        // Import Service
        const { buildReportMetrics } = require('./services/reportMetricsService');

        console.log("Building report metrics...");
        const metrics = await buildReportMetrics(PROJECT_ID.toString(), null);

        // Verify
        const transparency = metrics.scoring.byPrincipleOverall['TRANSPARENCY'];
        console.log("Transparency Metrics:", transparency);

        if (transparency.avgImportance !== 3.5) throw new Error(`Expected avgImportance 3.5, got ${transparency.avgImportance}`);
        if (transparency.highImportanceRatio !== 0.75) throw new Error(`Expected highImportanceRatio 0.75, got ${transparency.highImportanceRatio}`);

        // Verify Chart
        console.log("Charts Available:", metrics.charts.available);
        if (!metrics.charts.available.ethicalImportanceRanking) throw new Error("Chart 'ethicalImportanceRanking' not available");

        const chartObj = metrics._chartBuffers.ethicalImportanceRanking;
        console.log("Chart Object Keys:", chartObj ? Object.keys(chartObj) : "null");
        if (chartObj) console.log("Chart pngBase64 length:", chartObj.pngBase64 ? chartObj.pngBase64.length : "missing");

        // Check chart buffer existence
        if (!metrics._chartBuffers.ethicalImportanceRanking || !metrics._chartBuffers.ethicalImportanceRanking.pngBase64) {
            throw new Error("Chart buffer missing for ethicalImportanceRanking");
        }

        console.log("VERIFICATION SUCCESS");

    } catch (error) {
        const fs = require('fs');
        fs.writeFileSync('error.txt', error.message + '\n' + error.stack);
        console.error("VERIFICATION FAILED");
        process.exit(1);
    } finally {
        // Cleanup
        if (mongoose.connection.readyState === 1) {
            await mongoose.model('Project').deleteOne({ _id: PROJECT_ID });
            await mongoose.model('User').deleteOne({ _id: USER_ID });
            await mongoose.model('Response').deleteMany({ projectId: PROJECT_ID });
            await mongoose.model('Score').deleteMany({ projectId: PROJECT_ID });
            await mongoose.disconnect();
        }
    }
}

run();
