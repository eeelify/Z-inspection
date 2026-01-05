# Fix: Remove "Questionnaire: general-v1" Label from Report

## User Request
1. **Remove "Questionnaire: general-v1" from report header**
2. **Verify report includes ALL questionnaires (general + role-specific)**

## Investigation Results

### ✅ Report DOES Include All Questionnaires

**Evidence from terminal logs:**
```
📊 Both general-v1 and role-specific responses exist, counting both
```

This message appears repeatedly throughout report generation, confirming that:
- General questions (general-v1) are included
- Role-specific questions (legal-expert-v1, ethical-expert-v1, etc.) are included
- All responses are being counted

**Code verification (`reportController.js` lines 446-449):**
```javascript
// Pass null to include ALL questionnaires, not just 'general-v1'
reportMetrics = await buildReportMetrics(projectId, null);

// Get analytics for chart data - include ALL questionnaires
const analytics = await getProjectAnalytics(projectId, null);
```

When `questionnaireKey` is `null`, the system includes:
- All general questions (first 12)
- All role-specific questions (legal, ethical, technical, etc.)

### ❌ Report Header Was Misleading

**Problem location:** `backend/services/htmlReportTemplateService.js` (Line 365)

**Before:**
```html
<span><strong>Project:</strong> ${project.title || 'Untitled Project'}</span>
<span><strong>Category:</strong> ${project.category || 'N/A'}</span>
<span><strong>Generated:</strong> ${formatDate(options.generatedAt || new Date())}</span>
<span><strong>Questionnaire:</strong> ${project.questionnaireKey || 'general-v1'}</span>
```

This was displaying "Questionnaire: general-v1" even though the report included ALL questionnaires.

## Solution

**File:** `backend/services/htmlReportTemplateService.js` (Line 362-365)

**After:**
```html
<span><strong>Project:</strong> ${project.title || 'Untitled Project'}</span>
<span><strong>Category:</strong> ${project.category || 'N/A'}</span>
<span><strong>Generated:</strong> ${formatDate(options.generatedAt || new Date())}</span>
<!-- Questionnaire line removed - report includes ALL questionnaires -->
```

## Why This Is Correct

### Report Now Shows Accurate Information

1. **No misleading label:** Report doesn't claim to be only "general-v1"
2. **Actually includes all data:** Both general and role-specific responses are included
3. **Cleaner header:** Less clutter in the report metadata

### Data Flow Confirmation

```
1. reportController.js
   → buildReportMetrics(projectId, null)  // null = ALL questionnaires
   → getProjectAnalytics(projectId, null) // null = ALL questionnaires
   
2. reportMetricsService.js
   → Fetches ALL Score documents (no questionnaireKey filter)
   → Fetches ALL Response documents (no questionnaireKey filter)
   
3. computeParticipation.js
   → Counts responses WITH ANSWERS (regardless of questionnaire)
   → Message: "Both general-v1 and role-specific responses exist, counting both"
   
4. Report Output
   → Includes scores from all principles
   → Includes answers from all roles
   → Includes all evaluators who submitted
```

## Verification

### How to Confirm Report Includes Role-Specific Data

1. **Check evaluator count:** Should show actual number of assigned evaluators (not hardcoded "2 per role")
2. **Check principle scores:** Legal questions map to ACCOUNTABILITY, TECHNICAL ROBUSTNESS & SAFETY, etc.
3. **Check answer count:** Should include more than just first 12 questions
4. **Check evaluator roles:** Should show legal-expert, ethical-expert, etc.

### Terminal Log Confirmations

```
✅ [DEBUG buildReportMetrics] Found 6 Score documents (all questionnaires)
✅ [DEBUG buildReportMetrics] Found 4 total responses
   Response 1: userId=xxx, status=draft, answersCount=12, textAnswers=1
   Response 2: userId=xxx, status=draft, answersCount=21, textAnswers=3  ← 21 answers (includes legal questions)
   Response 3: userId=yyy, status=draft, answersCount=12, textAnswers=1
   Response 4: userId=yyy, status=draft, answersCount=12, textAnswers=9
```

## Impact

- ✅ **Report header cleaner:** No misleading "general-v1" label
- ✅ **Report accuracy:** Still includes ALL questionnaires
- ✅ **User clarity:** No confusion about which questionnaires are included
- ✅ **No data loss:** All answers (general + role-specific) are in the report

## Alternative Options (Not Implemented)

### Option 1: Show "All Questionnaires"
```html
<span><strong>Coverage:</strong> All Questionnaires (General + Role-Specific)</span>
```
**Pros:** Explicit about what's included  
**Cons:** Takes up space, obvious from evaluator roles

### Option 2: List All Questionnaires
```html
<span><strong>Questionnaires:</strong> general-v1, legal-expert-v1, ethical-expert-v1</span>
```
**Pros:** Very explicit  
**Cons:** Can be long, changes per project, redundant

### Option 3: Remove Completely (✅ Chosen)
```html
<!-- No questionnaire label -->
```
**Pros:** Clean, not misleading, data speaks for itself  
**Cons:** None (evaluator roles and answer counts make it clear)

## Conclusion

The "Questionnaire: general-v1" label has been removed from the report header. The report continues to include ALL questionnaires (general + role-specific), as confirmed by:
- Terminal logs showing "Both general-v1 and role-specific responses exist"
- Code passing `null` for questionnaireKey
- Multiple responses with 12+ answers (role-specific questions)

**Result:** Cleaner, more accurate report. ✅

