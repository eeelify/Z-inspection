/**
 * Chart Generation Service
 * Generates deterministic charts as PNG images for embedding in DOCX reports
 * 
 * IMPORTANT: This service uses chartjs-node-canvas which requires native compilation.
 * On Windows, if you encounter build errors, use chartGenerationServicePuppeteer.js instead.
 * 
 * To switch to Puppeteer-based generation:
 * 1. In reportMetricsService.js, change: require('./chartGenerationService')
 *    to: require('./chartGenerationServicePuppeteer')
 */

// Try to use chartjs-node-canvas, fallback to Puppeteer if unavailable
let ChartJSNodeCanvas;
let usePuppeteer = false;

try {
  ChartJSNodeCanvas = require('chartjs-node-canvas');
  usePuppeteer = false;
} catch (error) {
  console.warn('⚠️ chartjs-node-canvas not available, falling back to Puppeteer-based chart generation');
  console.warn('   This is normal on Windows if Visual Studio Build Tools are not installed.');
  usePuppeteer = true;
}

// If using Puppeteer, delegate to the Puppeteer service
if (usePuppeteer) {
  module.exports = require('./chartGenerationServicePuppeteer');
} else {
  // Original chartjs-node-canvas implementation
  // Note: chartjs-plugin-datalabels must be installed: npm install chartjs-plugin-datalabels
  let ChartDataLabels;
  try {
    ChartDataLabels = require('chartjs-plugin-datalabels');
  } catch (e) {
    console.warn('⚠️ chartjs-plugin-datalabels not installed. Data labels will not appear on charts.');
    ChartDataLabels = null;
  }
  
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width: 800,
    height: 400,
    backgroundColour: 'white',
    plugins: ChartDataLabels ? [ChartDataLabels] : []
  });

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

    return generateChartImage(chartConfig, 800, 400);
  }

  /**
   * Generate role×principle heatmap
   */
  async function generatePrincipleEvaluatorHeatmap(byPrincipleTable, evaluatorsWithScores) {
    const width = 1000;
    const height = 500;
    
    // Build matrix data
    const principles = Object.keys(byPrincipleTable || {});
    const evaluatorNames = evaluatorsWithScores.map(e => e.name || `${e.role} (${e.userId})`);
    
    // Create datasets for each principle
    const datasets = principles.map((principle, idx) => {
      const data = evaluatorNames.map(name => {
        const evaluator = evaluatorsWithScores.find(e => (e.name || `${e.role} (${e.userId})`) === name);
        if (!evaluator) return null;
        const score = byPrincipleTable[principle]?.[evaluator.userId]?.avg;
        return score !== undefined && score !== null ? score : null;
      });
      
      return {
        label: principle,
        data: data,
        backgroundColor: `hsl(${idx * 60}, 70%, 50%)`,
        borderColor: '#ffffff',
        borderWidth: 1
      };
    });

    const chartConfig = {
      type: 'bar',
      data: {
        labels: evaluatorNames,
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Role × Principle Heatmap',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: true,
            position: 'right'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 4,
            title: {
              display: true,
              text: 'Score (0-4)'
            }
          }
        }
      }
    };

    return generateChartImage(chartConfig, width, height);
  }

  /**
   * Generate evidence coverage donut chart
   */
  async function generateEvidenceCoverageChart(evidenceTypeDistribution, tensionsWithEvidence = 0, totalTensions = 0) {
    const width = 600;
    const height = 500;
    
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
      type: 'doughnut',
      data: {
        labels: types.length > 0 ? types : ['No Evidence'],
        datasets: [{
          data: types.length > 0 ? counts : [totalTensions],
          backgroundColor: types.length > 0 ? colors : ['#e5e7eb'],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
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
    
    return generateChartImage(chartConfig, width, height);
  }

  /**
   * Generate tension review state chart
   */
  async function generateTensionReviewStateChart(tensionsSummary) {
    const width = 600;
    const height = 500;
    
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
          backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
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
    
    return generateChartImage(chartConfig, width, height);
  }

  /**
   * Helper: Generate chart image from Chart.js config
   */
  async function generateChartImage(chartConfig, width = 800, height = 400) {
    try {
      let canvas = chartJSNodeCanvas;
      if (width !== 800 || height !== 400) {
        canvas = new ChartJSNodeCanvas({
          width,
          height,
          backgroundColour: 'white',
          plugins: ChartDataLabels ? [ChartDataLabels] : []
        });
      }
      
      const buffer = await canvas.renderToBuffer(chartConfig);
      return buffer;
    } catch (error) {
      throw new Error(`Chart generation failed: ${error.message}`);
    }
  }

  module.exports = {
    generatePrincipleBarChart,
    generatePrincipleEvaluatorHeatmap,
    generateEvidenceCoverageChart,
    generateTensionReviewStateChart,
    generateChartImage
  };
}
