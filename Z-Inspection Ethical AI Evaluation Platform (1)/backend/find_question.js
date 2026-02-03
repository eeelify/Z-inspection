const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema);

async function findQuestion() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const logArr = [];
        logArr.push('Connected to MongoDB');

        // Search for the question text
        const questions = await Question.find({
            $or: [
                { questionEn: { $regex: "ethical tensions", $options: "i" } },
                { questionTr: { $regex: "etik gerilim", $options: "i" } }
            ]
        });

        logArr.push(`Found ${questions.length} questions.`);
        questions.forEach(q => {
            logArr.push('--------------------------------------------------');
            logArr.push(`ID: ${q._id}`);
            logArr.push(`Role: ${q.role}`);
            logArr.push(`Step: ${q.step}`);
            logArr.push(`Question (EN): ${q.questionEn}`);
        });

        fs.writeFileSync('find_question_output.txt', logArr.join('\n'));
        console.log('Output written to find_question_output.txt');

    } catch (error) {
        console.error('Error:', error);
        fs.writeFileSync('find_question_error.txt', error.toString());
    } finally {
        await mongoose.disconnect();
    }
}

findQuestion();
