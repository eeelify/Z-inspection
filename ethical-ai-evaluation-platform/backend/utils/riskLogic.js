/**
 * Core Risk Calculation Logic
 * Extracted from EthicalScoringService for pure unit testing
 */

function calculateRiskScore(questionImportance, answerScore) {
    // Validation
    if (questionImportance < 1 || questionImportance > 4) {
        throw new Error("Importance must be between 1 and 4");
    }
    if (answerScore < 0 || answerScore > 1) {
        throw new Error("Answer Score must be between 0.0 and 1.0");
    }

    // Formula: FinalRiskContribution = importance * (1 - answerScore)
    const risk = questionImportance * (1 - answerScore);

    // Return precision normalized
    return Math.round(risk * 100) / 100;
}

module.exports = { calculateRiskScore };
