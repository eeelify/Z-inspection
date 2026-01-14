const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = '6964d4e9d7a6755353c39e4b';

async function verify() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));

        const Response = require('./models/response');

        const responses = await Response.find({
            projectId: new mongoose.Types.ObjectId(PROJECT_ID)
        }).lean();

        let totalAnswers = 0;
        let withSeverity = 0;
        let withScore = 0;
        let withBoth = 0;

        for (const response of responses) {
            if (!response.answers) continue;

            for (const answer of response.answers) {
                totalAnswers++;
                const hasSeverity = answer.answerSeverity !== undefined && answer.answerSeverity !== null;
                const hasScore = answer.answerScore !== undefined && answer.answerScore !== null;

                if (hasSeverity) withSeverity++;
                if (hasScore) withScore++;
                if (hasSeverity && hasScore) withBoth++;
            }
        }

        const result = {
            totalResponses: responses.length,
            totalAnswers,
            withSeverity,
            withScore,
            withBoth,
            migrationSuccess: withSeverity > 0
        };

        console.log(JSON.stringify(result, null, 2));
        fs.writeFileSync('migration_verify.json', JSON.stringify(result, null, 2));

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
        fs.writeFileSync('migration_verify_error.txt', error.stack);
        process.exit(1);
    }
}

verify();
