# Z-Inspection Evaluation Platform - Implementation Guide

## Overview

This document describes the new MongoDB data model for the Z-Inspection evaluation platform, designed to support versioned questionnaires, role-specific questions, and comprehensive scoring by EU's 7 ethical principles.

## Architecture

### Collections

1. **questionnaires** - Versioned questionnaire definitions
2. **questions** - Question bank with scoring rules
3. **project_assignments** - Expert assignments to projects
4. **responses** - Expert answers and computed scores
5. **scores** - Materialized aggregated scores (optional, for performance)

### Key Features

- **Versioning**: Questionnaires are versioned (e.g., "general-v1", "general-v2")
- **Auditability**: Raw answers, mappings, and scores are preserved
- **Role-based**: Questions can be role-specific or apply to all roles
- **Scoring**: Automatic 0-4 scoring for choice questions, manual for open_text
- **Aggregation**: Built-in pipelines for reporting by principle and role

## Migration Strategy

### Phase 1: Setup (No Breaking Changes)

1. Create new collections alongside existing `generalquestionsanswers`
2. Seed initial questionnaires and questions
3. Keep old collection read-only

### Phase 2: Backfill

1. Run migration script: `node backend/migrations/migrateGeneralQuestions.js`
2. Migrates existing data to new structure
3. Maps old question IDs to new question codes
4. Converts old risk values (low/medium/high) to 0-4 scores

### Phase 3: Dual Write (Optional)

1. Write to both old and new collections
2. Verify data consistency
3. Switch reads to new collections

### Phase 4: Deprecation

1. Mark old collection as deprecated
2. Archive if needed
3. Remove dual-write logic

## Usage Examples

### 1. Create Assignment

```javascript
const { createAssignment } = require('./services/evaluationService');

await createAssignment(
  projectId,
  userId,
  'medical-expert',
  ['general-v1', 'medical-v1']
);
```

### 2. Save Draft Response

```javascript
const { saveDraftResponse } = require('./services/evaluationService');

await saveDraftResponse(projectId, userId, 'general-v1', [
  {
    questionCode: 'T1',
    answer: { choiceKey: 'very_clear' }
  },
  {
    questionCode: 'W1',
    answer: { text: 'The system might affect trust...' },
    score: 2
  }
]);
```

### 3. Submit Response

```javascript
const { submitResponse } = require('./services/evaluationService');

await submitResponse(projectId, userId, 'general-v1');
```

### 4. Get Aggregated Scores

```javascript
const Response = require('./models/response');
const { projectLevelScoresByPrinciple } = require('./services/aggregationPipelines');

const pipeline = projectLevelScoresByPrinciple(projectId, 'general-v1');
const scores = await Response.aggregate(pipeline);
```

## Pitfalls and Best Practices

### 1. Versioning

**Pitfall**: Modifying questions in place breaks historical data
**Solution**: Always create new questionnaire versions when questions change

### 2. Scoring Changes

**Pitfall**: Changing scoring rules breaks historical comparisons
**Solution**: Store raw answers and recompute scores when needed

### 3. Performance

**Pitfall**: Aggregating large datasets on-the-fly is slow
**Solution**: Use materialized `scores` collection for reporting

### 4. Data Integrity

**Pitfall**: Missing required questions in responses
**Solution**: Validate before submission, use status: 'draft' for incomplete

### 5. Auditability

**Pitfall**: Losing track of who scored what and when
**Solution**: Store `reviewerId`, `scoreSuggested`, `scoreFinal` for open_text

## Index Strategy

All critical indexes are defined in schemas:
- Unique indexes prevent duplicates
- Compound indexes optimize common queries
- Multikey indexes support array queries

## Testing

1. **Unit Tests**: Test service functions with mock data
2. **Integration Tests**: Test API endpoints end-to-end
3. **Migration Tests**: Verify migration script on sample data
4. **Performance Tests**: Test aggregation pipelines on large datasets

## Next Steps

1. Seed initial questionnaires and questions
2. Run migration script on development database
3. Update frontend to use new API endpoints
4. Monitor performance and optimize as needed

