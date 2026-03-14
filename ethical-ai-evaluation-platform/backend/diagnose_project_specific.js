const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!uri) {
    console.error("❌ No Mongo URI found");
    process.exit(1);
}

mongoose.connect(uri).catch(err => { console.error(err); process.exit(1); });

const ProjectSchema = new mongoose.Schema({}, { strict: false });
const Project = mongoose.model('Project', ProjectSchema, 'projects');
const ResponseSchema = new mongoose.Schema({}, { strict: false });
const Response = mongoose.model('Response', ResponseSchema, 'responses');
const ScoreSchema = new mongoose.Schema({}, { strict: false });
const Score = mongoose.model('Score', ScoreSchema, 'scores');
const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema, 'questions');

function log(msg) {
    fs.appendFileSync('diag_project_out.txt', (typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg) + '\n', 'utf8');
}

async function run() {
    try {
        fs.writeFileSync('diag_project_out.txt', '', 'utf8');

        // 1. Find Project
        log("--- FINDING PROJECT ---");
        const projects = await Project.find({ title: { $regex: /test.*3/i } });

        if (projects.length === 0) {
            log("❌ No project found with 'test' and '3' in output.");
            const allProjects = await Project.find({}, { title: 1 }).limit(10);
            log("Recent projects:");
            allProjects.forEach(p => log(` - ${p.title} (${p._id})`));
            return;
        }

        const project = projects[0];
        log(`✅ Found Project: "${project.title}" (ID: ${project._id})`);

        // 2. Check Responses
        log("\n--- CHECKING RESPONSES ---");
        const responses = await Response.find({ projectId: project._id });
        log(`Total Response Docs: ${responses.length}`);

        let totalAnswers = 0;

        // Get Transparency questions to cross-reference
        const transparencyQuestions = await Question.find({
            $or: [
                { principle: /TRANSPARENCY/i },
                { principleKey: /TRANSPARENCY/i }
            ]
        });
        const transparencyIds = transparencyQuestions.map(q => q.id || q.code);
        log(`Total Transparency Questions Definitions in DB: ${transparencyIds.length}`);
        log(`IDs: ${transparencyIds.join(', ')}`);

        responses.forEach((r, idx) => {
            log(`\nResponse #${idx + 1} (User: ${r.userId}, Role: ${r.userRole}):`);
            const answers = r.answers || [];
            totalAnswers += answers.length;
            log(`  - Total Answers Submitted: ${answers.length}`);

            // Check which transparency questions are answered
            const answeredTransp = answers.filter(a => transparencyIds.includes(a.questionId) || transparencyIds.includes(a.questionCode));
            log(`  - Transparency Answers Found: ${answeredTransp.length}`);
            answeredTransp.forEach(a => {
                log(`    > Q: ${a.questionId || a.questionCode}, Score: ${a.answerScore}`);
            });
        });

        // 3. Check Scores
        log("\n--- CHECKING SCORES ---");
        const scores = await Score.find({ projectId: project._id, role: { $ne: 'project' } });
        log(`Total Evaluator Scores: ${scores.length}`);

        scores.forEach((s, idx) => {
            log(`\nScore #${idx + 1} (User: ${s.userId}):`);
            if (s.byPrinciple) {
                const pData = s.byPrinciple['TRANSPARENCY'] || s.byPrinciple['TRANSPARENCY & EXPLAINABILITY'];
                if (pData) {
                    log(`  - TRANSPARENCY Data: n=${pData.n}, risk=${pData.risk}`);
                } else {
                    log(`  - No TRANSPARENCY data in byPrinciple.`);
                    log(`  - Available Principles: ${Object.keys(s.byPrinciple).join(', ')}`);
                }
            }
        });

    } catch (e) {
        log(e);
    } finally {
        mongoose.connection.close();
    }
}

run();
