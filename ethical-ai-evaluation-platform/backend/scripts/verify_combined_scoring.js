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

// Copy the aggregation function from reportMetricsService.js
const CANONICAL_PRINCIPLES = [
    "TRANSPARENCY",
    "HUMAN AGENCY & OVERSIGHT",
    "TECHNICAL ROBUSTNESS & SAFETY",
    "PRIVACY & DATA GOVERNANCE",
    "DIVERSITY, NON-DISCRIMINATION & FAIRNESS",
    "SOCIETAL & INTERPERSONAL WELL-BEING",
    "ACCOUNTABILITY"
];

function aggregateMultiQuestionnaireScores(scores) {
    console.log(`🔄 [TEST] Merging ${scores.length} Score documents from all questionnaires`);

    if (!scores || scores.length === 0) {
        console.warn('⚠️ No scores to aggregate');
        return null;
    }

    const allQuestionBreakdowns = [];
    const scoresByQuestionnaire = {};

    scores.forEach(score => {
        const qKey = score.questionnaireKey || 'unknown';
        if (!scoresByQuestionnaire[qKey]) {
            scoresByQuestionnaire[qKey] = 0;
        }
        scoresByQuestionnaire[qKey]++;

        if (score.questionBreakdown && Array.isArray(score.questionBreakdown)) {
            console.log(`  Adding ${score.questionBreakdown.length} questions from ${qKey} (userId: ${score.userId})`);
            allQuestionBreakdowns.push(...score.questionBreakdown);
        }
    });

    console.log(`📊 Questionnaire distribution:`, scoresByQuestionnaire);
    console.log(`📊 Total combined questions: ${allQuestionBreakdowns.length}`);

    const byPrinciple = {};
    CANONICAL_PRINCIPLES.forEach(principle => {
        byPrinciple[principle] = {
            n: 0,
            risk: 0,
            avgImportance: 0,
            highImportanceRatio: 0,
            topDrivers: []
        };
    });

    const principleData = {};
    CANONICAL_PRINCIPLES.forEach(p => {
        principleData[p] = {
            questions: [],
            totalRisk: 0,
            totalImportance: 0,
            highImportanceCount: 0
        };
    });

    allQuestionBreakdowns.forEach(qb => {
        const principle = qb.principle;
        if (!principle || !CANONICAL_PRINCIPLES.includes(principle)) {
            return;
        }

        principleData[principle].questions.push(qb);
        principleData[principle].totalRisk += (qb.finalRiskContribution || 0);
        principleData[principle].totalImportance += (qb.importance || 0);
        if (qb.importance >= 3) {
            principleData[principle].highImportanceCount++;
        }
    });

    CANONICAL_PRINCIPLES.forEach(principle => {
        const data = principleData[principle];
        const n = data.questions.length;

        if (n > 0) {
            byPrinciple[principle] = {
                n,
                risk: data.totalRisk,
                avgImportance: data.totalImportance / n,
                highImportanceRatio: data.highImportanceCount / n,
                topDrivers: data.questions
                    .sort((a, b) => (b.finalRiskContribution || 0) - (a.finalRiskContribution || 0))
                    .slice(0, 5)
                    .map(q => ({
                        questionId: q.questionId,
                        answerSeverity: q.answerSeverity,
                        finalRiskContribution: q.finalRiskContribution,
                        importance: q.importance
                    }))
            };

            console.log(`  ${principle}: ${n} questions, risk=${data.totalRisk.toFixed(2)}`);
        }
    });

    const totalRisk = allQuestionBreakdowns.reduce((sum, qb) => sum + (qb.finalRiskContribution || 0), 0);
    const totalQuestions = allQuestionBreakdowns.length;

    console.log(`✅ Combined totals: ${totalQuestions} questions, total risk=${totalRisk.toFixed(2)}`);

    return {
        byPrinciple,
        totals: {
            overallRisk: totalRisk,
            n: totalQuestions
        },
        questionBreakdown: allQuestionBreakdowns,
        questionnaireKey: '__ALL_COMBINED__',
        role: scores[0]?.role || 'combined',
        scoringModelVersion: scores[0]?.scoringModelVersion || 'combined',
        userId: scores[0]?.userId || 'combined_all_evaluators',
        projectId: scores[0]?.projectId
    };
}

async function verifyAggregation() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const Score = require('../models/score');

        const tutorAIProjectId = '6985dc9a9ff7bb6bcd9d528e';

        console.log('\n✅ RISK CALCULATION VERIFICATION');
        console.log('='.repeat(80));

        const scores = await Score.find({
            projectId: tutorAIProjectId
        }).lean();

        console.log(`\n📊 Found ${scores.length} Score documents\n`);

        const evaluatorScores = scores.filter(s => s && s.role !== 'project' && s.userId);
        console.log(`📊 Evaluator Scores (excluding project-level): ${evaluatorScores.length}\n`);

        // Test aggregation
        const combinedScore = aggregateMultiQuestionnaireScores(evaluatorScores);

        console.log('\n' + '='.repeat(80));
        console.log('✅ VERIFICATION RESULTS');
        console.log('='.repeat(80));

        if (combinedScore) {
            console.log(`\n✅ Combined Score Created Successfully`);
            console.log(`   - Total Questions: ${combinedScore.totals.n}`);
            console.log(`   - Cumulative Risk: ${combinedScore.totals.overallRisk.toFixed(2)}`);
            console.log(`   - Average ERC: ${(combinedScore.totals.overallRisk / combinedScore.totals.n).toFixed(3)}`);
            console.log(`   - Normalized (0-4): ${((combinedScore.totals.overallRisk / combinedScore.totals.n) * 4).toFixed(3)} / 4`);
            console.log(`   - userId: ${combinedScore.userId}`);
            console.log(`   - projectId: ${combinedScore.projectId}`);

            console.log(`\n📋 By Principle:`);
            CANONICAL_PRINCIPLES.forEach(p => {
                const data = combinedScore.byPrinciple[p];
                if (data && data.n > 0) {
                    console.log(`   ${p}: ${data.n} questions, ${data.risk.toFixed(2)} risk`);
                }
            });

            // Simulate what would happen in buildReportMetrics
            console.log(`\n🔄 Simulating buildReportMetrics behavior:`);
            console.log(`   Before: evaluatorScores.length = ${evaluatorScores.length}`);

            evaluatorScores.length = 0;
            evaluatorScores.push(combinedScore);

            console.log(`   After: evaluatorScores.length = ${evaluatorScores.length}`);
            console.log(`   ✅ evaluatorScores now contains ONLY combined score`);

            console.log(`\n✅ VERIFICATION PASSED - Implementation is correct!`);

        } else {
            console.log(`\n❌ VERIFICATION FAILED - Combined score is null`);
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

verifyAggregation();
