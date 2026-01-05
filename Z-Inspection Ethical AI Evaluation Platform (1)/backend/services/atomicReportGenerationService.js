/**
 * Atomic Report Generation Service
 * 
 * Ensures PDF and Word are generated from the SAME snapshot, atomically.
 * This is the SINGLE SOURCE OF TRUTH for report file generation.
 * 
 * CRITICAL RULES:
 * - PDF and Word MUST be generated in the same transaction
 * - Both files MUST reference the same report version
 * - If either generation fails, the entire operation fails (no partial publish)
 * - Report status transitions: generating → final (on success) or failed (on error)
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');

const Report = mongoose.model('Report');

/**
 * Generate PDF from HTML content using Puppeteer
 * 
 * @param {string} htmlContent - Full HTML report
 * @param {string} outputPath - Where to save the PDF
 * @returns {Promise<{success: boolean, filePath: string, fileSize: number}>}
 */
async function generatePDFFromHtml(htmlContent, outputPath) {
  let browser;
  try {
    console.log('📄 Generating PDF from HTML using Puppeteer...');

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Launch Puppeteer
    // Auto-detect Chrome from multiple sources
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    };

    // Try to find Chrome in order of preference:
    // 1. Environment variable (if explicitly set)
    // 2. Puppeteer's installed Chrome (from npx @puppeteer/browsers)
    // 3. System Chrome (Windows/Mac/Linux common locations)
    const fsSync = require('fs');
    
    const possiblePaths = [];

    // 1. Check environment variable
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      possiblePaths.push(process.env.PUPPETEER_EXECUTABLE_PATH);
    }

    // 2. Check Puppeteer's cache (from npx @puppeteer/browsers install)
    const homeDir = os.homedir();
    if (process.platform === 'win32') {
      // Windows Puppeteer cache locations
      possiblePaths.push(
        path.join(homeDir, 'chrome', 'win64-143.0.7499.169', 'chrome-win64', 'chrome.exe'),
        path.join(homeDir, '.cache', 'puppeteer', 'chrome', 'win64-143.0.7499.169', 'chrome-win64', 'chrome.exe'),
        // System Chrome
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
      );
    } else if (process.platform === 'darwin') {
      // Mac
      possiblePaths.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      );
    } else {
      // Linux
      possiblePaths.push(
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      );
    }

    // Try each path until we find Chrome
    let chromeFound = false;
    for (const chromePath of possiblePaths) {
      try {
        if (chromePath && fsSync.existsSync(chromePath)) {
          launchOptions.executablePath = chromePath;
          console.log(`✅ Using Chrome at: ${chromePath}`);
          chromeFound = true;
          break;
        }
      } catch (e) {
        // Continue to next path
      }
    }

    if (!chromeFound) {
      console.warn('⚠️  No Chrome executable found. Trying default Puppeteer behavior...');
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    // Set content and wait for images to load
    await page.setContent(htmlContent, {
      waitUntil: ['load', 'networkidle0']
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      preferCSSPageSize: false
    });

    // Write to file
    await fs.writeFile(outputPath, pdfBuffer);

    // Get file size
    const stats = await fs.stat(outputPath);
    const fileSize = stats.size;

    console.log(`✅ PDF generated successfully: ${outputPath} (${(fileSize / 1024).toFixed(2)} KB)`);

    return {
      success: true,
      filePath: outputPath,
      fileSize
    };
  } catch (error) {
    console.error('❌ Error generating PDF from HTML:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate Word document from HTML content
 * 
 * @param {string} htmlContent - Full HTML report
 * @param {string} outputPath - Where to save the .docx
 * @returns {Promise<{success: boolean, filePath: string, fileSize: number}>}
 */
async function generateWordFromHtml(htmlContent, outputPath) {
  try {
    console.log('📝 Generating Word document from HTML...');

    // Check if html-to-docx is available
    let convert;
    try {
      const htmlToDocx = require('html-to-docx');
      convert = htmlToDocx.default || htmlToDocx;
    } catch (error) {
      console.warn('⚠️  html-to-docx not available, using fallback method');
      return await generateWordFallback(htmlContent, outputPath);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Convert HTML to DOCX buffer
    const docxBuffer = await convert(htmlContent, {
      orientation: 'portrait',
      margins: {
        top: 1440, // 1 inch in twips
        right: 1440,
        bottom: 1440,
        left: 1440
      },
      font: 'Calibri',
      fontSize: 22, // 11pt (size is in half-points)
      lineHeight: 360, // 1.5 line spacing
      title: 'Ethical AI Assessment Report',
      subject: 'Z-Inspection Report',
      creator: 'Z-Inspection Platform',
      keywords: ['ethical AI', 'assessment', 'governance'],
      description: 'Enterprise-grade ethical assessment report'
    });

    // Write buffer to file
    await fs.writeFile(outputPath, docxBuffer);

    // Get file size
    const stats = await fs.stat(outputPath);
    const fileSize = stats.size;

    console.log(`✅ Word document generated successfully: ${outputPath} (${(fileSize / 1024).toFixed(2)} KB)`);

    return {
      success: true,
      filePath: outputPath,
      fileSize
    };
  } catch (error) {
    console.error('❌ Error generating Word document:', error);
    throw new Error(`Word generation failed: ${error.message}`);
  }
}

/**
 * Fallback Word generation using simple docx library
 */
async function generateWordFallback(htmlContent, outputPath) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

  try {
    console.log('📝 Generating Word document (fallback mode)...');

    // Parse basic text from HTML (remove tags)
    const textContent = htmlContent
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const doc = new Document({
      creator: 'Z-Inspection Platform',
      title: 'Ethical Assessment Report',
      description: 'Ethical AI Assessment Report',
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440
              }
            }
          },
          children: [
            new Paragraph({
              text: 'Ethical AI Assessment Report',
              heading: HeadingLevel.HEADING_1
            }),
            new Paragraph({
              text: textContent.slice(0, 5000), // First 5000 chars
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: 'Note: This is a simplified Word export. For full report with visualizations, use PDF format.',
              italics: true,
              spacing: { before: 800 }
            })
          ]
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write to file
    await fs.writeFile(outputPath, buffer);

    const stats = await fs.stat(outputPath);
    const fileSize = stats.size;

    console.log(`✅ Word document generated (fallback): ${outputPath} (${(fileSize / 1024).toFixed(2)} KB)`);

    return {
      success: true,
      filePath: outputPath,
      fileSize
    };
  } catch (error) {
    console.error('❌ Error generating Word document (fallback):', error);
    throw new Error(`Word generation (fallback) failed: ${error.message}`);
  }
}

/**
 * ATOMIC REPORT GENERATION
 * 
 * Generates PDF and Word from the same HTML snapshot, atomically.
 * This is the ONLY function that should generate report files.
 * 
 * @param {Object} params
 * @param {string} params.projectId - Project ID
 * @param {string} params.htmlContent - Full HTML report content
 * @param {Object} params.metadata - Report metadata (ERC, evaluators, etc.)
 * @param {string} params.narrative - Gemini narrative (markdown)
 * @param {Object} params.userId - User who triggered generation
 * @returns {Promise<{reportId: string, pdfPath: string, wordPath: string, version: number}>}
 */
async function generateReportFilesAtomic({ projectId, htmlContent, metadata, narrative, userId }) {
  const startTime = Date.now();
  const projectIdObj = mongoose.Types.ObjectId.isValid(projectId)
    ? new mongoose.Types.ObjectId(projectId)
    : projectId;
  const userIdObj = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;

  let reportDoc = null;

  try {
    console.log('🚀 Starting ATOMIC report generation for project:', projectId);

    // ====================================================================
    // STEP 1: Get next version number and create report document
    // ====================================================================
    const latestReport = await Report.findOne({ projectId: projectIdObj })
      .sort({ version: -1 })
      .select('version')
      .lean();

    const nextVersion = latestReport ? latestReport.version + 1 : 1;

    console.log(`📊 Generating report version ${nextVersion}`);

    // Create report document with status='generating'
    reportDoc = new Report({
      projectId: projectIdObj,
      useCaseId: projectIdObj,
      title: `Ethical Assessment Report v${nextVersion}`,
      content: narrative, // Legacy compatibility
      sections: [{
        principle: 'FULL_REPORT',
        aiDraft: narrative,
        expertEdit: '',
        comments: []
      }],
      generatedBy: userIdObj,
      version: nextVersion,
      status: 'generating', // CRITICAL: Mark as generating during process
      latest: false, // Will be set to true after successful generation
      metadata: {
        ...metadata,
        generationDurationMs: null // Will be set after completion
      },
      htmlContent: htmlContent,
      generatedAt: new Date()
    });

    await reportDoc.save();
    const reportId = reportDoc._id.toString();

    console.log(`✅ Report document created: ${reportId}`);

    // ====================================================================
    // STEP 2: Generate PDF and Word files (ATOMIC OPERATION)
    // ====================================================================
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'reports');
    await fs.mkdir(uploadsDir, { recursive: true });

    const pdfFilename = `report_${projectId}_v${nextVersion}_${Date.now()}.pdf`;
    const wordFilename = `report_${projectId}_v${nextVersion}_${Date.now()}.docx`;

    const pdfPath = path.join(uploadsDir, pdfFilename);
    const wordPath = path.join(uploadsDir, wordFilename);

    console.log('📄 Generating PDF...');
    const pdfResult = await generatePDFFromHtml(htmlContent, pdfPath);

    console.log('📝 Generating Word...');
    const wordResult = await generateWordFromHtml(htmlContent, wordPath);

    // ====================================================================
    // STEP 3: Update report document with file paths and mark as latest
    // ====================================================================
    const generationDurationMs = Date.now() - startTime;

    // Use the Report model's markAsLatest method for atomic update
    await Report.markAsLatest(reportDoc._id, projectIdObj);

    // Update file paths and metadata
    reportDoc.pdfPath = `reports/${pdfFilename}`;
    reportDoc.wordPath = `reports/${wordFilename}`;
    reportDoc.pdfSize = pdfResult.fileSize;
    reportDoc.wordSize = wordResult.fileSize;
    reportDoc.metadata.generationDurationMs = generationDurationMs;
    reportDoc.metadata.hasHTMLReport = true;

    await reportDoc.save();

    console.log(`✅ ATOMIC REPORT GENERATION COMPLETED in ${generationDurationMs}ms`);
    console.log(`   - Version: ${nextVersion}`);
    console.log(`   - PDF: ${pdfResult.fileSize} bytes`);
    console.log(`   - Word: ${wordResult.fileSize} bytes`);
    console.log(`   - Marked as latest: true`);

    return {
      reportId: reportId,
      pdfPath: reportDoc.pdfPath,
      wordPath: reportDoc.wordPath,
      pdfSize: pdfResult.fileSize,
      wordSize: wordResult.fileSize,
      version: nextVersion,
      status: 'final',
      latest: true
    };

  } catch (error) {
    console.error('❌ ATOMIC REPORT GENERATION FAILED:', error.message);

    // Mark report as failed if it was created
    if (reportDoc && reportDoc._id) {
      try {
        await Report.findByIdAndUpdate(reportDoc._id, {
          status: 'failed',
          latest: false,
          errorDetails: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date()
          }
        });
        console.log(`⚠️  Report ${reportDoc._id} marked as failed`);
      } catch (updateError) {
        console.error('❌ Error updating failed report status:', updateError.message);
      }
    }

    // Cleanup partial files if they exist
    try {
      if (reportDoc && reportDoc.pdfPath) {
        const pdfFullPath = path.join(__dirname, '..', 'uploads', reportDoc.pdfPath);
        await fs.unlink(pdfFullPath).catch(() => {});
      }
      if (reportDoc && reportDoc.wordPath) {
        const wordFullPath = path.join(__dirname, '..', 'uploads', reportDoc.wordPath);
        await fs.unlink(wordFullPath).catch(() => {});
      }
    } catch (cleanupError) {
      console.warn('⚠️  Error cleaning up partial files:', cleanupError.message);
    }

    throw error;
  }
}

module.exports = {
  generateReportFilesAtomic,
  generatePDFFromHtml,
  generateWordFromHtml
};

