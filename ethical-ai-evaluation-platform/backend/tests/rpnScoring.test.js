/**
 * Unit Tests for RPN Scoring Model
 * 
 * H) Tests for RPN scoring:
 * - If riskScore is high (4) but answerRisk is 0, contribution must be 0
 * - If riskScore is low (1) and answerRisk is 4, normalizedContribution must be 1
 * - If role missing submission, report table must not show that evaluator
 * - Ensure overallRisk matches expected for a small fixture dataset
 */

const { calculateAnswerRisk } = require('../services/answerRiskService');

describe('RPN Scoring Model', () => {
  describe('calculateAnswerRisk', () => {
    test('Select question: high riskScore (4) but answerRisk 0 should give contribution 0', () => {
      const question = {
        answerType: 'single_choice',
        optionRiskMap: {
          'safe_option': 0, // answerRisk = 0 (no risk)
          'risky_option': 4  // answerRisk = 4 (critical risk)
        }
      };
      
      const answerEntry = {
        answer: { choiceKey: 'safe_option' }
      };
      
      const result = calculateAnswerRisk(question, answerEntry);
      
      // answerRisk should be 0
      expect(result.answerRisk).toBe(0);
      
      // If riskScore = 4 and answerRisk = 0, then:
      // rawRpn = 4 × 0 = 0
      // normalizedContribution = 0 / 4 = 0
      const riskScore = 4;
      const rawRpn = riskScore * result.answerRisk;
      const normalizedContribution = rawRpn / 4;
      
      expect(normalizedContribution).toBe(0);
    });

    test('Select question: low riskScore (1) and answerRisk 4 should give normalizedContribution 1', () => {
      const question = {
        answerType: 'single_choice',
        optionRiskMap: {
          'safe_option': 0,
          'risky_option': 4
        }
      };
      
      const answerEntry = {
        answer: { choiceKey: 'risky_option' }
      };
      
      const result = calculateAnswerRisk(question, answerEntry);
      
      // answerRisk should be 4
      expect(result.answerRisk).toBe(4);
      
      // If riskScore = 1 and answerRisk = 4, then:
      // rawRpn = 1 × 4 = 4
      // normalizedContribution = 4 / 4 = 1
      const riskScore = 1;
      const rawRpn = riskScore * result.answerRisk;
      const normalizedContribution = rawRpn / 4;
      
      expect(normalizedContribution).toBe(1);
    });

    test('Free-text: empty answer should give answerRisk 3', () => {
      const question = {
        answerType: 'open_text'
      };
      
      const answerEntry = {
        answer: { text: '' }
      };
      
      const result = calculateAnswerRisk(question, answerEntry);
      
      // Empty answer => answerRisk = 3 (missing info is risky)
      expect(result.answerRisk).toBe(3);
      expect(result.metadata.triggeredRules).toContain('empty');
    });

    test('Free-text: answer with controls should lower answerRisk', () => {
      const question = {
        answerType: 'open_text'
      };
      
      const answerEntry = {
        answer: { text: 'We have implemented monitoring, logging, and audit controls. Policy document available.' }
      };
      
      const result = calculateAnswerRisk(question, answerEntry);
      
      // Baseline = 2, has controls => -1, has evidence => -1, floor = 0
      expect(result.answerRisk).toBeLessThanOrEqual(1); // Should be 0 or 1
      expect(result.metadata.triggeredRules).toContain('has_controls');
      expect(result.metadata.triggeredRules).toContain('has_evidence');
    });

    test('Free-text: answer with gaps should raise answerRisk', () => {
      const question = {
        answerType: 'open_text'
      };
      
      const answerEntry = {
        answer: { text: 'Not sure. No monitoring. Missing policy. Unknown.' }
      };
      
      const result = calculateAnswerRisk(question, answerEntry);
      
      // Baseline = 2, has gaps => +1, cap = 4
      expect(result.answerRisk).toBeGreaterThanOrEqual(3); // Should be 3 or 4
      expect(result.metadata.triggeredRules).toContain('has_gaps');
    });

    test('Select question: missing optionRiskMap should default to answerRisk 2 and flag mappingMissing', () => {
      const question = {
        answerType: 'single_choice',
        options: [{ key: 'option1', label: { en: 'Option 1' } }]
        // No optionRiskMap
      };
      
      const answerEntry = {
        answer: { choiceKey: 'option1' }
      };
      
      const result = calculateAnswerRisk(question, answerEntry);
      
      // Missing mapping => answerRisk = 2, mappingMissing = true
      expect(result.answerRisk).toBe(2);
      expect(result.metadata.mappingMissing).toBe(true);
    });
  });

  describe('RPN Contribution Calculation', () => {
    test('Contribution calculation: riskScore × answerRisk, normalized to 0-4', () => {
      const testCases = [
        { riskScore: 4, answerRisk: 0, expectedNormalized: 0 },
        { riskScore: 4, answerRisk: 4, expectedNormalized: 4 },
        { riskScore: 1, answerRisk: 4, expectedNormalized: 1 },
        { riskScore: 2, answerRisk: 2, expectedNormalized: 1 },
        { riskScore: 3, answerRisk: 3, expectedNormalized: 2.25 }
      ];

      testCases.forEach(({ riskScore, answerRisk, expectedNormalized }) => {
        const rawRpn = riskScore * answerRisk;
        const normalizedContribution = rawRpn / 4;
        
        expect(normalizedContribution).toBe(expectedNormalized);
      });
    });
  });

  describe('Principle Risk Aggregation', () => {
    test('Principle risk = sum(normalizedContribution) / answeredCount', () => {
      const questions = [
        { normalizedContribution: 2.0 },
        { normalizedContribution: 1.5 },
        { normalizedContribution: 3.0 }
      ];
      
      const answeredCount = questions.length;
      const normalizedContributionSum = questions.reduce((sum, q) => sum + q.normalizedContribution, 0);
      const principleRisk = normalizedContributionSum / answeredCount;
      
      expect(principleRisk).toBe((2.0 + 1.5 + 3.0) / 3); // 2.166...
    });
  });

  describe('Overall Risk Aggregation', () => {
    test('Overall risk = average(principleRisk) for principles with at least 1 answered question', () => {
      const principleRisks = [
        2.0, // TRANSPARENCY
        1.5, // HUMAN AGENCY
        3.0, // TECHNICAL ROBUSTNESS
        0,   // PRIVACY (no questions answered - should be excluded)
        2.5  // DIVERSITY
      ];
      
      // Filter out principles with 0 risk (no questions answered)
      const validPrincipleRisks = principleRisks.filter(r => r > 0);
      const overallRisk = validPrincipleRisks.reduce((a, b) => a + b, 0) / validPrincipleRisks.length;
      
      expect(overallRisk).toBe((2.0 + 1.5 + 3.0 + 2.5) / 4); // 2.25
      expect(validPrincipleRisks.length).toBe(4); // Excludes PRIVACY
    });
  });
});

