# 🚨 Remaining Critical Fixes - Implementation Guide

## Summary of Remaining Issues

After Phase 1 (chart data pipeline fix), these issues remain:

1. ✅ **Chart Data Pipeline** - FIXED in Phase 1
2. ❌ **Top Risk Drivers Empty** - NEEDS FIX
3. ❌ **Inconsistent Evaluator Counts** - NEEDS CONSISTENCY CHECK
4. ❌ **Inconsistent Risk Labels** - NEEDS FIX
5. ❌ **Tension Table Incomplete** - NEEDS FIX

---

## Fix #2: Top Risk Drivers

### Problem
Top drivers table is empty or shows placeholder text.

### Root Cause
`buildTopRiskDriversTable` in `topDriversService.js` returns empty array when `topDrivers` is missing from `Score.byPrinciple`.

### Solution

**File:** `backend/services/topDriversService.js`

**Current Logic:**
```javascript
// Gets topDrivers from scores.byPrinciple[].topDrivers
// If missing → returns []
```

**Required Fix:**
```javascript
async function buildTopRiskDriversTable(projectId) {
  const projectIdObj = isValidObjectId(projectId) 
    ? new mongoose.Types.ObjectId(projectId) 
    : projectId;

  // Step 1: Try to get from Score.byPrinciple.topDrivers
  const scores = await Score.find({ projectId: projectIdObj }).lean();
  
  let topDrivers = [];
  
  // Extract topDrivers from all principles in all scores
  scores.forEach(score => {
    if (score.byPrinciple) {
      Object.values(score.byPrinciple).forEach(principle => {
        if (principle && principle.topDrivers && Array.isArray(principle.topDrivers)) {
          topDrivers.push(...principle.topDrivers);
        }
      });
    }
  });
  
  console.log(`📊 [buildTopRiskDriversTable] Extracted ${topDrivers.length} drivers from scores`);
  
  // Step 2: If no drivers found, compute on-the-fly from responses
  if (topDrivers.length === 0) {
    console.warn('⚠️  No topDrivers in scores, computing from responses...');
    
    const responses = await Response.find({ projectId: projectIdObj })
      .populate('answers.questionId')
      .lean();
    
    const driverMap = {};
    
    responses.forEach(resp => {
      if (!resp.answers) return;
      
      resp.answers.forEach(ans => {
        const q = ans.questionId;
        if (!q || !q.questionRiskImportance) return;
        
        const questionIdStr = q._id.toString();
        const erc = (q.questionRiskImportance || 0) * (ans.answerSeverity || 0.5);
        
        if (!driverMap[questionIdStr] || driverMap[questionIdStr].erc < erc) {
          driverMap[questionIdStr] = {
            questionId: q._id,
            questionCode: q.code || q.questionCode,
            questionText: q.text || q.question,
            principle: q.principle,
            riskImportance: q.questionRiskImportance,
            answerSeverity: ans.answerSeverity || 0.5,
            computedERC: erc,
            answerSnippet: extractAnswerSnippet(ans.answer)
          };
        }
      });
    });
    
    topDrivers = Object.values(driverMap);
    console.log(`✅ Computed ${topDrivers.length} drivers from responses`);
  }
  
  // Step 3: Sort by ERC and take top 5
  const sorted = topDrivers
    .filter(d => d.computedERC > 0) // Only include questions with actual risk
    .sort((a, b) => b.computedERC - a.computedERC)
    .slice(0, 5);
  
  // Step 4: Get answer snippets (if not already present)
  for (const driver of sorted) {
    if (!driver.answerSnippet) {
      // Fetch from responses
      const response = await Response.findOne({
        projectId: projectIdObj,
        'answers.questionId': driver.questionId
      }).select('answers').lean();
      
      if (response && response.answers) {
        const answer = response.answers.find(a => 
          a.questionId.toString() === driver.questionId.toString()
        );
        if (answer) {
          driver.answerSnippet = extractAnswerSnippet(answer.answer);
        }
      }
    }
  }
  
  return sorted;
}

function extractAnswerSnippet(answer) {
  if (!answer) return '—';
  
  // Text answer
  if (answer.text) {
    return answer.text.substring(0, 200) + (answer.text.length > 200 ? '...' : '');
  }
  
  // Choice answer
  if (answer.choiceKey) {
    return `Selected: ${answer.choiceKey}`;
  }
  
  // Multi-choice answer
  if (answer.multiChoiceKeys && answer.multiChoiceKeys.length > 0) {
    return `Selected: ${answer.multiChoiceKeys.join(', ')}`;
  }
  
  // Numeric answer
  if (answer.numeric !== undefined) {
    return `Value: ${answer.numeric}`;
  }
  
  return '—';
}
```

