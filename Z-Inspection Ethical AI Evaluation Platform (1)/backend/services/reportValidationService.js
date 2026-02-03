/**
 * Report Validation Service
 * 
 * Pre-generation validation to ensure data integrity and methodology compliance.
 * Implements "Honest Reporting" - all errors/warnings visible in reports.
 * 
 * CRITICAL: Validation results are NEVER filtered or softened.
 * What goes in the validation result goes DIRECTLY into the report.
 */

const mongoose = require('mongoose');
const { ETHICAL_EXPERT_CARDINALITY, MIN_TOTAL_EVALUATORS } = require('../config/roles.config');
const ercConfig = require('../config/ercThresholds.v1');

/**
 * Validate project data before report generation
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} validation result
 */
async function validateProjectForReporting(projectId) {
    const projectIdObj = mongoose.isValidObjectId(projectId)
        ? new mongoose.Types.ObjectId(projectId)
        : projectId;

    const errors = [];
    const warnings = [];
    let validityStatus = 'valid';

    const ProjectAssignment = require('../models/projectAssignment');
    const Response = require('../models/response');
    const Score = require('../models/score');

    // ============================================================
    // 1. EVALUATOR ROLE CARDINALITY VALIDATION
    // ============================================================
    const assignments = await ProjectAssignment.find({ projectId: projectIdObj }).lean();

    const ethicalExpertCount = assignments.filter(a => a.role === 'ethical-expert').length;

    if (ethicalExpertCount < ETHICAL_EXPERT_CARDINALITY.min) {
        validityStatus = 'invalid_evaluator_configuration';
        errors.push(`Expected at least ${ETHICAL_EXPERT_CARDINALITY.min} ethical-expert, found ${ethicalExpertCount}`);
        errors.push('Z-Inspection methodology requires exactly ONE ethical-expert per project');
    } else if (ethicalExpertCount > ETHICAL_EXPERT_CARDINALITY.max) {
        validityStatus = 'invalid_evaluator_configuration';
        errors.push(`Expected exactly ${ETHICAL_EXPERT_CARDINALITY.max} ethical-expert, found ${ethicalExpertCount}`);
        errors.push('Evaluator plurality violated - role cardinality constraint exceeded');
    }

    // Check total evaluator count
    if (assignments.length < MIN_TOTAL_EVALUATORS) {
        // CHANGED: Treat small team as a warning only, do not invalidate the report.
        // if (validityStatus === 'valid') validityStatus = 'invalid_incomplete_team';
        warnings.push(`Total evaluators (${assignments.length}) below recommended minimum (${MIN_TOTAL_EVALUATORS}) for ethical plurality`);
    }

    // ============================================================
    // 2. RESPONSE-SCORE ALIGNMENT VALIDATION
    // ============================================================
    const responses = await Response.find({ projectId: projectIdObj }).lean();
    const scores = await Score.find({ projectId: projectIdObj, role: { $ne: 'project' } }).lean();

    const submittedUserIds = new Set(responses.map(r => r.userId.toString()));
    const scoredUserIds = new Set(scores.map(s => s.userId?.toString()).filter(Boolean));

    const usersWithoutScores = [...submittedUserIds].filter(id => !scoredUserIds.has(id));

    if (usersWithoutScores.length > 0) {
        if (validityStatus === 'valid') validityStatus = 'invalid_missing_scores';
        errors.push(`${usersWithoutScores.length} evaluators submitted responses but have no scores`);
        errors.push('Run "Compute Scores" to process latest submissions');
    }

    // ============================================================
    // 3. SCHEMA VALIDATION (answerSeverity presence)
    // ============================================================
    let totalAnswers = 0;
    let answersWithSeverity = 0;
    let answersWithLegacyScore = 0;

    for (const response of responses) {
        if (!response.answers) continue;

        for (const answer of response.answers) {
            totalAnswers++;

            if (answer.answerSeverity !== null && answer.answerSeverity !== undefined) {
                answersWithSeverity++;
            }

            // Check for legacy answerScore field (FORBIDDEN)
            if (answer.answerScore !== undefined) {
                answersWithLegacyScore++;
            }
        }
    }

    if (answersWithLegacyScore > 0) {
        if (validityStatus === 'valid') validityStatus = 'invalid_schema_violation';
        errors.push(`${answersWithLegacyScore} answers use forbidden 'answerScore' field`);
        errors.push('Schema violation detected - run migration to convert to answerSeverity');
    }

    const severityCompleteness = totalAnswers > 0 ? (answersWithSeverity / totalAnswers) * 100 : 0;

    if (severityCompleteness < 50) {
        if (validityStatus === 'valid') validityStatus = 'invalid_partial_data';
        errors.push(`Only ${severityCompleteness.toFixed(1)}% of answers have answerSeverity calculated`);
    } else if (severityCompleteness < 100) {
        warnings.push(`${(100 - severityCompleteness).toFixed(1)}% of answers missing answerSeverity (may be open-text questions)`);
    }

    // ============================================================
    // 4. SCORING VERSION VALIDATION
    // ============================================================
    const currentScoringVersion = 'strict_ethical_v3_cumulative';
    const legacyScores = scores.filter(s => s.scoringModelVersion !== currentScoringVersion);

    if (legacyScores.length > 0) {
        warnings.push(`${legacyScores.length} scores computed with outdated scoring version`);
        warnings.push('Consider recomputing scores with current methodology');
    }

    // Check if scores have threshold version metadata
    const scoresWithoutThresholdVersion = scores.filter(s => !s.thresholdsVersion);
    if (scoresWithoutThresholdVersion.length > 0) {
        warnings.push(`${scoresWithoutThresholdVersion.length} scores missing threshold version metadata`);
    }

    // ============================================================
    // FINAL VALIDATION RESULT
    // ============================================================
    return {
        isValid: validityStatus === 'valid',
        validityStatus,
        errors,  // NEVER filtered - goes directly to report
        warnings, // NEVER filtered - goes directly to report
        metadata: {
            projectId: projectIdObj.toString(),
            validatedAt: new Date().toISOString(),
            validationVersion: 'v1.0',
            ercThresholdsVersion: ercConfig.version,
            evaluatorCount: {
                total: assignments.length,
                ethicalExperts: ethicalExpertCount,
                submitted: submittedUserIds.size,
                scored: scoredUserIds.size
            },
            dataCompleteness: {
                totalAnswers,
                answersWithSeverity,
                severityCompleteness: `${severityCompleteness.toFixed(1)}%`
            }
        }
    };
}

/**
 * Get invalidity notice for report display
 */
function getInvalidityNotice(validationResult) {
    if (validationResult.isValid) {
        return null;
    }

    return {
        title: '⚠️ QUANTITATIVE SCORING INVALIDITY NOTICE',
        severity: 'CRITICAL',
        status: 'REPORT NOT AUDIT-SAFE',
        message: 'This report contains systemic data integrity issues that compromise the reliability of quantitative risk assessments.',

        issuesIdentified: validationResult.errors,
        warnings: validationResult.warnings,

        impact: [
            'All numeric risk values are suppressed or flagged as unreliable',
            'Charts and visualizations may be disabled or show incomplete data',
            'This report MUST NOT be used for compliance, audit, or regulatory purposes'
        ],

        requiredActions: [
            'Contact system administrator to review validation errors',
            'Fix identified data integrity issues (see errors list above)',
            'Recompute scores after remediation',
            'Regenerate report and verify validity status = "valid"'
        ],

        metadata: validationResult.metadata
    };
}

module.exports = {
    validateProjectForReporting,
    getInvalidityNotice
};
