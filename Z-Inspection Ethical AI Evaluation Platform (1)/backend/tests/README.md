# Report Generation Tests

This directory contains unit, integration, and acceptance criteria tests for the report generation system.

## Test Structure

```
tests/
├── README.md                           # This file
├── reportMetrics.test.js               # Unit tests for evaluator counting, tensions evidence
├── acceptanceCriteria.test.js          # Acceptance criteria verification tests
├── acceptanceCriteriaVerification.js   # Automated verification script
└── integration/
    └── reportGeneration.test.js        # End-to-end integration tests
```

## Running Tests

### All Tests
```bash
npm run test:all
```

### Individual Test Suites
```bash
# Acceptance criteria verification (checks code structure)
npm run test

# Unit tests (evaluator counting, evidence distribution)
npm run test:unit

# Acceptance criteria tests (structure verification)
npm run test:acceptance

# Integration tests (end-to-end flow)
npm run test:integration
```

## Test Coverage

### 1. Evaluator Counting (`reportMetrics.test.js`)
- ✅ Only submitted evaluators are counted (not in-progress or draft)
- ✅ No duplicate evaluators per role
- ✅ Correct count per role

### 2. Tensions Evidence Distribution (`reportMetrics.test.js`)
- ✅ Correctly counts tensions with and without evidence
- ✅ Correctly distributes evidence types (Policy, Test, User feedback, Logs, Incident, Other)
- ✅ Calculates evidence coverage percentage

### 3. Report Exists Logic (`reportMetrics.test.js`)
- ✅ Returns null when no report exists
- ✅ Returns latest report when multiple exist
- ✅ Constructs fileUrl if filePath exists but fileUrl missing

### 4. Acceptance Criteria (`acceptanceCriteria.test.js`)
- ✅ 7-principle bar chart with legend and thresholds
- ✅ Role×Principle heatmap with only submitted roles
- ✅ Evidence coverage donut with percentage
- ✅ Tensions reviewState visualization
- ✅ Top risky questions table with answer snippets
- ✅ Tensions table with reviewState/consensus/evidenceCount
- ✅ Clickable internal anchors in DOCX
- ✅ Evaluator list shows correct number (no phantom duplicates)
- ✅ Gemini does not compute scores
- ✅ Show Report button appears only when report exists

### 5. Integration Tests (`integration/reportGeneration.test.js`)
- ✅ Backend aggregation returns complete structure
- ✅ Chart generation produces all required chart types
- ✅ DOCX composition includes all required sections
- ✅ Report storage saves all required fields

## Acceptance Criteria Checklist

Run the automated verification:
```bash
node tests/acceptanceCriteriaVerification.js
```

This script checks:
1. ✅ 7-principle bar chart + legend + thresholds
2. ✅ Role×Principle heatmap with only submitted roles
3. ✅ Evidence coverage donut + percentage
4. ✅ Tensions reviewState visualization
5. ✅ Top risky questions table with answer snippets
6. ✅ Tensions table with reviewState/consensus/evidenceCount
7. ✅ Clickable internal anchors in DOCX
8. ✅ Evaluator counting (no phantom duplicates)
9. ✅ Gemini does not compute scores
10. ✅ Show Report button logic

## Notes

- Tests use mock data and do not require a MongoDB connection
- Integration tests verify structure and flow, not actual database operations
- For full end-to-end testing, use the actual API endpoints with a test database

