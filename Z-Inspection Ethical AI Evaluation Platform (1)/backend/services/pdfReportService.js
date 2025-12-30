const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { generateHTMLReport } = require('./htmlReportTemplateService');
const { buildReportMetrics } = require('./reportMetricsService');
const { generateReportNarrative } = require('./geminiService');
const { getProjectAnalytics } = require('./analyticsService');
const chartGenerationService = require('./chartGenerationService');

/**
 * PDF Report Service
 * Generates professional dashboard-style PDF reports from HTML templates
 * Uses Puppeteer to convert HTML to PDF with charts and internal links
 */

/**
 * Generate chart images from analytics JSON (deterministic)
 * @param {Object} analytics - From analyticsService
 * @returns {Promise<Object>} Object with chart image buffers
 */
async function generateChartImagesFromAnalytics(analytics) {
  const charts = {};
  
  try {
    // Principle bar chart
    if (analytics.principleBar && analytics.principleBar.length > 0) {
      const principleData = {};
      analytics.principleBar.forEach(p => {
        principleData[p.principleKey] = {
          avgScore: p.avgScore,
          min: 0, // Could be computed if needed
          max: 4
        };
      });
      charts.principleBarChart = await chartGenerationService.generatePrincipleBarChart(
        principleData
      );
    }

    // Evidence type donut
    if (analytics.evidenceMetrics && analytics.evidenceMetrics.typeDistribution.length > 0) {
      const evidenceTypeDist = {};
      analytics.evidenceMetrics.typeDistribution.forEach(d => {
        evidenceTypeDist[d.type] = d.count;
      });
      charts.evidenceTypeChart = await chartGenerationService.generateEvidenceTypeChart(
        evidenceTypeDist
      );
    }
    
    // Evidence coverage donut
    if (analytics.evidenceMetrics) {
      charts.evidenceCoverageChart = await chartGenerationService.generateEvidenceCoverageChart(
        analytics.evidenceMetrics
      );
    }

    // Tension review state chart
    if (analytics.tensionsSummary && analytics.tensionsSummary.total > 0) {
      charts.tensionReviewStateChart = await chartGenerationService.generateTensionReviewStateChart({
        accepted: analytics.tensionsSummary.accepted,
        underReview: analytics.tensionsSummary.underReview,
        disputed: analytics.tensionsSummary.disputed,
        resolved: 0, // Could be added if needed
        total: analytics.tensionsSummary.total
      });
    }

    // Severity chart
    if (analytics.tensionsTable && analytics.tensionsTable.length > 0) {
      charts.severityChart = await chartGenerationService.generateSeverityChart(
        analytics.tensionsTable.map(t => ({
          severityLevel: t.severityLevel
        }))
      );
    }
  } catch (error) {
    console.warn('⚠️ Chart generation failed (non-critical):', error.message);
    // Continue without charts
  }

  return charts;
}

/**
 * Generate chart images from reportMetrics (legacy support)
 * @param {Object} reportMetrics - From reportMetricsService
 * @returns {Promise<Object>} Object with chart image buffers
 */
async function generateChartImages(reportMetrics) {
  const charts = {};
  
  try {
    // Principle bar chart
    if (Object.keys(reportMetrics.scoring.byPrincipleOverall || {}).length > 0) {
      charts.principleBarChart = await chartGenerationService.generatePrincipleBarChart(
        reportMetrics.scoring.byPrincipleOverall
      );
    }

    // Principle-evaluator heatmap (use actual evaluators from analytics)
    if (reportMetrics.scoring.byPrincipleTable && 
        Object.keys(reportMetrics.scoring.byPrincipleTable).length > 0 && 
        reportMetrics.evaluators?.withScores?.length > 0) {
      // Use evaluators from reportMetrics (derived from scores collection)
      charts.principleEvaluatorHeatmap = await chartGenerationService.generatePrincipleEvaluatorHeatmap(
        reportMetrics.scoring.byPrincipleTable,
        reportMetrics.evaluators.withScores
      );
    }

    // Team completion donut
    charts.teamCompletionDonut = await chartGenerationService.generateTeamCompletionDonut(
      reportMetrics.coverage
    );

    // Tension charts
    if (reportMetrics.tensions?.summary?.total > 0) {
      charts.tensionReviewStateChart = await chartGenerationService.generateTensionReviewStateChart(
        reportMetrics.tensions.summary
      );
      
      if (Object.keys(reportMetrics.tensions.summary.evidenceTypeDistribution || {}).length > 0) {
        charts.evidenceTypeChart = await chartGenerationService.generateEvidenceTypeChart(
          reportMetrics.tensions.summary.evidenceTypeDistribution
        );
      }
      
      if (reportMetrics.tensions.list?.length > 0) {
        charts.severityChart = await chartGenerationService.generateSeverityChart(
          reportMetrics.tensions.list
        );
      }
    }
  } catch (error) {
    console.warn('⚠️ Chart generation failed (non-critical):', error.message);
    // Continue without charts
  }

  return charts;
}

