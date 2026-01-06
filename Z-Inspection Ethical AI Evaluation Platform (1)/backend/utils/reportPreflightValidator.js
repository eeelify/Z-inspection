/**
 * Preflight Validator for Report Generation
 * 
 * Validates consistency before PDF export to prevent contradictory data.
 * Hard fails if critical inconsistencies are detected.
 * 
 * Updated to use Chart Contract system - validates key presence only, not data availability.
 */

const { classifyRisk, riskLabelEN } = require('./riskScale');
const { validateChartContract, CHART_STATUS } = require('../services/chartContract');

/**
 * Validate report data consistency
 * @param {Object} reportData - Report data including metrics, scores, evaluators
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateReportPreflight(reportData) {
  const errors = [];
  const warnings = [];

  const { reportMetrics, scores, evaluators, tensions, chartImages } = reportData;

  // G1: No contradictory overall labels
  if (reportMetrics?.scoring?.totalsOverall) {
    const overallRisk = reportMetrics.scoring.totalsOverall.avg;
    const overallRiskLabel = reportMetrics.scoring.totalsOverall.riskLabel;
    
    if (overallRisk !== null && overallRisk !== undefined) {
      const expectedLabel = riskLabelEN(overallRisk);
      if (overallRiskLabel && overallRiskLabel !== expectedLabel) {
        errors.push(
          `Contradictory risk label: overallRisk=${overallRisk} but label="${overallRiskLabel}" ` +
          `(expected "${expectedLabel}")`
        );
      }
    }
  }

  // G2: Evaluator count equals number of submitted responses
  if (evaluators && scores) {
    const submittedEvaluatorIds = new Set(
      evaluators.submitted
        .filter(e => e.userId)
        .map(e => e.userId.toString ? e.userId.toString() : String(e.userId))
    );
    
    const scoreUserIds = new Set(
      scores
        .filter(s => s.userId)
        .map(s => s.userId.toString ? s.userId.toString() : String(s.userId))
    );
    
    // Scores should match submitted evaluators (or be subset if some evaluators have no scores)
    const missingScores = [...submittedEvaluatorIds].filter(id => !scoreUserIds.has(id));
    if (missingScores.length > 0) {
      warnings.push(
        `${missingScores.length} submitted evaluator(s) have no scores: ${missingScores.join(', ')}`
      );
    }
    
    // Check for scores without evaluators (shouldn't happen but warn)
    const extraScores = [...scoreUserIds].filter(id => !submittedEvaluatorIds.has(id));
    if (extraScores.length > 0) {
      warnings.push(
        `${extraScores.length} score(s) exist for non-submitted evaluators: ${extraScores.join(', ')}`
      );
    }
  }

  // G3: Risk% formula validation
  if (reportMetrics?.scoring?.byPrincipleOverall) {
    Object.entries(reportMetrics.scoring.byPrincipleOverall).forEach(([principle, data]) => {
      if (data && typeof data === 'object') {
        // Validate riskPct calculation
        if (data.riskPct !== undefined && data.count !== undefined) {
          // riskPct should be (highRiskCount / totalCount) * 100
          // where highRiskCount = count of scores > 2.5 (report safe/risky split)
          // We can't fully validate without raw scores, but we can check bounds
          if (data.riskPct < 0 || data.riskPct > 100) {
            errors.push(
              `Invalid riskPct for ${principle}: ${data.riskPct} (must be 0-100)`
            );
          }
        }
        
        // Validate safePct = 100 - riskPct (if both exist)
        if (data.riskPct !== undefined && data.safePct !== undefined) {
          const expectedSafePct = 100 - data.riskPct;
          const diff = Math.abs(data.safePct - expectedSafePct);
          if (diff > 0.1) { // Allow small floating point differences
            errors.push(
              `Inconsistent safePct for ${principle}: safePct=${data.safePct} but ` +
              `expected ${expectedSafePct} (100 - riskPct=${data.riskPct})`
            );
          }
        }
      }
    });
  }

  // G4: Chart Contract Validation
  // Validate that all required charts exist and have pngBase64, regardless of data availability
  // Charts with status='placeholder' or 'error' are VALID (they have pngBase64)
  // Only MISSING keys or missing pngBase64 cause errors
  
  if (chartImages) {
    const contractValidation = validateChartContract(chartImages);
    
    if (!contractValidation.valid) {
      // Hard fail: required chart keys are missing or lack pngBase64
      if (contractValidation.missing.length > 0) {
        errors.push(
          `Chart contract violation: Missing required chart keys: ${contractValidation.missing.join(', ')}. ` +
          `Report generation cannot proceed.`
        );
      }
      
      if (contractValidation.errors.length > 0) {
        errors.push(
          `Chart contract violation: ${contractValidation.errors.join('; ')}. ` +
          `Report generation cannot proceed.`
        );
      }
    }
    
    // Log chart status for debugging (warnings only, not errors)
    const placeholderCharts = [];
    const errorCharts = [];
    
    Object.entries(chartImages).forEach(([chartId, chart]) => {
      if (chart?.meta?.status === CHART_STATUS.PLACEHOLDER) {
        placeholderCharts.push(`${chartId} (${chart.meta.reason || 'no data'})`);
      } else if (chart?.meta?.status === CHART_STATUS.ERROR) {
        errorCharts.push(`${chartId} (${chart.meta.reason || 'generation failed'})`);
      }
    });
    
    if (placeholderCharts.length > 0) {
      warnings.push(
        `Placeholder charts (no data): ${placeholderCharts.join(', ')}`
      );
    }
    
    if (errorCharts.length > 0) {
      warnings.push(
        `Charts with generation errors: ${errorCharts.join(', ')}`
      );
    }
  } else {
    // chartImages is null or undefined - this is a critical error
    errors.push(
      'Chart contract violation: chartImages is missing. Report generation cannot proceed.'
    );
  }

  // G5: Top drivers table not empty unless truly no questions
  if (reportMetrics?.scoring?.byPrincipleOverall) {
    let hasTopDrivers = false;
    Object.values(reportMetrics.scoring.byPrincipleOverall).forEach(data => {
      if (data?.topDrivers && Array.isArray(data.topDrivers) && data.topDrivers.length > 0) {
        hasTopDrivers = true;
      }
    });
    
    // If we have scores but no top drivers, warn (but don't fail - might be legitimate)
    if (scores && scores.length > 0 && !hasTopDrivers) {
      warnings.push(
        'No top risk drivers found despite having scores. Top drivers table will be empty.'
      );
    }
  }

  // G6: Tensions data consistency
  if (tensions && Array.isArray(tensions)) {
    tensions.forEach((tension, idx) => {
      // Check for placeholder values
      if (tension.claim === 'Not provided' || tension.claim === 'unknown' || !tension.claim) {
        warnings.push(
          `Tension ${idx + 1} has missing or placeholder claim. Check data mapping.`
        );
      }
      
      if (tension.createdBy === 'unknown' || !tension.createdBy) {
        warnings.push(
          `Tension ${idx + 1} has missing createdBy. Check data mapping.`
        );
      }
      
      // Validate reviewState enum
      const validStates = ['Proposed', 'SingleReview', 'UnderReview', 'Accepted', 'Disputed'];
      if (tension.reviewState && !validStates.includes(tension.reviewState)) {
        warnings.push(
          `Tension ${idx + 1} has invalid reviewState: "${tension.reviewState}". ` +
          `Expected one of: ${validStates.join(', ')}`
        );
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  validateReportPreflight
};