---

## Fix #3: Risk Label Consistency

### Problem
Same score (0.91) shown as "LOW" in one place, "Minimal" in another.

### Root Cause
Multiple risk classification functions with different thresholds:
- `riskLabelEN()` in reportMetricsService
- `getRiskLabel()` in riskScale.js (if exists)
- Inline risk classification in various files

### Solution

**Step 1: Ensure canonical thresholds in `backend/utils/riskScale.js`**

```javascript
const ERC_RISK_THRESHOLDS = {
  MINIMAL: { min: 0.0, max: 0.9, label: 'Minimal Risk', short: 'MINIMAL', color: '#10b981' },
  LOW: { min: 1.0, max: 1.9, label: 'Low Risk', short: 'LOW', color: '#84cc16' },
  MEDIUM: { min: 2.0, max: 2.9, label: 'Medium Risk', short: 'MEDIUM', color: '#f59e0b' },
  HIGH: { min: 3.0, max: 3.6, label: 'High Risk', short: 'HIGH', color: '#ef4444' },
  CRITICAL: { min: 3.7, max: 4.0, label: 'Critical Risk', short: 'CRITICAL', color: '#dc2626' }
};

function getRiskLabel(score, format = 'label') {
  if (score === null || score === undefined || isNaN(score)) return 'N/A';
  
  // Find matching threshold
  for (const [key, threshold] of Object.entries(ERC_RISK_THRESHOLDS)) {
    if (score >= threshold.min && score <= threshold.max) {
      return format === 'short' ? threshold.short : threshold.label;
    }
  }
  
  // Fallback for out-of-range scores
  if (score < 0) return 'Invalid';
  if (score > 4) return 'Out of Range';
  
  return 'Unknown';
}

function getRiskColor(score) {
  for (const threshold of Object.values(ERC_RISK_THRESHOLDS)) {
    if (score >= threshold.min && score <= threshold.max) {
      return threshold.color;
    }
  }
  return '#6b7280'; // Gray for unknown
}

module.exports = {
  ERC_RISK_THRESHOLDS,
  getRiskLabel,
  getRiskColor,
  // Legacy exports for backward compatibility
  riskLabelEN: getRiskLabel,
  riskLabelTR: (score) => {
    // Turkish translations
    const label = getRiskLabel(score);
    const translations = {
      'Minimal Risk': 'Minimum Risk',
      'Low Risk': 'Düşük Risk',
      'Medium Risk': 'Orta Risk',
      'High Risk': 'Yüksek Risk',
      'Critical Risk': 'Kritik Risk'
    };
    return translations[label] || label;
  },
  classifyRisk: getRiskLabel, // Alias
  colorForScore: getRiskColor
};
```

**Step 2: Update all imports to use canonical function**

**Files to update:**
- `backend/services/reportMetricsService.js` - use `getRiskLabel` from riskScale.js
- `backend/services/geminiService.js` - pass risk labels computed with `getRiskLabel`
- `backend/services/htmlReportTemplateService.js` - use `getRiskLabel` for inline labels
- `backend/controllers/reportController.js` - use `getRiskLabel` for validation

**Example import:**
```javascript
const { getRiskLabel, getRiskColor } = require('../utils/riskScale');

// Use everywhere:
const riskLabel = getRiskLabel(0.91); // → "Minimal Risk"
const riskLabelShort = getRiskLabel(0.91, 'short'); // → "MINIMAL"
const color = getRiskColor(0.91); // → "#10b981"
```

---

## Fix #4: Tension Table Fields

### Problem
Tension table shows:
- Evidence Types: N/A
- Claim: "Not provided"
- CreatedBy: "unknown"

### Root Cause
Mapping logic in `buildTensionsSummary` doesn't correctly extract fields from Tension documents.

### Solution

**File:** `backend/services/reportMetricsService.js`

