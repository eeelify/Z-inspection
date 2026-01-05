/**
 * Chart Generation Service using Puppeteer (No Native Dependencies)
 * Alternative to chartjs-node-canvas for Windows environments
 * Generates charts by rendering Chart.js in a headless browser
 */

const puppeteer = require('puppeteer');

/**
 * Generate chart image using Puppeteer and Chart.js
 * @param {Object} chartConfig - Chart.js configuration
 * @param {Number} width - Image width in pixels
 * @param {Number} height - Image height in pixels
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateChartImagePuppeteer(chartConfig, width = 1200, height = 600) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });

    // Create HTML with Chart.js CDN + datalabels plugin
    const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
  <style>
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0;
      padding: 20px;
      background: white;
    }
    #chartContainer {
      width: ${width}px;
      height: ${height}px;
      padding: 20px;
      box-sizing: border-box;
      background: white;
    }
    canvas {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <div id="chartContainer">
    <canvas id="chartCanvas" width="${width}" height="${height}"></canvas>
  </div>
  <script>
    const ctx = document.getElementById('chartCanvas').getContext('2d');
    const config = ${JSON.stringify(chartConfig)};
    // Register datalabels plugin
    if (typeof Chart !== 'undefined' && Chart.register && typeof ChartDataLabels !== 'undefined') {
      Chart.register(ChartDataLabels);
    }
    const chart = new Chart(ctx, config);
    
    // Wait for chart to fully render with animations
    chart.options.animation = {
      duration: 0 // Disable animation for faster rendering
    };
    chart.update();
    
    setTimeout(() => {
      window.chartReady = true;
    }, 2000);
  </script>
</body>
</html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait for chart to be ready
    await page.waitForFunction('window.chartReady === true', { timeout: 5000 });

    // Take screenshot of the chart container (better quality)
    const chartElement = await page.$('#chartContainer');
    const screenshot = await chartElement.screenshot({
      type: 'png'
    });

    return screenshot;
  } catch (error) {
    throw new Error(`Chart generation failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate a bar chart for ethical principles with average scores
 */
async function generatePrincipleBarChart(byPrincipleOverall) {
  // TASK B: Handle null values (missing principles) - show N/A, not 0
  const principles = Object.keys(byPrincipleOverall).filter(p => byPrincipleOverall[p] !== null);
  const scores = principles.map(p => {
    const data = byPrincipleOverall[p];
    // TASK B: If null, return null (will be handled specially in chart)
    return data && typeof data.avgScore === 'number' ? data.avgScore : 
           data && typeof data.avg === 'number' ? data.avg : null;
  });
  
  // Add N/A labels for missing principles
  const labels = principles.map((p, idx) => {
    if (scores[idx] === null) {
      return `${p} (N/A)`;
    }
    return p;
  });

  const chartConfig = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average Score',
        data: scores,
        backgroundColor: scores.map(s => {
          // TASK 3 & 5: Handle null (N/A) - use gray color, preserve null values
          if (s === null || s === undefined || isNaN(s)) {
            return '#9ca3af'; // Gray for N/A
          }
          // TASK 7: Validate score range before using
          if (s < 0 || s > 4) {
            throw new Error(`INVALID SCORE FOR CHART: Score ${s} is outside valid range [0-4]`);
          }
          // CORRECT SCALE: 0 = MINIMAL RISK (green), 4 = CRITICAL RISK (red)
          // Higher score = Higher risk
          const { colorForScore } = require('../utils/riskUtils');
          return colorForScore(s);
        }),
        borderColor: '#ffffff',
        borderWidth: 3,
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: '7 Ethical Principles Score Overview',
          font: { size: 24, weight: 'bold', family: 'Arial, sans-serif' },
          padding: { top: 20, bottom: 20 }
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: { size: 14, family: 'Arial, sans-serif' },
            padding: 15,
            boxWidth: 20
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          formatter: (value) => {
            // TASK B: Show N/A for null values
            if (value === null || value === undefined) {
              return 'N/A';
            }
            return value.toFixed(2);
          },
          font: {
            size: 16,
            weight: 'bold',
            family: 'Arial, sans-serif'
          },
          color: '#1f2937',
          display: true,
          padding: 6
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 4,
          ticks: {
            font: { size: 14, family: 'Arial, sans-serif' },
            stepSize: 0.5
          },
          title: {
            display: true,
            text: 'Score (0-4, 0=MINIMAL risk, 4=CRITICAL risk)',
            font: { size: 16, weight: 'bold', family: 'Arial, sans-serif' },
            padding: { top: 10, bottom: 10 }
          },
          grid: {
            color: '#e5e7eb',
            lineWidth: 1
          }
        },
        x: {
          ticks: {
            font: { size: 12, family: 'Arial, sans-serif' },
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            display: false
          }
        }
      },
      layout: {
        padding: { left: 20, right: 20, top: 20, bottom: 20 }
      }
    }
  };

  return generateChartImagePuppeteer(chartConfig, 1200, 700);
}

