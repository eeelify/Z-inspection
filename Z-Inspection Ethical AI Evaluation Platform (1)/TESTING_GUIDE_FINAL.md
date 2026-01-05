# 🧪 Final Testing Guide - Report Generation

## Prerequisites Check

Before testing, ensure:
- ✅ Backend server is running (`npm start` in `backend/`)
- ✅ Frontend is running (`npm start` in `frontend/`)
- ✅ MongoDB is connected
- ✅ You have at least one **completed project** (100% progress)

---

## 🎯 Test Scenario: Generate Report for Completed Project

### Step 1: Select Test Project

**Requirements:**
- Project completion: **100%**
- Has submitted responses from evaluators
- Has at least one ethical tension (optional but recommended)

**Best test project:**
- "test case 2" or any project with:
  - Multiple evaluators (2+)
  - Multiple roles (legal-expert, etc.)
  - General questions + role-specific questions answered

---

### Step 2: Open Backend Console

**Keep this terminal visible while testing!**

You'll see critical debug logs here:

```powershell
cd backend
npm start

# Wait for:
# Server running on port 3000
# MongoDB connected...
```

---

### Step 3: Generate Report

1. **Browser:** Open `http://localhost:3001` (or your frontend port)
2. **Login** as Admin
3. **Navigate** to project list
4. **Select** a completed project
5. **Click** "Generate Report" button
6. **Wait** 30-60 seconds (report generation takes time)

---

### Step 4: Watch Console Logs ⭐ CRITICAL

While report generates, **look for these patterns** in backend console:

#### ✅ SUCCESS Pattern:

```
📈 Building report metrics for charts...
📊 [DEBUG buildReportMetrics] Found 6 Score documents (all questionnaires)

🔍 [DEBUG buildReportMetrics] Mapping 7 principles to byPrincipleOverall
  📊 TRANSPARENCY: Found 2 score document(s) with data
    Risk values: [2.5, 2.3]
    ✅ Populated: avgRisk=2.40, count=2, topDrivers=5
  📊 ACCOUNTABILITY: Found 2 score document(s) with data
    Risk values: [1.8, 2.0]
    ✅ Populated: avgRisk=1.90, count=2, topDrivers=3
  ... (for all 7 principles)

✅ [DEBUG buildReportMetrics] byPrincipleOverall populated: 7 principles
   TRANSPARENCY=2.40, ACCOUNTABILITY=1.90, TECHNICAL ROBUSTNESS & SAFETY=2.10, ...

🔍 [DEBUG reportController] Passing data to chart generation:
   scoring.byPrincipleOverall exists: true
   Principle count: 7
   Principle keys: TRANSPARENCY, HUMAN AGENCY & OVERSIGHT, TECHNICAL ROBUSTNESS & SAFETY, ...
   "TRANSPARENCY": { isNull: false, fields: 'avgScore,avg,risk,erc,min,max,count,answeredCount,riskLabel,...', risk: 2.4, avg: 2.4, erc: 2.4 }

📊 Generating charts using Chart Contract system...
🔍 [DEBUG generateAllCharts] Received scoring object:
   exists: true, hasByPrincipleOverall: true, principleCount: 7, principleKeys: [...]
   Sample principle "TRANSPARENCY": { isNull: false, fields: ['avgScore','avg','risk','erc',...], risk: 2.4, avg: 2.4, erc: 2.4 }

📊 Generating principleBarChart with 7 non-null principles...
✅ principleBarChart generated successfully

📊 Generating principleEvaluatorHeatmap...
✅ principleEvaluatorHeatmap generated successfully

✅ Chart Contract system generated 2 chart(s)

📊 Building top risk drivers table...
📊 [buildTopRiskDriversTable] Extracted 15 drivers from scores.byPrinciple
✅ Built top risk drivers table with 5 drivers

✅ Converted 2 chart(s) to data URIs for HTML template

🤖 Calling Gemini API for narrative generation...
✅ Report narrative generated (5234 chars)

✅ HTML report generated (45123 chars)
🔍 DEBUG: img tags with data URIs in HTML: 2 (expected: 2)

✅ Report generation complete!
```

#### ❌ FAILURE Patterns to Watch For:

**Pattern A: No Data**
```
❌ CRITICAL: byPrincipleOverall is EMPTY! Charts will not render.
   Scores count: 0
```
→ **Problem:** No Score documents in MongoDB  
→ **Fix Needed:** Run scoring service

**Pattern B: Data Lost**
```
✅ byPrincipleOverall populated: 7 principles
...
❌ reportMetrics.scoring.byPrincipleOverall is MISSING or EMPTY!
```
→ **Problem:** Data not passed to chart generation  
→ **Share console logs for diagnosis**

