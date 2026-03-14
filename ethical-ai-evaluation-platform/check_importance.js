const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const Question = require('./backend/models/question');

async function check() {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ethical-ai';
    await mongoose.connect(MONGO_URI);

    const targets = ['L5', 'L6', 'L8', 'L13', 'Q12', 'Q6', 'Q3', 'Q21'];
    const questions = await Question.find({ code: { $in: targets } });

    console.log('--- Question Importance Analysis ---');
    questions.forEach(q => {
        console.log(`Code: ${q.code}`);
        console.log(` - Principle: ${q.principleKey || q.principle}`);
        console.log(` - riskScore (Importance): ${q.riskScore}`);
        console.log(` - importance: ${q.importance}`);
        console.log(` - scoring.importanceHandledSeparately: ${q.scoring?.importanceHandledSeparately}`);
        console.log('-------------------');
    });

    process.exit(0);
}

check().catch(console.error);