**Add this helper function:**

```javascript
function buildTensionsSummary(tensions, creatorMap) {
  return tensions.map(t => {
    // Evidence types: extract from evidence array
    let evidenceTypes = 'None';
    if (t.evidence && Array.isArray(t.evidence) && t.evidence.length > 0) {
      const types = [...new Set(t.evidence.map(e => e.type || e.evidenceType || 'Other'))];
      evidenceTypes = types.join(', ');
    }
    
    // Claim: use claimStatement or claim field
    const claim = t.claimStatement || t.claim || '—';
    
    // CreatedBy: resolve from user map
    let createdBy = '—';
    if (t.createdBy) {
      const creatorIdStr = t.createdBy.toString ? t.createdBy.toString() : String(t.createdBy);
      const creator = creatorMap.get(creatorIdStr);
      createdBy = creator ? creator.name : creatorIdStr;
    }
    
    // ReviewState: normalize enum
    const reviewState = normalizeReviewState(t.status || t.reviewState || 'Proposed');
    
    // Severity: use severityLevel or severity
    const severity = t.severityLevel || t.severity || 'Unknown';
    
    // Evidence count
    const evidenceCount = t.evidence ? t.evidence.length : 0;
    
    // Consensus: extract from consensus object or votes
    let consensus = { agree: 0, disagree: 0, percentage: 0 };
    if (t.consensus) {
      consensus = {
        agree: t.consensus.agree || 0,
        disagree: t.consensus.disagree || 0,
        percentage: t.consensus.percentage || 0
      };
    } else if (t.votes) {
      const agree = t.votes.filter(v => v.vote === 'agree' || v.vote === 'accept').length;
      const disagree = t.votes.filter(v => v.vote === 'disagree' || v.vote === 'reject').length;
      const total = agree + disagree;
      consensus = {
        agree,
        disagree,
        percentage: total > 0 ? Math.round((agree / total) * 100) : 0
      };
    }
    
    return {
      _id: t._id,
      principle1: t.principle1 || t.principles?.[0] || 'Unknown',
      principle2: t.principle2 || t.principles?.[1] || 'Unknown',
      severity,
      evidenceCount,
      evidenceTypes,
      claim,
      createdBy,
      reviewState,
      consensus,
      proposedMitigations: t.proposedMitigations || [],
      tradeOffDecision: t.tradeOffDecision || null
    };
  });
}

function normalizeReviewState(status) {
  if (!status) return 'Proposed';
  
  const statusLower = String(status).toLowerCase();
  
  // Map various status values to canonical states
  if (statusLower.includes('accept')) return 'Accepted';
  if (statusLower.includes('disput')) return 'Disputed';
  if (statusLower.includes('review') || statusLower.includes('under')) return 'Under Review';
  if (statusLower.includes('resolv')) return 'Resolved';
  if (statusLower.includes('propos')) return 'Proposed';
  
  // Default
  return 'Proposed';
}
```

**Update in `buildReportMetrics`:**

```javascript
// Around line 640-652 where tensions are fetched

// Get tensions (all tensions for the project)
const tensions = await Tension.find({
  projectId: projectIdObj
}).lean();

// Get users for createdBy join (to avoid "unknown" in reports)
const tensionCreatorIds = [...new Set(tensions
  .map(t => t.createdBy?.toString())
  .filter(Boolean)
)];
const tensionCreators = await User.find({ _id: { $in: tensionCreatorIds } })
  .select('_id name email role')
  .lean();
const creatorMap = new Map(tensionCreators.map(u => [u._id.toString(), u]));

// Build tensions summary with correct field mapping
const tensionsSummary = buildTensionsSummary(tensions, creatorMap);
```

**Then use `tensionsSummary` in reportMetrics:**

```javascript
// Add to reportMetrics object (around line 1270)
tensionsSummary: {
  total: tensionsSummary.length,
  bySeverity: groupBy(tensionsSummary, 'severity'),
  byReviewState: groupBy(tensionsSummary, 'reviewState'),
  evidenceCoverage: calculateEvidenceCoverage(tensionsSummary),
  evidenceTypeDistribution: calculateEvidenceTypeDistribution(tensionsSummary),
  list: tensionsSummary
}
```

---

## Fix #5: Evaluator Count Consistency (Verification)

