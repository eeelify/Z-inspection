# 🚨 Critical Report Generation Bugs - Analysis & Fix Plan

## Executive Summary

The generated PDF reports have **5 CRITICAL defects** preventing proper visualization and data presentation:

1. ❌ **Charts Missing:** "Chart Not Available" instead of principle bar chart and heatmap
2. ❌ **Top Risk Drivers Empty:** No question data, only placeholder text  
3. ❌ **Inconsistent Evaluator Counts:** 2/6 vs 2/5 vs 6 - conflicting numbers
4. ❌ **Inconsistent Risk Labels:** 0.91 shown as both "LOW" and "Minimal"
5. ❌ **Tension Table Incomplete:** N/A values, "Not provided" entries

---

## Root Cause Analysis

### 1. Charts Missing → "Chart Not Available"

**Problem:** `reportMetrics.scoring.byPrincipleOverall` is empty or malformed

**Data Flow:**
```
MongoDB `scores` collection (ERC data per principle)
    ↓
buildReportMetrics() in reportMetricsService.js
    ↓
scoring.byPrincipleOverall = {} ← EMPTY!
    ↓
chartGenerationService.generateAllCharts(scoring, ...)
    ↓
No data → creates placeholder chart
    ↓
HTML template shows "Chart Not Available"
```

**Root Cause:** 
- `buildReportMetrics` is NOT correctly fetching or mapping data from `scores` collection
- The `byPrincipleOverall` object is initialized empty but never populated
- Charts check for data and find none, so they create placeholders

**Fix Required:**
```javascript
// backend/services/reportMetricsService.js
// Line ~798-858: buildPrincipleScores function

// CURRENT (BROKEN):
scoring.byPrincipleOverall = {}; // Initialized empty
// ... code that should populate it but doesn't

// REQUIRED FIX:
// 1. Query scores collection correctly
const scores = await Score.find({ projectId, latest: true });

// 2. Extract principle ERC data
scores.forEach(score => {
  if (score.byPrinciple) {
    Object.entries(score.byPrinciple).forEach(([principle, data]) => {
      scoring.byPrincipleOverall[principle] = {
        erc: data.erc || data.risk,
        risk: data.erc || data.risk,
        riskLabel: getRiskLabel(data.erc || data.risk),
        answeredCount: data.answeredCount,
        topDrivers: data.topDrivers || []
      };
    });
  }
});
```

---

### 2. Top Risk Drivers Empty

**Problem:** `topDriversTable` is empty or not being passed to template

**Data Flow:**
```
buildTopRiskDriversTable(projectId)
    ↓
Queries scores.byPrinciple[].topDrivers
    ↓
topDriversTable = [] ← EMPTY!
    ↓
reportMetrics.scoring.topRiskDrivers.table = []
    ↓
Gemini receives empty array
    ↓
PDF shows "No drivers computed" or placeholder
```

**Root Cause:**
- `scores.byPrinciple[principle].topDrivers` is missing or empty in MongoDB
- `buildTopRiskDriversTable` doesn't fall back to computing drivers if missing
- No answer snippets are being attached

**Fix Required:**
```javascript
// backend/services/topDriversService.js

// If topDrivers missing in scores, compute on-the-fly:
if (!topDrivers || topDrivers.length === 0) {
  // Fallback: Query responses for high-ERC questions
  const responses = await Response.find({ projectId }).populate('answers.questionId');
  
  // Find questions with highest questionRiskImportance * answerSeverity
  const driversMap = {};
  responses.forEach(resp => {
    resp.answers.forEach(ans => {
      const q = ans.questionId;
      if (q && q.questionRiskImportance) {
        const erc = q.questionRiskImportance * (ans.answerSeverity || 0.5);
        driversMap[q._id] = {
          questionText: q.text,
          principle: q.principle,
          erc,
          answerSnippet: ans.answer?.text?.substring(0, 200)
        };
      }
    });
  });
  
  // Sort by ERC and take top 5
  topDrivers = Object.values(driversMap)
    .sort((a, b) => b.erc - a.erc)
    .slice(0, 5);
}
```

---

### 3. Inconsistent Evaluator Counts

**Problem:** Different functions count evaluators differently

**Data Sources:**
```
computeParticipation() → Counts responses with answers (any status)
    vs
getProjectEvaluators() → Counts responses with status='submitted'
    vs
Project.assignedUsers → Total assigned (may include non-submitters)
```

**Root Cause:**
- Three different counting methods in use
- No single source of truth for "submitted evaluators"
- Some count by userId, some by role (leading to duplicates)

