require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { buildReportMetrics } = require('./services/reportMetricsService');
const Project = require('./models/Project');
const Response = require('./models/Response');
const Score = require('./models/Score');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
    console.error("❌ No Mongo URI found in .env");
    process.exit(1);
}

async function checkMetrics() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const project = await Project.findOne({ title: /test case 3/i });
        if (!project) {
            console.log('Project "test case 3" not found');
            // Try finding ANY project
            const anyProject = await Project.findOne({});
            if (anyProject) {
                console.log(`Fallback: Checking Project: ${anyProject.title} (${anyProject._id})`);
                await analyzeProject(anyProject._id);
            } else {
                console.log('No projects found in DB.');
            }
            return;
        }
        console.log(`Checking Project: ${project.title} (${project._id})`);
        await analyzeProject(project._id);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

async function analyzeProject(projectId) {
    const metrics = await buildReportMetrics(projectId);

    console.log('\n--- SCORING.BY_PRINCIPLE_OVERALL ---');
    console.log(JSON.stringify(metrics.scoring?.byPrincipleOverall, null, 2));

    const scores = await Score.find({ project: projectId });
    console.log(`\nTotal Scores in DB: ${scores.length}`);

    const responses = await Response.find({ project: projectId });
    console.log(`Total Responses in DB: ${responses.length}`);

    if (metrics.scoring?.byPrincipleOverall) {
        Object.keys(metrics.scoring.byPrincipleOverall).forEach(k => {
            const d = metrics.scoring.byPrincipleOverall[k];
            // Log specifically the properties used in report template
            const risk = d.risk !== undefined ? d.risk : (d.avg !== undefined ? d.avg : 0);
            const questionCount = typeof d.n === 'number' && d.n > 0 ? d.n : 1;
            const expertCount = typeof d.count === 'number' && d.count > 0 ? d.count : 1;
            const normalized = risk / (questionCount * expertCount);

            console.log(`${k}: Risk=${risk.toFixed(2)}, Qs=${questionCount}, Experts=${expertCount} => Normalized=${normalized.toFixed(2)}`);
        });
    } else {
        console.log("metrics.scoring.byPrincipleOverall is MISSING/EMPTY");
    }
}

checkMetrics();
