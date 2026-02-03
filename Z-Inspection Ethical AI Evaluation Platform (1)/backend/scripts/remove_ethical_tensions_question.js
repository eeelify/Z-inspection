const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema);

async function removeQuestion() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Search for the question text
        // "Are there any ethical tensions or value conflicts in the design or use of the system"
        const regex = /ethical tensions or value conflicts/i;

        const question = await Question.findOne({
            $or: [
                { questionEn: { $regex: regex } },
                { text: { $regex: regex } } // In case structure is different (some schemas use 'text.en') via strict:false
            ]
        });

        if (question) {
            console.log('Found question:');
            console.log(`ID: ${question._id}`);
            console.log(`Code: ${question.code}`);
            console.log(`Text (EN): ${question.questionEn || (question.text && question.text.en)}`);

            // Delete the question
            await Question.deleteOne({ _id: question._id });
            console.log('✅ Question deleted successfully.');
        } else {
            // Try searching inside text object subfield if strict:false didn't help with findOne top level
            // Actually findOne with dot notation works for nested fields
            const questionNested = await Question.findOne({
                "text.en": { $regex: regex }
            });

            if (questionNested) {
                console.log('Found question (nested text):');
                console.log(`ID: ${questionNested._id}`);
                console.log(`Code: ${questionNested.code}`);
                console.log(`Text (EN): ${questionNested.text.en}`);

                await Question.deleteOne({ _id: questionNested._id });
                console.log('✅ Question deleted successfully (nested structure).');
            } else {
                console.log('❌ Question NOT found.');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

removeQuestion();
