const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema);

async function inspectFullQuestion() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) return;
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const question = await Question.findOne({ code: 'T1' });
        if (question) {
            console.log(JSON.stringify(question.toObject(), null, 2));
        } else {
            console.log("T1 not found");
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectFullQuestion();
