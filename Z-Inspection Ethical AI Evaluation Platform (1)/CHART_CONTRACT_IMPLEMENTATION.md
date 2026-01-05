# Chart Contract System - Implementation Summary

## Overview
Implemented an end-to-end Chart Contract system that guarantees all required charts exist in reports, even as placeholders, preventing preflight validation failures.

## Problem Solved
**Previous Issue:** Report generation failed with error:
```
Preflight validation failed: Missing required charts: principleBarChart, principleEvaluatorHeatmap
```

**Root Cause:**
- Charts were generated conditionally based on data availability
- If data was missing, chart keys were not added to `chartImages` object
- Preflight validator expected chart keys to exist, causing hard failures

## Solution Architecture

### 1. Chart Contract System (`backend/services/chartContract.js`)

#### Required Charts
```javascript
const REQUIRED_CHARTS = [
  'principleBarChart',        // 7 ethical principles bar chart
  'principleEvaluatorHeatmap' // Role × Principle heatmap
];
```

#### Chart Result Object Structure
```javascript
{
  chartId: string,           // Unique chart identifier
  type: 'bar'|'heatmap'|'placeholder',
  title: string,             // Human-readable title
  subtitle: string,          // Optional subtitle
  meta: {
    status: 'ready'|'placeholder'|'error',
    reason: string,          // Why placeholder/error
    generatedAt: ISO string,
    source: {
      collections: ['scores'|'responses'|'tensions'],
      projectId: string,
      questionnaireKey: string|null
    },
    scale: { min: 0, max: 4, meaning: 'Higher = higher risk (ERC)' }
  },
  pngBase64: string,         // ALWAYS present (base64 without data: prefix)
  data: any|null             // Optional raw data for debugging
}
```

#### Key Functions
- **`createChartResult()`**: Factory for normalized chart objects
- **`createPlaceholderChartResult()`**: Factory for placeholder charts
- **`createErrorChartResult()`**: Factory for error charts
- **`createPlaceholderChartPng()`**: Generates PNG image with text (uses chartjs-node-canvas or Puppeteer fallback)
- **`initializeRequiredCharts()`**: Creates placeholder chart objects for all required charts
- **`validateChartContract()`**: Validates that all required charts exist with pngBase64

### 2. Chart Generation Service Updates (`backend/services/chartGenerationService.js`)

#### New `generateAllCharts()` Function
Orchestrates chart generation with contract compliance:

```javascript
async function generateAllCharts(reportData) {
  // Step 1: Initialize with placeholders
  const charts = await initializeRequiredCharts(projectId, questionnaireKey);
  
  // Step 2: Attempt to generate principleBarChart
  // - If data exists & generation succeeds → replace with ready chart
  // - If generation fails → keep placeholder with error status
  
  // Step 3: Attempt to generate principleEvaluatorHeatmap
  // - If data exists & generation succeeds → replace with ready chart
  // - If generation fails → keep placeholder with error status
  
  // Step 4: Generate optional charts (evidence, tensions)
  // - These don't need placeholders if they fail
  
  // Step 5: Validate contract compliance
  const validation = validateChartContract(charts);
  if (!validation.valid) throw new Error(...);
  
  return { charts, chartErrors };
}
```

**Benefits:**
- Guarantees all required charts exist
- Gracefully handles missing data (returns placeholder)
- Gracefully handles generation errors (returns placeholder with error message)
- Never throws due to missing chart keys

### 3. Preflight Validator Updates (`backend/utils/reportPreflightValidator.js`)

#### Updated Chart Validation Logic
```javascript
// OLD (caused failures):
if (!chartImages[chartId] || !chartImages[chartId].startsWith('data:image/')) {
  errors.push('Missing required charts...');
}

// NEW (contract-aware):
const validation = validateChartContract(chartImages);
if (!validation.valid) {
  // Only fail if keys are missing or pngBase64 is missing
  // Placeholders and errors are VALID
}
```

