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
function enrichReportMetrics(reportMetrics, counts = {}) {
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

        // OLD (Buggy for Risk Norm, but needed for Display): Unique Question Count
        const totalQuestionCount = principleValues.reduce((sum, p) => sum + (p.questionCount || p.n || 0), 0);

        // NEW (Fixed): Normalize by TOTAL ANSWERS (sum of all 'n' from all scores)
        const totalAnswerCount = principleValues.reduce((sum, p) => sum + (p.totalAnswers || p.n || 0), 0);

        // Denominator must be total answers to get correct average per answer
        const averageERCPerQuestion = totalAnswerCount > 0 ? totalCumulativeRisk / totalAnswerCount : 0;

        // --- SENSITIVITY OVERRIDE (DILUTION FIX) ---
        // Calculate max average across principles to prevent a single high-risk area being hidden by volume
        const principleAverages = principleValues.map(p => {
            const n = p.totalAnswers || p.n || 0;
            return n > 0 ? (p.cumulativeRisk || p.risk || 0) / n : 0;
        });
        const maxPrincipleAverage = Math.max(0, ...principleAverages);

        // Final sensitivity: use the higher of the overall average or the maximum principle average
        const effectiveERC = Math.max(averageERCPerQuestion, maxPrincipleAverage);
        const normalized = ercConfig.getRiskLevel(effectiveERC);

        // REGRESSION GUARD & LOGGING
        if (maxPrincipleAverage > averageERCPerQuestion + 0.5) {
            console.log(`⚠️  RISK SENSITIVITY OVERRIDE: Overall Avg=${averageERCPerQuestion.toFixed(2)}, Max Principle Avg=${maxPrincipleAverage.toFixed(2)}. Promoting to ${normalized.label}.`);
        }

        overallTotals = {
            cumulativeRiskVolume: Math.round(totalCumulativeRisk * 100) / 100,
            quantitativeQuestionCount: totalQuestionCount,
            averageERC: Math.round(effectiveERC * 100) / 100, // Now reflects the higher sensitivity value
            rawAverageERC: Math.round(averageERCPerQuestion * 100) / 100, // Keep raw avg for transparency if needed
            maxPrincipleAverage: Math.round(maxPrincipleAverage * 100) / 100,
            normalizedRiskLevel: normalized.level,
            normalizedLabel: normalized.label,
            normalizedColor: normalized.color,

            // DEPRECATED (Backward compat - Phase 5 cleanup)
            overallRisk: Math.round(totalCumulativeRisk * 100) / 100,
            riskLabel: normalized.label
        };
    }

    // Scoring Disclosure
    const totalQ = counts.total || 0;
    const quantQ = counts.quantitative || 0;
    const qualQ = counts.qualitative || 0;

    const scoringDisclosure = {
        totalQuestions: totalQ,
        quantitativeQuestions: quantQ,
        qualitativeQuestions: qualQ,
        text: `${qualQ} qualitative (open-text) questions are excluded from quantitative scoring. Quantitative risk assessment is based on ${quantQ} questions with predefined answer options.`,
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
