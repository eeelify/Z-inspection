# Evaluation API Documentation

## Request/Response Examples

### 1. Create Assignment

**Request:**
```json
POST /api/evaluations/assignments
{
  "projectId": "507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439012",
  "role": "medical-expert",
  "questionnaires": ["general-v1", "medical-v1"]
}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "projectId": "507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439012",
  "role": "medical-expert",
  "questionnaires": ["general-v1", "medical-v1"],
  "status": "assigned",
  "assignedAt": "2024-01-15T10:00:00.000Z"
}
```

### 2. Save Draft Response

**Request:**
```json
POST /api/evaluations/responses/draft
{
  "projectId": "507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439012",
  "questionnaireKey": "general-v1",
  "answers": [
    {
      "questionCode": "T1",
      "answer": {
        "choiceKey": "very_clear"
      }
    },
    {
      "questionCode": "T2",
      "answer": {
        "choiceKey": "yes"
      }
    },
    {
      "questionCode": "W1",
      "answer": {
        "text": "The system might affect trust between doctors and patients..."
      },
      "score": 2,
      "scoreSuggested": 2,
      "notes": "Needs review"
    }
  ]
}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "projectId": "507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439012",
  "role": "medical-expert",
  "questionnaireKey": "general-v1",
  "questionnaireVersion": 1,
  "status": "draft",
  "answers": [
    {
      "questionId": "507f1f77bcf86cd799439015",
      "questionCode": "T1",
      "answer": {
        "choiceKey": "very_clear"
      },
      "score": 4,
      "notes": null,
      "evidence": []
    },
    {
      "questionId": "507f1f77bcf86cd799439016",
      "questionCode": "T2",
      "answer": {
        "choiceKey": "yes"
      },
      "score": 4,
      "notes": null,
      "evidence": []
    },
    {
      "questionId": "507f1f77bcf86cd799439017",
      "questionCode": "W1",
      "answer": {
        "text": "The system might affect trust between doctors and patients..."
      },
      "score": 2,
      "scoreSuggested": 2,
      "scoreFinal": null,
      "reviewerId": null,
      "notes": "Needs review",
      "evidence": []
    }
  ],
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 3. Submit Response

**Request:**
```json
POST /api/evaluations/responses/submit
{
  "projectId": "507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439012",
  "questionnaireKey": "general-v1"
}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "status": "submitted",
  "submittedAt": "2024-01-15T11:00:00.000Z",
  ...
}
```

### 4. Get Project-Level Scores

**Request:**
```
GET /api/evaluations/scores/project/507f1f77bcf86cd799439011?questionnaireKey=general-v1
```

**Response:**
```json
[
  {
    "principle": "TRANSPARENCY",
    "avgScore": 3.5,
    "minScore": 2,
    "maxScore": 4,
    "count": 20,
    "questionCodes": ["T1", "T2"]
  },
  {
    "principle": "HUMAN AGENCY & OVERSIGHT",
    "avgScore": 3.2,
    "minScore": 1,
    "maxScore": 4,
    "count": 15,
    "questionCodes": ["H1", "H2"]
  }
]
```

## Best Practices

### Auditability
1. **Never delete responses** - Use status: "locked" instead
2. **Store raw answers** - Keep original answer format in `answer` field
3. **Track score changes** - Use `scoreSuggested` and `scoreFinal` for open_text
4. **Version questionnaires** - Increment version when questions change
5. **Keep question references** - Store `questionId` and `questionCode` for traceability

### Versioning
1. **Questionnaire versions** - When questions change, create new questionnaire key (e.g., "general-v2")
2. **Question changes** - Create new questions rather than modifying existing ones
3. **Backward compatibility** - Old responses reference old question versions
4. **Migration strategy** - Use migration scripts to backfill new structure

### Performance
1. **Use indexes** - All unique indexes are defined in schemas
2. **Materialize scores** - Use `scores` collection for fast reporting
3. **Batch operations** - Use aggregation pipelines for complex queries
4. **Pagination** - Add limit/skip for large result sets

### Data Integrity
1. **Validation** - Mongoose schemas enforce required fields and types
2. **Unique constraints** - Prevent duplicate responses
3. **Foreign keys** - Use references to maintain relationships
4. **Transactions** - Use MongoDB transactions for multi-document operations

