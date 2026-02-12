const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

// Define minimal schemas for reading
const ProjectSchema = new mongoose.Schema({}, { strict: false });
const Project = mongoose.model('Project', ProjectSchema);

const ResponseSchema = new mongoose.Schema({}, { strict: false });
const Response = mongoose.model('Response', ResponseSchema);

const ScoreSchema = new mongoose.Schema({}, { strict: false });
const Score = mongoose.model('Score', ScoreSchema);

async function findAndInspect() {
    const result = {
        project: null,
        responses: [],
        scores: []
    };

    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            result.error = 'MONGO_URI not found';
            fs.writeFileSync('debug_result.json', JSON.stringify(result, null, 2));
            return;
        }
        await mongoose.connect(mongoUri);

        // 1. Find Project
        const projects = await Project.find({
            $or: [
                { title: { $regex: /Tutor/i } },
                { name: { $regex: /Tutor/i } }
            ]
        });

        if (projects.length === 0) {
            result.error = 'No project found';
            fs.writeFileSync('debug_result.json', JSON.stringify(result, null, 2));
            return;
        }

        const project = projects[0];
        result.project = {
            id: project._id,
            title: project.title,
            name: project.name
        };

        // 2. Inspect Responses
        const responses = await Response.find({ projectId: project._id }).lean();
        result.responses = responses.map(r => {
            const hasAnswers = r.answers && r.answers.length > 0;
            let sampleAnswer = null;
            if (hasAnswers) {
                // Find first answer with score/severity
                sampleAnswer = r.answers.find(a => a.answerScore !== undefined || a.answerSeverity !== undefined);
                if (!sampleAnswer) sampleAnswer = r.answers[0]; // fallback
            }
            return {
                userId: r.userId,
                status: r.status,
                answersCount: hasAnswers ? r.answers.length : 0,
                sampleAnswer: sampleAnswer ? {
                    questionId: sampleAnswer.questionId,
                    answerScore: sampleAnswer.answerScore, // Legacy
                    answerSeverity: sampleAnswer.answerSeverity, // Strict
                    importanceScore: sampleAnswer.importanceScore,
                    answer: sampleAnswer.answer
                } : null
            };
        });

        // 3. Inspect Scores
        const scores = await Score.find({ projectId: project._id }).lean();
        result.scores = scores.map(s => ({
            userId: s.userId,
            version: s.scoringModelVersion,
            totals: s.totals,
            byPrinciple: s.byPrinciple // Full breakdown
        }));

    } catch (error) {
        result.error = error.message;
    } finally {
        await mongoose.disconnect();
        fs.writeFileSync('debug_result.json', JSON.stringify(result, null, 2));
    }
}

findAndInspect();
