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
  console.log('✅ Using chartjs-node-canvas for chart generation');
} catch (error) {
  // Silently fall back to Puppeteer - this is expected on Windows
  // Puppeteer-based chart generation works without native dependencies
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
   * TASK B: Handle null values (missing principles) - show N/A, not 0
   */
  async function generatePrincipleBarChart(byPrincipleOverall) {
    // Filter out null principles for display (or show as N/A)
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
            formatter: (value) => {
              // TASK B: Show N/A for null values
              if (value === null || value === undefined) {
                return 'N/A';
              }
              return value.toFixed(2);
            },
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
                text: 'Score (0-4, 0=MINIMAL risk, 4=CRITICAL risk)'
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
   * Generate tension severity distribution chart
   */
  async function generateTensionSeverityChart(severityDistribution) {
    const width = 600;
    const height = 500;
    
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
    
    return generateChartImage(chartConfig, width, height);
  }

  /**
   * Generate evidence type distribution chart (bar chart)
   */
  async function generateEvidenceTypeChart(evidenceTypeDistribution) {
    const width = 800;
    const height = 400;
    
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
          borderWidth: 2
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
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${value} (${percentage}%)`;
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

    return generateChartImage(chartConfig, 600, 500);
  }

  module.exports = {
    generatePrincipleBarChart,
    generatePrincipleEvaluatorHeatmap,
    generateEvidenceCoverageChart,
    generateEvidenceTypeChart,
    generateTensionSeverityChart,
    generateTensionReviewStateChart,
    generateTeamCompletionDonut,
    generateChartImage
  };
}
