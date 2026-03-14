const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema);

async function inspectQuestions() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Find questions with relevant text or principle
        const questions = await Question.find({
            $or: [
                { principle: { $regex: /human/i } },
                { principle: { $regex: /transparency/i } }
            ]
        });

        console.log(`Found ${questions.length} relevant questions.`);
        const principles = new Set();

        questions.forEach(q => {
            principles.add(q.principle);
            // console.log(`[${q.code}] Principle: '${q.principle}'`);
        });

        console.log("\nUnique Principle Strings found in DB:");
        principles.forEach(p => console.log(`'${p}'`));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectQuestions();
