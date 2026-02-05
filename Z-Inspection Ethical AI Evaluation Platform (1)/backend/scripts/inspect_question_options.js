const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema);

async function inspectOptions() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) return;
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const questions = await Question.find({ code: { $in: ['T1', 'T2'] } });

        questions.forEach(q => {
            console.log(`\n[${q.code}] Type: ${q.answerType}`);
            console.log(`Options:`, JSON.stringify(q.answerOptions, null, 2));
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectOptions();
