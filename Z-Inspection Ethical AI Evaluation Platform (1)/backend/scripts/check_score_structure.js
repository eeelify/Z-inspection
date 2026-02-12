const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const parts = trimmed.split('=');
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^[\"']|[\"']$/g, '');
            if (key === 'MONGODB_URI' || key === 'MONGO_URI') {
                process.env.MONGODB_URI = val;
            }
        }
    }
}

async function checkScoreStructure() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const Score = require('../models/score');

        // Get one score document for Tutor AI project
        const score = await Score.findOne({
            projectId: new mongoose.Types.ObjectId('6985dc9a9ff7bb6bcd9d528e')
        }).lean();

        if (!score) {
            throw new Error('No score found for Tutor AI');
        }

        console.log('\n=== RAW SCORE DOCUMENT STRUCTURE ===');
        console.log(JSON.stringify(score, null, 2));

        console.log('\n=== KEY FIELDS CHECK ===');
        console.log('Has totalsOverall:', !!score.totalsOverall);
        console.log('Has byPrincipleOverall:', !!score.byPrincipleOverall);
        console.log('Has byPrinciple:', !!score.byPrinciple);
        console.log('Has totals:', !!score.totals);

        if (score.byPrincipleOverall) {
            console.log('\nbyPrincipleOverall keys:', Object.keys(score.byPrincipleOverall));
            console.log('byPrincipleOverall type:', typeof score.byPrincipleOverall);
        }

        if (score.byPrinciple) {
            console.log('\nbyPrinciple keys:', Object.keys(score.byPrinciple));
        }

        fs.writeFileSync('score_structure.json', JSON.stringify(score, null, 2));
        console.log('\n✅ Full score document written to score_structure.json');

    } catch (error) {
        console.error('Error:', error);
        fs.writeFileSync('score_structure.json', JSON.stringify({ error: error.message }, null, 2));
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkScoreStructure();
