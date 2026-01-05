# Fix: chartGenerationService.generateAllCharts is not a function

## Error
```
Error: Chart generation failed:
chartGenerationService.generateAllCharts is not a function
```

## Root Cause Analysis

### File Structure
```
backend/services/
├── chartGenerationService.js          (Primary - chartjs-node-canvas)
├── chartGenerationServicePuppeteer.js (Fallback - Puppeteer)
└── chartContract.js                   (Chart contract system)
```

### The Problem

**`chartGenerationService.js` (Lines 13-30):**
```javascript
let usePuppeteer = false;

try {
  ChartJSNodeCanvas = require('chartjs-node-canvas');
  usePuppeteer = false;
  console.log('✅ Using chartjs-node-canvas for chart generation');
} catch (error) {
  usePuppeteer = true;
}

// If using Puppeteer, delegate to the Puppeteer service
if (usePuppeteer) {
  module.exports = require('./chartGenerationServicePuppeteer'); // ❌ Complete replacement
} else {
  // ... rest of file with module.exports at end
}
```

**When `chartjs-node-canvas` fails to load (Windows):**
1. `usePuppeteer = true`
2. **ENTIRE `module.exports` is replaced** with `chartGenerationServicePuppeteer`
3. `chartGenerationServicePuppeteer.js` did NOT have `generateAllCharts`
4. Result: `generateAllCharts is not a function`

### Export Comparison

**chartGenerationService.js (Lines 877-888):**
```javascript
module.exports = {
  generatePrincipleBarChart,
  generatePrincipleEvaluatorHeatmap,
  generateEvidenceCoverageChart,
  generateEvidenceTypeChart,
  generateTensionSeverityChart,
  generateTensionReviewStateChart,
  generateTeamCompletionDonut,
  generateChartImage,
  generateAllCharts  // ✅ Exported
};
```

**chartGenerationServicePuppeteer.js (Original - Lines 576-585):**
```javascript
module.exports = {
  generatePrincipleBarChart,
  generatePrincipleEvaluatorHeatmap,
  generateEvidenceCoverageChart,
  generateEvidenceTypeChart,
  generateTensionSeverityChart,
  generateTensionReviewStateChart,
  generateTeamCompletionDonut,
  generateChartImage: generateChartImagePuppeteer
  // ❌ generateAllCharts was MISSING
};
```

## Solution

### 1. Added `generateAllCharts` to Puppeteer Service

**File:** `backend/services/chartGenerationServicePuppeteer.js`

Added the complete `generateAllCharts` function (260 lines) that:
- Initializes with placeholders using Chart Contract
- Attempts to generate each required chart
- Replaces placeholders with ready charts on success
- Keeps placeholders with error status on failure
- Validates chart contract compliance
- Returns `{ charts, chartErrors }`

**Updated export (Lines 576-586):**
```javascript
module.exports = {
  generatePrincipleBarChart,
  generatePrincipleEvaluatorHeatmap,
  generateEvidenceCoverageChart,
  generateEvidenceTypeChart,
  generateTensionSeverityChart,
  generateTensionReviewStateChart,
  generateTeamCompletionDonut,
  generateChartImage: generateChartImagePuppeteer,
  generateAllCharts  // ✅ Now exported
};
```

### 2. Added Defensive Runtime Check

**File:** `backend/controllers/reportController.js` (Line 5-13)

```javascript
const chartGenerationService = require('../services/chartGenerationService');

// Defensive runtime check: Ensure generateAllCharts is exported
if (typeof chartGenerationService.generateAllCharts !== 'function') {
  throw new Error(
    'CRITICAL: chartGenerationService.generateAllCharts is not a function. ' +
    'This usually means the Puppeteer fallback (chartGenerationServicePuppeteer.js) ' +
    'is missing the generateAllCharts export. Check module.exports in both chart services.'
  );
}
```

**Benefits:**
- Fails fast at startup, not during report generation
- Clear error message pointing to the exact problem
- Helps catch future export mismatches

## Export Structure (Now Consistent)

### CommonJS Pattern Used
Both services use **CommonJS** `module.exports`:

