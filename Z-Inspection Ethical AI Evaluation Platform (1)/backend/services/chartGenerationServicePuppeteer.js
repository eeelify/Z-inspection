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
async function generateChartImagePuppeteer(chartConfig, width = 800, height = 400) {
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
      margin: 0;
      padding: 0;
      background: white;
    }
    #chartContainer {
      width: ${width}px;
      height: ${height}px;
    }
  </style>
</head>
<body>
  <canvas id="chartCanvas"></canvas>
  <script>
    const ctx = document.getElementById('chartCanvas').getContext('2d');
    const config = ${JSON.stringify(chartConfig)};
    // Register datalabels plugin
    if (typeof Chart !== 'undefined' && Chart.register) {
      Chart.register(ChartDataLabels);
    }
    const chart = new Chart(ctx, config);
    
    // Wait for chart to render
    setTimeout(() => {
      window.chartReady = true;
    }, 1500);
  </script>
</body>
</html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait for chart to be ready
    await page.waitForFunction('window.chartReady === true', { timeout: 5000 });

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height }
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
  const principles = Object.keys(byPrincipleOverall);
  const scores = principles.map(p => byPrincipleOverall[p].avg || 0);

  const chartConfig = {
    type: 'bar',
    data: {
      labels: principles,
      datasets: [{
        label: 'Average Score',
        data: scores,
        backgroundColor: scores.map(s => {
          // 0 = lowest risk, 4 = highest risk
          if (s >= 3.0 && s <= 4.0) return '#dc2626'; // Critical (red) - highest risk
          if (s >= 2.0 && s < 3.0) return '#ef4444'; // High (red-500)
          if (s >= 1.0 && s < 2.0) return '#f59e0b'; // Moderate (amber)
          return '#10b981'; // Low (emerald) - lowest risk
        }),
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
          text: '7 Ethical Principles Score Overview',
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          display: true,
          position: 'top'
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          formatter: (value) => value.toFixed(2),
          font: {
            size: 12,
            weight: 'bold'
          },
          color: '#1f2937',
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 4,
          title: {
            display: true,
            text: 'Score (0-4, 0=lowest risk, 4=highest risk)'
          }
        }
      }
    }
  };

  return generateChartImagePuppeteer(chartConfig, 800, 400);
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

  return generateChartImagePuppeteer(chartConfig, 1000, 500);
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

  return generateChartImagePuppeteer(chartConfig, 600, 500);
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

  return generateChartImagePuppeteer(chartConfig, 600, 500);
}

module.exports = {
  generatePrincipleBarChart,
  generatePrincipleEvaluatorHeatmap,
  generateEvidenceCoverageChart,
  generateTensionReviewStateChart,
  generateChartImage: generateChartImagePuppeteer
};

