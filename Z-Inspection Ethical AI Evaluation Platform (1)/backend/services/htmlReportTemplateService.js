/**
 * HTML Report Template Service
 * Generates professional dashboard-style HTML report for PDF conversion
 * Includes charts, tables, and internal navigation links
 */

const { getRiskLabel, colorForScore } = require('../utils/riskScale');

/**
 * Generate HTML report template with dashboard layout
 * @param {Object} reportMetrics - From reportMetricsService
 * @param {Object} geminiNarrative - Narrative from Gemini
 * @param {Object} chartImages - Base64 encoded chart images, used specifically for charts that are not HTML-based
 * @param {Object} options - Additional options including analytics data for heatmap
 * @returns {string} Complete HTML string
 */
function generateHTMLReport(reportMetrics, geminiNarrative, chartImages = {}, options = {}) {
  const project = reportMetrics.project || {};
  const scoring = reportMetrics.scoring || {};
  const tensions = reportMetrics.tensions || {};
  const evaluators = reportMetrics.evaluators || {};

  // Helper to format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Helper to get risk tier object
  const getRiskTier = (score) => ({
    label: getRiskLabel(score, 'label', 'en'),
    color: colorForScore(score),
    shortLabel: getRiskLabel(score, 'short', 'en')
  });

  const overallRisk = scoring.totalsOverall?.overallRisk ?? (scoring.totalsOverall?.avg || 0);
  const riskTier = getRiskTier(overallRisk);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ethical AI Evaluation Report - ${project.title || 'Project'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #111827;
      margin: 0;
      padding: 0;
      font-size: 11pt; /* Reduced from 12pt */
    }

    .page {
      background: white;
      padding: 2cm;
      margin: 0 auto;
      max-width: 210mm;
      min-height: 297mm;
      box-sizing: border-box;
      page-break-after: always;
    }
    
    @media print {
      body { background: white; }
      .page { margin: 0; max-width: none; min-height: auto; page-break-after: always; box-shadow: none; }
      .page:last-child { page-break-after: auto; }
    }
    
    p { margin-bottom: 1em; page-break-inside: avoid; }
    li { page-break-inside: avoid; margin-bottom: 0.3em; }

    /* Header */
    .header { border-bottom: 2px solid #3b82f6; padding-bottom: 0.5cm; margin-bottom: 1cm; }
    .header h1 { font-size: 26pt; color: #1e40af; margin-bottom: 0.2cm; }
    .header-meta { font-size: 10pt; color: #6b7280; display: flex; gap: 1cm; }
    
    /* Dashboard */
    .dashboard-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1cm; margin-bottom: 1cm; }
    .dashboard-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.8cm; page-break-inside: avoid; }
    .dashboard-card h3 { font-size: 14pt; color: #374151; margin-bottom: 0.4cm; border-bottom: 1px solid #d1d5db; padding-bottom: 0.2cm; }
    .stat-value { font-size: 30pt; font-weight: bold; color: #1f2937; margin-bottom: 0.2cm; }
    .stat-label { font-size: 11pt; color: #6b7280; }
    
    /* Tables */
    table { width: 100%; border-collapse: collapse; margin: 0.8cm 0; page-break-inside: avoid; font-size: 10pt; }
    table th { background: #3b82f6; color: white; padding: 0.4cm; text-align: left; font-weight: 600; }
    table td { padding: 0.3cm; border-bottom: 1px solid #e5e7eb; }
    table tr:nth-child(even) { background: #f9fafb; }
    
    /* Sections */
    .section { margin: 1.5cm 0; page-break-inside: avoid; }
    .section h2 { font-size: 22pt; color: #1e40af; margin-bottom: 0.5cm; border-bottom: 2px solid #3b82f6; padding-bottom: 0.2cm; }
    .section h3 { font-size: 16pt; color: #374151; margin-top: 0.8cm; margin-bottom: 0.4cm; }
    
    .risk-badge { display: inline-block; padding: 0.2cm 0.5cm; border-radius: 4px; font-size: 9pt; font-weight: 600; color: white; }
    .footer { position: fixed; bottom: 1cm; left: 1.5cm; right: 1.5cm; text-align: center; font-size: 9pt; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 0.3cm; }
  </style>
</head>
<body>

  <!-- PAGE 1: DASHBOARD & SUMMARY -->
  <div class="page" id="section-dashboard">
    <div class="header">
      <h1>Ethical AI Evaluation Report</h1>
      <div class="header-meta">
        <span><strong>Project:</strong> ${project.title || 'Untitled Project'}</span>
        <span><strong>Generated:</strong> ${formatDate(options.generatedAt || new Date())}</span>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="dashboard-card">
        <h3>Overall Ethical Risk</h3>
        <div class="stat-value" style="color: ${riskTier.color}">
          ${overallRisk.toFixed(2)}
        </div>
        <div class="stat-label">
          <span class="risk-badge" style="background-color: ${riskTier.color}">${riskTier.label}</span>
        </div>
        <div style="margin-top: 0.3cm; font-size: 10pt; color: #6b7280;">
          Cumulative risk volume across all evaluators.
        </div>
      </div>

      <div class="dashboard-card">
        <h3>Ethical Tensions</h3>
        <div class="stat-value">${tensions.summary?.total || 0}</div>
        <div class="stat-label">Total Tensions</div>
        <div style="margin-top: 0.3cm; font-size: 10pt; color: #6b7280;">
          ${tensions.summary?.accepted || 0} Accepted, ${tensions.summary?.underReview || 0} Under Review
        </div>
      </div>
    </div>

    <!-- RESTORED: Ethical Principles Risk Overview Table -->
    <div class="section">
      <h3>Ethical Principles Risk Overview</h3>
      <table>
        <thead>
          <tr>
            <th>Ethical Principle</th>
            <th>Cumulative Risk</th>
            <th>Risk Level</th>
            <th>Interpretation</th>
          </tr>
        </thead>
        <tbody>
          ${(() => {
      const byPrinciple = scoring.byPrincipleOverall || {};
      const principles = Object.keys(byPrinciple);
      if (principles.length === 0) {
        return '<tr><td colspan="4">No principle data available.</td></tr>';
      }
      return principles.map(principle => {
        const data = byPrinciple[principle];
        if (data === null) {
          return '<tr><td>' + principle + '</td><td>N/A</td><td>Not Evaluated</td><td>No data submitted.</td></tr>';
        }
        const risk = data.risk !== undefined ? data.risk : (data.avg !== undefined ? data.avg : 0);
        const questionCount = typeof data.n === 'number' ? data.n : 0;
        const expertCount = typeof data.count === 'number' && data.count > 0 ? data.count : 1;

        // NORMALIZED LABELING logic
        // Verify not dividing by zero
        const denominator = (questionCount > 0 ? questionCount : 1) * expertCount;
        const normalizedRisk = risk / denominator;

        let riskLevel = 'Minimal';
        let interpretation = 'No significant ethical concerns identified.';
        if (normalizedRisk >= 3.5) {
          riskLevel = 'Critical';
          interpretation = 'Severe ethical issues identified. Immediate action required.';
        } else if (normalizedRisk >= 2.5) {
          riskLevel = 'High';
          interpretation = 'Significant ethical concerns requiring attention.';
        } else if (normalizedRisk >= 1.5) {
          riskLevel = 'Medium';
          interpretation = 'Multiple issues identified under this principle.';
        } else if (normalizedRisk >= 0.5) {
          riskLevel = 'Low';
          interpretation = 'Minor ethical concerns identified. Monitor as needed.';
        }

        let riskColor = '#10b981'; // Green
        if (normalizedRisk >= 3.5) riskColor = '#dc2626'; // Red
        else if (normalizedRisk >= 2.5) riskColor = '#f97316'; // Orange
        else if (normalizedRisk >= 1.5) riskColor = '#f59e0b'; // Amber
        else if (normalizedRisk >= 0.5) riskColor = '#84cc16'; // Light green

        const qLabel = questionCount === 1 ? '1 Question' : `${questionCount} Questions`;

        return '<tr><td>' + principle + '</td>' +
          '<td style="font-weight: bold; color: ' + riskColor + ';">' + risk.toFixed(2) + ' <span style="font-size: 8pt; font-weight: normal; color: #6b7280;">(' + qLabel + ')</span></td>' +
          '<td><span class="risk-badge" style="background-color: ' + riskColor + '; color: white;">' + riskLevel + '</span></td>' +
          '<td style="font-size: 10pt;">' + interpretation + '</td></tr>';
      }).join('');
    })()}
        </tbody>
      </table>
    </div>
    ${geminiNarrative?.executiveSummary && geminiNarrative.executiveSummary.length > 0 ? `
    <div class="section">
      <h2>Executive Summary</h2>
      <ul style="margin-left: 1.5cm; margin-top: 0.5cm;">
        ${geminiNarrative.executiveSummary.map(point => `<li style="margin-bottom: 0.3cm;">${point}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <!-- Fallback Markdown Narrative if Exec Summary Missing -->
    ${geminiNarrative?.markdown && (!geminiNarrative?.executiveSummary || geminiNarrative.executiveSummary.length === 0) ? `
    <div class="section">
      ${(() => {
        let html = geminiNarrative.markdown;
        // Basic Markdown to HTML conversion
        html = html.replace(/## (.+)/g, '<h2>$1</h2>');
        html = html.replace(/### (.+)/g, '<h3>$1</h3>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\- (.+)/g, '<li>$1</li>');
        html = html.replace(/\n\n/g, '<br>');
        return html;
      })()}
    </div>
    ` : ''}

     <!-- HEATMAP REMOVED (User Request) --> 
    <!--
      The Role x Principle Risk Matrix has been removed.
    -->
  </div>

  <!-- PAGE 2: TENSIONS & RECOMMENDATIONS -->
  <div class="page">
    <div class="section" id="section-tensions">
      <h2>Ethical Tensions</h2>
      ${((options.analytics?.tensionsTable && options.analytics.tensionsTable.length > 0) || (tensions.list && tensions.list.length > 0)) ? `
      <table>
        <thead>
          <tr>
            <th>Conflict</th>
            <th>Severity</th>
            <th>State</th>
            <th>Consensus</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          ${(options.analytics?.tensionsTable || tensions.list || []).map(t => {
        const conflictLabel = `${t.conflict?.principle1 || t.principle1 || ''} <-> ${t.conflict?.principle2 || t.principle2 || ''}`;
        const agreePct = t.agreePct || t.consensus?.agreePct || 0;
        const evidenceCount = t.evidenceCount || t.evidence?.count || 0;
        return `
            <tr>
              <td>${conflictLabel}</td>
              <td><span class="risk-badge" style="background:${t.severityLevel === 'Critical' ? '#dc2626' : (t.severityLevel === 'High' ? '#f97316' : '#f59e0b')}">${t.severityLevel || 'Unknown'}</span></td>
              <td>${t.reviewState || 'Proposed'}</td>
              <td>${agreePct.toFixed(0)}%</td>
              <td>${evidenceCount} items</td>
            </tr>
            `;
      }).join('')}
        </tbody>
      </table>
      ` : '<p>No ethical tensions identified.</p>'}
    </div>

    ${geminiNarrative?.recommendations && geminiNarrative.recommendations.length > 0 ? `
    <div class="section" id="section-recommendations">
      <h2>Prioritized Recommendations</h2>
      <table>
        <thead>
          <tr>
            <th>Recommendation</th>
            <th>Priority</th>
            <th>Owner</th>
            <th>Timeline</th>
          </tr>
        </thead>
        <tbody>
          ${geminiNarrative.recommendations.map(rec => `
            <tr>
              <td>${rec.title || ''}</td>
              <td><span class="risk-badge" style="background:${rec.priority === 'High' ? '#ef4444' : (rec.priority === 'Medium' ? '#f59e0b' : '#10b981')}">${rec.priority || 'Med'}</span></td>
              <td>${rec.ownerRole || 'Team'}</td>
              <td>${rec.timeline || 'TBD'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
  </div>

  <!-- PAGE 3: METHODOLOGY & APPENDIX -->
  <div class="page">
    <div class="section">
      <h2>Methodology & Data Sources</h2>
      <p>This report matches the Z-Inspection methodology for ethical AI evaluation.</p>
      
      <h3>Risk Calculation</h3>
      <ul>
        <li><strong>Question Risk:</strong> Importance x Unmitigated Ethical Risk.</li>
        <li><strong>Aggregated Risk:</strong> Cumulative sum across all questions.</li>
      </ul>
      <p><em>Note: All numeric metrics are deterministic and traceable to MongoDB data.</em></p>
    </div>
    
    <div class="section">
      <h2>Appendix: Evaluators</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
           ${(options.analytics?.evaluators || []).map(e => `
              <tr>
                <td>${e.name || 'Unknown'}</td>
                <td>${e.role || 'unknown'}</td>
                <td>Submitted</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <p>Ethical AI Evaluation Report - ${project.title} | Generated: ${formatDate(new Date())}</p>
  </div>
</body>
</html>`;
}

module.exports = { generateHTMLReport };