```javascript
// Pattern: Named exports object
module.exports = {
  function1,
  function2,
  generateAllCharts
};

// Usage: Named import
const chartGenerationService = require('./chartGenerationService');
chartGenerationService.generateAllCharts(...);
```

### Why This Pattern?
- ✅ Consistent with existing codebase (Node.js backend)
- ✅ No ESM/CommonJS mixing
- ✅ Explicit, stable public API
- ✅ Easy to understand and maintain

## Call Sites Verified

### reportController.js (Line 489)
```javascript
const chartGenerationResult = await chartGenerationService.generateAllCharts({
  projectId,
  questionnaireKey: null,
  scoring: reportMetrics.scoring,
  evaluators: evaluatorsData,
  tensions: tensionsSummary,
  coverage: coverageData
});

chartResults = chartGenerationResult.charts; // Always complete
chartErrors = chartGenerationResult.chartErrors;
```

**Status:** ✅ Correct usage, no changes needed

## Testing

### Verification Steps
1. **chartjs-node-canvas available:** Uses primary service with `generateAllCharts`
2. **chartjs-node-canvas missing (Windows):** Uses Puppeteer service with `generateAllCharts`
3. **Both services export the same API:** No breaking changes

### Log Output
```
✅ Using chartjs-node-canvas for chart generation
📊 Initializing required charts with placeholders...
```

OR

```
📊 Initializing required charts with placeholders (Puppeteer)...
✅ principleBarChart generated successfully (Puppeteer)
```

## Why This Error Occurred

1. **Conditional Module Replacement:**
   - `chartGenerationService.js` completely replaces `module.exports` based on runtime condition
   - This is a valid pattern but requires **both services to export the same API**

2. **Incremental Development:**
   - `generateAllCharts` was added to `chartGenerationService.js` (primary)
   - But NOT added to `chartGenerationServicePuppeteer.js` (fallback)
   - Windows users hit the fallback → missing function

3. **No Runtime Check:**
   - Error only occurred when calling the function
   - Not caught at startup or module load time

## Lessons Learned

### Best Practices for Dual Implementations

1. **Keep APIs Synchronized:**
   ```javascript
   // Both files MUST export the same functions
   module.exports = {
     sharedFunction1,
     sharedFunction2,
     newFunction  // Add to BOTH files
   };
   ```

2. **Add Runtime Validation:**
   ```javascript
   // At import site, verify expected functions exist
   if (typeof service.expectedFunction !== 'function') {
     throw new Error('Missing expected export');
   }
   ```

3. **Document the Contract:**
   ```javascript
   // At top of both files:
   /**
    * PUBLIC API (must be identical in both implementations):
    * - generatePrincipleBarChart(data)
    * - generateAllCharts(reportData)
    * - ... etc
    */
   ```

4. **Consider Shared Interface:**
   ```javascript
   // Option: Create chartGenerationInterface.js
   // Both implementations must satisfy this interface
   ```

## Changes Summary

### Files Modified
1. **`backend/services/chartGenerationServicePuppeteer.js`**
   - Added `generateAllCharts` function (~260 lines)
   - Updated `module.exports` to include `generateAllCharts`

2. **`backend/controllers/reportController.js`**
   - Added defensive runtime check for `generateAllCharts`

### Files NOT Changed
- `backend/services/chartGenerationService.js` (already had `generateAllCharts`)
- `backend/services/chartContract.js` (no changes needed)
- No changes to chart rendering logic or PDF output

## Impact

- ✅ **Windows users can now generate reports** (Puppeteer fallback works)
- ✅ **Linux/Mac users unaffected** (chartjs-node-canvas still works)
- ✅ **Consistent API** between both implementations
- ✅ **Fail-fast validation** catches future export mismatches
- ✅ **No breaking changes** to existing functionality

## Verification Commands

```bash
# Test with chartjs-node-canvas (if available)
npm start
# Generate a report

# Test Puppeteer fallback (simulate Windows)
# Temporarily rename node_modules/chartjs-node-canvas
npm start
# Generate a report - should see "(Puppeteer)" in logs
```

