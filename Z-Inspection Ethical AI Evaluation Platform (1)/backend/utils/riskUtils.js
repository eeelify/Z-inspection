/**
 * Risk Utils - Single Source of Truth for Risk Score Interpretation
 * 
 * ⚠️ CRITICAL RULE (FIXED - NO LONGER INVERTED):
 * - 0 = MINIMAL/NO RISK (best case)
 * - 1 = LOW RISK
 * - 2 = MEDIUM RISK
 * - 3 = HIGH RISK
 * - 4 = MAX/CRITICAL RISK (worst case)
 * 
 * Score → Risk mapping (CORRECT):
 * - 0   → MINIMAL/NO RISK
 * - 1   → LOW RISK
 * - 2   → MEDIUM RISK
 * - 3   → HIGH RISK
 * - 4   → MAX/CRITICAL RISK
 */

/**
 * Get risk level label from numeric score
 * @param {number} score - Score from 0 to 4
 * @returns {string} Risk level: "MINIMAL", "LOW", "MEDIUM", "HIGH", or "CRITICAL"
 */
function riskLevelFromScore(score) {
  if (score === null || score === undefined || isNaN(score)) {
    return "UNKNOWN";
  }
  
  // CORRECT SCALE: Higher score = Higher risk
  if (score < 0.5) return "MINIMAL";
  if (score < 1.5) return "LOW";
  if (score < 2.5) return "MEDIUM";
  if (score < 3.5) return "HIGH";
  return "CRITICAL"; // score >= 3.5
}

/**
 * Get color for a score (for charts and visualizations)
 * @param {number} score - Score from 0 to 4
 * @param {boolean} isPerformance - If true, high score = good (green), if false, high score = bad (red)
 * @returns {string} Hex color code
 */
function colorForScore(score, isPerformance = false) {
  if (score === null || score === undefined || isNaN(score)) {
    return "#9ca3af"; // Gray for N/A or unknown
  }
  
  if (isPerformance) {
    // PERFORMANCE MODE: High score = good (green), Low score = bad (red)
    if (score >= 3.5) return "#10b981";   // Green - EXCELLENT (3.5-4.0)
    if (score >= 2.5) return "#84cc16";   // Light green - GOOD (2.5-3.4)
    if (score >= 1.5) return "#fbbf24";   // Yellow - FAIR (1.5-2.4)
    if (score >= 0.5) return "#f97316";   // Orange - POOR (0.5-1.4)
    return "#ef4444";                     // Red - CRITICAL (0-0.4)
  } else {
    // RISK MODE: High score = bad (red), Low score = good (green)
    if (score < 0.5) return "#10b981";   // Green - MINIMAL RISK (0)
    if (score < 1.5) return "#84cc16";   // Light green - LOW RISK (1)
    if (score < 2.5) return "#fbbf24";   // Yellow/Amber - MEDIUM RISK (2)
    if (score < 3.5) return "#f97316";   // Orange - HIGH RISK (3)
    return "#ef4444";                    // Red - CRITICAL RISK (4)
  }
}

/**
 * Get risk/performance tier object (for compatibility with existing code)
 * @param {number} score - Score from 0 to 4
 * @param {boolean} isPerformance - If true, interprets as performance score
 * @returns {Object} { label: string, color: string }
 */
function getRiskTier(score, isPerformance = false) {
  const label = riskLevelFromScore(score);
  const color = colorForScore(score, isPerformance);
  
  return { label, color };
}

/**
 * Safety assertion to prevent risk scale inversion
 * @param {number} score - Score from 0 to 4
 * @param {string} interpretedRisk - Risk level that was interpreted
 * @throws {Error} If risk interpretation is inverted
 */
function assertRiskScaleCorrectness(score, interpretedRisk) {
  if (score === null || score === undefined || isNaN(score)) {
    return; // Skip validation for invalid scores
  }
  
  const correctRisk = riskLevelFromScore(score);
  const interpretedUpper = String(interpretedRisk || '').toUpperCase();
  
  // CORRECT SCALE: score 4 should be CRITICAL/HIGH, score 0 should be MINIMAL
  // Check for inversion: score 4 should NEVER be MINIMAL or LOW
  if (score >= 3.5 && (interpretedUpper.includes('MINIMAL') || interpretedUpper.includes('LOW'))) {
    throw new Error(`RISK SCALE INVERSION DETECTED: Score ${score} interpreted as ${interpretedRisk}, but should be ${correctRisk} (score 4 = CRITICAL)`);
  }
  
  // Check for inversion: score 0-1 should NEVER be HIGH or CRITICAL
  if (score < 1 && (interpretedUpper.includes('HIGH') || interpretedUpper.includes('CRITICAL') || interpretedUpper.includes('MAX'))) {
    throw new Error(`RISK SCALE INVERSION DETECTED: Score ${score} interpreted as ${interpretedRisk}, but should be ${correctRisk} (score < 1 = MINIMAL/LOW risk)`);
  }
}

/**
 * Get risk description text
 * @param {number} score - Score from 0 to 4
 * @returns {string} Human-readable risk description
 */
function getRiskDescription(score) {
  const level = riskLevelFromScore(score);
  const descriptions = {
    'MINIMAL': 'Minimal/no ethical risk - well-managed, no concerns',
    'LOW': 'Low ethical risk - acceptable with minor concerns',
    'MEDIUM': 'Medium ethical risk - requires monitoring and mitigation',
    'HIGH': 'High ethical risk - requires immediate attention and remediation',
    'CRITICAL': 'Critical ethical risk - requires urgent intervention and comprehensive mitigation'
  };
  return descriptions[level] || 'Unknown risk level';
}

module.exports = {
  riskLevelFromScore,
  colorForScore,
  getRiskTier,
  assertRiskScaleCorrectness,
  getRiskDescription
};

