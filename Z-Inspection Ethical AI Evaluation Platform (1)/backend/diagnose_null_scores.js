const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = '6964d4e9d7a6755353c39e4b';

async function diagnose() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));

        const Score = require('./models/score');
        const sampleScore = await Score.findOne({ projectId: PROJECT_ID }).lean();

        const result = {
            found: !!sampleScore,
            userId: sampleScore?.userId?.toString(),
            questionnaireKey: sampleScore?.questionnaireKey,
            byPrincipleExists: !!sampleScore?.byPrinciple,
            byPrincipleKeys: sampleScore?.byPrinciple ? Object.keys(sampleScore.byPrinciple) : [],
            samplePrinciple: sampleScore?.byPrinciple?.['TRANSPARENCY'],
            totalsOverallRisk: sampleScore?.totals?.overallRisk,
            totalsN: sampleScore?.totals?.n
        };

        fs.writeFileSync('score_diagnostic.json', JSON.stringify(result, null, 2));
        console.log('Written to score_diagnostic.json');
        console.log(JSON.stringify(result, null, 2));

        await mongoose.disconnect();
    } catch (error) {
        fs.writeFileSync('score_diagnostic_error.txt', error.stack);
        console.error(error);
        process.exit(1);
    }
}

diagnose();
