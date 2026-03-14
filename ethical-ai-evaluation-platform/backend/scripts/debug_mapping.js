const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

// Define minimal schemas for reading
const ProjectSchema = new mongoose.Schema({}, { strict: false });
const Project = mongoose.model('Project', ProjectSchema);

const ResponseSchema = new mongoose.Schema({}, { strict: false });
const Response = mongoose.model('Response', ResponseSchema);

const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema);

async function findAndInspect() {
    const result = {
        project: null,
        analysis: []
    };

    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            result.error = 'MONGO_URI not found';
            fs.writeFileSync('debug_mapping.json', JSON.stringify(result, null, 2));
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
            fs.writeFileSync('debug_mapping.json', JSON.stringify(result, null, 2));
            return;
        }

        const project = projects[0];
        result.project = { id: project._id, name: project.name || project.title };

        // 2. Fetch Responses
        const responses = await Response.find({ projectId: project._id }).lean();

        // 3. Analyze each response's questions
        for (const r of responses) {
            if (!r.answers || r.answers.length === 0) continue;

            const questionIds = r.answers.map(a => a.questionId);
            const questions = await Question.find({ _id: { $in: questionIds } }).lean();
            const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

            const analysisEntry = {
                userId: r.userId,
                totalAnswers: r.answers.length,
                questions: []
            };

            r.answers.forEach(a => {
                const q = questionMap.get(a.questionId.toString());
                if (q) {
                    analysisEntry.questions.push({
                        id: q._id,
                        code: q.code,
                        principle: q.principle,
                        principleKey: q.principleKey,
                        riskScore: q.riskScore,
                        type: q.type // Check if it's open_text which might be skipped
                    });
                } else {
                    analysisEntry.questions.push({
                        id: a.questionId,
                        error: 'Question not found in DB'
                    });
                }
            });

            result.analysis.push(analysisEntry);
        }

    } catch (error) {
        result.error = error.message;
    } finally {
        await mongoose.disconnect();
        fs.writeFileSync('debug_mapping.json', JSON.stringify(result, null, 2));
    }
}

findAndInspect();
