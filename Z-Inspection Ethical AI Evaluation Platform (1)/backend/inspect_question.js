const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function inspect() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));

        const Question = require('./models/question');

        // Get question T1 and check its options
        const question = await Question.findOne({ code: 'T1' }).lean();

        if (!question) {
            console.log('Question T1 not found');
            await mongoose.disconnect();
            return;
        }

        const result = {
            code: question.code,
            text: question.text,
            answerType: question.answerType,
            principle: question.principle,
            riskScore: question.riskScore,
            importance: question.importance,
            hasOptions: !!question.options,
            optionsCount: question.options?.length || 0,
            options: question.options?.map(opt => ({
                key: opt.key,
                label: opt.label,
                value: opt.value,
                severity: opt.severity,
                score: opt.score
            })) || []
        };

        console.log(JSON.stringify(result, null, 2));
        fs.writeFileSync('question_structure.json', JSON.stringify(result, null, 2));

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
        fs.writeFileSync('question_structure_error.txt', error.stack);
        process.exit(1);
    }
}

inspect();
