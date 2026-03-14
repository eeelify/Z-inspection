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
  // NATIVE BINDING FIX: Force Puppeteer
  // The 'canvas' module requires native bindings that often fail on Windows/Node 22+.
  // We skip trying to require('chartjs-node-canvas') entirely to prevent crashes.
  const chartjsModule = null; // DISABLED
  ChartJSNodeCanvas = null;   // DISABLED

  // Force Puppeteer
  throw new Error('Force Puppeteer Fallback (Native canvas disabled)');


  usePuppeteer = false;
  console.log('✅ Using chartjs-node-canvas for chart generation');
} catch (error) {
  // Fall back to Puppeteer - this is expected on Windows or if chartjs-node-canvas fails
  console.log('⚠️ chartjs-node-canvas not available, using Puppeteer fallback');
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
    // Validate input
    if (!byPrincipleOverall || typeof byPrincipleOverall !== 'object') {
      throw new Error('byPrincipleOverall must be a non-null object');
    }

    // Filter out null principles for display (or show as N/A)
    const principles = Object.keys(byPrincipleOverall).filter(p => byPrincipleOverall[p] !== null);

    if (principles.length === 0) {
      throw new Error('No valid principles found in byPrincipleOverall');
    }
    const scores = principles.map(p => {
      const data = byPrincipleOverall[p];
      // TASK B: If null, return null (will be handled specially in chart)
      if (!data) return null;

      // NEW FORMAT (Risk-based): use risk
      if (typeof data.risk === 'number') return data.risk;
      if (typeof data.overallRisk === 'number') return data.overallRisk;

      // LEGACY/FALLBACK: use avg or avgScore (assumed to be risk now)
      if (typeof data.avg === 'number') return data.avg;
      if (typeof data.avgScore === 'number') return data.avgScore;

      return null;
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
            // TASK 7: Validate score range (Cumulative can exceed 4)
            if (s < 0) {
              throw new Error(`INVALID SCORE FOR CHART: Score ${s} cannot be negative`);
            }
            // RISK MODE: Low score = Safe (green), High score = Critical (red)
            const { colorForScore } = require('../utils/riskScale');
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
            text: '7 Ethical Principles Risk Overview (0-4 Scale)',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: true,
            position: 'top'
          },
          subtitle: {
            display: true,
            text: 'Risk Scale: 0=MINIMAL, 1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL (Lower = Better)',
            font: { size: 11, style: 'italic' },
            padding: { bottom: 10 }
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
            // max: 4, // REMOVED for Cumulative Risk (Unbounded)
            title: {
              display: true,
              text: 'Cumulative Risk Score (Lower is Safer)'
            }
          }
        }
      }
    };

    return generateChartImage(chartConfig, 800, 400);
  }

  /**
   * NEW: Generate Ethical Importance Ranking Chart
   * Shows expert prioritization (Avg Importance 1-4) independent of Risk
   */
  async function generatePrincipleImportanceChart(byPrincipleOverall) {
    // Validate
    if (!byPrincipleOverall || typeof byPrincipleOverall !== 'object') {
      throw new Error('byPrincipleOverall must be a non-null object');
    }

    const principles = Object.keys(byPrincipleOverall).filter(p => byPrincipleOverall[p] !== null);
    if (principles.length === 0) throw new Error('No valid principles found');

    // Extract data and SORT by avgImportance (High Priority First)
    const dataPoints = principles.map(p => {
      const data = byPrincipleOverall[p];
      return {
        label: p,
        value: data.avgImportance || 0, // Default to 0 if missing
        highRatio: data.highImportanceRatio || 0
      };
    });

    // Sort descending
    dataPoints.sort((a, b) => b.value - a.value);

    const labels = dataPoints.map(d => d.label);
    const values = dataPoints.map(d => d.value);

    // Color gradient based on Importance (1-4)
    // 1=Low (Blue/Green), 4=High (Red/Orange)
    const colors = values.map(v => {
      if (v >= 3.5) return '#b91c1c'; // Deep Red
      if (v >= 2.5) return '#f97316'; // Orange
      if (v >= 1.5) return '#facc15'; // Yellow
      return '#3b82f6'; // Blue
    });

    const chartConfig = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Average Importance (Expert Priority)',
          data: values,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        indexAxis: 'y', // Horizontal Bar Chart for better label readability
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Ethical Importance Ranking (Expert Prioritization)',
            font: { size: 16, weight: 'bold' }
          },
          subtitle: {
            display: true,
            text: 'How critical is this principle for the project? (1=Low, 4=Critical)',
            font: { size: 12, style: 'italic' }
          },
          datalabels: {
            anchor: 'end',
            align: 'end',
            formatter: (value) => value.toFixed(1),
            font: { weight: 'bold' },
            color: '#1f2937'
          },
          legend: { display: false }
        },
        scales: {
          x: {
            min: 0,
            max: 4,
            title: { display: true, text: 'Average Importance Score (1-4)' }
          }
        }
      }
    };

    return generateChartImage(chartConfig, 800, 500); // Slightly taller
  }

  /**
   * Generate role×principle heatmap
   */
  async function generatePrincipleEvaluatorHeatmap(byPrincipleTable, evaluatorsWithScores) {
    const width = 1000;
    const height = 500;

    // Validate inputs
    if (!evaluatorsWithScores || !Array.isArray(evaluatorsWithScores) || evaluatorsWithScores.length === 0) {
      throw new Error('evaluatorsWithScores must be a non-empty array');
    }

    // Build matrix data
    const principles = Object.keys(byPrincipleTable || {});

    // Safely map evaluator names and userIds
    const evaluatorNames = evaluatorsWithScores.map(e => {
      if (!e) return 'Unknown';
      const userIdStr = e.userId ? (e.userId.toString ? e.userId.toString() : String(e.userId)) : 'unknown';
      return e.name || `${e.role || 'Unknown'} (${userIdStr})`;
    });

    // Create datasets for each principle
    const datasets = principles.map((principle, idx) => {
      const data = evaluatorNames.map(name => {
        const evaluator = evaluatorsWithScores.find(e => {
          if (!e) return false;
          const userIdStr = e.userId ? (e.userId.toString ? e.userId.toString() : String(e.userId)) : 'unknown';
          const evaluatorName = e.name || `${e.role || 'Unknown'} (${userIdStr})`;
          return evaluatorName === name;
        });
        if (!evaluator || !evaluator.userId) return null;

        // Match by userId
        // byPrincipleTable structure: { PRINCIPLE: { evaluators: [ { userId, score (Risk) }, ... ] } }
        const pData = byPrincipleTable[principle];
        if (!pData || !pData.evaluators || !Array.isArray(pData.evaluators)) return null;

        // Convert userId to string for lookup
        const userIdStr = evaluator.userId.toString ? evaluator.userId.toString() : String(evaluator.userId);

        const evalEntry = pData.evaluators.find(e => {
          const eId = e.userId ? (e.userId.toString ? e.userId.toString() : String(e.userId)) : '';
          return eId === userIdStr;
        });

        // score is Risk (0-4)
        return evalEntry && typeof evalEntry.score === 'number' ? evalEntry.score : null;
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
            text: 'Ethical Risk Heatmap (Role × Principle)',
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
              text: 'Risk Score (0-4)'
            }
          }
        }
      }
    };

    return generateChartImage(chartConfig, width, height);
  }

  /**
   * NEW: Generate Risk Radar Chart (Spider Chart)
   * Visualizes the risk profile across all principles
   */
  async function generateRiskRadarChart(byPrincipleOverall) {
    if (!byPrincipleOverall || typeof byPrincipleOverall !== 'object') {
      throw new Error('byPrincipleOverall must be a non-null object');
    }

    const principles = Object.keys(byPrincipleOverall).filter(p => byPrincipleOverall[p] !== null);
    if (principles.length === 0) throw new Error('No valid principles found');

    const scores = principles.map(p => {
      const data = byPrincipleOverall[p];
      if (!data) return 0;
      // Use cumulative risk, capped at some reasonable visual max if needed, or normalized 0-4
      // Use Average Risk (Normalized 0-4) for consistent scale on Radar
      return typeof data.averageRisk === 'number' ? data.averageRisk : (data.avg || 0);
    });

    const chartConfig = {
      type: 'radar',
      data: {
        labels: principles,
        datasets: [{
          label: 'Ethical Risk Level (0-4)',
          data: scores,
          backgroundColor: 'rgba(239, 68, 68, 0.2)', // Red-ish with opacity
          borderColor: '#ef4444', // Red
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#ef4444',
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Ethical Risk Profile (Radar View)',
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false },
          datalabels: {
            display: false // Too cluttered on radar usually
          }
        },
        scales: {
          r: {
            angleLines: {
              display: true
            },
            suggestedMin: 0,
            suggestedMax: 4,
            ticks: {
              stepSize: 1,
              backdropColor: 'transparent' // Hide white box behind numbers
            },
            pointLabels: {
              font: {
                size: 11,
                weight: 'bold'
              }
            }
          }
        }
      }
    };

    return generateChartImage(chartConfig, 700, 600); // Taller for radar
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
      // Validate chartConfig
      if (!chartConfig || !chartConfig.data || !chartConfig.data.labels) {
        throw new Error('Invalid chartConfig: missing data or labels');
      }

      // Validate data arrays - ensure no null values that could cause toString() errors
      if (chartConfig.data.datasets) {
        chartConfig.data.datasets.forEach((dataset, idx) => {
          if (!dataset.data || !Array.isArray(dataset.data)) {
            throw new Error(`Dataset ${idx} has invalid data array`);
          }
          // Replace any null/undefined values with 0 for chart rendering
          dataset.data = dataset.data.map(v => (v === null || v === undefined || isNaN(v)) ? 0 : v);
        });
      }

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
      console.error('Chart generation error details:', {
        message: error.message,
        stack: error.stack,
        chartConfig: chartConfig ? {
          type: chartConfig.type,
          labelsCount: chartConfig.data?.labels?.length,
          datasetsCount: chartConfig.data?.datasets?.length
        } : 'null'
      });
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
    console.log('📊 Initializing required charts with placeholders...');
    const charts = await initializeRequiredCharts(projectId, questionnaireKey);

    const chartErrors = [];

    // Step 2: Attempt to generate principleBarChart
    try {
      // CRITICAL DEBUG: Log exactly what data we receive
      console.log('🔍 [DEBUG generateAllCharts] Received scoring object:', {
        exists: !!scoring,
        hasByPrincipleOverall: !!scoring?.byPrincipleOverall,
        principleCount: scoring?.byPrincipleOverall ? Object.keys(scoring.byPrincipleOverall).length : 0,
        principleKeys: scoring?.byPrincipleOverall ? Object.keys(scoring.byPrincipleOverall) : []
      });

      if (scoring?.byPrincipleOverall) {
        // Log first principle's data structure
        const firstPrinciple = Object.keys(scoring.byPrincipleOverall)[0];
        if (firstPrinciple) {
          const firstData = scoring.byPrincipleOverall[firstPrinciple];
          console.log(`   Sample principle "${firstPrinciple}":`, {
            isNull: firstData === null,
            fields: firstData ? Object.keys(firstData) : [],
            risk: firstData?.risk,
            avg: firstData?.avg,
            avgScore: firstData?.avgScore,
            erc: firstData?.erc
          });
        }
      }

      if (scoring?.byPrincipleOverall && Object.keys(scoring.byPrincipleOverall).length > 0) {
        // Filter out null principles
        const nonNullPrinciples = Object.keys(scoring.byPrincipleOverall).filter(p => scoring.byPrincipleOverall[p] !== null);

        if (nonNullPrinciples.length === 0) {
          console.log('⚠️ All principles are null, cannot generate chart');
          throw new Error('All principle data is null');
        }

        console.log(`📊 Generating principleBarChart with ${nonNullPrinciples.length} non-null principles...`);
        const pngBuffer = await generatePrincipleBarChart(scoring.byPrincipleOverall);

        if (pngBuffer && Buffer.isBuffer(pngBuffer) && pngBuffer.length > 0) {
          charts.principleBarChart = createChartResult({
            chartId: 'principleBarChart',
            type: CHART_TYPES.BAR,
            status: CHART_STATUS.READY,
            title: 'Ethical Principles Risk Overview',
            subtitle: 'Risk scores by principle (0-4 scale)',
            pngBuffer,
            meta: {
              source: {
                collections: ['scores'],
                projectId,
                questionnaireKey
              },
              scale: { min: 0, max: 4, meaning: 'Lower = safer (0=No Risk, 4=Critical)' }
            },
            data: scoring.byPrincipleOverall
          });
          console.log('✅ principleBarChart generated successfully');
        } else {
          throw new Error('Generated buffer is empty or invalid');
        }
      } else {
        console.error('❌ CRITICAL: No principle data available for chart generation!');
        console.error('   This should NOT happen if Gemini narrative contains principle scores.');
        console.error('   scoring object:', JSON.stringify(scoring, null, 2).substring(0, 500));
      }
    } catch (error) {
      console.error('❌ principleBarChart generation failed:', error.message);
      console.error('   Stack:', error.stack);
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

    // Step 2.1: NEW Radar Chart (Spider Chart)
    try {
      if (scoring?.byPrincipleOverall && Object.keys(scoring.byPrincipleOverall).length > 0) {
        console.log('📊 Generating riskRadarChart...');
        const pngBuffer = await generateRiskRadarChart(scoring.byPrincipleOverall);

        if (pngBuffer && Buffer.isBuffer(pngBuffer)) {
          charts.riskRadarChart = createChartResult({
            chartId: 'riskRadarChart',
            type: CHART_TYPES.OTHER, // Radar isn't in standard types enum yet maybe, or use OTHER
            status: CHART_STATUS.READY,
            title: 'Ethical Risk Profile',
            pngBuffer,
            meta: {
              source: { collections: ['scores'], projectId },
              description: 'Radar chart showing risk distribution across principles'
            }
          });
          console.log('✅ riskRadarChart generated successfully');
        }
      }
    } catch (error) {
      console.warn('⚠️ riskRadarChart generation failed:', error.message);
      chartErrors.push({ chart: 'riskRadarChart', error: error.message });
      // Non-critical chart, so no placeholder needed strictly, or can add one
    }

    // Step 3: Attempt to generate principleEvaluatorHeatmap
    try {
      if (scoring?.byPrincipleTable &&
        Object.keys(scoring.byPrincipleTable).length > 0 &&
        evaluators?.withScores &&
        evaluators.withScores.length > 0) {
        console.log('📊 Generating principleEvaluatorHeatmap...');
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
              scale: { min: 0, max: 4, meaning: 'Lower = safer (0=No Risk, 4=Critical)' }
            },
            data: {
              byPrincipleTable: scoring.byPrincipleTable,
              evaluators: evaluators.withScores.map(e => ({ role: e.role, userId: e.userId }))
            }
          });
          console.log('✅ principleEvaluatorHeatmap generated successfully');
        } else {
          throw new Error('Generated buffer is empty or invalid');
        }
      } else {
        console.log('ℹ️ No evaluator/principle data available, keeping placeholder for principleEvaluatorHeatmap');
      }
    } catch (error) {
      console.error('❌ principleEvaluatorHeatmap generation failed:', error.message);
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
    // These don't need placeholders if they fail
    try {
      if (coverage?.evidenceMetrics) {
        console.log('📊 Generating evidenceCoverageChart...');
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
      console.warn('⚠️ evidenceCoverageChart generation failed (optional):', error.message);
      chartErrors.push({ chart: 'evidenceCoverageDonut', error: error.message });
    }

    try {
      if (tensions?.summary?.evidenceTypeDistribution) {
        console.log('📊 Generating evidenceTypeChart...');
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
      console.warn('⚠️ evidenceTypeChart generation failed (optional):', error.message);
      chartErrors.push({ chart: 'evidenceTypeDonut', error: error.message });
    }

    try {
      if (tensions?.list && tensions.list.length > 0) {
        console.log('📊 Generating tensionSeverityChart...');
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
      console.warn('⚠️ tensionSeverityChart generation failed (optional):', error.message);
      chartErrors.push({ chart: 'tensionSeverityChart', error: error.message });
    }

    try {
      if (tensions?.summary) {
        console.log('📊 Generating tensionReviewStateChart...');
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
      console.warn('⚠️ tensionReviewStateChart generation failed (optional):', error.message);
      chartErrors.push({ chart: 'tensionReviewStateChart', error: error.message });
    }

    // Step 5: Validate contract compliance
    const { validateChartContract } = require('./chartContract');
    const validation = validateChartContract(charts);

    if (!validation.valid) {
      console.error('❌ Chart contract validation failed:', validation);
      throw new Error(`Chart contract violation: ${validation.missing.concat(validation.errors).join(', ')}`);
    }

    console.log(`✅ Chart generation complete: ${Object.keys(charts).length} charts, ${chartErrors.length} errors`);

    return {
      charts,
      chartErrors: chartErrors.length > 0 ? chartErrors : null
    };
  }

  module.exports = {
    generatePrincipleBarChart,
    generateRiskRadarChart,
    generatePrincipleImportanceChart,
    generatePrincipleEvaluatorHeatmap,
    generateEvidenceCoverageChart,
    generateEvidenceTypeChart,
    generateTensionSeverityChart,
    generateTensionReviewStateChart,
    generateTeamCompletionDonut,
    generateChartImage,
    generateAllCharts // New orchestration function
  };
}
