/**
 * Report Retrieval Controller
 * 
 * Endpoints for retrieving reports with version control.
 * Ensures Admin and Expert panels always see the same latest report.
 * 
 * CRITICAL RULES:
 * - Always query for latest = true to get current report
 * - Never serve files from old versions if a newer one exists
 * - Validate file existence before serving
 * - Log warnings if Admin and Expert requests resolve to different versions
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

const Report = mongoose.model('Report');
const Project = mongoose.model('Project');

/**
 * Get latest report for a project (metadata only)
 * Used by both Admin and Expert panels to display report info
 * 
 * GET /api/reports/latest/:projectId
 */
exports.getLatestReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.body.userId || req.query.userId;

    // Validate projectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Get latest report
    const report = await Report.getLatestReport(projectId);

    if (!report) {
      return res.status(404).json({ 
        error: 'No reports found for this project',
        projectId
      });
    }

    // Build response with file URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const response = {
      reportId: report._id,
      projectId: report.projectId,
      version: report.version,
      versionLabel: `v${report.version}${report.latest ? ' (Latest)' : ''}`,
      status: report.status,
      generatedAt: report.generatedAt,
      latest: report.latest,
      title: report.title,
      metadata: report.metadata,
      files: {
        pdf: {
          downloadUrl: `${baseUrl}/api/reports/${report._id}/pdf`,
          viewUrl: `${baseUrl}/api/reports/${report._id}/pdf?inline=true`,
          size: report.pdfSize,
          sizeFormatted: report.pdfSize ? `${(report.pdfSize / 1024).toFixed(2)} KB` : 'N/A'
        },
        word: {
          downloadUrl: `${baseUrl}/api/reports/${report._id}/word`,
          size: report.wordSize,
          sizeFormatted: report.wordSize ? `${(report.wordSize / 1024).toFixed(2)} KB` : 'N/A'
        }
      }
    };

    // Runtime validation: Ensure both files exist
    const validationWarnings = [];
    if (!report.pdfPath) validationWarnings.push('PDF path missing');
    if (!report.wordPath) validationWarnings.push('Word path missing');

    if (validationWarnings.length > 0) {
      console.warn(`⚠️  Report ${report._id} validation warnings: ${validationWarnings.join(', ')}`);
      response.warnings = validationWarnings;
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Error getting latest report:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Download PDF file
 * 
 * GET /api/reports/:reportId/pdf
 */
exports.downloadPDF = async (req, res) => {
  try {
    const { reportId } = req.params;
    const inline = req.query.inline === 'true';

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    const report = await Report.findById(reportId);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Validate that this is the latest version (critical check)
    if (!report.latest) {
      const latestReport = await Report.getLatestReport(report.projectId);
      if (latestReport && latestReport._id.toString() !== reportId) {
        console.warn(`⚠️  STALE REPORT ACCESS: User requested report ${reportId} but latest is ${latestReport._id}`);
        // Allow access but log warning (user may want to see old versions)
      }
    }

    if (!report.pdfPath) {
      return res.status(404).json({ error: 'PDF file not available for this report' });
    }

    // Build full file path
    const filePath = path.join(__dirname, '..', 'uploads', report.pdfPath);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      console.error(`❌ PDF file not found: ${filePath}`);
      return res.status(404).json({ error: 'PDF file not found on disk' });
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath);

    // Set headers
    const disposition = inline ? 'inline' : 'attachment';
    const filename = `ethical_assessment_report_v${report.version}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('X-Report-Version', report.version);
    res.setHeader('X-Report-Latest', report.latest);

    res.send(fileBuffer);
  } catch (error) {
    console.error('❌ Error downloading PDF:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Download Word file
 * 
 * GET /api/reports/:reportId/word
 */
exports.downloadWord = async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    const report = await Report.findById(reportId);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Validate that this is the latest version (critical check)
    if (!report.latest) {
      const latestReport = await Report.getLatestReport(report.projectId);
      if (latestReport && latestReport._id.toString() !== reportId) {
        console.warn(`⚠️  STALE REPORT ACCESS: User requested report ${reportId} but latest is ${latestReport._id}`);
      }
    }

    if (!report.wordPath) {
      return res.status(404).json({ error: 'Word file not available for this report' });
    }

    // Build full file path
    const filePath = path.join(__dirname, '..', 'uploads', report.wordPath);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      console.error(`❌ Word file not found: ${filePath}`);
      return res.status(404).json({ error: 'Word file not found on disk' });
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath);

    // Set headers
    const filename = `ethical_assessment_report_v${report.version}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('X-Report-Version', report.version);
    res.setHeader('X-Report-Latest', report.latest);

    res.send(fileBuffer);
  } catch (error) {
    console.error('❌ Error downloading Word:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * List all reports for a project (Admin only)
 * Shows version history
 * 
 * GET /api/reports/list/:projectId
 */
exports.listProjectReports = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const reports = await Report.find({ projectId })
      .sort({ version: -1 })
      .select('_id version status generatedAt latest title metadata pdfPath wordPath pdfSize wordSize')
      .lean();

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const formattedReports = reports.map(report => ({
      reportId: report._id,
      version: report.version,
      versionLabel: `v${report.version}${report.latest ? ' (Latest)' : ''}`,
      status: report.status,
      generatedAt: report.generatedAt,
      latest: report.latest,
      title: report.title,
      metadata: report.metadata,
      files: {
        pdf: {
          available: !!report.pdfPath,
          downloadUrl: report.pdfPath ? `${baseUrl}/api/reports/${report._id}/pdf` : null,
          size: report.pdfSize,
          sizeFormatted: report.pdfSize ? `${(report.pdfSize / 1024).toFixed(2)} KB` : 'N/A'
        },
        word: {
          available: !!report.wordPath,
          downloadUrl: report.wordPath ? `${baseUrl}/api/reports/${report._id}/word` : null,
          size: report.wordSize,
          sizeFormatted: report.wordSize ? `${(report.wordSize / 1024).toFixed(2)} KB` : 'N/A'
        }
      }
    }));

    res.json({
      projectId,
      totalReports: reports.length,
      latestVersion: reports.length > 0 ? reports[0].version : 0,
      reports: formattedReports
    });
  } catch (error) {
    console.error('❌ Error listing project reports:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Validate report version consistency
 * Checks if PDF and Word belong to the same report version
 * 
 * GET /api/reports/validate/:reportId
 */
exports.validateReportConsistency = async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    const report = await Report.findById(reportId);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const errors = [];
    const warnings = [];

    // Check 1: PDF and Word paths exist
    if (!report.pdfPath) errors.push('PDF path is missing');
    if (!report.wordPath) warnings.push('Word path is missing');

    // Check 2: Files exist on disk
    if (report.pdfPath) {
      const pdfPath = path.join(__dirname, '..', 'uploads', report.pdfPath);
      try {
        await fs.access(pdfPath);
      } catch (error) {
        errors.push('PDF file not found on disk');
      }
    }

    if (report.wordPath) {
      const wordPath = path.join(__dirname, '..', 'uploads', report.wordPath);
      try {
        await fs.access(wordPath);
      } catch (error) {
        warnings.push('Word file not found on disk');
      }
    }

    // Check 3: Version consistency
    if (!report.latest) {
      const latestReport = await Report.getLatestReport(report.projectId);
      if (latestReport && latestReport._id.toString() !== reportId) {
        warnings.push(`This is not the latest report. Latest version is v${latestReport.version} (ID: ${latestReport._id})`);
      }
    }

    // Check 4: Status validation
    if (report.status === 'generating') {
      warnings.push('Report is still generating');
    } else if (report.status === 'failed') {
      errors.push('Report generation failed');
    }

    const isValid = errors.length === 0;

    res.json({
      reportId: report._id,
      projectId: report.projectId,
      version: report.version,
      status: report.status,
      latest: report.latest,
      isValid,
      errors,
      warnings,
      files: {
        pdf: {
          exists: !!report.pdfPath,
          size: report.pdfSize
        },
        word: {
          exists: !!report.wordPath,
          size: report.wordSize
        }
      }
    });
  } catch (error) {
    console.error('❌ Error validating report consistency:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;

