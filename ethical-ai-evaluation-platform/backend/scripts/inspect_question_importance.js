const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema);

async function inspectImportance() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const questions = await Question.find({
            principle: { $regex: /TRANSPARENCY/i }
        });

        console.log(`Found ${questions.length} Transparency questions.`);

        questions.forEach(q => {
            console.log(`[${q.code}] Importance: ${q.importance}, RiskScore: ${q.riskScore}, Type: ${q.answerType}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectImportance();
