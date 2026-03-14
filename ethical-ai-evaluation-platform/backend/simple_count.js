
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
// Hardcode URI or read from process.env if available, but for now rely on dotenv
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
    try {
        console.log('STARTING COUNT...');
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) {
            console.error('NO URI');
            process.exit(1);
        }
        await mongoose.connect(uri);
        const Question = require('./models/question');

        const questions = await Question.find({}).lean();
        console.log(`FOUND ${questions.length} questions`);

        const breakdown = {};
        questions.forEach(q => {
            const k = q.questionnaireKey || 'general-v1';
            if (!breakdown[k]) breakdown[k] = { total: 0, quant: 0, qual: 0 };
            breakdown[k].total++;
            if (q.answerType === 'open_text') breakdown[k].qual++;
            else breakdown[k].quant++;
        });

        const out = { total: questions.length, breakdown };
        fs.writeFileSync('question_counts_root.json', JSON.stringify(out, null, 2));
        console.log('DONE WRITING question_counts_root.json');

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
