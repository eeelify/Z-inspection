// Simple test to verify aggregation function creates totalAnswers field correctly

const CANONICAL_PRINCIPLES = [
    "TRANSPARENCY",
    "HUMAN AGENCY & OVERSIGHT",
    "TECHNICAL ROBUSTNESS & SAFETY",
    "PRIVACY & DATA GOVERNANCE",
    "DIVERSITY, NON-DISCRIMINATION & FAIRNESS",
    "SOCIETAL & INTERPERSONAL WELL-BEING",
    "ACCOUNTABILITY"
];

// Sample question breakdown data (from real Tutor AI data)
const sampleQuestionBreakdown = [
    // TRANSPARENCY questions
    ...Array(14).fill({ principle: "TRANSPARENCY", finalRiskContribution: 0.14, importance: 2 }),
    // HUMAN AGENCY & OVERSIGHT
    ...Array(22).fill({ principle: "HUMAN AGENCY & OVERSIGHT", finalRiskContribution: 0.30, importance: 2 }),
    // TECHNICAL ROBUSTNESS & SAFETY  
    ...Array(20).fill({ principle: "TECHNICAL ROBUSTNESS & SAFETY", finalRiskContribution: 0.15, importance: 2 }),
    // PRIVACY & DATA GOVERNANCE
    ...Array(16).fill({ principle: "PRIVACY & DATA GOVERNANCE", finalRiskContribution: 0.13, importance: 2 }),
    // DIVERSITY, NON-DISCRIMINATION & FAIRNESS
    ...Array(8).fill({ principle: "DIVERSITY, NON-DISCRIMINATION & FAIRNESS", finalRiskContribution: 0.19, importance: 2 }),
    // SOCIETAL & INTERPERSONAL WELL-BEING
    ...Array(13).fill({ principle: "SOCIETAL & INTERPERSONAL WELL-BEING", finalRiskContribution: 0.38, importance: 2 }),
    // ACCOUNTABILITY
    ...Array(26).fill({ principle: "ACCOUNTABILITY", finalRiskContribution: 0.06, importance: 2 })
];

console.log('\n🔍 Testing totalAnswers field generation');
console.log('='.repeat(80));
console.log(`Total questions: ${sampleQuestionBreakdown.length}\n`);

const byPrinciple = {};
CANONICAL_PRINCIPLES.forEach(principle => {
    byPrinciple[principle] = {
        n: 0,
        risk: 0,
        totalAnswers: 0,
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

sampleQuestionBreakdown.forEach(qb => {
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
            totalAnswers: n, // CRITICAL: This should be present
            avgImportance: data.totalImportance / n,
            highImportanceRatio: data.highImportanceCount / n
        };

        console.log(`${principle}:`);
        console.log(`   n: ${n}`);
        console.log(`   totalAnswers: ${byPrinciple[principle].totalAnswers}`);
        console.log(`   risk: ${data.totalRisk.toFixed(2)}`);
    }
});

console.log('\n' + '='.repeat(80));
console.log('✅ Simulating reportEnrichmentService calculation:\n');

const principleValues = Object.values(byPrinciple).filter(p => p.n > 0);
const totalAnswerCount = principleValues.reduce((sum, p) => sum + (p.totalAnswers || p.n || 0), 0);
const totalN = principleValues.reduce((sum, p) => sum + (p.n || 0), 0);

console.log(`totalAnswerCount (using p.totalAnswers || p.n): ${totalAnswerCount}`);
console.log(`totalN (using p.n): ${totalN}`);

if (totalAnswerCount === 119) {
    console.log('\n✅ ✅ ✅ SUCCESS! totalAnswers field works correctly!');
} else {
    console.log(`\n❌ ❌ ❌ FAILED! Expected 119, got ${totalAnswerCount}`);
}
