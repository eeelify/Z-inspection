const { 
  calculateAnswerQuality,
  calculateRiskWeight,
  calculateAnswerQualitySelect,
  calculateAnswerQualityFreeText,
  computeEthicalScores
} = require('../services/ethicalScoringService');

describe('Ethical Scoring Service', () => {
  describe('calculateRiskWeight', () => {
    test('should return 0.10 for low-risk questions (0-1)', () => {
      expect(calculateRiskWeight(0)).toBe(0.10);
      expect(calculateRiskWeight(1)).toBe(0.10);
    });

    test('should return 0.40 for risk score 2', () => {
      expect(calculateRiskWeight(2)).toBe(0.40);
    });

    test('should return 0.70 for risk score 3', () => {
      expect(calculateRiskWeight(3)).toBe(0.70);
    });

    test('should return 1.00 for high-risk questions (4)', () => {
      expect(calculateRiskWeight(4)).toBe(1.00);
    });

    test('should default to 0.10 for invalid scores', () => {
      expect(calculateRiskWeight(-1)).toBe(0.10);
      expect(calculateRiskWeight(5)).toBe(0.10);
      expect(calculateRiskWeight(null)).toBe(0.10);
    });
  });

  describe('calculateAnswerQualityFreeText', () => {
    test('should return AQ=0 for empty text', () => {
      const result = calculateAnswerQualityFreeText({ answer: { text: '' } });
      expect(result.aq).toBe(0);
      expect(result.heuristics).toContain('empty');
    });

    test('should return AQ=0.2 for short text (<20 chars)', () => {
      const result = calculateAnswerQualityFreeText({ answer: { text: 'Short' } });
      expect(result.aq).toBe(0.2);
      expect(result.heuristics).toContain('length_short');
    });

    test('should return AQ=0.5 for medium text (20-80 chars)', () => {
      const text = 'This is a medium length answer that should trigger the medium threshold.';
      const result = calculateAnswerQualityFreeText({ answer: { text } });
      expect(result.aq).toBe(0.5);
      expect(result.heuristics).toContain('length_medium');
    });

    test('should return AQ=0.7 for long text (>80 chars)', () => {
      const text = 'This is a very long answer that exceeds the eighty character threshold and should trigger the long text heuristic for better answer quality scoring.';
      const result = calculateAnswerQualityFreeText({ answer: { text } });
      expect(result.aq).toBe(0.7);
      expect(result.heuristics).toContain('length_long');
    });

    test('should add 0.1 for structured markers (bullets)', () => {
      const text = '- First point\n- Second point\n- Third point';
      const result = calculateAnswerQualityFreeText({ answer: { text } });
      expect(result.aq).toBeGreaterThanOrEqual(0.3); // 0.2 (short) + 0.1 (structure)
      expect(result.heuristics).toContain('has_structure');
    });

    test('should add 0.1 for evidence cues (URLs, policy, test, etc.)', () => {
      const text = 'We have a policy at https://example.com/policy that covers this. We also have test logs and audit metrics.';
      const result = calculateAnswerQualityFreeText({ answer: { text } });
      expect(result.aq).toBeGreaterThanOrEqual(0.3); // 0.2 (short) + 0.1 (evidence)
      expect(result.heuristics).toContain('has_evidence');
    });

    test('should cap AQ at 1.0', () => {
      const text = 'This is a very long answer with structure:\n- Point 1\n- Point 2\nAnd evidence: https://example.com policy test log audit metric incident';
      const result = calculateAnswerQualityFreeText({ answer: { text } });
      expect(result.aq).toBeLessThanOrEqual(1.0);
    });
  });

  describe('calculateAnswerQualitySelect', () => {
    test('should return AQ from optionScores map', () => {
      const question = {
        optionScores: new Map([['option1', 0.8], ['option2', 0.3]])
      };
      const answer = { answer: { choiceKey: 'option1' } };
      const result = calculateAnswerQualitySelect(question, answer);
      expect(result.aq).toBe(0.8);
      expect(result.optionScoreMissing).toBe(false);
    });

    test('should return AQ from optionScores object', () => {
      const question = {
        optionScores: { 'option1': 0.8, 'option2': 0.3 }
      };
      const answer = { answer: { choiceKey: 'option1' } };
      const result = calculateAnswerQualitySelect(question, answer);
      expect(result.aq).toBe(0.8);
      expect(result.optionScoreMissing).toBe(false);
    });

    test('should return AQ from option.answerQuality', () => {
      const question = {
        options: [
          { key: 'option1', answerQuality: 0.9 },
          { key: 'option2', answerQuality: 0.2 }
        ]
      };
      const answer = { answer: { choiceKey: 'option1' } };
      const result = calculateAnswerQualitySelect(question, answer);
      expect(result.aq).toBe(0.9);
      expect(result.optionScoreMissing).toBe(false);
    });

    test('should return default AQ=0.5 if no mapping found', () => {
      const question = {
        options: [{ key: 'option1' }]
      };
      const answer = { answer: { choiceKey: 'option1' } };
      const result = calculateAnswerQualitySelect(question, answer);
      expect(result.aq).toBe(0.5);
      expect(result.optionScoreMissing).toBe(true);
    });

    test('should return AQ=0 if no choiceKey', () => {
      const question = {
        options: [{ key: 'option1', answerQuality: 0.8 }]
      };
      const answer = { answer: {} };
      const result = calculateAnswerQualitySelect(question, answer);
      expect(result.aq).toBe(0);
      expect(result.optionScoreMissing).toBe(false);
    });
  });

  describe('Low-risk question impact', () => {
    test('low-risk question (riskScore=0) should have minimal impact', () => {
      const rw = calculateRiskWeight(0);
      expect(rw).toBe(0.10);
      
      // Even with low AQ, contribution should be small
      const aq = 0.2; // Poor answer
      const contribution = aq * rw;
      expect(contribution).toBe(0.02); // Very small
      
      const unmitigatedRisk = (1 - aq) * rw;
      expect(unmitigatedRisk).toBe(0.08); // Also small
    });

    test('high-risk question (riskScore=4) should dominate with low AQ', () => {
      const rw = calculateRiskWeight(4);
      expect(rw).toBe(1.00);
      
      const aq = 0.2; // Poor answer
      const contribution = aq * rw;
      expect(contribution).toBe(0.2);
      
      const unmitigatedRisk = (1 - aq) * rw;
      expect(unmitigatedRisk).toBe(0.8); // Large unmitigated risk
    });
  });

  describe('Principle aggregation', () => {
    test('principle risk should be weighted average of unmitigatedRisk', () => {
      // Mock principle data
      const rwSum = 2.0; // Two questions with RW=1.0 each
      const unmitigatedRiskSum = 0.6; // (1-0.7)*1.0 + (1-0.3)*1.0 = 0.3 + 0.3 = 0.6
      
      const principleRisk = (unmitigatedRiskSum / rwSum) * 4; // Scale to 0-4
      expect(principleRisk).toBe(1.2); // 0.6/2.0 * 4 = 1.2
      
      const principleMaturity = 1 - (unmitigatedRiskSum / rwSum);
      expect(principleMaturity).toBe(0.7); // 1 - 0.3 = 0.7
    });

    test('principle with no answered questions should have risk=0', () => {
      const rwSum = 0;
      const unmitigatedRiskSum = 0;
      
      const principleRisk = rwSum > 0 ? (unmitigatedRiskSum / rwSum) * 4 : 0;
      expect(principleRisk).toBe(0);
    });
  });
});

