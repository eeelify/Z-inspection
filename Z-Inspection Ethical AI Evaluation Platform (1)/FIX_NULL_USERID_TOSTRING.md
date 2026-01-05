# Fix: Cannot read properties of null (reading 'toString')

## Problem
```
❌ Error: Chart generation failed: Cannot read properties of null (reading 'toString')
TypeError: Cannot read properties of null (reading 'toString')
    at C:\...\backend\services\analyticsService.js:66:65
```

## Root Cause
In `analyticsService.js` line 66, the code was calling `.toString()` on `score.userId` without checking if it's null:

```javascript
// ❌ BAD: Calls toString() on null
const evaluatorUserIds = [...new Set(scores.map(s => s.userId.toString()))];
```

**Why null userId exists:**
- Project-aggregate scores have `userId=null` (these are project-level aggregates, not user-specific)
- From terminal logs:
```
Score 5: userId=null, questionnaireKey=project-aggregate
Score 6: userId=null, questionnaireKey=project
```

## Solution
Filter out scores with null userId before calling `.toString()`:

```javascript
// ✅ GOOD: Filter nulls, then safely convert to string
const evaluatorUserIds = [...new Set(
  scores
    .filter(s => s.userId !== null && s.userId !== undefined)
    .map(s => s.userId.toString ? s.userId.toString() : String(s.userId))
)];
```

Also applied the same fix when building `evaluatorsFromScores`:

```javascript
// ✅ Build evaluator list from scores (exclude project-aggregate)
const evaluatorsFromScores = scores
  .filter(score => score.userId !== null && score.userId !== undefined)
  .map(score => {
    const userIdStr = score.userId.toString ? score.userId.toString() : String(score.userId);
    const user = userMap.get(userIdStr);
    return {
      userId: userIdStr,
      name: user?.name || 'Unknown',
      email: user?.email || '',
      ...
    };
  });
```

## Changes Made
**File:** `backend/services/analyticsService.js`

- **Line 66-69:** Added `.filter(s => s.userId !== null && s.userId !== undefined)` before mapping
- **Line 74-79:** Added `.filter(score => score.userId !== null && score.userId !== undefined)` before mapping
- Added safe `toString()` calls: `s.userId.toString ? s.userId.toString() : String(s.userId)`

## Impact
- ✅ Chart generation will succeed even when project-aggregate scores exist
- ✅ Only user-specific scores are included in evaluator lists
- ✅ No more null reference errors

## Testing
Test by generating a report for a project that has project-aggregate scores (which all projects should have after the recent scoring refactoring).

