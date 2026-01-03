/**
 * CANONICAL RISK SCALE UTILITY
 * 
 * Single source of truth for risk score interpretation across the entire system.
 * 
 * ⚠️ CRITICAL RULES (NEVER INVERTED):
 * - Score range: 0 to 4
 * - 0 = MINIMAL / NO RISK (best case - minimal ethical concerns)
 * - 1 = LOW RISK (low ethical concerns)
 * - 2 = MEDIUM RISK (moderate ethical concerns)
 * - 3 = HIGH RISK (high ethical concerns)
 * - 4 = CRITICAL / MAX RISK (worst case - critical ethical concerns)
 * 
 * Higher numeric score = Higher ethical risk
 * Lower numeric score = Lower ethical risk
 * 
 * NULL/undefined = Not evaluated (N/A) - NOT the same as 0
 */

/**
 * Clamp score to valid range [0, 4]
 * @param {number|null|undefined} score - Input score
 * @returns {number|null} Clamped score or null if invalid
 */
function clampScore(score) {
  if (score === null || score === undefined || isNaN(score)) {
    return null;
  }
  
  if (score < 0) return 0;
  if (score > 4) return 4;
  return score;
}

/**
 * Classify risk level from numeric score
 * @param {number|null|undefined} score - Risk score (0-4) or null/undefined
 * @returns {string} Risk classification: "MINIMAL_RISK" | "LOW_RISK" | "MEDIUM_RISK" | "HIGH_RISK" | "CRITICAL_RISK" | "N/A"
 */
function classifyRisk(score) {
  // NULL/undefined means not evaluated
  if (score === null || score === undefined || isNaN(score)) {
    return "N/A";
  }
  
  // Validate and clamp range
  const clamped = clampScore(score);
  if (clamped === null) {
    return "N/A";
  }
  
  // CORRECT SCALE: Higher score = Higher risk
  if (clamped >= 4) return "CRITICAL_RISK";
  if (clamped >= 3) return "HIGH_RISK";
  if (clamped >= 2) return "MEDIUM_RISK";
  if (clamped >= 1) return "LOW_RISK";
  return "MINIMAL_RISK"; // clamped < 1 (typically 0)
}

/**
 * Get Turkish risk label
 * @param {number|null|undefined} score - Risk score
 * @returns {string} Turkish label
 */
function riskLabelTR(score) {
  const classification = classifyRisk(score);
  const labels = {
    "MINIMAL_RISK": "Minimal Risk",
    "LOW_RISK": "Düşük Risk",
    "MEDIUM_RISK": "Orta Risk",
    "HIGH_RISK": "Yüksek Risk",
    "CRITICAL_RISK": "Kritik Risk",
    "N/A": "Değerlendirilmedi"
  };
  return labels[classification] || "Bilinmeyen";
}

/**
 * Get English risk label
 * @param {number|null|undefined} score - Risk score
 * @returns {string} English label
 */
function riskLabelEN(score) {
  const classification = classifyRisk(score);
  const labels = {
    "MINIMAL_RISK": "Minimal Risk",
    "LOW_RISK": "Low Risk",
    "MEDIUM_RISK": "Medium Risk",
    "HIGH_RISK": "High Risk",
    "CRITICAL_RISK": "Critical Risk",
    "N/A": "Not Evaluated"
  };
  return labels[classification] || "Unknown";
}

/**
 * Validate risk classification is not inverted
 * Throws error if score < 1 is classified as HIGH/CRITICAL or score >= 3.5 is classified as MINIMAL/LOW
 * @param {number|null|undefined} score - Risk score
 * @param {string} interpretedRisk - Interpreted risk classification
 * @throws {Error} If risk interpretation is inverted
 */
function validateRiskScaleNotInverted(score, interpretedRisk) {
  if (score === null || score === undefined || isNaN(score)) {
    return; // Skip validation for invalid scores
  }
  
  const correctRisk = classifyRisk(score);
  const interpretedUpper = String(interpretedRisk || '').toUpperCase();
  
  // Check for inversion: score < 1 should NEVER be HIGH or CRITICAL
  if (score < 1 && (interpretedUpper.includes('HIGH') || interpretedUpper.includes('CRITICAL') || interpretedUpper.includes('MAX'))) {
    throw new Error(
      `RISK SCALE INVERSION DETECTED: Score ${score} interpreted as "${interpretedRisk}", but should be "${correctRisk}" ` +
      `(score < 1 = MINIMAL/LOW risk, never HIGH/CRITICAL)`
    );
  }
  
  // Check for inversion: score >= 3.5 should NEVER be MINIMAL or LOW
  if (score >= 3.5 && (interpretedUpper.includes('MINIMAL') || interpretedUpper.includes('LOW'))) {
    throw new Error(
      `RISK SCALE INVERSION DETECTED: Score ${score} interpreted as "${interpretedRisk}", but should be "${correctRisk}" ` +
      `(score >= 3.5 = HIGH/CRITICAL risk, never MINIMAL/LOW)`
    );
  }
}

/**
 * Get color for a score (for charts and visualizations)
 * @param {number|null|undefined} score - Score from 0 to 4
 * @returns {string} Hex color code
 */
function colorForScore(score) {
  if (score === null || score === undefined || isNaN(score)) {
    return "#9ca3af"; // Gray for N/A or unknown
  }
  
  const clamped = clampScore(score);
  if (clamped === null) {
    return "#9ca3af"; // Gray
  }
  
  // CORRECT SCALE: 0 = green (safe), 4 = red (critical)
  if (clamped < 0.5) return "#10b981";   // Green - MINIMAL RISK (0)
  if (clamped < 1.5) return "#84cc16";   // Light green - LOW RISK (1)
  if (clamped < 2.5) return "#fbbf24";   // Yellow/Amber - MEDIUM RISK (2)
  if (clamped < 3.5) return "#f97316";   // Orange - HIGH RISK (3)
  return "#ef4444";                      // Red - CRITICAL RISK (4)
}

module.exports = {
  clampScore,
  classifyRisk,
  riskLabelTR,
  riskLabelEN,
  validateRiskScaleNotInverted,
  colorForScore
};