**Key Changes:**
- Validates **key presence only**, not data availability
- Charts with status='placeholder' or 'error' are VALID
- Only missing keys or missing pngBase64 cause errors
- Warnings (not errors) for placeholders/errors

### 4. Report Controller Updates (`backend/controllers/reportController.js`)

#### Simplified Chart Generation Flow
```javascript
// OLD (complex, conditional):
if (reportMetrics.scoring?.byPrincipleOverall) {
  try {
    chartImages.principleBarChart = await generatePrincipleBarChart(...);
  } catch (err) {
    // chartImages.principleBarChart remains undefined
  }
}
// ... 100+ lines of conditional chart generation

// NEW (unified, contract-based):
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

**Conversion to Data URIs:**
```javascript
// Chart Contract objects have .pngBase64 (without data: prefix)
// HTML template expects data:image/png;base64,... strings
const chartImages = {};
for (const [chartId, chartResult] of Object.entries(chartResults)) {
  if (chartResult.pngBase64) {
    chartImages[chartId] = chartResult.pngBase64.startsWith('data:image/') 
      ? chartResult.pngBase64
      : `data:image/png;base64,${chartResult.pngBase64}`;
  }
}
```

### 5. HTML Template Updates (`backend/services/htmlReportTemplateService.js`)

#### Enhanced Chart Helper Functions
```javascript
// OLD:
const getChartImage = (key) => {
  if (!chartImages[key]) return '';
  // Convert Buffer/string to data URI
};

// NEW (contract-aware):
const getChartImage = (key) => {
  const img = chartImages[key];
  
  // Chart Contract object (has .pngBase64 and .meta)
  if (typeof img === 'object' && img.pngBase64) {
    return img.pngBase64.startsWith('data:image/') 
      ? img.pngBase64
      : `data:image/png;base64,${img.pngBase64}`;
  }
  
  // Legacy formats (Buffer, string, etc.)
  // ... existing conversion logic
};

const getChartStatus = (key) => {
  // Returns { status, reason, title } for displaying notes
};
```

#### Placeholder-Aware Chart Display
```html
<!-- Principle Bar Chart -->
<div class="chart-container">
  <h3>Ethical Principles Score Overview</h3>
  ${getChartImage('principleBarChart') ? `
    <img src="${getChartImage('principleBarChart')}" alt="..." />
    ${(() => {
      const status = getChartStatus('principleBarChart');
      if (status && (status.status === 'placeholder' || status.status === 'error')) {
        return `<p style="...">
          <strong>⚠️ Chart Not Available:</strong> ${status.reason}
        </p>`;
      }
      return '';
    })()}
  ` : `
    <p style="...">
      <strong>⚠️ Chart Not Available:</strong> No principle score data available.
    </p>
  `}
  <div class="chart-legend">
    <!-- Scale legend, methodology notes -->
  </div>
</div>
```

## Evaluator Mapping Fix

**Issue:** User reported concern about evaluators being hardcoded ("2 per role").

**Solution:** 
- `getProjectEvaluators()` already uses `ProjectAssignment` collection to fetch actual project assignments
- Evaluators reflect ACTUAL ASSIGNED USERS from the database, not hardcoded values
- Updated HTML template legend to clarify: "Evaluators reflect ACTUAL PROJECT ASSIGNMENTS from the team/assignments collection"

**Data Flow:**
```
ProjectAssignment.find({ projectId })
  → Get actual assigned users
  → Cross-reference with Response documents (with answers)
  → Cross-reference with Score documents
  → Return only evaluators who submitted data
