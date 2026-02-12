
const { enrichReportMetrics } = require('../services/reportEnrichmentService');

// Mock data to simulate the "Risk Dilution" scenario
// Scenario: 2 Evaluators, answering 1 question each with High Risk (4.0).
// Total Cumulative Risk = 8.0.
// Total Unique Questions = 1.
// Total Answers = 2.
// Old Incorrect Avg = 8.0 / 1 = 8.0 (Way out of bounds).
// Correct Avg = 8.0 / 2 = 4.0 (Critical).

const mockReportMetrics = {
    scoring: {
        byPrincipleOverall: {
            "TRANSPARENCY": {
                cumulativeRisk: 8.0,
                n: 1, // Unique questions
                totalAnswers: 2 // Total answers (New field)
            }
        }
    }
};

const mockCounts = {
    total: 10,
    quantitative: 8,
    qualitative: 2
};

console.log("--- RUNNING RISK CALCULATION VERIFICATION ---");

// Run enrichment
const enriched = enrichReportMetrics(mockReportMetrics, mockCounts);

console.log("Input:", JSON.stringify(mockReportMetrics.scoring.byPrincipleOverall, null, 2));
console.log("\n--- RESULT ---");
console.log("Cumulative Risk Volume:", enriched.overallTotals.cumulativeRiskVolume); // Should be 8.0
console.log("Average ERC:", enriched.overallTotals.averageERC); // Should be 4.0
console.log("Normalized Label:", enriched.overallTotals.normalizedLabel); // Should be CRITICAL RISK

console.log("\n--- SCORING DISCLOSURE ---");
console.log("Quantitative Questions:", enriched.scoringDisclosure.quantitativeQuestions);

// Verification Logic
if (enriched.overallTotals.averageERC === 4.0) {
    console.log("\n✅ SUCCESS: Risk normalization is correct (divided by total answers).");
} else {
    console.error(`\n❌ FAILURE: Average ERC is ${enriched.overallTotals.averageERC}, expected 4.0.`);
}

if (enriched.scoringDisclosure.quantitativeQuestions === 8) {
    console.log("✅ SUCCESS: Scoring disclosure is present.");
} else {
    console.error("❌ FAILURE: Scoring disclosure is missing or incorrect.");
}