**Pattern C: Chart Generation Failed**
```
📊 Generating principleBarChart with 7 non-null principles...
❌ principleBarChart generation failed: ...
```
→ **Problem:** Chart rendering error  
→ **Share error message**

---

### Step 5: Download & Inspect PDF

Once generation completes:

1. **Download** the generated PDF
2. **Open** in PDF viewer (Adobe, Chrome, etc.)
3. **Verify** using checklist below

---

## ✅ PDF Verification Checklist

### Section 1: Executive Summary (First Page)

- [ ] **Overall Risk Score** appears (e.g., "1.85 / 4.0")
- [ ] **Risk Classification** appears (e.g., "Low Risk" or "Medium Risk")
- [ ] **Risk label is consistent** (not contradictory)
- [ ] **Evaluator counts** appear (e.g., "2/5 evaluators submitted")
- [ ] **7 Ethical principles** mentioned with ERC scores

**Example (Good):**
```
Overall Ethical Risk: 1.85 / 4.0 (Low Risk)
Evaluation Coverage: 2 of 5 assigned evaluators submitted responses
```

**Example (Bad - Report this!):**
```
Overall Risk: 0.91 (LOW RISK)  ← Contradictory!
Later: Score 0.91 = Minimal Risk
```

---

### Section 2: Dashboard Summary

#### Charts - CRITICAL TEST ⭐

**Principle Bar Chart:**
- [ ] **Chart IMAGE appears** (not "Chart Not Available" text)
- [ ] **7 colored bars** visible (one per principle)
- [ ] **Y-axis scale**: 0 to 4
- [ ] **Bars have different heights** (showing actual data)
- [ ] **Legend/Threshold guide** appears below chart

**Example (Good):**
```
[VISUAL BAR CHART HERE showing 7 bars of varying heights from 0-4]
Scale 0–4 (ERC Risk Interpretation)
0.0: MINIMAL/NO RISK
1.0: LOW RISK
...
```

**Example (Bad - Report this!):**
```
⚠️ Chart Not Available: No principle score data available for visualization.
```

**Role × Principle Heatmap:**
- [ ] **Chart IMAGE appears** (not "Chart Not Available")
- [ ] **Matrix/grid** visible with rows (evaluators) and columns (principles)
- [ ] **Color gradient** showing risk levels
- [ ] **Legend** explaining colors

---

### Section 3: Top Risk Drivers

**Top 5 Questions Table:**
- [ ] **Table appears** (not empty)
- [ ] **5 rows** (or fewer if <5 questions)
- [ ] Each row has:
  - [ ] **Question text** (actual question, not just ID)
  - [ ] **Principle name** (e.g., "TRANSPARENCY")
  - [ ] **ERC score** (numeric value 0-4)
  - [ ] **Answer snippet** (text excerpt, 50-200 chars)
  - [ ] **Role** who answered (e.g., "legal-expert")

**Example (Good):**
```
| Question | Principle | ERC | Role | Answer |
|----------|-----------|-----|------|--------|
| Does the system provide explanations for decisions? | TRANSPARENCY | 2.4 | legal-expert | "The system provides basic explanations but lacks detail for complex cases..." |
```

**Example (Bad - Report this!):**
```
Top Risk Drivers
No drivers computed.
```

OR

```
| Question | Principle | ERC | Role | Answer |
|----------|-----------|-----|------|--------|
| (empty table) |
```

---

### Section 4: Ethical Tensions

**Tension Table:**
- [ ] **Tensions listed** (if any exist in project)
- [ ] For each tension:
  - [ ] **Created By**: Shows **real name** (e.g., "Dr. Sarah Johnson")
    - ❌ BAD: User ID like "507f1f77bcf86cd799439011"
    - ❌ BAD: "unknown"
  - [ ] **Evidence Types**: Shows **list** (e.g., "Policy, Test Report")
    - ❌ BAD: "N/A"
  - [ ] **Claim**: Shows **actual claim** or clean placeholder "—"
    - ❌ BAD: "Not provided"
  - [ ] **Review State**: Shows normalized state (e.g., "UnderReview", "Accepted")
  - [ ] **Severity**: Shows level (Low/Medium/High/Critical)

**Example (Good):**
```
Tension 1: TRANSPARENCY vs PRIVACY & DATA GOVERNANCE
Created By: Dr. Sarah Johnson
Severity: Medium
Claim: Explaining AI decisions requires disclosing sensitive data.
Evidence Types: Policy, Test Report
Review State: UnderReview
Consensus: 75% agree
```

**Example (Bad - Report this!):**
```
Created By: 507f1f77bcf86cd799439011  ← User ID!
Evidence Types: N/A                    ← Not informative!
Claim: Not provided                    ← Ugly!
```

---

### Section 5: Methodology & Appendix

