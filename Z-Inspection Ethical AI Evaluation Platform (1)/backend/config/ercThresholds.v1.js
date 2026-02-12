/**
 * ERC (Ethical Risk Contribution) Threshold Configuration - Version 1
 * 
 * VERSIONED for audit trail and methodology evolution.
 * 
 * ERC Formula: importance (0-4) × severity (0-1) = risk (0-4)
 * 
 * This version uses a 0-4 scale normalized thresholds.
 * If methodology changes, create ercThresholds.v2.js and update CURRENT_VERSION.
 */

module.exports = {
    version: 'erc-v1',
    description: 'Z-Inspection ERC Thresholds - January 2026',

    scale: {
        min: 0,
        max: 4,
        unit: 'ERC (Importance × Severity)'
    },

    /**
     * Thresholds for NORMALIZED ERC values (averages, not cumulative sums)
     * 
     * Applied to:
     * - Average ERC per question
     * - Average ERC per principle
     * - Overall average ERC
     * 
     * NEVER applied to cumulative sums!
     */
    thresholds: {
        MINIMAL: { min: 0.0, max: 0.5, label: 'Minimal Risk', color: '#4CAF50' },
        LOW: { min: 0.5, max: 1.5, label: 'Low Risk', color: '#edbf4bff' },
        MODERATE: { min: 1.5, max: 2.5, label: 'Moderate Risk', color: '#EF6C00' },
        HIGH: { min: 2.5, max: 3.5, label: 'High Risk', color: '#D32F2F' },
        CRITICAL: { min: 3.5, max: 4.0, label: 'Critical Risk', color: '#B71C1C' }
    },

    /**
     * Get risk level from normalized ERC value
     */
    getRiskLevel(ercValue) {
        if (ercValue === null || ercValue === undefined || isNaN(ercValue)) {
            return { level: 'UNKNOWN', label: 'Data Unavailable', color: '#9E9E9E' };
        }

        const value = Number(ercValue);
        const thresholds = module.exports.thresholds;

        for (const [level, threshold] of Object.entries(thresholds)) {
            if (value >= threshold.min && value < threshold.max) {
                return { level, ...threshold };
            }
            // Handle edge case: exactly max value
            if (level === 'CRITICAL' && value >= threshold.min) {
                return { level, ...threshold };
            }
        }

        return { level: 'UNKNOWN', label: 'Out of Range', color: '#9E9E9E' };
    }
};
