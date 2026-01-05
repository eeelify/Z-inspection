# 🔍 Enhanced Debug Logging - Ready for Testing

## What Was Added

### Critical Debug Points

**1. In `reportController.js` (before chart generation):**
```javascript
console.log('🔍 [DEBUG reportController] Passing data to chart generation:');
console.log('   scoring.byPrincipleOverall exists:', !!reportMetrics.scoring?.byPrincipleOverall);
console.log('   Principle count:', principleKeys.length);
console.log('   Principle keys:', principleKeys.join(', '));
// + detailed logging of first 2 principles
```

**2. In `chartGenerationService.js` (when receiving data):**
```javascript
console.log('🔍 [DEBUG generateAllCharts] Received scoring object:');
console.log('   Sample principle data structure');
// + detailed logging of data fields
```

---

## Testing Instructions

### Step 1: Restart Server
```powershell
# Stop server (Ctrl+C)
cd backend
npm start
```

### Step 2: Generate Report & Capture Logs

Generate a report and look for these **critical log patterns**:

---

### ✅ SCENARIO A: Data Exists and Reaches Charts (SUCCESS)

```
📈 Building report metrics for charts...
✅ [DEBUG buildReportMetrics] byPrincipleOverall populated: 7 principles
   TRANSPARENCY=2.50, ACCOUNTABILITY=1.80, ...

🔍 [DEBUG reportController] Passing data to chart generation:
   scoring.byPrincipleOverall exists: true
   Principle count: 7
   Principle keys: TRANSPARENCY, HUMAN AGENCY & OVERSIGHT, ...
   "TRANSPARENCY": { isNull: false, fields: 'avgScore,avg,risk,erc,min,max,count,...', risk: 2.5, avg: 2.5, erc: 2.5 }

🔍 [DEBUG generateAllCharts] Received scoring object:
   exists: true, hasByPrincipleOverall: true, principleCount: 7
   Sample principle "TRANSPARENCY": { isNull: false, fields: ['avgScore','avg','risk','erc',...], risk: 2.5, avg: 2.5, erc: 2.5 }

📊 Generating principleBarChart with 7 non-null principles...
✅ principleBarChart generated successfully
```

**If you see this → Charts WILL render in PDF ✅**

---

### ❌ SCENARIO B: Data Lost Between reportMetrics and Charts (BUG)

```
✅ [DEBUG buildReportMetrics] byPrincipleOverall populated: 7 principles
   TRANSPARENCY=2.50, ...

🔍 [DEBUG reportController] Passing data to chart generation:
   ❌ reportMetrics.scoring.byPrincipleOverall is MISSING or EMPTY!
   reportMetrics.scoring keys: totalsOverall,byRole
```

**This means:** Data exists in `buildReportMetrics` but is LOST before reaching charts.

**Root Cause:** `reportMetrics.scoring` structure is malformed or `byPrincipleOverall` is not being assigned.

**Fix Location:** Check `backend/services/reportMetricsService.js` around line 1270 where `reportMetrics` object is assembled.

---

### ❌ SCENARIO C: Data Never Populated in reportMetrics (CRITICAL BUG)

```
📈 Building report metrics for charts...
❌ CRITICAL: byPrincipleOverall is EMPTY! Charts will not render.
   Scores count: 5
   principleScoresData keys: TRANSPARENCY, ACCOUNTABILITY, ...
```

**This means:** `buildPrincipleScores` found data but mapping to `byPrincipleOverall` failed.

**Root Cause:** The loop at line ~800-870 in `reportMetricsService.js` is not correctly populating `scoring.byPrincipleOverall`.

**Fix Required:** Check the condition logic - it might be skipping all principles.

---

### ❌ SCENARIO D: No Score Documents Exist (DATA MISSING)

```
📈 Building report metrics for charts...
📊 [DEBUG buildReportMetrics] Found 0 Score documents (all questionnaires)
❌ CRITICAL: byPrincipleOverall is EMPTY! Charts will not render.
   Scores count: 0
```

**This means:** No `Score` documents exist in MongoDB for this project.

**Root Cause:** Ethical scoring service never ran, or scores were deleted.

