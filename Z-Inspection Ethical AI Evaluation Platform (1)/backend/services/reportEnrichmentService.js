/**
 * PHASE 3: ERC-Compliant Report Enrichment Service
 * 
 * Adds ERC-compliant fields (overallTotals, scoringDisclosure) to reportMetrics
 * WITHOUT modifying core reportMetricsService.js
 * 
 * This is a Phase 3 incremental fix for backward compatibility.
 */

const ercConfig = require('../config/ercThresholds.v1');

/**
 * Enrich report metrics with Phase 3 ERC-compliant fields
 */
function enrichReportMetrics(reportMetrics) {
    if (!reportMetrics || !reportMetrics.scoring) {
        return reportMetrics;
    }

    const scoring = reportMetrics.scoring;

    // Calculate Overall Totals from principle scores
    const principleValues = Object.values(scoring.byPrincipleOverall || {}).filter(p => p !== null);

    let overallTotals;

    if (principleValues.length === 0) {
        overallTotals = {
            cumulativeRiskVolume: 0,
            quantitativeQuestionCount: 0,
            averageERC: 0,
            normalizedRiskLevel: 'UNKNOWN',
            normalizedLabel: 'No Data',
            normalizedColor: '#9E9E9E',
            overallRisk: 0,  // DEPRECATED
            riskLabel: 'No Data'  // DEPRECATED
        };
    } else {
        const totalCumulativeRisk = principleValues.reduce((sum, p) => sum + (p.cumulativeRisk || p.risk || 0), 0);
        const totalQuestionCount = principleValues.reduce((sum, p) => sum + (p.questionCount || p.n || 0), 0);
        const averageERCPerQuestion = totalQuestionCount > 0 ? totalCumulativeRisk / totalQuestionCount : 0;
        const normalized = ercConfig.getRiskLevel(averageERCPerQuestion);

        // REGRESSION GUARD
        const wrongNormalized = ercConfig.getRiskLevel(totalCumulativeRisk);
        if (normalized.level === wrongNormalized.level && Math.abs(totalCumulativeRisk - averageERCPerQuestion) > 0.01) {
            console.warn(`⚠️  OVERALL REGRESSION DETECTED: Risk label would be same for sum (${totalCumulativeRisk.toFixed(2)}) and avg (${averageERCPerQuestion.toFixed(2)})`);
        }

        overallTotals = {
            cumulativeRiskVolume: Math.round(totalCumulativeRisk * 100) / 100,
            quantitativeQuestionCount: totalQuestionCount,
            averageERC: Math.round(averageERCPerQuestion * 100) / 100,
            normalizedRiskLevel: normalized.level,
            normalizedLabel: normalized.label,
            normalizedColor: normalized.color,

            // DEPRECATED (Backward compat - Phase 5 cleanup)
            overallRisk: Math.round(totalCumulativeRisk * 100) / 100,  // DEPRECATED: Use cumulativeRiskVolume
            riskLabel: normalized.label  // FIXED: Now uses normalized average
        };
    }

    // Scoring Disclosure
    const scoringDisclosure = {
        totalQuestions: 93,  // TODO: Calculate dynamically
        quantitativeQuestions: 59,  // Questions with answerSeverity
        qualitativeQuestions: 34,  // Open-text/narrative
        text: `34 qualitative (open-text) questions are excluded from quantitative scoring. Quantitative risk assessment is based on 59 questions with predefined answer options.`,
        methodology: 'ERC (Ethical Risk Contribution) = Importance × Severity'
    };

    // Return enriched metrics
    return {
        ...reportMetrics,
        overallTotals,
        scoringDisclosure
    };
}

module.exports = {
    enrichReportMetrics
};