/**
 * Generate role×principle heatmap
 */
async function generatePrincipleEvaluatorHeatmap(byPrincipleTable, evaluatorsWithScores) {
  // Implementation similar to chartjs-node-canvas version
  // but using Puppeteer
  const chartConfig = {
    type: 'bar',
    data: {
      labels: evaluatorsWithScores.map(e => e.name || e.role),
      datasets: [] // Build datasets for each principle
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Role × Principle Heatmap'
        }
      }
    }
  };

  return generateChartImagePuppeteer(chartConfig, 1400, 800);
}

/**
 * Generate evidence coverage donut chart
 */
async function generateEvidenceCoverageChart(evidenceTypeDistribution, tensionsWithEvidence = 0, totalTensions = 0) {
  const types = Object.keys(evidenceTypeDistribution || {});
  const counts = types.map(t => evidenceTypeDistribution[t]);

  const chartConfig = {
    type: 'doughnut',
    data: {
      labels: types.length > 0 ? types : ['No Evidence'],
      datasets: [{
        data: types.length > 0 ? counts : [totalTensions],
        backgroundColor: [
          '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `Evidence Coverage: ${totalTensions > 0 ? ((tensionsWithEvidence / totalTensions) * 100).toFixed(1) : 0}% (${tensionsWithEvidence}/${totalTensions} tensions)`,
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          display: true,
          position: 'right'
        },
        datalabels: {
          anchor: 'center',
          align: 'center',
          formatter: (value, context) => {
            const label = context.chart.data.labels[context.dataIndex];
            return `${label}: ${value}`;
          },
          font: {
            size: 11,
            weight: 'bold'
          },
          color: '#1f2937'
        }
      }
    }
  };

  return generateChartImagePuppeteer(chartConfig, 1000, 700);
}

  /**
   * Generate tension severity distribution chart
   */
  async function generateTensionSeverityChart(severityDistribution) {
    const severities = ['low', 'medium', 'high', 'critical'];
    const counts = severities.map(s => severityDistribution[s] || severityDistribution[s.toLowerCase()] || 0);
    
    const severityColors = {
      'low': '#10b981',
      'medium': '#f59e0b',
      'high': '#ef4444',
      'critical': '#dc2626'
    };
    
    const colors = severities.map(s => severityColors[s] || '#6b7280');
    
    const chartConfig = {
      type: 'bar',
      data: {
        labels: severities.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
        datasets: [{
          label: 'Number of Tensions',
          data: counts,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Ethical Tension Severity Distribution',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: false
          },
          datalabels: {
            anchor: 'end',
            align: 'top',
            formatter: (value) => value > 0 ? value : '',
            font: {
              size: 12,
              weight: 'bold'
            },
            color: '#1f2937'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Tensions'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Severity Level'
            }
          }
        }
      }
    };
    
    return generateChartImagePuppeteer(chartConfig, 1000, 700);
  }

  /**
   * Generate evidence type distribution chart (bar chart)
   */
  async function generateEvidenceTypeChart(evidenceTypeDistribution) {
    const types = Object.keys(evidenceTypeDistribution || {});
    const counts = types.map(t => evidenceTypeDistribution[t]);
    
    const typeColors = {
      'Policy': '#3b82f6',
      'Test': '#10b981',
      'User feedback': '#f59e0b',
      'Logs': '#8b5cf6',
      'Incident': '#ef4444',
      'Other': '#6b7280'
    };
    
    const colors = types.map(t => typeColors[t] || '#6b7280');
    
    const chartConfig = {
      type: 'bar',
      data: {
        labels: types.length > 0 ? types : ['No Evidence'],
        datasets: [{
          label: 'Evidence Count',
          data: types.length > 0 ? counts : [0],
          backgroundColor: types.length > 0 ? colors : ['#e5e7eb'],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Evidence Type Distribution',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: false
          },
          datalabels: {
            anchor: 'end',
            align: 'top',
            formatter: (value) => value > 0 ? value : '',
            font: {
              size: 12,
              weight: 'bold'
            },
            color: '#1f2937'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Count'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Evidence Type'
            }
          }
        }
      }
    };
    
    return generateChartImagePuppeteer(chartConfig, 1200, 700);
  }

  /**
   * Generate tension review state chart
   */
  async function generateTensionReviewStateChart(tensionsSummary) {
  // Include all possible review states, including "Resolved" if present
  const reviewStates = ['Proposed', 'Under Review', 'Accepted', 'Disputed', 'Resolved'];
  const counts = reviewStates.map(state => {
    // Try both normalized and original state keys
    const stateKey = state.toLowerCase().replace(/\s+/g, '');
    const stateKeyOriginal = state; // Also try original case
    return tensionsSummary.countsByReviewState?.[stateKey] || 
           tensionsSummary.countsByReviewState?.[stateKeyOriginal] || 
           tensionsSummary.countsByReviewState?.[state.toLowerCase()] || 0;
  });

  const chartConfig = {
    type: 'doughnut',
    data: {
      labels: reviewStates,
      datasets: [{
        data: counts,
        backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Tensions Review State Distribution',
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          display: true,
          position: 'right'
        },
        datalabels: {
          anchor: 'center',
          align: 'center',
          formatter: (value, context) => {
            const label = context.chart.data.labels[context.dataIndex];
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} (${pct}%)`;
          },
          font: {
            size: 11,
            weight: 'bold'
          },
          color: '#1f2937'
        }
      }
    }
  };

  return generateChartImagePuppeteer(chartConfig, 1000, 700);
}

/**
 * Generate team completion donut chart
 * Shows completion status: submitted vs assigned
 */
async function generateTeamCompletionDonut(coverage) {
  if (!coverage) {
    console.warn('⚠️  generateTeamCompletionDonut: coverage data missing, returning null');
    return null;
  }

  // DEĞİŞİKLİK: Artık sadece submit edenleri gösteriyoruz, assignedCount'a bakmıyoruz
  const submitted = coverage.expertsSubmittedCount || 0;

  if (submitted === 0) {
    console.warn('⚠️  generateTeamCompletionDonut: no submitted experts, returning null');
    return null;
  }

  const chartConfig = {
    type: 'doughnut',
    data: {
      labels: ['Submitted'],
      datasets: [{
        label: 'Team Completion',
        data: [submitted],
        backgroundColor: ['#10b981'], // Green for submitted
        borderColor: '#ffffff',
        borderWidth: 3,
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Team Completion: ${submitted} Expert${submitted > 1 ? 's' : ''} Submitted`,
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          display: true,
          position: 'bottom'
        },
        datalabels: {
          anchor: 'center',
          align: 'center',
          formatter: (value, ctx) => {
            return `${value}`;
          },
          font: {
            size: 12,
            weight: 'bold'
          },
          color: '#ffffff'
        }
      }
    }
  };

  return generateChartImagePuppeteer(chartConfig, 1000, 700);
}

