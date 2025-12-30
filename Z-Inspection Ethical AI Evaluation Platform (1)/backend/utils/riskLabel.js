/**
 * Shared risk label mapping function
 * 
 * Scoring interpretation: 0 = lowest risk (no/negligible risk), 4 = highest risk (high risk requiring immediate mitigation)
 * Higher score = Higher risk
 * Lower score = Lower risk
 * 
 * @param {number} score - Risk score (0-4)
 * @returns {string} Risk label: "Low", "Moderate", "High", or "Critical"
 */
function riskLabel(score) {
  if (typeof score !== 'number' || isNaN(score)) {
    return 'Unknown';
  }
  
  // 0 = lowest risk (no/negligible risk) = Low
  // 4 = highest risk (high risk requiring immediate mitigation) = Critical
  if (score >= 0.0 && score < 1.0) {
    return 'Low'; // 0.0-1.0 = lowest risk
  } else if (score >= 1.0 && score < 2.0) {
    return 'Moderate'; // 1.0-2.0 = moderate risk
  } else if (score >= 2.0 && score < 3.0) {
    return 'High'; // 2.0-3.0 = high risk
  } else if (score >= 3.0 && score <= 4.0) {
    return 'Critical'; // 3.0-4.0 = highest risk
  }
  
  // Handle edge cases
  if (score < 0) return 'Low'; // Negative scores = lowest risk (edge case)
  if (score > 4) return 'Critical'; // Scores above 4 = highest risk (edge case)
  
  return 'Unknown';
}

module.exports = { riskLabel };

