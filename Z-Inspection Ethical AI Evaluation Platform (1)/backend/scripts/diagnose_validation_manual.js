const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

// Define only necessary Schemas to read data
const ProjectAssignmentSchema = new mongoose.Schema({ projectId: mongoose.Schema.Types.ObjectId, role: String }, { strict: false });
const ResponseSchema = new mongoose.Schema({ projectId: mongoose.Schema.Types.ObjectId, userId: mongoose.Schema.Types.ObjectId, answers: Array }, { strict: false });
const ScoreSchema = new mongoose.Schema({ projectId: mongoose.Schema.Types.ObjectId, userId: mongoose.Schema.Types.ObjectId, role: String, scoringModelVersion: String }, { strict: false });
const ProjectSchema = new mongoose.Schema({ title: String }, { strict: false });

const ProjectAssignment = mongoose.model('ProjectAssignment', ProjectAssignmentSchema);
const Response = mongoose.model('Response', ResponseSchema);
const Score = mongoose.model('Score', ScoreSchema);
const Project = mongoose.model('Project', ProjectSchema);

async function diagnose() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // 1. Find Project
        const project = await Project.findOne({ title: { $regex: /deneme 1/i } });
        if (!project) {
            console.error('Project "deneme 1" not found!');
            return;
        }
        console.log(`Analyzing Project: ${project.title} (${project._id})`);

        // 2. Check Assignments (Cardinality)
        const assignments = await ProjectAssignment.find({ projectId: project._id });
        console.log(`\n--- Evaluators ---`);
        console.log(`Total Assignments: ${assignments.length}`);
        const ethicalExperts = assignments.filter(a => a.role === 'ethical-expert');
        console.log(`Ethical Experts: ${ethicalExperts.length}`);
        assignments.forEach(a => console.log(`- ${a.role}`));

        if (ethicalExperts.length !== 1) {
            console.error(`❌ FAIL: Expected 1 ethical-expert, found ${ethicalExperts.length}`);
        } else {
            console.log(`✅ PASS: Ethical Expert Count = 1`);
        }

        if (assignments.length < 3) {
            console.warn(`⚠️ WARNING: Total evaluators (${assignments.length}) < 3 (may trigger warning)`);
        }

        // 3. Check Responses vs Scores
        const responses = await Response.find({ projectId: project._id });
        const scores = await Score.find({ projectId: project._id, role: { $ne: 'project' } });

        console.log(`\n--- Responses vs Scores ---`);
        const submittedUsers = [...new Set(responses.map(r => r.userId.toString()))];
        console.log(`Submitted Users (${submittedUsers.length}): ${submittedUsers.join(', ')}`);

        const scoredUsers = [...new Set(scores.map(s => s.userId ? s.userId.toString() : 'unknown'))];
        console.log(`Scored Users (${scoredUsers.length}): ${scoredUsers.join(', ')}`);

        const missingScores = submittedUsers.filter(id => !scoredUsers.includes(id));
        if (missingScores.length > 0) {
            console.error(`❌ FAIL: Users submitted but not scored: ${missingScores.join(', ')}`);
        } else {
            console.log(`✅ PASS: All submissions have scores.`);
        }

        // 4. Check Schema (answerSeverity)
        console.log(`\n--- Schema / Data Integrity ---`);
        let totalAnswers = 0;
        let withSeverity = 0;
        let withLegacy = 0;

        responses.forEach(r => {
            if (r.answers) {
                r.answers.forEach(a => {
                    totalAnswers++;
                    if (a.answerSeverity !== undefined && a.answerSeverity !== null) withSeverity++;
                    if (a.answerScore !== undefined) withLegacy++;
                });
            }
        });

        console.log(`Total Answers: ${totalAnswers}`);
        console.log(`With answerSeverity: ${withSeverity} (${totalAnswers > 0 ? (withSeverity / totalAnswers * 100).toFixed(1) : 0}%)`);
        console.log(`With legacy answerScore: ${withLegacy}`);

        if (withLegacy > 0) console.error(`❌ FAIL: Found legacy answerScore fields.`);
        if (totalAnswers > 0 && (withSeverity / totalAnswers) < 0.5) console.error(`❌ FAIL: Severity Completeness too low.`);

        // 5. Check Scoring Version
        console.log(`\n--- Scoring Version ---`);
        const currentVersion = 'strict_ethical_v3_cumulative';
        const outdatedScores = scores.filter(s => s.scoringModelVersion !== currentVersion);
        if (outdatedScores.length > 0) {
            console.warn(`⚠️ WARNING: ${outdatedScores.length} scores use outdated version (Expected: ${currentVersion})`);
            outdatedScores.forEach(s => console.log(`- ${s.scoringModelVersion}`));
        } else {
            console.log(`✅ PASS: All scores use current version.`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
