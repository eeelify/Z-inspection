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

const ScoreSchema = new mongoose.Schema({
    projectId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    role: String,
    questionnaireKey: String,
    byPrinciple: mongoose.Schema.Types.Mixed,
    totals: mongoose.Schema.Types.Mixed
}, { strict: false });

const ResponseSchema = new mongoose.Schema({
    projectId: mongoose.Schema.Types.ObjectId,
    userId: String,
    role: String,
    questionnaireKey: String,
    status: String,
    submittedAt: Date
}, { strict: false });

const ProjectSchema = new mongoose.Schema({
    title: String,
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { strict: false });

const UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    role: String
}, { strict: false });

async function debugChartSimulation() {
    try {
        // Clean URI if needed
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);

        // Helper to safe register
        const safeRegister = (name, schema) => {
            if (!mongoose.models[name]) {
                try {
                    mongoose.model(name, schema);
                } catch (e) { /* ignore */ }
            }
        };

        safeRegister('Project', new mongoose.Schema({}, { strict: false }));
        safeRegister('Response', new mongoose.Schema({}, { strict: false }));
        safeRegister('Score', new mongoose.Schema({}, { strict: false }));
        safeRegister('User', new mongoose.Schema({}, { strict: false }));
        safeRegister('ProjectAssignment', new mongoose.Schema({}, { strict: false }));
        safeRegister('Question', new mongoose.Schema({}, { strict: false }));
        safeRegister('Tension', new mongoose.Schema({}, { strict: false }));
        safeRegister('UseCase', new mongoose.Schema({}, { strict: false }));
        const Project = mongoose.model('Project'); // Retrieve the registered model
        const Score = mongoose.model('Score');
        const Response = mongoose.model('Response');
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

        const result = {
            project: { title: project.title, id: project._id },
            counts: { responses: responses.length, scores: scores.length },
            responseStatuses: responses.map(r => r.status),
            // Use the REAL metrics data
            metrics_byPrincipleTable: metrics.scoring?.byPrincipleTable,
            // Resolve evaluators with scores using the service logic
            evaluators_withScores: await metrics.evaluators.withScores(null),
            message: "Data fetched."
        };

        const seenUsers = new Set();
        for (const r of responses) {
            const userIdStr = r.userId ? r.userId.toString() : null;
            if (!userIdStr || seenUsers.has(userIdStr)) continue;
            seenUsers.add(userIdStr);

            const user = await User.findById(userIdStr).lean();
            const userScores = scores.filter(s => s.userId.toString() === userIdStr);

            const exactScore = scores.find(s =>
                s.userId.toString() === userIdStr &&
                (s.questionnaireKey === r.questionnaireKey || (!s.questionnaireKey && r.questionnaireKey === 'general-v1'))
            );

            result.evaluators.push({
                user: user ? user.name : 'Unknown',
                userId: userIdStr,
                role: r.role,
                responseQKey: r.questionnaireKey,
                hasAnyScore: userScores.length > 0,
                hasExactScore: !!exactScore,
                scoreKeys: userScores.map(s => s.questionnaireKey),
                scoreDocPrinciplesCount: exactScore && exactScore.byPrinciple ? Object.keys(exactScore.byPrinciple).length : 0
            });
        }

        const validEvaluators = result.evaluators.filter(e => e.hasAnyScore); // Checked stricter condition before, let's look at ANY score
        if (validEvaluators.length === 0) {
            result.message = "CHART WILL BE EMPTY. Valid Evaluators: 0";
        } else {
            result.message = `Chart should show ${validEvaluators.length} evaluators.`;
        }

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
