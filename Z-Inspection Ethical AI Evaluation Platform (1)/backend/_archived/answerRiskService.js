// ARCHIVED — Violates strict no-inference ethical scoring rules.
// DO NOT USE.

/**
 * Answer Quality/Severity Service
 * 
 * ARCHIVED: This service contained logic to infer `answerSeverity` from text labels
 * and map legacy scoring fields. This is strictly forbidden in the new
 * ethical scoring architecture.
 * 
 * All scoring must now be explicit:
 * 1. questionImportance (1-4)
 * 2. answerScore (0.0-1.0)
 * 
 * Logic is verified in ethicalScoringService.js
 */

module.exports = {
    calculateAnswerSeverity: () => { throw new Error("ARCHIVED SERVICE: Do not use answerRiskService."); },
    mapOptionToSeverity: () => { throw new Error("ARCHIVED SERVICE: Do not use answerRiskService."); },
    clampAnswerSeverity: () => { throw new Error("ARCHIVED SERVICE: Do not use answerRiskService."); }
};