### Problem
Different sections show different counts (2/6 vs 2/5 vs 6).

### Root Cause
Multiple data sources and inconsistent counting logic.

### Verification Steps

**Check 1: Assigned Count Sources**

```javascript
// In buildReportMetrics, ensure single source:
const participation = await computeParticipation(projectId);
const evaluators = await getProjectEvaluators(projectId);

// CRITICAL: Use SAME counts everywhere
const CANONICAL_ASSIGNED = participation.assignedCount; // From ProjectAssignment
const CANONICAL_SUBMITTED = participation.submittedCount; // From responses with answers

console.log(`📊 CANONICAL COUNTS: Assigned=${CANONICAL_ASSIGNED}, Submitted=${CANONICAL_SUBMITTED}`);

// Use these in:
// - coverage.assignedExpertsCount = CANONICAL_ASSIGNED
// - coverage.expertsSubmittedCount = CANONICAL_SUBMITTED  
// - Executive Summary: "${CANONICAL_SUBMITTED}/${CANONICAL_ASSIGNED} evaluators"
// - Dashboard Summary: same
// - Appendix: same
```

**Check 2: Role-Based Counts**

```javascript
// Ensure no duplicates when counting by role
const roleStats = {};
const roleEvaluatorSet = {}; // Track unique evaluators per role

evaluators.assigned.forEach(e => {
  const role = e.role || 'unknown';
  if (!roleStats[role]) {
    roleStats[role] = { assigned: 0, submitted: 0 };
    roleEvaluatorSet[role] = new Set();
  }
  // CRITICAL: Only count each userId once per role
  if (!roleEvaluatorSet[role].has(e.userId)) {
    roleStats[role].assigned++;
    roleEvaluatorSet[role].add(e.userId);
  }
});

// Count submitted (same logic - no duplicates)
evaluators.submitted.forEach(e => {
  const role = e.role || 'unknown';
  if (roleStats[role] && !roleEvaluatorSet[role].has(e.userId)) {
    roleStats[role].submitted++;
    // Don't add to set again if already in assigned
  }
});

// Verify sum matches canonical
const sumAssigned = Object.values(roleStats).reduce((sum, r) => sum + r.assigned, 0);
const sumSubmitted = Object.values(roleStats).reduce((sum, r) => sum + r.submitted, 0);

if (sumAssigned !== CANONICAL_ASSIGNED) {
  console.error(`❌ CRITICAL: Role-based assigned sum (${sumAssigned}) != canonical (${CANONICAL_ASSIGNED})`);
}
if (sumSubmitted !== CANONICAL_SUBMITTED) {
  console.error(`❌ CRITICAL: Role-based submitted sum (${sumSubmitted}) != canonical (${CANONICAL_SUBMITTED})`);
}
```

---

## Implementation Priority

1. **Fix #2 (Top Risk Drivers)** - HIGH PRIORITY
   - Directly impacts report usefulness
   - Relatively isolated fix (single service file)
   - Est. time: 30-60 minutes

2. **Fix #3 (Risk Label Consistency)** - MEDIUM-HIGH PRIORITY
   - Affects report credibility
   - Requires updates across multiple files
   - Est. time: 30-45 minutes

3. **Fix #4 (Tension Table)** - MEDIUM PRIORITY
   - Cosmetic but important for completeness
   - Isolated fix (reportMetricsService)
   - Est. time: 20-30 minutes

4. **Fix #5 (Evaluator Count Verification)** - LOW PRIORITY (verification only)
   - Likely already correct after previous fixes
   - Add validation logs to catch issues
   - Est. time: 15-20 minutes

---

## Testing After Fixes

1. Generate report
2. Check console logs for:
   - `[buildTopRiskDriversTable] Extracted X drivers from scores` (X > 0)
   - `CANONICAL COUNTS: Assigned=X, Submitted=Y` (consistent throughout)
   - No `CRITICAL` error messages

3. Check PDF for:
   - Top 5 risk drivers table with question text and answer snippets
   - Risk labels consistent (0.91 always shows same label)
   - Tension table with actual evidence types (not "N/A")
   - Evaluator counts consistent across all sections

---

**Total Est. Time:** 2-3 hours for all fixes + testing

**Status:** Ready for implementation  
**Next:** Implement fixes in order of priority

