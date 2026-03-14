const { riskLabel } = require('../utils/riskLabel');

describe('riskLabel function', () => {
  // Test cases from requirements
  test('avgScore=0.25 => Low (0.0-1.0 range)', () => {
    expect(riskLabel(0.25)).toBe('Low');
  });

  test('avgScore=1.25 => Moderate (1.0-2.0 range)', () => {
    expect(riskLabel(1.25)).toBe('Moderate');
  });

  test('avgScore=2.25 => High (2.0-3.0 range)', () => {
    expect(riskLabel(2.25)).toBe('High');
  });

  test('avgScore=3.25 => Critical (3.0-4.0 range)', () => {
    expect(riskLabel(3.25)).toBe('Critical');
  });

  // Test risk scale interpretation: 4 = highest risk, 0 = lowest risk
  test('label(4) must return "Critical" (highest risk)', () => {
    expect(riskLabel(4.0)).toBe('Critical');
  });

  test('label(0) must return "Low" (lowest risk)', () => {
    expect(riskLabel(0.0)).toBe('Low');
  });

  // Additional edge case tests
  test('avgScore=0.0 => Low', () => {
    expect(riskLabel(0.0)).toBe('Low');
  });

  test('avgScore=1.0 => Moderate', () => {
    expect(riskLabel(1.0)).toBe('Moderate');
  });

  test('avgScore=2.0 => High', () => {
    expect(riskLabel(2.0)).toBe('High');
  });

  test('avgScore=3.0 => Critical', () => {
    expect(riskLabel(3.0)).toBe('Critical');
  });

  test('avgScore=4.0 => Critical', () => {
    expect(riskLabel(4.0)).toBe('Critical');
  });

  test('avgScore=0.99 => Low', () => {
    expect(riskLabel(0.99)).toBe('Low');
  });

  test('avgScore=1.99 => Moderate', () => {
    expect(riskLabel(1.99)).toBe('Moderate');
  });

  test('avgScore=2.99 => High', () => {
    expect(riskLabel(2.99)).toBe('High');
  });

  test('avgScore=3.99 => Critical', () => {
    expect(riskLabel(3.99)).toBe('Critical');
  });

  // Edge cases
  test('avgScore < 0 => Low (edge case)', () => {
    expect(riskLabel(-1)).toBe('Low');
  });

  test('avgScore > 4 => Critical (edge case)', () => {
    expect(riskLabel(5)).toBe('Critical');
  });

  test('avgScore=NaN => Unknown', () => {
    expect(riskLabel(NaN)).toBe('Unknown');
  });

  test('avgScore=null => Unknown', () => {
    expect(riskLabel(null)).toBe('Unknown');
  });

  test('avgScore=undefined => Unknown', () => {
    expect(riskLabel(undefined)).toBe('Unknown');
  });
});

