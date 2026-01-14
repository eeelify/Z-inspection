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
  // Canonical thresholds (aligned with riskUtils):
  // < 0.5: Minimal
  // < 1.5: Low
  // < 2.5: Medium
  // < 3.5: High
  // >= 3.5: Critical
  if (clamped >= 3.5) return "CRITICAL_RISK";
  if (clamped >= 2.5) return "HIGH_RISK";
  if (clamped >= 1.5) return "MEDIUM_RISK";
  if (clamped >= 0.5) return "LOW_RISK";
  return "MINIMAL_RISK"; // clamped < 0.5
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
 * Get risk label in specified format (unified function for consistency)
 * @param {number|null|undefined} score - Risk score (0-4)
 * @param {string} format - Format: 'label' (default), 'short', 'classification'
 * @param {string} language - Language: 'en' (default) or 'tr'
 * @returns {string} Risk label
 */
function getRiskLabel(score, format = 'label', language = 'en') {
  const classification = classifyRisk(score);

  // Short format (e.g., "MINIMAL", "LOW", "MEDIUM", "HIGH", "CRITICAL")
  if (format === 'short') {
    const shortLabels = {
      "MINIMAL_RISK": "MINIMAL",
      "LOW_RISK": "LOW",
      "MEDIUM_RISK": "MEDIUM",
      "HIGH_RISK": "HIGH",
      "CRITICAL_RISK": "CRITICAL",
      "N/A": "N/A"
    };
    return shortLabels[classification] || "UNKNOWN";
  }

  // Classification format (e.g., "MINIMAL_RISK", "LOW_RISK", etc.)
  if (format === 'classification') {
    return classification;
  }

  // Label format (default) - full descriptive label
  if (language === 'tr') {
    return riskLabelTR(score);
  }
  return riskLabelEN(score);
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
  // Use canonical thresholds for consistent colors
  // PALETTE UPDATE (Jan 2026): Minimal=Green, Low=LightGreen, Moderate=Amber, High=Red
  if (clamped < 0.5) return "#4CAF50";   // Green - MINIMAL
  if (clamped < 1.6) return "#edbf4bff";   // Yellow - LOW (User Request: Sarı)
  if (clamped < 2.5) return "#EF6C00";   // Dark Orange - MEDIUM (User Request: Koyu Turuncu)
  if (clamped < 3.5) return "#D32F2F";   // Dark Red - HIGH (User Request)
  return "#B71C1C";                      // Very Dark Red - CRITICAL
}

/**
 * CUMULATIVE RISK CLASSIFICATION (NORMALIZED)
 * 
 * For cumulative/aggregated risk values (SUM of finalRiskContribution),
 * we NORMALIZE by question count before applying bounded thresholds.
 * 
 * This prevents inflation where principles with many questions always
 * appear as CRITICAL even when individual answers are low-risk.
 * 
 * @param {number} cumulativeScore - Sum of finalRiskContribution values
 * @param {number} questionCount - Number of questions contributing to this sum
 * @returns {string} Risk classification
 */
function classifyCumulativeRisk(cumulativeScore, questionCount) {
  if (cumulativeScore === null || cumulativeScore === undefined || isNaN(cumulativeScore)) {
    return "N/A";
  }
  if (!questionCount || questionCount <= 0) {
    return "N/A";
  }

  // Normalize: average risk per question
  const normalizedRisk = cumulativeScore / questionCount;

  // Apply standard 0-4 thresholds to normalized value
  if (normalizedRisk >= 3.5) return "CRITICAL_RISK";
  if (normalizedRisk >= 2.5) return "HIGH_RISK";
  if (normalizedRisk >= 1.5) return "MEDIUM_RISK";
  if (normalizedRisk >= 0.5) return "LOW_RISK";
  return "MINIMAL_RISK";
}

/**
 * Get risk label for cumulative risk (normalized by question count)
 * @param {number} cumulativeScore - Sum of finalRiskContribution values
 * @param {number} questionCount - Number of questions
 * @param {string} format - 'label' (full), 'short', or 'class' (CSS)
 * @param {string} lang - 'en' or 'tr'
 * @returns {string} Human-readable label
 */
function getCumulativeRiskLabel(cumulativeScore, questionCount, format = 'label', lang = 'en') {
  const classification = classifyCumulativeRisk(cumulativeScore, questionCount);

  const labelsEN = {
    "MINIMAL_RISK": "Minimal Risk",
    "LOW_RISK": "Low Risk",
    "MEDIUM_RISK": "Medium Risk",
    "HIGH_RISK": "High Risk",
    "CRITICAL_RISK": "Critical Risk",
    "N/A": "Not Evaluated"
  };

  const shortLabelsEN = {
    "MINIMAL_RISK": "MINIMAL",
    "LOW_RISK": "LOW",
    "MEDIUM_RISK": "MEDIUM",
    "HIGH_RISK": "HIGH",
    "CRITICAL_RISK": "CRITICAL",
    "N/A": "N/A"
  };

  if (format === 'short') {
    return shortLabelsEN[classification] || "N/A";
  }
  if (format === 'class') {
    return classification.toLowerCase().replace('_', '-');
  }
  return labelsEN[classification] || "Unknown";
}

/**
 * Get color for cumulative risk (normalized)
 * @param {number} cumulativeScore - Sum of finalRiskContribution values
 * @param {number} questionCount - Number of questions
 * @returns {string} Hex color code
 */
function colorForCumulativeRisk(cumulativeScore, questionCount) {
  if (cumulativeScore === null || cumulativeScore === undefined || !questionCount || questionCount <= 0) {
    return "#9ca3af"; // Gray
  }

  const normalizedRisk = cumulativeScore / questionCount;

  if (normalizedRisk < 0.5) return "#4CAF50";   // Green - MINIMAL
  if (normalizedRisk < 1.5) return "#FBC02D";   // Yellow - LOW
  if (normalizedRisk < 2.5) return "#EF6C00";   // Dark Orange - MEDIUM
  if (normalizedRisk < 3.5) return "#D32F2F";   // Dark Red - HIGH
  return "#B71C1C";                             // Very Dark Red - CRITICAL
}

module.exports = {
  clampScore,
  classifyRisk,
  riskLabelTR,
  riskLabelEN,
  getRiskLabel,
  validateRiskScaleNotInverted,
  colorForScore,
  classifyCumulativeRisk,
  getCumulativeRiskLabel,
  colorForCumulativeRisk
};
