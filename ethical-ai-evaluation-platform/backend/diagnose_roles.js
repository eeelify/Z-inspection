const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!uri) {
    console.error("❌ No Mongo URI found");
    process.exit(1);
}

mongoose.connect(uri).catch(err => { console.error(err); process.exit(1); });

const ScoreSchema = new mongoose.Schema({}, { strict: false });
const Score = mongoose.model('Score', ScoreSchema, 'scores');
const ProjectSchema = new mongoose.Schema({}, { strict: false });
const Project = mongoose.model('Project', ProjectSchema, 'projects');

function log(msg) {
    fs.appendFileSync('diag_roles_out.txt', (typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg) + '\n', 'utf8');
}

async function run() {
    try {
        fs.writeFileSync('diag_roles_out.txt', '', 'utf8');

        // Find the specific test project
        const projects = await Project.find({ title: { $regex: /test.*3/i } });
        if (projects.length === 0) {
            log("❌ Project 'test case 3' not found, searching latest...");
        }
        const project = projects.length > 0 ? projects[0] : await Project.findOne({}).sort({ _id: -1 });
        log(`Checking Project: "${project.title}" (${project._id})`);

        // Find ALL scores
        const scores = await Score.find({ projectId: project._id, role: { $ne: 'project' } });
        log(`Total Scores Found: ${scores.length}`);

        const roleCounts = {};

        scores.forEach((s, idx) => {
            const role = s.role || 'unknown';
            const qKey = s.questionnaireKey || 'unknown';
            roleCounts[role] = (roleCounts[role] || 0) + 1;

            log(`\nScore #${idx + 1}:`);
            log(`  - Role: ${role}`);
            log(`  - Questionnaire Key: ${qKey}`);
            log(`  - User ID: ${s.userId}`);

            if (s.byPrinciple) {
                log(`  - Principles Scored: ${Object.keys(s.byPrinciple).join(', ')}`);
                // Check "Technical" specific principles if any
                Object.keys(s.byPrinciple).forEach(p => {
                    const data = s.byPrinciple[p];
                    log(`    > ${p}: n=${data.n}, risk=${data.risk}`);
                });
            } else {
                log(`  - No byPrinciple data found.`);
            }
        });

        log("\nSummary of Roles Found:");
        log(roleCounts);

    } catch (e) {
        log(e);
    } finally {
        mongoose.connection.close();
    }
}

run();
