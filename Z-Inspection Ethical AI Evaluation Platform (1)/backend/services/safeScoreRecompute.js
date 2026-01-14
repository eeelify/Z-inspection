/**
 * Safe Score Recomputation Utility
 * 
 * REVISION 3: Prevents accidental deletion of scores from other projects.
 * Only recomputes when necessary (version mismatch or missing data).
 * 
 * NEVER use global Score.deleteMany() without project filter!
 */

const mongoose = require('mongoose');
const ercConfig = require('../config/ercThresholds.v1');

const CURRENT_SCORING_VERSION = 'strict_ethical_v3_cumulative';
const CURRENT_THRESHOLDS_VERSION = ercConfig.version;

/**
 * Safely recompute scores for a specific project
 * 
 * @param {string} projectId - Project ID
 * @param {Object} options - Recomputation options
 * @returns {Promise<Object>} result
 */
async function safeRecomputeScores(projectId, options = {}) {
    const {
        force = false,  // Force recompute even if versions match
        deleteOld = true  // Delete old scores before recomputing
    } = options;

    const projectIdObj = mongoose.isValidObjectId(projectId)
        ? new mongoose.Types.ObjectId(projectId)
        : projectId;

    const Score = require('../models/score');
    const { computeProjectEthicalScores } = require('./ethicalScoringService');

    // Check existing scores
    const existingScores = await Score.find({ projectId: projectIdObj }).lean();

    let needsRecompute = force;
    const reasons = [];

    if (existingScores.length === 0) {
        needsRecompute = true;
        reasons.push('No scores found for this project');
    } else {
        // Check for version mismatch
        const legacyScores = existingScores.filter(
            s => s.scoringModelVersion !== CURRENT_SCORING_VERSION
        );

        if (legacyScores.length > 0) {
            needsRecompute = true;
            reasons.push(`${legacyScores.length} scores have outdated scoring version`);
        }

        // Check for missing threshold version
        const scoresWithoutThresholds = existingScores.filter(
            s => !s.thresholdsVersion || s.thresholdsVersion !== CURRENT_THRESHOLDS_VERSION
        );

        if (scoresWithoutThresholds.length > 0) {
            needsRecompute = true;
            reasons.push(`${scoresWithoutThresholds.length} scores missing current threshold version`);
        }
    }

    if (!needsRecompute) {
        return {
            recomputed: false,
            reason: 'Scores are up-to-date',
            currentVersion: CURRENT_SCORING_VERSION,
            thresholdsVersion: CURRENT_THRESHOLDS_VERSION,
            scoreCount: existingScores.length
        };
    }

    // SAFE DELETION: Only delete scores for THIS PROJECT
    if (deleteOld) {
        const deleteResult = await Score.deleteMany({ projectId: projectIdObj });
        console.log(`🗑️  Deleted ${deleteResult.deletedCount} old scores for project ${projectId}`);
    }

    // Recompute using current methodology
    console.log(`🔄 Recomputing scores for project ${projectId}...`);
    console.log(`   Reasons: ${reasons.join(', ')}`);

    const computeResult = await computeProjectEthicalScores(projectId);

    // Verify scores were created with correct versions
    const newScores = await Score.find({ projectId: projectIdObj }).lean();
    const versionsCorrect = newScores.every(
        s => s.scoringModelVersion === CURRENT_SCORING_VERSION &&
            s.thresholdsVersion === CURRENT_THRESHOLDS_VERSION
    );

    return {
        recomputed: true,
        reasons,
        oldScoreCount: existingScores.length,
        newScoreCount: newScores.length,
        versionsCorrect,
        currentVersion: CURRENT_SCORING_VERSION,
        thresholdsVersion: CURRENT_THRESHOLDS_VERSION,
        computeResult
    };
}

/**
 * Check if project needs score recomputation
 */
async function checkScoreStatus(projectId) {
    const projectIdObj = mongoose.isValidObjectId(projectId)
        ? new mongoose.Types.ObjectId(projectId)
        : projectId;

    const Score = require('../models/score');
    const scores = await Score.find({ projectId: projectIdObj }).lean();

    if (scores.length === 0) {
        return {
            needsRecompute: true,
            reason: 'No scores exist',
            currentVersion: null,
            thresholdsVersion: null
        };
    }

    const versionMismatches = scores.filter(
        s => s.scoringModelVersion !== CURRENT_SCORING_VERSION ||
            s.thresholdsVersion !== CURRENT_THRESHOLDS_VERSION
    );

    return {
        needsRecompute: versionMismatches.length > 0,
        reason: versionMismatches.length > 0 ? 'Version mismatch detected' : 'Scores are current',
        scoreCount: scores.length,
        versionsCorrect: versionMismatches.length === 0,
        currentScoringVersion: CURRENT_SCORING_VERSION,
        currentThresholdsVersion: CURRENT_THRESHOLDS_VERSION,
        foundVersions: {
            scoring: [...new Set(scores.map(s => s.scoringModelVersion))],
            thresholds: [...new Set(scores.map(s => s.thresholdsVersion))]
        }
    };
}

module.exports = {
    safeRecomputeScores,
    checkScoreStatus,
    CURRENT_SCORING_VERSION,
    CURRENT_THRESHOLDS_VERSION
};
