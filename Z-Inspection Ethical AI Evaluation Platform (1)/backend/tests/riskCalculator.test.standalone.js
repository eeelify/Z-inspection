const { calculateRiskScore } = require('../utils/riskLogic');

describe('Risk Calculator (Core Logic)', () => {

    test('should calculate risk score correctly for High Importance / Low Safety', () => {
        // Importance 4 (Critical), Answer 0.0 (High Risk/No Safety)
        // Expected: 4 * (1 - 0) = 4.0
        const result = calculateRiskScore(4, 0.0);
        expect(result).toBe(4.0);
    });

    test('should calculate risk score correctly for High Importance / High Safety', () => {
        // Importance 4 (Critical), Answer 1.0 (Safe)
        // Expected: 4 * (1 - 1) = 0.0
        const result = calculateRiskScore(4, 1.0);
        expect(result).toBe(0.0);
    });

    test('should calculate partial risk correctly', () => {
        // Importance 3, Answer 0.5 (Partial)
        // Expected: 3 * (1 - 0.5) = 1.5
        const result = calculateRiskScore(3, 0.5);
        expect(result).toBe(1.5);
    });

    test('should throw error for invalid inputs', () => {
        try {
            calculateRiskScore(5, 0.5); // Invalid importance
        } catch (e) {
            expect(e.message).toBe("Importance must be between 1 and 4");
        }
    });

});
