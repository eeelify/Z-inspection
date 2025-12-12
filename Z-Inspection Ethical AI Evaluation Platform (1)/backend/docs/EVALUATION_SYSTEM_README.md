# Z-Inspection Evaluation System - Complete Implementation

## Overview

This is a production-ready MongoDB data model and service layer for the Z-Inspection evaluation platform, supporting versioned questionnaires, role-specific questions, and comprehensive scoring by EU's 7 ethical principles.

## File Structure

```
backend/
├── models/
│   ├── questionnaire.js      # Versioned questionnaire definitions
│   ├── question.js            # Question bank with scoring rules
│   ├── projectAssignment.js   # Expert assignments to projects
│   ├── response.js            # Expert answers and computed scores
│   └── score.js              # Materialized aggregated scores
├── services/
│   ├── evaluationService.js  # Core business logic
│   └── aggregationPipelines.js # MongoDB aggregation pipelines
├── routes/
│   └── evaluationRoutes.js   # API endpoints
├── migrations/
│   └── migrateGeneralQuestions.js # Migration from old collection
└── docs/
    ├── evaluationAPI.md       # API documentation
    ├── IMPLEMENTATION_GUIDE.md # Implementation guide
    └── EVALUATION_SYSTEM_README.md # This file
```

## Quick Start

### 1. Install Dependencies

All models use Mongoose. Ensure mongoose is installed:
```bash
npm install mongoose
```

### 2. Seed Initial Data

Create questionnaires and questions:
```javascript
const Questionnaire = require('./models/questionnaire');
const Question = require('./models/question');

// Create general-v1 questionnaire
await Questionnaire.create({
  key: 'general-v1',
  title: 'General Questions v1',
  language: 'en-tr',
  version: 1,
  isActive: true
});

// Create questions (see example in migration script)
```

### 3. Run Migration

Migrate existing data from `generalquestionsanswers`:
```bash
node backend/migrations/migrateGeneralQuestions.js
```

### 4. Use API

```javascript
// Create assignment
POST /api/evaluations/assignments
{
  "projectId": "...",
  "userId": "...",
  "role": "medical-expert",
  "questionnaires": ["general-v1", "medical-v1"]
}

// Save draft
POST /api/evaluations/responses/draft
{
  "projectId": "...",
  "userId": "...",
  "questionnaireKey": "general-v1",
  "answers": [...]
}

// Submit
POST /api/evaluations/responses/submit
{
  "projectId": "...",
  "userId": "...",
  "questionnaireKey": "general-v1"
}
```

## Key Features

### 1. Versioning
- Questionnaires are versioned (e.g., "general-v1", "general-v2")
- Questions reference questionnaire versions
- Responses store questionnaire version for auditability

### 2. Scoring
- **single_choice**: Score from option.score
- **multi_choice**: Average of selected option scores
- **open_text**: Manual scoring (0-4) with audit trail
- **numeric**: Mapped to 0-4 scale

### 3. Auditability
- Raw answers preserved
- Score computation traceable
- Reviewer tracking for open_text
- Timestamps on all operations

### 4. Aggregation
- Project-level scores by principle
- Role-level scores by principle
- Hotspot detection (score <= 1)
- Expert completion status

## Migration Safety

The migration script:
1. ✅ Keeps old collection intact
2. ✅ Maps old question IDs to new codes
3. ✅ Converts old risk values to 0-4 scores
4. ✅ Creates assignments automatically
5. ✅ Preserves timestamps

## Indexes

All critical indexes are defined:
- Unique: `(projectId, userId, questionnaireKey)` on responses
- Unique: `(projectId, userId)` on assignments
- Compound: `(questionnaireKey, order)` on questions
- Multikey: `answers.questionCode` on responses

## Best Practices

1. **Never delete responses** - Use status: "locked"
2. **Version questionnaires** - Create new version when questions change
3. **Store raw answers** - Keep original format for auditability
4. **Use materialized scores** - For fast reporting
5. **Validate before submit** - Check required questions

## Example Aggregation Queries

See `backend/services/aggregationPipelines.js` for:
- Project-level scores by principle
- Role-level scores by principle
- Hotspot detection
- Expert completion status

## Testing

Test the system:
1. Create test assignments
2. Save draft responses
3. Submit responses
4. Compute scores
5. Run aggregation pipelines

## Support

For questions or issues, refer to:
- `backend/docs/evaluationAPI.md` - API documentation
- `backend/docs/IMPLEMENTATION_GUIDE.md` - Implementation details

