const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment from .env
const envPath = path.join(__dirname, '.env');
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

const PROJECT_ID = '6985dc9a9ff7bb6bcd9d528e'; // Tutor AI Project

async function inspectProjectAnswers() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri);

        const Response = require('./models/response');
        const Question = require('./models/question');

        // Fetch all responses for the project
        const responses = await Response.find({
            projectId: new mongoose.Types.ObjectId(PROJECT_ID)
        }).lean();

        console.log(`Found ${responses.length} responses for project ${PROJECT_ID}`);

        const detailedAnalysis = [];

        for (const res of responses) {
            const questionIds = res.answers.map(a => a.questionId);
            const questions = await Question.find({ _id: { $in: questionIds } }).lean();
            const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

            const analysis = {
                userId: res.userId?.toString(),
                role: res.role,
                questionnaireKey: res.questionnaireKey,
                answers: res.answers.map(ans => {
                    const q = questionMap.get(ans.questionId?.toString());
                    return {
                        code: q?.code,
                        text: q?.text?.substring(0, 50) + '...',
                        choiceKey: ans.answer?.choiceKey,
                        severity: ans.answerSeverity,
                        importance: ans.importanceScore ?? q?.riskScore ?? 2,
                        calcRisk: (ans.answerSeverity || 0) * (ans.importanceScore ?? q?.riskScore ?? 2)
                    };
                })
            };
            detailedAnalysis.push(analysis);
        }

        fs.writeFileSync('detailed_answers_analysis.json', JSON.stringify(detailedAnalysis, null, 2));
        console.log('Analysis written to detailed_answers_analysis.json');

        // Summary statistics
        detailedAnalysis.forEach(da => {
            const totalRisk = da.answers.reduce((s, a) => s + a.calcRisk, 0);
            const count = da.answers.length;
            console.log(`${da.role} (${da.questionnaireKey}): ${count} questions, Total Risk: ${totalRisk.toFixed(2)}, Avg: ${(totalRisk / count).toFixed(2)}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

inspectProjectAnswers();