- [ ] **ERC methodology explained**
- [ ] **Risk scale thresholds documented** (0-4 scale)
- [ ] **Evaluator list** appears
- [ ] **Evaluator counts consistent** with Executive Summary

---

## 📊 Console Log Collection

If ANY verification fails, collect these logs:

### Critical Logs to Copy:

```powershell
# Search in console for these patterns and copy ALL output:

1. "[DEBUG buildReportMetrics]" - Shows data extraction
2. "[DEBUG reportController]" - Shows data passing to charts
3. "[DEBUG generateAllCharts]" - Shows chart generation
4. "❌ CRITICAL" - Critical errors
5. "❌ Error" - All errors
6. "[buildTopRiskDriversTable]" - Top drivers status
```

**How to share:**
1. Copy entire console output from "Building report metrics" to "Report generation complete"
2. Save to a text file
3. Share the relevant sections

---

## 🐛 Common Issues & Solutions

### Issue 1: "Chart Not Available"

**Symptoms:**
- PDF shows text instead of chart image
- Console shows: `No principle data available`

**Diagnosis:**
```
Look for:
✅ [DEBUG buildReportMetrics] byPrincipleOverall populated: X principles
```

**If X = 0:**
- No Score documents exist
- Run: `db.scores.find({ projectId: ObjectId("YOUR_PROJECT_ID") }).count()` in MongoDB
- If 0, scores need to be computed

**If X > 0:**
- Data exists but not reaching charts
- Share console logs

---

### Issue 2: Top Drivers Empty

**Symptoms:**
- PDF shows "No drivers computed" or empty table

**Diagnosis:**
```
Look for:
📊 [buildTopRiskDriversTable] Extracted X drivers
```

**If X = 0:**
- Fallback logic will compute from responses
- Look for: `⚠️ No topDrivers in scores, computing from responses...`
- If still 0, no responses exist

---

### Issue 3: Inconsistent Evaluator Counts

**Symptoms:**
- Executive Summary says "2/5"
- Dashboard says "2/6"
- Appendix says "6 evaluators"

**Diagnosis:**
```
Look for:
📊 [computeParticipation] assignedCount=X, submittedCount=Y
```

**These should match across all report sections**

---

### Issue 4: Risk Label Contradictions

**Symptoms:**
- Score 0.91 shows "LOW" in one place, "Minimal" in another

**Should now be fixed!** All places should show "Minimal Risk" for 0.91.

If still inconsistent, report it!

---

## 📝 Test Report Template

**Please fill this out and share:**

```
=== TEST RESULTS ===

Project Tested: [project name]
Completion: [100%]
Evaluators: [2/5 submitted]

CHARTS:
- Principle Bar Chart: [✅ RENDERS / ❌ "Chart Not Available"]
- Role × Principle Heatmap: [✅ RENDERS / ❌ "Chart Not Available"]

TOP DRIVERS:
- Table populated: [✅ YES (5 rows) / ❌ NO (empty)]
- Has answer snippets: [✅ YES / ❌ NO]

TENSION TABLE:
- Created By format: [✅ Real names / ❌ User IDs / ❌ "unknown"]
- Evidence Types format: [✅ "Policy, Test" / ❌ "N/A"]
- Claim format: [✅ Text or "—" / ❌ "Not provided"]

RISK LABELS:
- Consistent: [✅ YES / ❌ NO - provide examples]

EVALUATOR COUNTS:
- Consistent: [✅ YES / ❌ NO - provide numbers]

CONSOLE LOGS:
- Any ❌ CRITICAL errors: [YES/NO - if yes, paste below]
- Any ❌ Error messages: [YES/NO - if yes, paste below]

OVERALL:
- Report Quality: [EXCELLENT / GOOD / ISSUES FOUND]

LOGS (if issues found):
[Paste relevant console sections here]
```

---

## 🎉 Success Criteria

Report is **EXCELLENT** if:
- ✅ All charts render (no "Not Available")
- ✅ Top drivers table has 5 rows with snippets
- ✅ Tension table shows real names and evidence types
- ✅ Risk labels consistent throughout
- ✅ Evaluator counts match everywhere
- ✅ No ❌ CRITICAL or ❌ Error in console

Report has **MINOR ISSUES** if:
- ✅ Charts render but tension table has some "N/A"
- ✅ Top drivers populated but <5 rows
- ⚠️ One or two minor inconsistencies

Report **NEEDS FIXES** if:
- ❌ Charts show "Not Available"
- ❌ Top drivers empty
- ❌ Multiple contradictions

---

## 🚀 Next Steps

**If EXCELLENT:**
🎉 All done! Report generation is working perfectly!

**If MINOR ISSUES:**
📝 Report the issues, we can polish further

**If NEEDS FIXES:**
🔍 Share console logs, we'll debug together

---

**Ready to test? Start with Step 1!** 🧪