/**
 * Generate PDF report from project data
 * @param {String} projectId - Project ID
 * @param {String} questionnaireKey - Questionnaire key (default: 'general-v1')
 * @param {Object} options - Additional options
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePDFReport(projectId, questionnaireKey = 'general-v1', options = {}) {
  let browser = null;
  
  try {
    console.log(`📊 Generating PDF report for project: ${projectId}`);
    
    // Step 1: Get analytics data (deterministic, single source of truth)
    console.log('📈 Fetching analytics data...');
    const analytics = await getProjectAnalytics(projectId, questionnaireKey);
    
    // Step 2: Build reportMetrics (for narrative generation)
    console.log('📈 Building report metrics...');
    const reportMetrics = await buildReportMetrics(projectId, questionnaireKey);
    
    // Step 3: Generate charts from analytics
    console.log('📊 Generating charts from analytics...');
    const chartImages = await generateChartImagesFromAnalytics(analytics);
    
    // Also generate heatmap using actual evaluators from analytics and reportMetrics
    if (reportMetrics.scoring.byPrincipleTable && 
        Object.keys(reportMetrics.scoring.byPrincipleTable).length > 0 && 
        analytics.evaluators && analytics.evaluators.length > 0) {
      // Use evaluators from analytics (derived from scores collection)
      chartImages.principleEvaluatorHeatmap = await chartGenerationService.generatePrincipleEvaluatorHeatmap(
        reportMetrics.scoring.byPrincipleTable,
        analytics.evaluators
      );
    }
    
    // Step 4: Generate narrative using Gemini (strict guardrails)
    console.log('🤖 Generating narrative with Gemini...');
    let geminiNarrative;
    try {
      // Pass analytics to Gemini for better context
      const reportMetricsWithAnalytics = {
        ...reportMetrics,
        analytics: {
          topRiskyQuestions: analytics.topRiskyQuestions,
          tensionsSummary: analytics.tensionsSummary,
          evidenceMetrics: analytics.evidenceMetrics,
          topRiskyQuestionContext: analytics.topRiskyQuestionContext.slice(0, 10)
        }
      };
      geminiNarrative = await generateReportNarrative(reportMetricsWithAnalytics);
    } catch (geminiError) {
      console.warn('⚠️ Gemini narrative generation failed, using fallback:', geminiError.message);
      geminiNarrative = {
        executiveSummary: [
          `Overall ethical risk level: ${reportMetrics.scoring.totalsOverall?.avg?.toFixed(2) || 'N/A'}/4.0`,
          `${reportMetrics.coverage.expertsSubmittedCount || 0} of ${reportMetrics.coverage.assignedExpertsCount || 0} assigned experts completed evaluations`,
          `${reportMetrics.tensions.summary?.total || 0} ethical tensions identified`
        ],
        principleFindings: [],
        topRiskDriversNarrative: [],
        tensionsNarrative: [],
        recommendations: [],
        limitations: []
      };
    }
    
    // Step 5: Generate HTML
    console.log('📝 Generating HTML template...');
    const html = generateHTMLReport(
      reportMetrics,
      geminiNarrative,
      chartImages,
      {
        generatedAt: options.generatedAt || new Date(),
        analytics: {
          ...analytics,
          evaluators: analytics.evaluators || [], // Ensure evaluators are included
          topRiskyQuestions: analytics.topRiskyQuestions || [],
          topRiskyQuestionContext: analytics.topRiskyQuestionContext || [],
          tensionsTable: analytics.tensionsTable || [],
          tensionsSummary: analytics.tensionsSummary || {},
          evidenceMetrics: analytics.evidenceMetrics || {}
        }
      }
    );
    
    // Step 5: Convert HTML to PDF using Puppeteer
    console.log('🖨️ Converting HTML to PDF...');
    console.log(`📄 HTML content length: ${html.length} characters`);
    
    let page;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ],
        timeout: 60000 // 60 second timeout for browser launch
      });
      
      console.log('✅ Browser launched successfully');
      
      page = await browser.newPage();
      console.log('✅ New page created');
      
      // Set content with longer timeout
      console.log('📝 Setting HTML content...');
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 60000 // 60 second timeout
      });
      console.log('✅ HTML content set');
      
      // Wait for images to load
      console.log('🖼️ Waiting for images to load...');
      await page.evaluateHandle(() => {
        return Promise.all(
          Array.from(document.images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              setTimeout(reject, 10000); // Increased timeout for images
            });
          })
        );
      }).catch((imgError) => {
        // Continue even if some images fail to load
        console.warn('⚠️ Some images may not have loaded:', imgError.message);
      });
      console.log('✅ Images loaded (or skipped)');
    } catch (setupError) {
      console.error('❌ Error setting up Puppeteer:', setupError);
      throw new Error(`Failed to set up PDF generation: ${setupError.message}`);
    }
    
    // Generate PDF
    console.log('📄 Generating PDF buffer...');
    let pdfBuffer;
    
    if (!page) {
      throw new Error('Page object is null or undefined');
    }
    
    try {
      const pdfResult = await page.pdf({
        format: 'A4',
        margin: {
          top: '2cm',
          right: '1.5cm',
          bottom: '2cm',
          left: '1.5cm'
        },
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 8pt; color: #6b7280; width: 100%; text-align: center; padding: 0.5cm;">
            <span>${reportMetrics.project.title || 'Ethical AI Evaluation Report'}</span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 8pt; color: #6b7280; width: 100%; text-align: center; padding: 0.5cm;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        `,
        timeout: 60000 // 60 second timeout
      });
      
      console.log('✅ PDF result received from Puppeteer');
      console.log('📊 PDF result type:', typeof pdfResult);
      console.log('📊 PDF result is Buffer:', Buffer.isBuffer(pdfResult));
      
      // Ensure we have a Buffer
      if (Buffer.isBuffer(pdfResult)) {
        pdfBuffer = pdfResult;
      } else if (pdfResult && typeof pdfResult === 'object' && pdfResult.data) {
        // Some Puppeteer versions return { data: Buffer }
        pdfBuffer = Buffer.from(pdfResult.data);
      } else if (pdfResult && typeof pdfResult === 'string') {
        // If it's a base64 string, convert to Buffer
        pdfBuffer = Buffer.from(pdfResult, 'base64');
      } else if (pdfResult && Array.isArray(pdfResult)) {
        // If it's an array (Uint8Array), convert to Buffer
        pdfBuffer = Buffer.from(pdfResult);
      } else {
        // Try to convert to Buffer
        pdfBuffer = Buffer.from(pdfResult);
      }
      
      console.log('✅ PDF buffer converted/validated');
    } catch (pdfError) {
      console.error('❌ Error calling page.pdf():', pdfError);
      console.error('❌ PDF error message:', pdfError.message);
      console.error('❌ PDF error stack:', pdfError.stack);
      throw new Error(`Failed to generate PDF from page: ${pdfError.message}`);
    }
    
    // Validate PDF buffer
    if (!pdfBuffer) {
      throw new Error('PDF generation returned null or undefined buffer');
    }
    
    if (!Buffer.isBuffer(pdfBuffer)) {
      console.error('❌ PDF buffer type:', typeof pdfBuffer);
      console.error('❌ PDF buffer constructor:', pdfBuffer?.constructor?.name);
      console.error('❌ PDF buffer value (first 100 chars):', pdfBuffer?.toString?.()?.substring(0, 100));
      // Try one more time to convert to Buffer
      try {
        pdfBuffer = Buffer.from(pdfBuffer);
        if (!Buffer.isBuffer(pdfBuffer)) {
          throw new Error(`PDF generation returned invalid buffer type: ${typeof pdfBuffer}. Expected Buffer, got ${typeof pdfBuffer}`);
        }
      } catch (convertError) {
        throw new Error(`PDF generation returned invalid buffer type: ${typeof pdfBuffer}. Expected Buffer, got ${typeof pdfBuffer}. Conversion failed: ${convertError.message}`);
      }
    }
    
    if (pdfBuffer.length === 0) {
      throw new Error('PDF generation returned empty buffer');
    }
    
    console.log(`✅ PDF report generated successfully (${pdfBuffer.length} bytes)`);
    return pdfBuffer;
    
  } catch (error) {
    console.error('❌ Error generating PDF report:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate PDF report and save to database
 * @param {String} projectId - Project ID
 * @param {String} questionnaireKey - Questionnaire key
 * @param {String} userId - User ID who generated the report
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Report document
 */
