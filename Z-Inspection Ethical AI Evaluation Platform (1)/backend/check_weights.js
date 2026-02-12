const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment
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

async function checkQuestionWeights() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Question = require('./models/question');

        // Find a question from ethical-expert-v1
        const question = await Question.findOne({ questionnaireKey: 'ethical-expert-v1' }).lean();

        if (question) {
            console.log('--- Question Details ---');
            console.log(`Code: ${question.code}`);
            console.log(`Principle: ${question.principleKey || question.principle}`);
            console.log(`Importance (riskScore): ${question.riskScore}`);
            console.log(`Options Weight Mapping:`);

            if (question.options) {
                question.options.forEach(opt => {
                    console.log(`  - [${opt.key}] ${opt.text}: Score=${opt.score}, Severity=${opt.answerSeverity}`);
                });
            } else {
                console.log('  No options found (maybe open text)');
            }
        } else {
            console.log('No question found for ethical-expert-v1');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
    }
}

checkQuestionWeights();
