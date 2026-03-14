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

async function debugAggregation() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const Score = require('../models/score');

        // Find Tutor AI project
        const tutorAIProjectId = '6985dc9a9ff7bb6bcd9d528e';

        console.log('\n🔍 Debugging Aggregation for Tutor AI');
        console.log('='.repeat(80));

        // Get all scores
        const scores = await Score.find({
            projectId: tutorAIProjectId
        }).lean();

        console.log(`\n📊 Found ${scores.length} Score documents\n`);

        // Group by questionnaire
        const byQuestionnaire = {};
        scores.forEach(s => {
            const qKey = s.questionnaireKey || 'null';
            if (!byQuestionnaire[qKey]) {
                byQuestionnaire[qKey] = [];
            }
            byQuestionnaire[qKey].push(s);
        });

        console.log('Scores by Questionnaire:');
        for (const [qKey, scoreList] of Object.entries(byQuestionnaire)) {
            console.log(`\n  📋 ${qKey}: ${scoreList.length} scores`);
            scoreList.forEach((s, idx) => {
                const qbLength = s.questionBreakdown?.length || 0;
                const totalRisk = s.totals?.overallRisk || 0;
                const n = s.totals?.n || 0;
                console.log(`    ${idx + 1}. userId: ${s.userId}, questions: ${qbLength}, risk: ${totalRisk}, n: ${n}`);
            });
        }

        // Filter evaluator scores (exclude project-level)
        const evaluatorScores = scores.filter(s => s && s.role !== 'project' && s.userId);
        console.log(`\n\n📊 Evaluator Scores (excluding project-level): ${evaluatorScores.length}`);

        // Test aggregation logic manually
        console.log('\n🔬 Testing Aggregation Logic:\n');

        const allQuestionBreakdowns = [];
        evaluatorScores.forEach(score => {
            if (score.questionBreakdown && Array.isArray(score.questionBreakdown)) {
                console.log(`  Adding ${score.questionBreakdown.length} questions from ${score.questionnaireKey} (userId: ${score.userId})`);
                allQuestionBreakdowns.push(...score.questionBreakdown);
            }
        });

        console.log(`\n✅ Total questions after merge: ${allQuestionBreakdowns.length}`);

        const totalRisk = allQuestionBreakdowns.reduce((sum, qb) => sum + (qb.finalRiskContribution || 0), 0);
        console.log(`✅ Total cumulative risk: ${totalRisk.toFixed(2)}`);
        console.log(`✅ Average ERC: ${(totalRisk / allQuestionBreakdowns.length).toFixed(3)}`);
        console.log(`✅ Normalized (0-4 scale): ${((totalRisk / allQuestionBreakdowns.length) * 4).toFixed(3)} / 4`);

        // Write results
        const result = {
            totalScores: scores.length,
            evaluatorScores: evaluatorScores.length,
            byQuestionnaire: Object.keys(byQuestionnaire).reduce((acc, key) => {
                acc[key] = byQuestionnaire[key].map(s => ({
                    userId: s.userId,
                    questionCount: s.questionBreakdown?.length || 0,
                    totalRisk: s.totals?.overallRisk || 0
                }));
                return acc;
            }, {}),
            aggregatedResult: {
                totalQuestions: allQuestionBreakdowns.length,
                totalRisk: totalRisk,
                averageERC: totalRisk / allQuestionBreakdowns.length,
                normalizedERC: (totalRisk / allQuestionBreakdowns.length) * 4
            }
        };

        fs.writeFileSync('aggregation_debug.json', JSON.stringify(result, null, 2));
        console.log('\n\n✅ Results written to aggregation_debug.json');

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

debugAggregation();