/**
 * Generate all charts for a report using the chart contract
 * Guarantees that all required charts exist, even as placeholders
 * @param {Object} reportData - Report data containing scoring, evaluators, tensions, etc.
 * @returns {Promise<Object>} Charts object with all required charts
 */
async function generateAllCharts(reportData) {
  const {
    createChartResult,
    createPlaceholderChartResult,
    createErrorChartResult,
    initializeRequiredCharts,
    CHART_STATUS,
    CHART_TYPES
  } = require('./chartContract');

  const { projectId, questionnaireKey, scoring, evaluators, tensions, coverage } = reportData;

  // Step 1: Initialize with placeholders for all required charts
  console.log('📊 Initializing required charts with placeholders (Puppeteer)...');
  const charts = await initializeRequiredCharts(projectId, questionnaireKey);

  const chartErrors = [];

  // Step 2: Attempt to generate principleBarChart
  try {
    if (scoring?.byPrincipleOverall && Object.keys(scoring.byPrincipleOverall).length > 0) {
      console.log('📊 Generating principleBarChart (Puppeteer)...');
      const pngBuffer = await generatePrincipleBarChart(scoring.byPrincipleOverall);
      
      if (pngBuffer && Buffer.isBuffer(pngBuffer) && pngBuffer.length > 0) {
        charts.principleBarChart = createChartResult({
          chartId: 'principleBarChart',
          type: CHART_TYPES.BAR,
          status: CHART_STATUS.READY,
          title: 'Ethical Principles Risk Overview',
          subtitle: 'ERC scores by principle (0-4 scale)',
          pngBuffer,
          meta: {
            source: {
              collections: ['scores'],
              projectId,
              questionnaireKey
            },
            scale: { min: 0, max: 4, meaning: 'Higher = higher risk (ERC)' }
          },
          data: scoring.byPrincipleOverall
        });
        console.log('✅ principleBarChart generated successfully (Puppeteer)');
      } else {
        throw new Error('Generated buffer is empty or invalid');
      }
    } else {
      console.log('ℹ️ No principle data available, keeping placeholder for principleBarChart');
    }
  } catch (error) {
    console.error('❌ principleBarChart generation failed (Puppeteer):', error.message);
    chartErrors.push({ chart: 'principleBarChart', error: error.message });
    charts.principleBarChart = createErrorChartResult({
      chartId: 'principleBarChart',
      title: 'Ethical Principles Risk Overview',
      error
    });
    // Generate placeholder PNG for error case
    try {
      const { createPlaceholderChartPng } = require('./chartContract');
      const placeholderPng = await createPlaceholderChartPng({
        chartId: 'principleBarChart',
        title: 'Ethical Principles Risk Overview',
        reason: `Chart generation failed: ${error.message}`
      });
      charts.principleBarChart.pngBase64 = placeholderPng.toString('base64');
    } catch (placeholderError) {
      console.error('❌ Failed to generate placeholder for principleBarChart:', placeholderError);
    }
  }

  // Step 3: Attempt to generate principleEvaluatorHeatmap
  try {
    if (scoring?.byPrincipleTable && 
        Object.keys(scoring.byPrincipleTable).length > 0 &&
        evaluators?.withScores && 
        evaluators.withScores.length > 0) {
      console.log('📊 Generating principleEvaluatorHeatmap (Puppeteer)...');
      const pngBuffer = await generatePrincipleEvaluatorHeatmap(
        scoring.byPrincipleTable,
        evaluators.withScores
      );
      
      if (pngBuffer && Buffer.isBuffer(pngBuffer) && pngBuffer.length > 0) {
        charts.principleEvaluatorHeatmap = createChartResult({
          chartId: 'principleEvaluatorHeatmap',
          type: CHART_TYPES.HEATMAP,
          status: CHART_STATUS.READY,
          title: 'Risk Distribution by Role and Principle',
          subtitle: `${evaluators.withScores.length} evaluator(s)`,
          pngBuffer,
          meta: {
            source: {
              collections: ['scores', 'responses'],
              projectId,
              questionnaireKey
            },
            evaluatorCount: evaluators.withScores.length,
            scale: { min: 0, max: 4, meaning: 'Higher = higher risk (ERC)' }
          },
          data: {
            byPrincipleTable: scoring.byPrincipleTable,
            evaluators: evaluators.withScores.map(e => ({ role: e.role, userId: e.userId }))
          }
        });
        console.log('✅ principleEvaluatorHeatmap generated successfully (Puppeteer)');
      } else {
        throw new Error('Generated buffer is empty or invalid');
      }
    } else {
      console.log('ℹ️ No evaluator/principle data available, keeping placeholder for principleEvaluatorHeatmap');
    }
  } catch (error) {
    console.error('❌ principleEvaluatorHeatmap generation failed (Puppeteer):', error.message);
    chartErrors.push({ chart: 'principleEvaluatorHeatmap', error: error.message });
    charts.principleEvaluatorHeatmap = createErrorChartResult({
      chartId: 'principleEvaluatorHeatmap',
      title: 'Risk Distribution by Role and Principle',
      error
    });
    // Generate placeholder PNG for error case
    try {
      const { createPlaceholderChartPng } = require('./chartContract');
      const placeholderPng = await createPlaceholderChartPng({
        chartId: 'principleEvaluatorHeatmap',
        title: 'Risk Distribution by Role and Principle',
        reason: `Chart generation failed: ${error.message}`
      });
      charts.principleEvaluatorHeatmap.pngBase64 = placeholderPng.toString('base64');
    } catch (placeholderError) {
      console.error('❌ Failed to generate placeholder for principleEvaluatorHeatmap:', placeholderError);
    }
  }

  // Step 4: Generate optional charts (evidence, tensions)
  try {
    if (coverage?.evidenceMetrics) {
      console.log('📊 Generating evidenceCoverageChart (Puppeteer)...');
      const pngBuffer = await generateEvidenceCoverageChart(coverage.evidenceMetrics);
      if (pngBuffer && Buffer.isBuffer(pngBuffer)) {
        charts.evidenceCoverageDonut = createChartResult({
          chartId: 'evidenceCoverageDonut',
          type: CHART_TYPES.DONUT,
          status: CHART_STATUS.READY,
          title: 'Evidence Coverage',
          pngBuffer,
          meta: { source: { collections: ['tensions'], projectId } }
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ evidenceCoverageChart generation failed (optional, Puppeteer):', error.message);
    chartErrors.push({ chart: 'evidenceCoverageDonut', error: error.message });
  }

  try {
    if (tensions?.summary?.evidenceTypeDistribution) {
      console.log('📊 Generating evidenceTypeChart (Puppeteer)...');
      const pngBuffer = await generateEvidenceTypeChart(tensions.summary.evidenceTypeDistribution);
      if (pngBuffer && Buffer.isBuffer(pngBuffer)) {
        charts.evidenceTypeDonut = createChartResult({
          chartId: 'evidenceTypeDonut',
          type: CHART_TYPES.DONUT,
          status: CHART_STATUS.READY,
          title: 'Evidence Type Distribution',
          pngBuffer,
          meta: { source: { collections: ['tensions'], projectId } }
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ evidenceTypeChart generation failed (optional, Puppeteer):', error.message);
    chartErrors.push({ chart: 'evidenceTypeDonut', error: error.message });
  }

  try {
    if (tensions?.list && tensions.list.length > 0) {
      console.log('📊 Generating tensionSeverityChart (Puppeteer)...');
      const severityDist = { low: 0, medium: 0, high: 0, critical: 0 };
      tensions.list.forEach(t => {
        const severity = String(t.severityLevel || t.severity || 'medium').toLowerCase();
        if (severityDist.hasOwnProperty(severity)) severityDist[severity]++;
        else severityDist.medium++;
      });
      const pngBuffer = await generateTensionSeverityChart(severityDist);
      if (pngBuffer && Buffer.isBuffer(pngBuffer)) {
        charts.tensionSeverityChart = createChartResult({
          chartId: 'tensionSeverityChart',
          type: CHART_TYPES.BAR,
          status: CHART_STATUS.READY,
          title: 'Tension Severity Distribution',
          pngBuffer,
          meta: { source: { collections: ['tensions'], projectId } }
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ tensionSeverityChart generation failed (optional, Puppeteer):', error.message);
    chartErrors.push({ chart: 'tensionSeverityChart', error: error.message });
  }

  try {
    if (tensions?.summary) {
      console.log('📊 Generating tensionReviewStateChart (Puppeteer)...');
      const pngBuffer = await generateTensionReviewStateChart(tensions.summary);
      if (pngBuffer && Buffer.isBuffer(pngBuffer)) {
        charts.tensionReviewStateChart = createChartResult({
          chartId: 'tensionReviewStateChart',
          type: CHART_TYPES.DONUT,
          status: CHART_STATUS.READY,
          title: 'Tension Review Status',
          pngBuffer,
          meta: { source: { collections: ['tensions'], projectId } }
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ tensionReviewStateChart generation failed (optional, Puppeteer):', error.message);
    chartErrors.push({ chart: 'tensionReviewStateChart', error: error.message });
  }

  // Step 5: Validate contract compliance
  const { validateChartContract } = require('./chartContract');
  const validation = validateChartContract(charts);
  
  if (!validation.valid) {
    console.error('❌ Chart contract validation failed (Puppeteer):', validation);
    throw new Error(`Chart contract violation: ${validation.missing.concat(validation.errors).join(', ')}`);
  }

  console.log(`✅ Chart generation complete (Puppeteer): ${Object.keys(charts).length} charts, ${chartErrors.length} errors`);

  return {
    charts,
    chartErrors: chartErrors.length > 0 ? chartErrors : null
  };
}

module.exports = {
  generatePrincipleBarChart,
  generatePrincipleEvaluatorHeatmap,
  generateEvidenceCoverageChart,
  generateEvidenceTypeChart,
  generateTensionSeverityChart,
  generateTensionReviewStateChart,
  generateTeamCompletionDonut,
  generateChartImage: generateChartImagePuppeteer,
  generateAllCharts // Add the new orchestration function
};

