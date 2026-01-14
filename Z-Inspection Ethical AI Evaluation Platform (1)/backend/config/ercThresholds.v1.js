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
        MINIMAL: { min: 0.0, max: 0.8, label: 'Minimal Risk', color: '#4CAF50' },
        LOW: { min: 0.8, max: 1.6, label: 'Low Risk', color: '#8BC34A' },
        MODERATE: { min: 1.6, max: 2.4, label: 'Moderate Risk', color: '#FFC107' },
        HIGH: { min: 2.4, max: 3.2, label: 'High Risk', color: '#FF9800' },
        CRITICAL: { min: 3.2, max: 4.0, label: 'Critical Risk', color: '#F44336' }
    },

    /**
     * Get risk level from normalized ERC value
     */
    getRiskLevel(ercValue) {
        if (ercValue === null || ercValue === undefined || isNaN(ercValue)) {
            return { level: 'UNKNOWN', label: 'Data Unavailable', color: '#9E9E9E' };
        }

        const value = Number(ercValue);

        for (const [level, threshold] of Object.entries(this.thresholds)) {
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
