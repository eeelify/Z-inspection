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

async function inspectRawResponse() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Response = require('./models/response');

        // Find one response for Tutor AI
        const res = await Response.findOne({ projectId: new mongoose.Types.ObjectId('6985dc9a9ff7bb6bcd9d528e') }).lean();

        if (res && res.answers) {
            console.log(`Response ID: ${res._id}`);
            console.log(`User ID: ${res.userId}`);

            // Look at a few answers
            const samples = res.answers.slice(0, 5).map(a => ({
                qId: a.questionId,
                keys: Object.keys(a),
                answer: a.answer,
                ansScore: a.answerScore,
                ansSeverity: a.answerSeverity,
                score: a.score
            }));

            console.log('Sample Answers RAW:');
            console.log(JSON.stringify(samples, null, 2));
        } else {
            console.log('No response found');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
    }
}

inspectRawResponse();
