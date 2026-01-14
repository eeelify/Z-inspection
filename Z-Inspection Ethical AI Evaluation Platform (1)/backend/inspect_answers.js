const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = '6964d4e9d7a6755353c39e4b';

async function inspect() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));

        const Response = require('./models/response');

        const response = await Response.findOne({
            projectId: new mongoose.Types.ObjectId(PROJECT_ID)
        }).lean();

        if (!response || !response.answers || response.answers.length === 0) {
            console.log('No response or answers found');
            await mongoose.disconnect();
            return;
        }

        // Get first 3 answers
        const sampleAnswers = response.answers.slice(0, 3).map(ans => ({
            questionCode: ans.questionCode,
            questionId: ans.questionId?.toString(),
            keys: Object.keys(ans),
            answerScore: ans.answerScore,
            answerSeverity: ans.answerSeverity,
            importanceScore: ans.importanceScore,
            answer: ans.answer
        }));

        const result = {
            responseId: response._id.toString(),
            userId: response.userId?.toString(),
            questionnaireKey: response.questionnaireKey,
            totalAnswers: response.answers.length,
            sampleAnswers
        };

        console.log(JSON.stringify(result, null, 2));
        fs.writeFileSync('answer_structure.json', JSON.stringify(result, null, 2));

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
        fs.writeFileSync('answer_structure_error.txt', error.stack);
        process.exit(1);
    }
}

inspect();
