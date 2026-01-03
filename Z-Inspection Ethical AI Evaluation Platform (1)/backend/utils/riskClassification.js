/**
 * CANONICAL RISK CLASSIFICATION FUNCTION
 * 
 * This is the ONLY allowed way to classify risk from numeric scores.
 * 
 * RULES:
 * - 0 = MINIMAL RISK (best case)
 * - 1 = LOW RISK
 * - 2 = MEDIUM RISK
 * - 3 = HIGH RISK
 * - 4 = MAX/CRITICAL RISK (worst case)
 * 
 * Higher numeric score = Higher ethical risk
 * Lower numeric score = Lower ethical risk
 * 
 * NULL/undefined = Not evaluated (N/A)
 * 
 * @param {number|null|undefined} score - Risk score (0-4) or null/undefined
 * @returns {string} Risk classification: "MINIMAL_RISK" | "LOW_RISK" | "MEDIUM_RISK" | "HIGH_RISK" | "MAX_RISK" | "N/A"
 */
function classifyRisk(score) {
  // NULL/undefined means not evaluated
  if (score === null || score === undefined || isNaN(score)) {
    return "N/A";
  }
  
  // Validate range (0-4)
  if (score < 0 || score > 4) {
    throw new Error(`INVALID RISK SCORE: ${score} is outside valid range [0-4]. Score must be between 0 and 4.`);
  }
  
  // CORRECT SCALE: Higher score = Higher risk
  if (score >= 4) return "MAX_RISK";
  if (score >= 3) return "HIGH_RISK";
  if (score >= 2) return "MEDIUM_RISK";
  if (score >= 1) return "LOW_RISK";
  return "MINIMAL_RISK"; // score < 1 (typically 0)
}

/**
 * Get human-readable risk label (for display)
 * @param {number|null|undefined} score - Risk score (0-4) or null/undefined
 * @returns {string} Human-readable label
 */
function getRiskLabel(score) {
  const classification = classifyRisk(score);
  const labels = {
    "MINIMAL_RISK": "Minimal Risk",
    "LOW_RISK": "Low Risk",
    "MEDIUM_RISK": "Medium Risk",
    "HIGH_RISK": "High Risk",
    "MAX_RISK": "Critical Risk",
    "N/A": "Not Evaluated"
  };
  return labels[classification] || "Unknown";
}

/**
 * Validate that a risk classification matches the score
 * Throws error if classification contradicts the score
 * @param {number|null|undefined} score - Risk score
 * @param {string} classification - Risk classification string
 * @throws {Error} If classification contradicts score
 */
function validateRiskClassification(score, classification) {
  const correctClassification = classifyRisk(score);
  
  if (correctClassification !== classification) {
    throw new Error(
      `RISK CLASSIFICATION INCONSISTENCY: Score ${score} was classified as "${classification}" ` +
      `but correct classification is "${correctClassification}". ` +
      `Risk classification must match the score.`
    );
  }
}

module.exports = {
  classifyRisk,
  getRiskLabel,
  validateRiskClassification
};

