/**
 * Shared risk label mapping function
 * 
 * ⚠️ CORRECT Scoring interpretation (FIXED - NO LONGER INVERTED):
 * - 0 = MINIMAL/NO RISK (best case)
 * - 1 = LOW RISK
 * - 2 = MEDIUM RISK
 * - 3 = HIGH RISK
 * - 4 = MAX/CRITICAL RISK (worst case)
 * 
 * CRITICAL RULE: Higher numeric score = Higher ethical risk
 * 
 * @param {number} score - Risk score (0-4)
 * @returns {string} Risk label: "MINIMAL", "LOW", "MEDIUM", "HIGH", or "CRITICAL"
 */
function riskLabel(score) {
  // Delegate to riskUtils for consistency
  const { riskLevelFromScore } = require('./riskUtils');
  return riskLevelFromScore(score);
}

module.exports = { riskLabel };

