/**
 * Chart Contract System
 * Guarantees that all required charts exist in the report, even as placeholders
 * Prevents preflight validation failures due to missing chart keys
 */

// Required charts that MUST exist in every report
const REQUIRED_CHARTS = [
  'principleBarChart',
  'principleEvaluatorHeatmap'
];

// Optional charts (generated only if data exists)
const OPTIONAL_CHARTS = [
  'evidenceCoverageDonut',
  'evidenceTypeDonut',
  'tensionSeverityChart',
  'tensionReviewStateChart',
  'ethicalImportanceRanking' // NEW: Expert prioritization chart
];

/**
 * Chart types
 */
const CHART_TYPES = {
  BAR: 'bar',
  HEATMAP: 'heatmap',
  DONUT: 'donut',
  PLACEHOLDER: 'placeholder'
};

/**
 * Chart status
 */
const CHART_STATUS = {
  READY: 'ready',        // Successfully generated with data
  PLACEHOLDER: 'placeholder', // Generated as placeholder (no data)
  ERROR: 'error'         // Generation failed, using placeholder
};

/**
 * Create a normalized chart result object
 * @param {Object} params - Chart parameters
 * @returns {Object} Normalized chart result
 */
function createChartResult({
  chartId,
  type = CHART_TYPES.PLACEHOLDER,
  status = CHART_STATUS.READY,
  title = '',
  subtitle = '',
  pngBuffer = null,
  pngBase64 = null,
  meta = {},
  data = null
}) {
  // Ensure we have either pngBuffer or pngBase64
  let finalBase64 = pngBase64;
  if (!finalBase64 && pngBuffer && Buffer.isBuffer(pngBuffer)) {
    finalBase64 = pngBuffer.toString('base64');
  }

  return {
    chartId,
    type,
    title,
    subtitle: subtitle || '',
    meta: {
      status,
      reason: meta.reason || '',
      generatedAt: new Date().toISOString(),
      source: meta.source || {},
      scale: meta.scale || { min: 0, max: 4, meaning: 'Higher = higher risk (ERC)' },
      ...meta
    },
    pngBase64: finalBase64 || '', // ALWAYS present
    data: data || null // Optional, for debugging
  };
}

/**
 * Create a placeholder chart result
 * @param {Object} params - Placeholder parameters
 * @returns {Object} Chart result with placeholder status
 */
function createPlaceholderChartResult({ chartId, title, reason = 'No data available' }) {
  return createChartResult({
    chartId,
    type: CHART_TYPES.PLACEHOLDER,
    status: CHART_STATUS.PLACEHOLDER,
    title,
    subtitle: '',
    pngBuffer: null,
    pngBase64: null,
    meta: {
      reason,
      source: {}
    },
    data: null
  });
}

/**
 * Create an error chart result (generation failed)
 * @param {Object} params - Error parameters
 * @returns {Object} Chart result with error status
 */
function createErrorChartResult({ chartId, title, error }) {
  return createChartResult({
    chartId,
    type: CHART_TYPES.PLACEHOLDER,
    status: CHART_STATUS.ERROR,
    title,
    subtitle: '',
    pngBuffer: null,
    pngBase64: null,
    meta: {
      reason: `Generation failed: ${error.message || error}`,
      error: error.message || String(error)
    },
    data: null
  });
}

/**
 * Generate a placeholder PNG image with text
 * Returns a PNG Buffer with white background and text explaining why the chart is not available
 * Uses chartjs-node-canvas if available, falls back to Puppeteer
 */
async function createPlaceholderChartPng({ chartId, title, reason = 'No data available' }) {
  try {
    // Try to use chartjs-node-canvas for consistency
    const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

    const width = 800;
    const height = 400;

    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: 'white'
    });

    // Create a minimal chart configuration that displays text
    const chartConfig = {
      type: 'bar',
      data: {
        labels: [''],
        datasets: [{
          label: reason,
          data: [0],
          backgroundColor: '#f3f4f6'
        }]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: [title, '', reason],
            font: { size: 16 },
            color: '#6b7280',
            padding: 20
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: { display: false },
          y: { display: false }
        }
      }
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(chartConfig);
    return buffer;
  } catch (canvasError) {
    console.warn(`⚠️ chartjs-node-canvas not available for placeholder, using Puppeteer fallback`);

    // Fallback to Puppeteer
    return await createPlaceholderChartPngPuppeteer({ title, reason });
  }
}