```

## Testing & Validation

### Contract Validation
```javascript
// Automatically validates before returning charts
const validation = validateChartContract(charts);
// { valid: true/false, missing: [], errors: [] }
```

### Placeholder Generation
- Uses `chartjs-node-canvas` for consistency (primary)
- Falls back to Puppeteer if canvas not available
- Returns PNG buffer with title + reason text

### Error Handling
- Chart generation errors → placeholder with error message
- Missing data → placeholder with "No data available"
- Contract violations → hard failure (should never happen)

## Benefits

1. **No More Preflight Failures:** All required charts guaranteed to exist
2. **Graceful Degradation:** Reports generate even when charts fail
3. **Clear User Feedback:** Placeholder images explain why charts are missing
4. **Maintainability:** Centralized chart contract definition
5. **Type Safety:** Consistent chart object structure
6. **Debugging:** Chart status and error messages logged
7. **Backward Compatible:** Supports legacy chart formats

## Files Modified

### New Files
- `backend/services/chartContract.js` (367 lines)

### Modified Files
- `backend/services/chartGenerationService.js` (+260 lines)
- `backend/utils/reportPreflightValidator.js` (~50 lines refactored)
- `backend/controllers/reportController.js` (~200 lines simplified)
- `backend/services/htmlReportTemplateService.js` (+60 lines)

## Usage Example

```javascript
// In reportController.js
const { generateAllCharts } = require('../services/chartGenerationService');

const chartGenerationResult = await generateAllCharts({
  projectId: '507f1f77bcf86cd799439011',
  questionnaireKey: null,
  scoring: reportMetrics.scoring,
  evaluators: { withScores: [...] },
  tensions: { summary: {...}, list: [...] },
  coverage: { evidenceMetrics: {...} }
});

// chartGenerationResult.charts ALWAYS contains all required charts
// - status='ready' if generated successfully
// - status='placeholder' if no data
// - status='error' if generation failed (still has pngBase64)

// Pass to HTML template
const html = generateHTMLReport(reportMetrics, narrative, chartGenerationResult.charts, ...);
```

## Current Chart Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│ 1. reportController.js                                       │
│    - Calls chartGenerationService.generateAllCharts()        │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ 2. chartGenerationService.js                                 │
│    - Initialize with placeholders (chartContract)            │
│    - Attempt to generate each required chart                 │
│    - Replace placeholders with ready charts (if successful)  │
│    - Keep placeholders for errors/missing data               │
│    - Validate contract compliance                            │
│    - Return { charts, chartErrors }                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ 3. Chart objects → Data URIs (reportController.js)           │
│    - Convert .pngBase64 to data:image/png;base64,...         │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ 4. reportPreflightValidator.js                               │
│    - Validate chart contract compliance                      │
│    - Check that all required charts exist with pngBase64     │
│    - Log warnings for placeholders/errors                    │
│    - Pass validation (placeholders are valid)                │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ 5. htmlReportTemplateService.js                              │
│    - getChartImage() extracts data URI from chart object     │
│    - getChartStatus() checks for placeholder/error           │
│    - Display chart OR placeholder note                       │
│    - Embed as <img src="data:image/png;base64,...">          │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ 6. pdfReportService.js (Puppeteer)                           │
│    - Render HTML with embedded chart images to PDF           │
└──────────────────────────────────────────────────────────────┘
```

## Notes

- **Gemini does NOT generate charts:** Charts are pre-generated server-side, Gemini only receives pre-computed metrics and generates narrative text
- **Charts are deterministic:** Same data → same chart (no AI/LLM involved in chart generation)
- **QuickChart/SVG alternatives:** Current implementation uses chartjs-node-canvas (with Puppeteer fallback). QuickChart.io or pure SVG could be added as additional fallback options if needed
- **Performance:** Chart generation is parallelized where possible; placeholders are generated only for required charts when needed

## Conclusion

The Chart Contract system provides a robust, maintainable solution that:
✅ Eliminates preflight validation failures
✅ Guarantees report generation continues even when charts fail
✅ Provides clear user feedback for missing/error charts
✅ Uses actual project assignments (not hardcoded evaluators)
✅ Maintains backward compatibility
✅ Follows enterprise-grade patterns (contract validation, factory functions, graceful degradation)

