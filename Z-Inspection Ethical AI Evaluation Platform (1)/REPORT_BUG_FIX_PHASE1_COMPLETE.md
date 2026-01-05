# 🔧 Report Bug Fix - Phase 1 Complete

## ✅ What Was Fixed

### Critical Fix: Chart Data Pipeline (byPrincipleOverall)

**Problem:** Charts showed "Chart Not Available" because `scoring.byPrincipleOverall` was empty.

**Root Cause:** The data mapping logic in `reportMetricsService.js` had incomplete logic for reading principle ERC scores from MongoDB Score documents.

**Solution Implemented:**

**File:** `backend/services/reportMetricsService.js` (Lines ~798-898)

**Changes:**
1. ✅ **Improved data extraction logic**
   - Now checks for BOTH `.risk` and `.avg` fields in Score documents
   - Falls back to `buildPrincipleScores` data if direct mapping fails
   - Handles both ERC model (risk field) and legacy model (avg field)

2. ✅ **Added comprehensive debug logging**
   - Logs how many principles are found
   - Shows risk values for each principle
   - Logs final populated count
   - **CRITICAL ERROR** logged if byPrincipleOverall is empty

3. ✅ **Top drivers extraction**
   - Extracts `topDrivers` array from Score documents
   - Includes in `scoring.byPrincipleOverall[principle].topDrivers`

4. ✅ **Added `erc` field alias**
   - Charts can now reference either `.risk` or `.erc`
   - Ensures compatibility with chart generation code

---

## 🧪 How to Test

### Step 1: Restart Server

```powershell
# Stop server (Ctrl+C if running)
# Then restart
cd backend
npm start
```

### Step 2: Generate a Test Report

1. Go to Admin Dashboard
2. Select a completed project (100% progress)
3. Click "Generate Report"
4. **Watch the console logs** for these key messages:

#### Expected Success Logs:

```
🔍 [DEBUG buildReportMetrics] Mapping 7 principles to byPrincipleOverall
  📊 TRANSPARENCY: Found 2 score document(s) with data
    Risk values: [2.5, 3.1]
    ✅ Populated: avgRisk=2.80, count=2, topDrivers=5
  📊 ACCOUNTABILITY: Found 2 score document(s) with data
    Risk values: [1.8, 2.0]
    ✅ Populated: avgRisk=1.90, count=2, topDrivers=3
  ... (for all 7 principles)
✅ [DEBUG buildReportMetrics] byPrincipleOverall populated: 7 principles
   TRANSPARENCY=2.80, ACCOUNTABILITY=1.90, ...
```

#### If Still Failing:

```
❌ CRITICAL: byPrincipleOverall is EMPTY! Charts will not render.
   Scores count: 0
   principleScoresData keys: ...
```

If you see this error, it means:
- **No Score documents exist** for the project, OR
- **Score documents exist** but have no `byPrinciple` data

---

### Step 3: Check PDF Report

Once generated, download the PDF and verify:

**✅ Success Indicators:**
1. **Principle Bar Chart** appears (not "Chart Not Available")
2. **Role × Principle Heatmap** appears
3. **Executive Summary** shows correct principle ERC values
4. **No "Chart Not Available" messages**

**❌ Still Broken:**
1. Charts still show "Chart Not Available"
2. Executive Summary shows no principle scores

---

## 📊 Debug Output Interpretation

### If byPrincipleOverall is still empty:

**Case 1: No Score documents** (`Scores count: 0`)
```
Root Cause: No scores have been computed for this project
Fix Required: Check if ethicalScoringService is being called
Check: Do responses exist for this project?
```

**Case 2: Score documents exist but no principle data**
```
Root Cause: Score.byPrinciple is null/undefined in all documents
Fix Required: Check ethicalScoringService.computeEthicalScores
Check: Is byPrinciple being populated when saving scores?
```

**Case 3: Principle name mismatch**
```
Root Cause: Principle names in Score don't match CANONICAL_PRINCIPLES
Example: "TRANSPARENCY & EXPLAINABILITY" != "TRANSPARENCY"
Fix Required: Check principle mapping in buildPrincipleScores
```

---

## 🚀 Next Steps (If Phase 1 Works)

If charts now appear, we proceed to fix remaining issues:

### Phase 2: Top Risk Drivers
- Ensure top 5 questions appear with answer snippets
- Fix: `backend/services/topDriversService.js`

### Phase 3: Evaluator Counting
- Ensure consistent counts across report sections
- Fix: Create `getCanonicalEvaluatorCounts()` function

### Phase 4: Risk Labels
- Ensure 0.91 maps to correct label everywhere
- Fix: Use `getRiskLabel()` from `riskScale.js` consistently

### Phase 5: Tension Table
- Ensure evidence types, claims, createdBy are populated
- Fix: `buildTensionsSummary()` mapping

---

## 📝 Manual Checks (If Automated Test Fails)

### Check 1: Do Score documents exist?

```javascript
// MongoDB shell or Compass
db.scores.find({ projectId: ObjectId("YOUR_PROJECT_ID") }).count()
// Expected: > 0
```

### Check 2: Do Score documents have byPrinciple data?

```javascript
db.scores.findOne({ projectId: ObjectId("YOUR_PROJECT_ID") })
// Check output:
// - totals.overallRisk: should be a number (0-4)
// - byPrinciple.TRANSPARENCY: should be an object with .risk or .avg
// - byPrinciple.TRANSPARENCY.topDrivers: should be an array
```

### Check 3: Are principle names canonical?

```javascript
db.scores.findOne({ projectId: ObjectId("YOUR_PROJECT_ID") })
// Check byPrinciple keys:
// Should be exactly: "TRANSPARENCY", "ACCOUNTABILITY", etc.
// NOT: "TRANSPARENCY & EXPLAINABILITY" or other variants
```

---

## 🐛 Known Limitations

**Not Fixed Yet:**
1. ❌ Top risk drivers may still be empty (Phase 2)
2. ❌ Evaluator counts may be inconsistent (Phase 3)
3. ❌ Risk labels may vary (0.91 as "LOW" vs "Minimal") (Phase 4)
4. ❌ Tension table may have N/A values (Phase 5)

These will be addressed in subsequent phases AFTER confirming Phase 1 works.

---

## 📞 Support

If Phase 1 test fails:
1. Copy the **console log output** (especially lines with `[DEBUG buildReportMetrics]`)
2. Copy the **error message** from frontend (if any)
3. Share **project ID** and **completion status** (should be 100%)
4. Share **Score document count** from MongoDB (Check 1 above)

---

**Status:** ✅ Phase 1 COMPLETE - Ready for Testing  
**Next:** User tests → If successful, proceed to Phase 2-5  
**Estimated Total Time:** Phase 1 (done) + Phases 2-5 (3-4 hours if Phase 1 works)