**Fix Required:**
```javascript
// backend/services/reportMetricsService.js

// Define ONE canonical function:
async function getCanonicalEvaluatorCounts(projectId) {
  // 1. Get assigned users
  const project = await Project.findById(projectId).populate('assignedUsers');
  const assigned = project.assignedUsers || [];
  
  // 2. Get users who submitted (status='submitted' AND has answers)
  const responses = await Response.find({
    projectId,
    status: 'submitted'
  }).populate('userId');
  
  const submitted = responses.filter(r => 
    r.answers && r.answers.length > 0
  );
  
  const submittedUserIds = [...new Set(submitted.map(r => r.userId._id.toString()))];
  
  // 3. Group by role (NO DUPLICATES)
  const byRole = {};
  submitted.forEach(r => {
    const role = r.userId.role || 'Unknown';
    if (!byRole[role]) {
      byRole[role] = { count: 0, userIds: new Set() };
    }
    byRole[role].userIds.add(r.userId._id.toString());
  });
  
  Object.keys(byRole).forEach(role => {
    byRole[role].count = byRole[role].userIds.size;
    delete byRole[role].userIds; // Remove set, keep only count
  });
  
  return {
    assignedTotal: assigned.length,
    submittedTotal: submittedUserIds.length,
    submittedByRole: byRole
  };
}

// USE THIS EVERYWHERE:
const evaluatorCounts = await getCanonicalEvaluatorCounts(projectId);
// Executive Summary: {evaluatorCounts.submittedTotal} evaluators
// Dashboard: {evaluatorCounts.assignedTotal} assigned, {evaluatorCounts.submittedTotal} submitted
// By Role: {evaluatorCounts.submittedByRole}
```

---

### 4. Inconsistent Risk Labels

**Problem:** Same score (0.91) mapped to different labels ("LOW" vs "Minimal")

**Root Cause:**
- Multiple risk classification functions exist
- Different thresholds in different files
- No single source of truth

**Current Thresholds (INCONSISTENT):**
```javascript
// File A:
0.0-0.9 → Minimal
1.0-1.9 → Low

// File B:
0.0-1.0 → Low
1.0-2.0 → Medium
```

**Fix Required:**
```javascript
// backend/utils/riskScale.js (SINGLE SOURCE OF TRUTH)

const ERC_RISK_SCALE = {
  thresholds: [
    { min: 0.0, max: 0.9, label: 'Minimal Risk', short: 'MINIMAL', color: '#10b981' },
    { min: 1.0, max: 1.9, label: 'Low Risk', short: 'LOW', color: '#84cc16' },
    { min: 2.0, max: 2.9, label: 'Medium Risk', short: 'MEDIUM', color: '#f59e0b' },
    { min: 3.0, max: 3.6, label: 'High Risk', short: 'HIGH', color: '#ef4444' },
    { min: 3.7, max: 4.0, label: 'Critical Risk', short: 'CRITICAL', color: '#dc2626' }
  ]
};

function getRiskLabel(score, format = 'label') {
  if (score === null || score === undefined) return 'N/A';
  
  const bucket = ERC_RISK_SCALE.thresholds.find(t => 
    score >= t.min && score <= t.max
  );
  
  if (!bucket) return 'Unknown';
  
  return format === 'short' ? bucket.short : bucket.label;
}

// USE EVERYWHERE:
const riskLabel = getRiskLabel(0.91); // → "Minimal Risk"
const riskLabelShort = getRiskLabel(0.91, 'short'); // → "MINIMAL"
```

---

### 5. Tension Table Incomplete

**Problem:** Evidence Types show "N/A", Claim shows "Not provided"

**Root Cause:**
- Tensions in MongoDB have evidence but mapping is wrong
- Evidence types stored as array but displayed as string
- Claim field may be `null` in some old tensions

**Fix Required:**
```javascript
// backend/services/reportMetricsService.js

function buildTensionsSummary(tensions) {
  return tensions.map(t => {
    // Evidence types: extract from evidence array
    const evidenceTypes = t.evidence && t.evidence.length > 0
      ? [...new Set(t.evidence.map(e => e.type || 'Other'))].join(', ')
      : 'None';
    
    // Claim: use actual value or fallback
    const claim = t.claimStatement || t.claim || '—';
    
    // CreatedBy: get user name or fallback
    const createdBy = t.createdBy?.name || t.createdBy || 'Unknown';
    
    // Review state: normalize enum
    const reviewState = normalizeReviewState(t.status || t.reviewState);
    
    return {
      principle1: t.principle1,
      principle2: t.principle2,
      severity: t.severityLevel || t.severity,
      evidenceCount: t.evidence?.length || 0,
      evidenceTypes,
      claim,
      createdBy,
      reviewState,
      consensus: t.consensus || { agree: 0, disagree: 0 }
    };
  });
}
```

---

## Implementation Plan

### Phase 1: Fix Data Pipeline (CRITICAL)

**File: `backend/services/reportMetricsService.js`**