/**
 * Generate placeholder PNG using Puppeteer (fallback)
 */
async function createPlaceholderChartPngPuppeteer({ title, reason }) {
  const puppeteer = require('puppeteer');
  let browser;

  try {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 800px;
      height: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: white;
      font-family: Arial, sans-serif;
    }
    .title {
      font-size: 18px;
      font-weight: bold;
      color: #374151;
      margin-bottom: 20px;
      text-align: center;
    }
    .reason {
      font-size: 14px;
      color: #6b7280;
      text-align: center;
      max-width: 600px;
    }
  </style>
</head>
<body>
  <div class="title">${title}</div>
  <div class="reason">${reason}</div>
</body>
</html>
    `;

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 400 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const screenshot = await page.screenshot({
      type: 'png',
      omitBackground: false
    });

    return screenshot;
  } catch (error) {
    console.error('❌ Failed to generate placeholder chart PNG:', error);
    // Return empty buffer as last resort
    return Buffer.alloc(0);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Initialize chart container with placeholders for all required charts
 * Ensures that preflight validation will never fail due to missing keys
 * @param {String} projectId - Project ID
 * @param {String} questionnaireKey - Questionnaire key
 * @returns {Promise<Object>} Charts object with placeholders
 */
async function initializeRequiredCharts(projectId, questionnaireKey = null) {
  const charts = {};

  // Chart metadata
  const chartMetadata = {
    principleBarChart: {
      title: 'Ethical Principles Risk Overview',
      reason: 'No scoring data available for this project'
    },
    principleEvaluatorHeatmap: {
      title: 'Risk Distribution by Role and Principle',
      reason: 'No evaluator submissions available'
    }
  };

  // Initialize all required charts with placeholders
  for (const chartId of REQUIRED_CHARTS) {
    const metadata = chartMetadata[chartId] || { title: chartId, reason: 'No data available' };

    try {
      const placeholderPng = await createPlaceholderChartPng({
        chartId,
        title: metadata.title,
        reason: metadata.reason
      });

      charts[chartId] = createChartResult({
        chartId,
        type: CHART_TYPES.PLACEHOLDER,
        status: CHART_STATUS.PLACEHOLDER,
        title: metadata.title,
        pngBuffer: placeholderPng,
        meta: {
          reason: metadata.reason,
          source: {
            collections: [],
            projectId,
            questionnaireKey
          }
        }
      });
    } catch (error) {
      console.error(`❌ Failed to create placeholder for ${chartId}:`, error);
      // Even if placeholder generation fails, create a minimal chart object
      charts[chartId] = createChartResult({
        chartId,
        type: CHART_TYPES.PLACEHOLDER,
        status: CHART_STATUS.ERROR,
        title: metadata.title,
        pngBase64: '', // Empty but present
        meta: {
          reason: `Placeholder generation failed: ${error.message}`,
          error: error.message
        }
      });
    }
  }

  return charts;
}

/**
 * Validate that all required charts exist and have pngBase64
 * @param {Object} charts - Charts object to validate
 * @returns {Object} Validation result { valid: boolean, missing: string[], errors: string[] }
 */
function validateChartContract(charts) {
  const missing = [];
  const errors = [];

  for (const chartId of REQUIRED_CHARTS) {
    if (!charts[chartId]) {
      missing.push(chartId);
    } else if (!charts[chartId].pngBase64 && charts[chartId].pngBase64 !== '') {
      errors.push(`${chartId}: missing pngBase64`);
    }
  }

  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors
  };
}

module.exports = {
  REQUIRED_CHARTS,
  OPTIONAL_CHARTS,
  CHART_TYPES,
  CHART_STATUS,
  createChartResult,
  createPlaceholderChartResult,
  createErrorChartResult,
  createPlaceholderChartPng,
  initializeRequiredCharts,
  validateChartContract
};