**Fix Required:**
1. Check if responses exist: `db.responses.count({ projectId: ObjectId("...") })`
2. Manually trigger score computation: Call `computeScores(projectId, null, null)` from evaluationService
3. Check `ethicalScoringService` for errors

---

## Interpretation Guide

| Log Pattern | Meaning | Action |
|-------------|---------|--------|
| `byPrincipleOverall populated: 7 principles` | ✅ Data extracted from MongoDB | Good |
| `Passing data to chart generation: ... exists: true, Principle count: 7` | ✅ Data sent to charts | Good |
| `Received scoring object: ... principleCount: 7` | ✅ Charts received data | Good |
| `principleBarChart generated successfully` | ✅ Chart PNG created | SUCCESS! |
| `byPrincipleOverall is EMPTY!` | ❌ Data never populated | Fix reportMetricsService |
| `reportMetrics.scoring.byPrincipleOverall is MISSING` | ❌ Data lost in transit | Fix reportMetrics assembly |
| `All principles are null` | ❌ Data exists but all null values | Check Score documents |
| `Scores count: 0` | ❌ No scores in MongoDB | Run ethicalScoringService |

---

## Expected Output (Success Case)

When everything works, you should see:

```
📊 [DEBUG buildReportMetrics] Found 6 Score documents (all questionnaires)
✅ [DEBUG buildReportMetrics] byPrincipleOverall populated: 7 principles
   TRANSPARENCY=2.50, HUMAN AGENCY & OVERSIGHT=1.90, ...

🔍 [DEBUG reportController] Passing data to chart generation:
   scoring.byPrincipleOverall exists: true
   Principle count: 7
   Principle keys: TRANSPARENCY, HUMAN AGENCY & OVERSIGHT, TECHNICAL ROBUSTNESS & SAFETY, ...

🔍 [DEBUG generateAllCharts] Received scoring object:
   exists: true, hasByPrincipleOverall: true, principleCount: 7

📊 Generating principleBarChart with 7 non-null principles...
✅ principleBarChart generated successfully

✅ Converted 2 chart(s) to data URIs for HTML template
```

---

## Next Steps Based on Output

### If Scenario A (Success):
✅ **Charts will appear in PDF**  
→ Verify PDF output  
→ Move to remaining fixes (risk labels, tension table)

### If Scenario B (Data lost):
❌ **Check reportMetrics assembly**  
→ Read `reportMetricsService.js` around line 1270  
→ Ensure `scoring.byPrincipleOverall` is in returned object  
→ Add debug log: `console.log('reportMetrics.scoring keys:', Object.keys(scoring))`

### If Scenario C (Mapping failed):
❌ **Check byPrincipleOverall population loop**  
→ Read `reportMetricsService.js` lines 800-870  
→ Check if loop conditions are too restrictive  
→ Verify `principleScoresData` has valid data

### If Scenario D (No scores):
❌ **Score documents missing**  
→ Check MongoDB: `db.scores.find({ projectId: ObjectId("...") }).count()`  
→ Check if responses exist: `db.responses.find({ projectId: ObjectId("..."), status: 'submitted' }).count()`  
→ Manually run scoring: Call `computeScores` API or function

---

## Commands to Run After Test

**1. If Charts Still Don't Appear:**

Copy the **entire console log output** from server startup to report generation completion.

Focus on these sections:
- `[DEBUG buildReportMetrics]` lines
- `[DEBUG reportController]` lines
- `[DEBUG generateAllCharts]` lines
- Any `❌ CRITICAL` or `❌ Error` lines

**2. Quick MongoDB Check (if Scenario D):**

```javascript
// In MongoDB shell or Compass
use your_database_name;

// Check scores exist
db.scores.find({ projectId: ObjectId("YOUR_PROJECT_ID") }).count()
// Expected: > 0

// Check if scores have byPrinciple data
db.scores.findOne({ projectId: ObjectId("YOUR_PROJECT_ID") })
// Check: document.byPrinciple should be an object with 7 principle keys
```

---

**Status:** Enhanced debug logging active  
**Ready:** YES - restart server and test  
**Next:** Share console logs for diagnosis

