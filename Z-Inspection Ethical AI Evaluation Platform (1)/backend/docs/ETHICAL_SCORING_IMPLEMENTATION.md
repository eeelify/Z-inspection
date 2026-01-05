# Ethical Scoring Implementation

## Overview

This document describes the new ethical scoring system that implements **Answer Quality (AQ) × Risk Weight (RW)** calculation with low-risk down-weighting.

## Key Concepts

### Answer Quality (AQ)
- **Range**: 0-1 (0 = poor answer, 1 = excellent answer)
- **Select-based questions**: Mapped from `optionScores` or `option.answerQuality`
- **Free-text questions**: Computed using deterministic heuristics (length, structure, evidence cues)

### Risk Weight (RW)
- **Range**: 0-1
- **Purpose**: Down-weights low-risk questions to minimize their impact
- **Mapping**:
  - Risk score 0-1: RW = 0.10 (minimal influence)
  - Risk score 2: RW = 0.40
  - Risk score 3: RW = 0.70
  - Risk score 4: RW = 1.00 (full weight)

### Per-Question Contribution
- **contribution** = AQ × RW
- **unmitigatedRisk** = (1 - AQ) × RW

### Principle Aggregation
- **principleRisk** = (sum(unmitigatedRisk) / sum(RW)) × 4 (scaled to 0-4)
- **principleMaturity** = 1 - (sum(unmitigatedRisk) / sum(RW))

## Implementation Details

### Files Modified/Created

1. **Models**:
   - `backend/models/question.js` - Added `optionScores` and `option.answerQuality`
   - `backend/models/score.js` - Extended schema with new fields (risk, maturity, rwSum, etc.)

2. **Services**:
   - `backend/services/ethicalScoringService.js` - New scoring service
   - `backend/services/evaluationService.js` - Updated to use new scoring

3. **Routes**:
   - `backend/routes/evaluationRoutes.js` - Updated `/scores/compute` endpoint

4. **Scripts**:
   - `backend/scripts/migrateOptionScores.js` - Backfill optionScores for existing questions
   - `backend/scripts/recomputeAllScores.js` - Recompute all scores with new system

5. **Tests**:
   - `backend/tests/ethicalScoring.test.js` - Unit tests

## Answer Quality Calculation

### Select-Based Questions

1. Check `optionScores[choiceKey]`
2. Check `option.answerQuality` in options array
3. Default to AQ = 0.5 if no mapping found (flag `optionScoreMissing=true`)

### Free-Text Questions

Deterministic heuristics:
- **Empty**: AQ = 0
- **Length**:
  - < 20 chars: AQ = 0.2
  - 20-80 chars: AQ = 0.5
  - > 80 chars: AQ = 0.7
- **Structure markers** (bullets, numbers): +0.1 (capped at 1.0)
- **Evidence cues** (URLs, policy, test, log, etc.): +0.1 (capped at 1.0)

## Score Storage

### User-Level Scores
Stored in `scores` collection with:
- `userId`, `role`, `questionnaireKey`
- `totals.overallRisk`, `totals.overallMaturity`
- `byPrinciple[principle].risk`, `byPrinciple[principle].maturity`
- `byPrinciple[principle].topDrivers[]`

### Project-Level Scores
Stored with `role: 'project'`, `questionnaireKey: 'project-aggregate'`:
- Aggregates across all roles that submitted responses
- `byRole[roleName]` contains role-specific metrics
- Only includes roles that actually submitted (no hallucination)

## Migration Steps

1. **Backfill optionScores**:
   ```bash
   node backend/scripts/migrateOptionScores.js
   ```

2. **Recompute all scores**:
   ```bash
   node backend/scripts/recomputeAllScores.js
   ```

## Usage

### Compute Scores for User/Questionnaire
```javascript
const { computeEthicalScores } = require('./services/ethicalScoringService');
const scores = await computeEthicalScores(projectId, userId, questionnaireKey);
```

### Compute Project-Level Scores
```javascript
const { computeProjectEthicalScores } = require('./services/ethicalScoringService');
const projectScore = await computeProjectEthicalScores(projectId);
```

## Testing

Run unit tests:
```bash
npm test -- backend/tests/ethicalScoring.test.js
```

## Key Requirements Met

✅ **A) Answer types distinguished**: Select-based and free-text handled separately  
✅ **B) Low-risk down-weighting**: Risk score 0-1 has RW=0.10 (minimal influence)  
✅ **C) Per-question contribution**: AQ × RW and unmitigatedRisk calculated  
✅ **D) Principle aggregation**: Weighted by RW, scaled to 0-4  
✅ **E) Role-aware**: Only includes roles that submitted responses  
✅ **F) Canonical storage**: All metrics stored in `scores` collection  
✅ **G) Dashboard-ready**: No Gemini dependency for scoring

## Notes

- **Risk score** (0-4) represents **importance/criticality**, NOT answer quality
- **Answer quality** (AQ 0-1) represents how well the question is answered
- **Higher principleRisk** = worse (more ethical risk remaining)
- **principleMaturity** = inverse of risk (higher = better)