async function generateAndSavePDFReport(projectId, questionnaireKey = 'general-v1', userId, options = {}) {
  const mongoose = require('mongoose');
  const Report = mongoose.model('Report');
  const isValidObjectId = (id) => {
    if (typeof mongoose.isValidObjectId === 'function') {
      return mongoose.isValidObjectId(id);
    }
    return mongoose.Types.ObjectId.isValid(id);
  };
  
  const projectIdObj = isValidObjectId(projectId)
    ? new mongoose.Types.ObjectId(projectId)
    : projectId;
  
  // Generate PDF
  const pdfBuffer = await generatePDFReport(projectId, questionnaireKey, options);
  
    // Get analytics (deterministic source)
    const analytics = await getProjectAnalytics(projectId, questionnaireKey);
    
    // Build report metrics for storage
    const reportMetrics = await buildReportMetrics(projectId, questionnaireKey);
    let geminiNarrative;
    try {
      const { generateReportNarrative } = require('./geminiService');
      // Pass analytics to Gemini for better context
      const reportMetricsWithAnalytics = {
        ...reportMetrics,
        analytics: {
          topRiskyQuestions: analytics.topRiskyQuestions,
          tensionsSummary: analytics.tensionsSummary,
          evidenceMetrics: analytics.evidenceMetrics,
          topRiskyQuestionContext: analytics.topRiskyQuestionContext.slice(0, 10)
        }
      };
      geminiNarrative = await generateReportNarrative(reportMetricsWithAnalytics);
    } catch (error) {
      console.warn('Gemini narrative generation failed, using fallback');
      geminiNarrative = null;
    }
  
  // Determine version (increment if report exists)
  const existingReport = await Report.findOne({ projectId: projectIdObj })
    .sort({ generatedAt: -1 })
    .select('version')
    .lean();
  const version = existingReport ? (existingReport.version || 1) + 1 : 1;

  // Compute hash for versioning (before saving)
  const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex').substring(0, 16);

  // Save PDF to file system first
  const reportsDir = path.join(__dirname, '../storage/reports');
  try {
    await fs.mkdir(reportsDir, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }
  
  // Create report document first to get _id for filename
  const report = new Report({
    projectId: projectIdObj,
    useCaseId: projectIdObj,
    title: `Ethical AI Evaluation Report - ${reportMetrics.project.title || 'Project'}`,
    computedMetrics: reportMetrics,
    geminiNarrative: geminiNarrative,
    questionnaireKey: questionnaireKey,
    generatedBy: userId,
    createdAt: new Date(), // Explicitly set createdAt
    status: 'draft',
    version,
    hash,
    metadata: {
      totalScores: reportMetrics.scoring.totalsOverall?.count || 0,
      totalTensions: reportMetrics.tensions.summary.total,
      principlesAnalyzed: Object.keys(reportMetrics.scoring.byPrincipleOverall),
      reportType: 'pdf-dashboard',
      chartsGenerated: Object.keys(await generateChartImagesFromAnalytics(analytics)).length
    }
  });
  
  // Save report to get _id, then update with file metadata
  await report.save();
  
  const fileName = `report_${report._id}_${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  await fs.writeFile(filePath, pdfBuffer);
  
  // Update report with file metadata
  report.filePath = filePath;
  report.fileUrl = `/api/reports/${report._id}/file`;
  report.mimeType = 'application/pdf';
  report.fileSize = pdfBuffer.length;
  
  await report.save();
  
  // Also return buffer for immediate download
  report._pdfBuffer = pdfBuffer;
  
  return report;
}

module.exports = {
  generatePDFReport,
  generateAndSavePDFReport,
  generateChartImages
};