```javascript
// Line ~790: buildPrincipleScores function
async function buildPrincipleScores(projectId) {
  const scoring = {
    totalsOverall: {
      overallERC: null,
      overallRisk: null,
      riskLabel: null,
      answeredCount: 0,
      missingCount: 0
    },
    byPrincipleOverall: {}, // ← MUST BE POPULATED
    byPrincipleTable: [],
    byRoleTable: [],
    topRiskDrivers: { list: [], table: [] }
  };

  // 1. Fetch project-level scores (latest only)
  const projectScores = await Score.findOne({
    projectId,
    questionnaireKey: { $in: ['project', 'project-aggregate', null] },
    userId: null // Project-level, not user-specific
  }).sort({ version: -1, updatedAt: -1 }).lean();

  if (!projectScores) {
    console.warn(`⚠️  No project-level scores found for ${projectId}`);
    return { scoring, hasData: false };
  }

  // 2. Populate totals
  scoring.totalsOverall.overallERC = projectScores.totals?.overallERC || 0;
  scoring.totalsOverall.overallRisk = projectScores.totals?.overallRisk || 0;
  scoring.totalsOverall.riskLabel = getRiskLabel(scoring.totalsOverall.overallERC);
  scoring.totalsOverall.answeredCount = projectScores.totals?.answeredCount || 0;

  // 3. Populate byPrincipleOverall ← FIX HERE
  if (projectScores.byPrinciple) {
    Object.entries(projectScores.byPrinciple).forEach(([principle, data]) => {
      scoring.byPrincipleOverall[principle] = {
        erc: data.erc || data.risk || 0,
        risk: data.erc || data.risk || 0,
        riskLabel: getRiskLabel(data.erc || data.risk),
        answeredCount: data.answeredCount || 0,
        topDrivers: data.topDrivers || []
      };
    });
  }

  // 4. Build table format
  scoring.byPrincipleTable = Object.entries(scoring.byPrincipleOverall).map(([principle, data]) => ({
    principle,
    ...data
  }));

  console.log(`✅ buildPrincipleScores: Found ${Object.keys(scoring.byPrincipleOverall).length} principles`);
  
  return { scoring, hasData: Object.keys(scoring.byPrincipleOverall).length > 0 };
}
```

### Phase 2: Fix Evaluator Counting

**File: `backend/services/reportMetricsService.js`**

Add canonical counting function (see code above in Root Cause #3).

Update ALL uses of evaluator counts to use this function:
- `computeParticipation()`
- `getProjectEvaluators()`
- Executive Summary
- Dashboard Summary
- Appendix

### Phase 3: Fix Risk Labels

**File: `backend/utils/riskScale.js`**

Update and export canonical `getRiskLabel()` function (see code above in Root Cause #4).

**Files to Update:**
- `backend/services/reportMetricsService.js` - import and use `getRiskLabel`
- `backend/services/geminiService.js` - pass risk labels in data
- `backend/services/htmlReportTemplateService.js` - use risk labels consistently

### Phase 4: Fix Top Risk Drivers

**File: `backend/services/topDriversService.js`**

Update `buildTopRiskDriversTable()` to:
1. Try to get drivers from `scores.byPrinciple[].topDrivers` first
2. If missing or empty, compute on-the-fly from responses
3. Always attach answer snippets (from responses collection)
4. Return at least top 5 (or fewer if not enough data)

### Phase 5: Fix Tension Table

**File: `backend/services/reportMetricsService.js`**

Update `buildTensionsSummary()` as shown in Root Cause #5.

---

## Testing Checklist

After fixes, verify:

- [ ] `console.log` in `buildPrincipleScores` shows "Found 7 principles"
- [ ] Chart generation logs show "ready" status, not "placeholder"
- [ ] HTML contains `<img src="data:image/png;base64,..."` tags (not "Chart Not Available")
- [ ] Top drivers table has 5 rows with question text and answer snippets
- [ ] Evaluator counts consistent: same number in Executive Summary, Dashboard, Appendix
- [ ] Risk label for 0.91 is "Minimal Risk" everywhere (not "LOW")
- [ ] Tension table shows actual evidence types (not "N/A")

---

## Priority Order

1. **CRITICAL:** Fix `buildPrincipleScores` to populate `byPrincipleOverall` (enables charts)
2. **HIGH:** Fix top risk drivers computation (enables analysis)
3. **HIGH:** Fix evaluator counting (consistency)
4. **MEDIUM:** Fix risk labels (consistency)
5. **LOW:** Fix tension table (cosmetic)

---

## Estimated Effort

- Phase 1 (Data Pipeline): 2-3 hours
- Phase 2 (Evaluator Counts): 1-2 hours
- Phase 3 (Risk Labels): 1 hour
- Phase 4 (Top Drivers): 1-2 hours
- Phase 5 (Tensions): 30 minutes
- Testing: 1 hour

**Total: 6-9 hours of development + testing**

---

## Next Steps

1. **Implement Phase 1** (data pipeline fix) - this is the blocker for charts
2. **Test report generation** - verify charts appear
3. **Implement Phases 2-5** (consistency fixes)
4. **Final regression test** - generate report, verify all 5 defects are fixed

---

**Status:** Analysis complete, ready for implementation.  
**Owner:** Backend Developer  
**Reviewer:** QA + Product Manager (verify PDF output matches requirements)

