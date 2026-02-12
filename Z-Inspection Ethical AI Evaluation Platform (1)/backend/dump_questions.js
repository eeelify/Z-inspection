const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

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

async function dumpAllEthicalQuestions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Question = require('./models/question');

        const questions = await Question.find({ questionnaireKey: 'ethical-expert-v1' }).sort({ order: 1 }).lean();

        const dump = questions.map(q => ({
            code: q.code,
            text: q.text?.en,
            importance: q.riskScore,
            options: q.options?.map(o => ({
                key: o.key,
                text: o.label?.en,
                ansScore: o.answerScore,
                legacyScore: o.score
            }))
        }));

        fs.writeFileSync('ethical_v1_dump.json', JSON.stringify(dump, null, 2));
        console.log(`Dumped ${questions.length} questions to ethical_v1_dump.json`);

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
    }
}

dumpAllEthicalQuestions();
