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

async function checkCombinedScoreFields() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const Score = require('../models/score');
        const tutorAIProjectId = '6985dc9a9ff7bb6bcd9d528e';

        console.log('\n🔍 Checking Combined Score Fields');
        console.log('='.repeat(80));

        // Find combined score
        const combinedScore = await Score.findOne({
            projectId: tutorAIProjectId,
            questionnaireKey: '__ALL_COMBINED__'
        }).lean();

        if (combinedScore) {
            console.log('\n✅ Found combined score in database');
            console.log(`   questionnaireKey: ${combinedScore.questionnaireKey}`);
            console.log(`   userId: ${combinedScore.userId}`);
            console.log(`   totals.n: ${combinedScore.totals?.n}`);
            console.log(`   totals.overallRisk: ${combinedScore.totals?.overallRisk}\n`);

            console.log('📊 byPrinciple structure check:\n');

            if (combinedScore.byPrinciple) {
                const principleKeys = Object.keys(combinedScore.byPrinciple);
                console.log(`   Found ${principleKeys.length} principles\n`);

                let totalN = 0;
                let totalAnswers = 0;

                principleKeys.forEach(p => {
                    const data = combinedScore.byPrinciple[p];
                    console.log(`   ${p}:`);
                    console.log(`      n: ${data.n}`);
                    console.log(`      totalAnswers: ${data.totalAnswers || 'MISSING!'}`);
                    console.log(`      risk: ${data.risk}`);
                    console.log('');

                    totalN += (data.n || 0);
                    totalAnswers += (data.totalAnswers || data.n || 0);
                });

                console.log('='.repeat(80));
                console.log(`✅ Sum of all n: ${totalN}`);
                console.log(`✅ Sum of all totalAnswers: ${totalAnswers}`);
                console.log(`\n❗ This is what reportEnrichmentService will use: ${totalAnswers}`);

                if (totalAnswers === 119) {
                    console.log(`\n✅ ✅ ✅ CORRECT! totalAnswers = 119`);
                } else if (totalAnswers === 83) {
                    console.log(`\n❌ ❌ ❌ WRONG! totalAnswers = 83 (missing totalAnswers field!)`);
                } else {
                    console.log(`\n⚠️ UNEXPECTED: totalAnswers = ${totalAnswers}`);
                }

            } else {
                console.log('\n❌ byPrinciple is missing!');
            }

        } else {
            console.log('\n❌ Combined score NOT found in database');
            console.log('   This means the combined score is not being saved to DB');
            console.log('   It only exists in memory during report generation');
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkCombinedScoreFields();
