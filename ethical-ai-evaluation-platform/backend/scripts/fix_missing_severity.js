const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const ResponseSchema = new mongoose.Schema({}, { strict: false });
const QuestionSchema = new mongoose.Schema({}, { strict: false });
const ProjectSchema = new mongoose.Schema({ title: String }, { strict: false });
const ScoreSchema = new mongoose.Schema({}, { strict: false });

const Response = mongoose.model('Response', ResponseSchema);
const Question = mongoose.model('Question', QuestionSchema);
const Project = mongoose.model('Project', ProjectSchema);
const Score = mongoose.model('Score', ScoreSchema);

async function fixSeverity() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) return;
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const project = await Project.findOne({ title: { $regex: /deneme 1/i } });
        if (!project) return;

        // Fetch Responses
        const responses = await Response.find({ projectId: project._id });

        // Fetch Questions separately
        const questionsArr = await Question.find({});
        const questionMap = new Map();
        const codeMap = new Map();
        questionsArr.forEach(q => {
            questionMap.set(q._id.toString(), q);
            if (q.code) codeMap.set(q.code, q);
        });

        console.log(`Found ${responses.length} responses.`);
        console.log(`Loaded ${questionMap.size} questions.`);

        let totalFixed = 0;

        for (const r of responses) {
            let changed = false;

            if (r.answers && Array.isArray(r.answers)) {
                for (const a of r.answers) {
                    const qId = a.questionId ? a.questionId.toString() : null;
                    let q = questionMap.get(qId);

                    // Fallback to Code lookup
                    if (!q && a.questionCode) {
                        q = codeMap.get(a.questionCode);
                    }

                    if (!q) {
                        console.log(`Skipping [${a.questionCode}]: Question definition not found.`);
                        continue;
                    }

                    let score = a.score;
                    let severity = a.answerSeverity;

                    // Lookup options
                    if (a.answer && a.answer.choiceKey && q.answerOptions) {
                        const option = q.answerOptions.find(o => o.key === a.answer.choiceKey);
                        if (option && option.score !== undefined) {
                            const correctScore = option.score;
                            const correctSeverity = (4 - correctScore) / 4;

                            // Check mismatch
                            // Also treat undefined/null score as mismatch
                            // Also treat 0 severity and 0 score (if risk) as mismatch
                            if (score !== correctScore ||
                                Math.abs((severity || 0) - correctSeverity) > 0.01 ||
                                score === undefined || score === null) {

                                console.log(`  Fixing [${a.questionCode}] Choice '${a.answer.choiceKey}':`);
                                console.log(`    Old: Score=${score}, Severity=${severity}`);
                                console.log(`    New: Score=${correctScore}, Severity=${correctSeverity}`);

                                a.score = correctScore;
                                a.answerSeverity = correctSeverity;
                                changed = true;
                                totalFixed++;
                            }
                        }
                    }
                }
            }

            if (changed) {
                r.markModified('answers');
                await r.save();
                console.log(`  ✅ Saved Response ${r._id}`);
            }
        }

        console.log(`Total answers fixed: ${totalFixed}`);
        await Score.deleteMany({ projectId: project._id });
        console.log(`Deleted stale scores.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixSeverity();
