/**
 * HTML Report Template Service
 * Generates professional dashboard-style HTML report for PDF conversion
 * Includes charts, tables, and internal navigation links
 */

/**
 * Generate HTML report template with dashboard layout
 * @param {Object} reportMetrics - From reportMetricsService
 * @param {Object} geminiNarrative - Narrative from Gemini
 * @param {Object} chartImages - Base64 encoded chart images
 * @param {Object} options - Additional options
 * @returns {string} Complete HTML string
 */
function generateHTMLReport(reportMetrics, geminiNarrative, chartImages = {}, options = {}) {
  const project = reportMetrics.project || {};
  const coverage = reportMetrics.coverage || {};
  const scoring = reportMetrics.scoring || {};
  const tensions = reportMetrics.tensions || {};
  const topRiskDrivers = reportMetrics.topRiskDrivers || {};
  const evaluators = reportMetrics.evaluators || {};

  // Helper to encode base64 images (supports Chart Contract objects)
  const getChartImage = (key) => {
    if (!chartImages[key]) {
      return '';
    }

    const img = chartImages[key];

    // Chart Contract object (has .pngBase64 and .meta properties)
    if (typeof img === 'object' && img.pngBase64) {
      // pngBase64 might already have data: prefix
      if (img.pngBase64.startsWith('data:image/')) {
        return img.pngBase64;
      }
      // Add data: prefix if missing
      if (img.pngBase64.length > 0) {
        return `data:image/png;base64,${img.pngBase64}`;
      }
      // Empty base64 (placeholder failed) - return empty
      return '';
    }

    // Already a data URI string (legacy format)
    if (typeof img === 'string' && img.startsWith('data:image/')) {
      return img;
    }

    // Buffer - convert to data URI (legacy format)
    if (Buffer.isBuffer(img)) {
      return `data:image/png;base64,${img.toString('base64')}`;
    }

    // Uint8Array - convert to Buffer then data URI (legacy format)
    if (img instanceof Uint8Array) {
      return `data:image/png;base64,${Buffer.from(img).toString('base64')}`;
    }

    // Object with buffer property (legacy format)
    if (typeof img === 'object' && img.buffer) {
      const buffer = Buffer.isBuffer(img.buffer) ? img.buffer : Buffer.from(img.buffer);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }

    // Plain base64 string (without data: prefix) (legacy format)
    if (typeof img === 'string' && img.length > 0) {
      return `data:image/png;base64,${img}`;
    }

    // Fallback: return empty if we can't convert
    return '';
  };

  // Helper to get chart status/reason for displaying notes
  const getChartStatus = (key) => {
    if (!chartImages[key]) {
      return null;
    }

    const img = chartImages[key];

    // Chart Contract object
    if (typeof img === 'object' && img.meta) {
      return {
        status: img.meta.status || 'unknown',
        reason: img.meta.reason || '',
        title: img.title || key
      };
    }

    // Legacy format - assume ready
    return {
      status: 'ready',
      reason: '',
      title: key
    };
  };

  // Helper to format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Risk tier mapping using shared function
  // RISK MODEL: Higher score = Higher Risk (colors: Green -> Red)
  const { getRiskLabel, colorForScore } = require('../utils/riskScale');

  // Helper to get risk tier object
  const getRiskTier = (score) => ({
    label: getRiskLabel(score, 'label', 'en'),
    color: colorForScore(score),
    shortLabel: getRiskLabel(score, 'short', 'en')
  });

  // Use overallRisk (new) or avg (legacy fallback)
  const overallRisk = scoring.totalsOverall?.overallRisk ?? (scoring.totalsOverall?.avg || 0);
  const riskTier = getRiskTier(overallRisk);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ethical AI Evaluation Report - ${project.title || 'Project'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1f2937;
      background: #ffffff;
    }
    
    .page {
      page-break-after: always;
      padding: 2cm 1.5cm;
      min-height: 29.7cm;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    /* Header */
    .header {
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 0.5cm;
      margin-bottom: 1cm;
    }
    
    .header h1 {
      font-size: 24pt;
      color: #1e40af;
      margin-bottom: 0.2cm;
    }
    
    .header-meta {
      font-size: 9pt;
      color: #6b7280;
      display: flex;
      gap: 1cm;
    }
    
    /* Dashboard Grid */
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1cm;
      margin-bottom: 1cm;
    }
    
    .dashboard-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.8cm;
    }
    
    .dashboard-card h3 {
      font-size: 12pt;
      color: #374151;
      margin-bottom: 0.4cm;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 0.2cm;
    }
    
    .stat-value {
      font-size: 28pt;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 0.2cm;
    }
    
    .stat-label {
      font-size: 9pt;
      color: #6b7280;
    }
    
    /* Charts */
    .chart-container {
      margin: 1cm 0;
      page-break-inside: avoid;
    }
    
    .chart-image {
      width: 100%;
      max-width: 100%;
      height: auto;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
    }
    
    .chart-legend {
      background: #f3f4f6;
      border-left: 4px solid #3b82f6;
      padding: 0.5cm;
      margin-top: 0.5cm;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    
    .chart-legend h4 {
      font-size: 10pt;
      margin-bottom: 0.3cm;
      color: #1f2937;
    }
    
    .chart-legend ul {
      margin-left: 1cm;
      color: #4b5563;
    }
    
    /* Navigation Links */
    .quick-nav {
      background: #eff6ff;
      border: 1px solid #3b82f6;
      border-radius: 6px;
      padding: 0.6cm;
      margin-bottom: 1cm;
      page-break-inside: avoid;
    }
    
    .quick-nav h3 {
      font-size: 11pt;
      color: #1e40af;
      margin-bottom: 0.3cm;
    }
    
    .quick-nav-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5cm;
    }
    
    .quick-nav-links a {
      color: #2563eb;
      text-decoration: underline;
      font-size: 9pt;
    }
    
    .quick-nav-links a:hover {
      color: #1d4ed8;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.8cm 0;
      page-break-inside: avoid;
      font-size: 9pt;
    }
    
    table th {
      background: #3b82f6;
      color: white;
      padding: 0.4cm;
      text-align: left;
      font-weight: 600;
    }
    
    table td {
      padding: 0.3cm;
      border-bottom: 1px solid #e5e7eb;
    }
    
    table tr:nth-child(even) {
      background: #f9fafb;
    }
    
    /* Sections */
    .section {
      margin: 1.5cm 0;
      page-break-inside: avoid;
    }
    
    .section h2 {
      font-size: 18pt;
      color: #1e40af;
      margin-bottom: 0.5cm;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 0.2cm;
    }
    
    .section h3 {
      font-size: 14pt;
      color: #374151;
      margin-top: 0.8cm;
      margin-bottom: 0.4cm;
    }
    
    /* Risk Badges */
    .risk-badge {
      display: inline-block;
      padding: 0.2cm 0.5cm;
      border-radius: 4px;
      font-size: 9pt;
      font-weight: 600;
      color: white;
    }
    
    .risk-critical { background: #dc2626; }
    .risk-high { background: #ef4444; }
    .risk-moderate { background: #f59e0b; }
    .risk-low { background: #10b981; }
    
    /* Footer */
    .footer {
      position: fixed;
      bottom: 1cm;
      left: 1.5cm;
      right: 1.5cm;
      text-align: center;
      font-size: 8pt;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      padding-top: 0.3cm;
    }
    
    /* Print styles */
    @media print {
      .page {
        margin: 0;
        padding: 2cm 1.5cm;
      }
      
      a {
        color: #2563eb;
        text-decoration: underline;
      }
    }
  </style>
</head>
  <body>
  <!-- COVER PAGE / DASHBOARD -->
  <div class="page" id="section-dashboard">
    <div class="header">
      <h1>Ethical AI Evaluation Report</h1>
      <div class="header-meta">
        <span><strong>Project:</strong> ${project.title || 'Untitled Project'}</span>
        <span><strong>Category:</strong> ${project.category || 'N/A'}</span>
        <span><strong>Generated:</strong> ${formatDate(options.generatedAt || new Date())}</span>
      </div>
    </div>

    <!-- Quick Navigation -->
    <div class="quick-nav">
      <h3>Quick Navigation</h3>
      <div class="quick-nav-links">
        <a href="#section-dashboard">Dashboard</a>
        <a href="#section-top-risks">Risks</a>
        <a href="#section-tensions">Tensions</a>
        <a href="#section-recommendations">Recommendations</a>
        <a href="#section-principles">Principle Analysis</a>
        <a href="#section-methodology">Methodology</a>
        <a href="#section-appendix">Appendix</a>
      </div>
    </div>

    <!-- Executive Dashboard -->
    <div class="dashboard-grid">
      <div class="dashboard-card">
        <h3>Overall Ethical Risk (Cumulative)</h3>
        <div class="stat-value" style="color: ${riskTier.color}">
          ${overallRisk.toFixed(2)}
        </div>
        <div class="stat-label">
          <span class="risk-badge" style="background-color: ${riskTier.color}">${riskTier.label}</span>
        </div>
        <div style="margin-top: 0.3cm; font-size: 9pt; color: #6b7280;">
          This score represents the cumulative volume and severity of identified ethical issues across all questions and experts.
        </div>
      </div>


      <div class="dashboard-card">
        <h3>Ethical Tensions</h3>
        <div class="stat-value">${tensions.summary?.total || 0}</div>
        <div class="stat-label">Total Tensions Identified</div>
        <div style="margin-top: 0.3cm; font-size: 9pt; color: #6b7280;">
          ${tensions.summary?.accepted || 0} Accepted, ${tensions.summary?.underReview || 0} Under Review, ${tensions.summary?.disputed || 0} Disputed
        </div>
      </div>

      <div class="dashboard-card">
        <h3>Evidence Coverage</h3>
        <div class="stat-value">${options.analytics?.evidenceMetrics?.coveragePct?.toFixed(1) || tensions.summary?.evidenceCoveragePct?.toFixed(1) || 0}%</div>
        <div class="stat-label">Tensions with Evidence</div>
        <div style="margin-top: 0.3cm; font-size: 9pt; color: #6b7280;">
          ${options.analytics?.tensionsSummary?.total > 0
      ? Math.round((options.analytics.evidenceMetrics?.coveragePct / 100) * options.analytics.tensionsSummary.total)
      : (tensions.summary?.total > 0 ? Math.round((tensions.summary.evidenceCoveragePct / 100) * tensions.summary.total) : 0)} of ${options.analytics?.tensionsSummary?.total || tensions.summary?.total || 0} tensions
        </div>
      </div>
    </div>

    <!-- Principle Risk Table (REPLACES CHART) -->
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
          return '<tr><td>' + principle + '</td><td>N/A</td><td>Not Evaluated</td><td>No data submitted for this principle.</td></tr>';
        }
        const risk = data.risk !== undefined ? data.risk : (data.avg !== undefined ? data.avg : 0);
        const questionCount = typeof data.n === 'number' ? data.n : 0; // Unique questions for this principle

        // NORMALIZED LABELING: Divide cumulative risk by question count
        // This prevents inflation where principles with many questions always show CRITICAL
        const normalizedRisk = risk / questionCount;

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
          interpretation = 'Multiple issues identified under this principle requiring attention.';
        } else if (normalizedRisk >= 0.5) {
          riskLevel = 'Low';
          interpretation = 'Minor ethical concerns identified. Monitor and address as needed.';
        }

        // Color based on normalized risk
        let riskColor = '#10b981'; // Green - Minimal
        if (normalizedRisk >= 3.5) riskColor = '#dc2626'; // Red - Critical
        else if (normalizedRisk >= 2.5) riskColor = '#f97316'; // Orange - High
        else if (normalizedRisk >= 1.5) riskColor = '#f59e0b'; // Amber - Medium
        else if (normalizedRisk >= 0.5) riskColor = '#84cc16'; // Light green - Low

        return '<tr><td>' + principle + '</td>' +
          '<td style="font-weight: bold; color: ' + riskColor + ';">' + risk.toFixed(2) + ' <span style="font-size: 8pt; font-weight: normal; color: #6b7280;">(' + questionCount + ' Question' + (questionCount !== 1 ? 's' : '') + ')</span></td>' +
          '<td><span class="risk-badge" style="background-color: ' + riskColor + '; color: white; padding: 4px 8px; border-radius: 4px;">' + riskLevel + '</span></td>' +
          '<td style="font-size: 9pt;">' + interpretation + '</td></tr>';
      }).join('');
    })()}
        </tbody>
      </table>
      
      <!-- Ethical Risk Summary -->
      <div style="margin-top: 1cm; padding: 0.8cm; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h4 style="margin-bottom: 0.4cm;">Ethical Risk Summary</h4>
        <p><strong>Total Cumulative Ethical Risk:</strong> ${overallRisk.toFixed(2)}</p>
        <p><strong>Critical Risk Principles:</strong> ${(() => {
      const byPrinciple = scoring.byPrincipleOverall || {};
      // Count principles where normalized risk (cumulative / questionCount) >= 3.5
      return Object.values(byPrinciple).filter(d => {
        if (!d) return false;
        const risk = d.risk ?? d.avg ?? 0;
        const n = typeof d.n === 'number' ? d.n : 1;
        return (risk / n) >= 3.5;
      }).length;
    })()}</p>
        <p style="margin-top: 0.4cm; font-style: italic; color: #6b7280;">
          Risk values shown are cumulative across questions and experts. Risk labels (Minimal/Low/Medium/High/Critical) are based on 
          normalized per-question averages to ensure fair comparison across principles with different question counts.
        </p>
      </div>
    </div>
    
    <!-- TASK 7: Evidence charts removed (invalid/misleading per Z-Inspection methodology) -->

    <!-- Executive Summary (structured) -->
    ${geminiNarrative?.executiveSummary && geminiNarrative.executiveSummary.length > 0 ? `
    <div class="section">
      <h2>Executive Summary</h2>
      <ul style="margin-left: 1.5cm; margin-top: 0.5cm;">
        ${geminiNarrative.executiveSummary.map(point => `<li style="margin-bottom: 0.3cm;">${point}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <!-- Narrative Content (markdown fallback) -->
    ${geminiNarrative?.markdown && (!geminiNarrative?.executiveSummary || geminiNarrative.executiveSummary.length === 0) ? `
    <div class="section" style="margin-top: 1cm;">
      <div style="font-family: inherit; line-height: 1.6;">
        ${(() => {
        let html = geminiNarrative.markdown;
        // Convert headers
        html = html.replace(/^## (.+)$/gm, '<h2 style="margin-top: 1cm; margin-bottom: 0.5cm; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 0.2cm;">$1</h2>');
        html = html.replace(/^### (.+)$/gm, '<h3 style="margin-top: 0.8cm; margin-bottom: 0.4cm; color: #374151;">$1</h3>');
        // Convert bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Convert italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Convert bullet lists
        html = html.replace(/^- (.+)$/gm, '<li style="margin-left: 1.5cm; margin-bottom: 0.3cm;">$1</li>');
        // Wrap consecutive list items in ul
        html = html.replace(/(<li[^>]*>.*?<\/li>(?:\s*<li[^>]*>.*?<\/li>)*)/gs, '<ul style="margin-top: 0.5cm; margin-bottom: 0.5cm;">$1</ul>');
        // Convert line breaks
        html = html.replace(/\n\n/g, '</p><p style="margin-top: 0.5cm; margin-bottom: 0.5cm;">');
        html = html.replace(/\n/g, '<br>');
        // Wrap in paragraph
        if (!html.startsWith('<h')) {
          html = '<p>' + html + '</p>';
        }
        return html;
      })()}
      </div>
    </div>
    ` : ''}
  </div>

  <!-- TOP RISK DRIVERS SECTION -->
  <div class="page">
    <div class="section" id="section-top-risks">
      <h2>Top Risk Drivers</h2>
      <p style="margin-bottom: 0.5cm; color: #6b7280; font-size: 9pt;">
        <strong>Note:</strong> AvgRisk is derived from scores collection and mapped to principle tags. 
        Only questions with submitted responses are included.
      </p>
      
      ${((options.analytics?.topRiskyQuestions && options.analytics.topRiskyQuestions.length > 0) || (topRiskDrivers.questions && topRiskDrivers.questions.length > 0)) ? `
      <table>
        <thead>
          <tr>
            <th>Question ID</th>
            <th>Question Text</th>
            <th>Principle</th>
            <th>Principle</th>
            <th>Total Risk Impact</th>
            <th>Type</th>
            <th>Role(s) Who Answered</th>
            <th>Answer Snippet</th>
          </tr>
        </thead>
        <tbody>
          ${(options.analytics?.topRiskyQuestions || topRiskDrivers.questions || []).slice(0, 10).map((q, idx) => {
        // Use totalRiskContribution if available (new logic), otherwise avg (legacy)
        const riskVal = q.totalRiskContribution !== undefined ? q.totalRiskContribution : (q.avgRiskScore || q.score || 0);

        // Get answer snippet from topRiskyQuestionContext
        const contextItem = options.analytics?.topRiskyQuestionContext?.find(c => c.questionId === q.questionId);
        let excerpt = '';
        if (contextItem?.answerSnippet) {
          excerpt = contextItem.answerSnippet.substring(0, 140) + (contextItem.answerSnippet.length > 140 ? '...' : '');
        } else if (q.answerExcerpts && q.answerExcerpts.length > 0) {
          const excerptText = q.answerExcerpts[0];
          if (excerptText === '[Answer is empty / not captured]') {
            excerpt = 'Answer is empty / not captured';
          } else {
            excerpt = excerptText.substring(0, 140) + (excerptText.length > 140 ? '...' : '');
          }
        } else if (q.answerStatus === 'submitted_empty') {
          excerpt = 'Answer is empty / not captured';
        } else {
          // Skip questions without submitted text answers
          return '';
        }

        // Use questionText if available, otherwise fallback to questionCode or questionId
        const questionDisplay = q.questionText || q.questionCode || q.questionId;
        const questionId = q.questionId || q.questionCode || 'N/A';
        // Determine question type (first 12 = common/core)
        const questionType = q.isCommonQuestion !== undefined
          ? (q.isCommonQuestion ? 'Common (Core)' : 'Role-Specific')
          : (q.questionOrder && q.questionOrder <= 12 ? 'Common (Core)' : 'Role-Specific');
        // Get roles who answered
        const rolesLabel = (q.rolesWhoAnswered && q.rolesWhoAnswered.length > 0)
          ? q.rolesWhoAnswered.join(', ')
          : (q.rolesMostAtRisk && q.rolesMostAtRisk.length > 0)
            ? q.rolesMostAtRisk.join(', ')
            : (q.rolesInvolved && q.rolesInvolved.length > 0)
              ? q.rolesInvolved.join(', ')
              : 'N/A';
        return `
            <tr>
              <td style="font-size: 8pt;">${questionId}</td>
              <td style="font-size: 8pt;">${questionDisplay}</td>
              <td>${q.principleKey || q.principle || 'Unknown'}</td>
              <td><strong>${riskVal.toFixed(2)}</strong></td>
              <td>${questionType}</td>
              <td style="font-size: 8pt;">${rolesLabel}</td>
              <td style="font-size: 8pt; color: #4b5563;">${excerpt}</td>
            </tr>
            `;
      }).join('')}
        </tbody>
      </table>
      ` : '<p>No risk drivers identified.</p>'}
      
      ${geminiNarrative?.topRiskDriversNarrative ? `
      <div style="margin-top: 1cm;">
        <h3>Analysis</h3>
        ${geminiNarrative.topRiskDriversNarrative.slice(0, 5).map(n => `
          <div style="margin-bottom: 0.5cm; padding: 0.4cm; background: #f9fafb; border-left: 3px solid #3b82f6;">
            <p><strong>${n.principle || 'Unknown'}:</strong> ${n.whyRisky || ''}</p>
            <p style="margin-top: 0.2cm; font-size: 9pt; color: #6b7280;">
              <strong>Recommended:</strong> ${n.recommendedAction || ''}
            </p>
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
  </div>

  <!-- ETHICAL TENSIONS SECTION -->
  <div class="page">
    <div class="section" id="section-tensions">
      <div style="margin-bottom: 0.5cm;">
        <a href="#section-dashboard" style="color: #2563eb; text-decoration: underline; font-size: 9pt;">← Back to Dashboard</a>
      </div>
      <h2>Ethical Tensions</h2>
      
      <!-- Tension Charts -->
      ${getChartImage('tensionReviewStateChart') ? `
      <div class="chart-container">
        <h3>Tension Review State Distribution</h3>
        <img src="${getChartImage('tensionReviewStateChart')}" alt="Tension Review State Chart" class="chart-image" />
        <div class="chart-legend">
          <h4>Review State Explanation</h4>
          <p>Review state is computed from votes/consensus rules:</p>
          <ul>
            <li><strong>Proposed:</strong> Newly identified, awaiting review</li>
            <li><strong>Under Review:</strong> Active discussion in progress</li>
            <li><strong>Accepted:</strong> Consensus reached, mitigation approved</li>
            <li><strong>Disputed:</strong> Conflicting opinions, requires resolution</li>
            <li><strong>Resolved:</strong> Tension addressed and closed</li>
          </ul>
        </div>
      </div>
      ` : ''}
      
      ${getChartImage('tensionSeverityChart') ? `
      <div class="chart-container">
        <h3>Tension Severity Distribution</h3>
        <img src="${getChartImage('tensionSeverityChart')}" alt="Tension Severity Chart" class="chart-image" />
      </div>
      ` : ''}
      
      <!-- TASK 7: Evidence charts removed (invalid/misleading per Z-Inspection methodology) -->

      <!-- Tensions Table -->
      ${((options.analytics?.tensionsTable && options.analytics.tensionsTable.length > 0) || (tensions.list && tensions.list.length > 0)) ? `
      <table>
        <thead>
          <tr>
            <th>Conflict Principles</th>
            <th>Severity</th>
            <th>Review State</th>
            <th>Agree/Disagree</th>
            <th>Agree %</th>
            <th>Evidence Count</th>
            <th>Evidence Types</th>
            <th>Discussions</th>
            <th>Claim (One-line)</th>
            <th>Created By</th>
          </tr>
        </thead>
        <tbody>
          ${(options.analytics?.tensionsTable || tensions.list || []).map(t => {
        const evidenceCount = t.evidenceCount || t.evidence?.count || 0;
        const evidenceTypes = t.evidenceTypes || t.evidence?.types || [];
        const evidenceTypesLabel = evidenceTypes.length > 0
          ? evidenceTypes.join(', ')
          : 'N/A';
        const agreeCount = t.agreeCount || t.consensus?.agreeCount || 0;
        const disagreeCount = t.disagreeCount || t.consensus?.disagreeCount || 0;
        const agreePct = t.agreePct || t.consensus?.agreePct || 0;
        const discussionCount = t.discussionCount || t.commentCount || 0;
        const claimOneLine = (t.claim || t.claimStatement || 'Not provided').substring(0, 80) +
          ((t.claim || t.claimStatement) && (t.claim || t.claimStatement).length > 80 ? '...' : '');
        const conflictLabel = `${t.conflict?.principle1 || t.principle1 || ''} ↔ ${t.conflict?.principle2 || t.principle2 || ''}`;
        return `
            <tr>
              <td>${conflictLabel}</td>
              <td><span class="risk-badge risk-${(t.severityLevel || 'Unknown').toLowerCase()}">${t.severityLevel || 'Unknown'}</span></td>
              <td>${t.reviewState || t.consensus?.reviewState || 'Proposed'}</td>
              <td>${agreeCount} / ${disagreeCount}</td>
              <td>${agreePct.toFixed(1)}%</td>
              <td>${evidenceCount}</td>
              <td style="font-size: 8pt;">${evidenceTypesLabel}</td>
              <td>${discussionCount}</td>
              <td style="font-size: 8pt;">${claimOneLine}</td>
              <td style="font-size: 8pt;">${t.createdByName || t.createdByRole || 'Unknown'}</td>
            </tr>
            `;
      }).join('')}
        </tbody>
      </table>
      <p style="font-size: 8pt; color: #6b7280; margin-top: 0.5cm; font-style: italic;">
        Note: Votes exclude the tension creator/owner (they cannot vote on their own tensions).
      </p>
      ` : '<p>No ethical tensions identified.</p>'}
      
      ${geminiNarrative?.tensionsNarrative ? `
      <div style="margin-top: 1cm;">
        <h3>Detailed Tension Analysis</h3>
        ${geminiNarrative.tensionsNarrative.map(n => `
          <div style="margin-bottom: 0.8cm; padding: 0.5cm; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px;">
            <h4 style="font-size: 11pt; margin-bottom: 0.3cm;">${n.summary || 'Tension Summary'}</h4>
            <p style="margin-bottom: 0.3cm;"><strong>Why it matters:</strong> ${n.whyItMatters || ''}</p>
            <p style="margin-bottom: 0.3cm;"><strong>Evidence Status:</strong> ${n.evidenceStatus || 'Unknown'}</p>
            <p style="margin-bottom: 0.3cm;"><strong>Mitigation:</strong> ${n.mitigationAssessment || 'No mitigation proposed'}</p>
            <p><strong>Next Step:</strong> ${n.nextStep || ''}</p>
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
  </div>

  <!-- PRINCIPLE ANALYSIS SECTION -->
  <div class="page">
    <div class="section" id="section-principles">
      <div style="margin-bottom: 0.5cm;">
        <a href="#section-dashboard" style="color: #2563eb; text-decoration: underline; font-size: 9pt;">← Back to Dashboard</a>
      </div>
      <h2>Principle-by-Principle Analysis</h2>
      
      ${geminiNarrative?.principleFindings ? geminiNarrative.principleFindings.map(finding => {
        const principleData = scoring.byPrincipleOverall[finding.principle];
        const principleRisk = principleData ? (principleData.risk ?? principleData.avg ?? 0) : 0;
        const pRiskTier = getRiskTier(principleRisk);
        return `
        <div style="margin-bottom: 1cm; padding: 0.6cm; background: #f9fafb; border-left: 4px solid ${pRiskTier.color};">
          <h3>${finding.principle || 'Unknown Principle'}</h3>
          ${principleData ? `
          <div style="margin: 0.4cm 0;">
            <strong>Cumulative Risk:</strong> ${principleRisk.toFixed(2)} 
            <span class="risk-badge" style="margin-left: 0.5cm; background: ${pRiskTier.color}; color: white; padding: 4px 8px; border-radius: 4px;">${pRiskTier.label}</span>
          </div>
          <div style="font-size: 9pt; color: #6b7280; margin-bottom: 0.4cm;">
            Distribution: ${principleData.riskPct ? principleData.riskPct.toFixed(1) : 0}% High Risk | ${principleData.safePct ? principleData.safePct.toFixed(1) : 0}% Low Risk
            (${principleData.riskyCount || 0} risky, ${principleData.safeCount || 0} safe)
          </div>
          ` : ''}
          
          ${finding.whatLooksGood && finding.whatLooksGood.length > 0 ? `
          <div style="margin-top: 0.4cm;">
            <strong style="color: #10b981;">✓ Strengths:</strong>
            <ul style="margin-left: 1cm; margin-top: 0.2cm;">
              ${finding.whatLooksGood.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          ${finding.keyRisks && finding.keyRisks.length > 0 ? `
          <div style="margin-top: 0.4cm;">
            <strong style="color: #ef4444;">⚠ Key Risks:</strong>
            <ul style="margin-left: 1cm; margin-top: 0.2cm;">
              ${finding.keyRisks.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          ${finding.recommendedActions && finding.recommendedActions.length > 0 ? `
          <div style="margin-top: 0.4cm;">
            <strong style="color: #3b82f6;">→ Recommended Actions:</strong>
            <ul style="margin-left: 1cm; margin-top: 0.2cm;">
              ${finding.recommendedActions.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
        </div>
        `;
      }).join('') : '<p>No principle analysis available.</p>'}
    </div>
  </div>

  <!-- RECOMMENDATIONS SECTION -->
  ${geminiNarrative?.recommendations && geminiNarrative.recommendations.length > 0 ? `
  <div class="page">
    <div class="section" id="section-recommendations">
      <div style="margin-bottom: 0.5cm;">
        <a href="#section-dashboard" style="color: #2563eb; text-decoration: underline; font-size: 9pt;">← Back to Dashboard</a>
      </div>
      <h2>Prioritized Recommendations</h2>
      <table>
        <thead>
          <tr>
            <th>Recommendation</th>
            <th>Priority</th>
            <th>Owner Role</th>
            <th>Owner (Person)</th>
            <th>Timeline</th>
            <th>Success Metric</th>
            <th>Data Basis</th>
            <th>Linked To</th>
          </tr>
        </thead>
        <tbody>
          ${geminiNarrative.recommendations.map(rec => {
        // Owner person: use ownerPerson if available, otherwise "Assign owner"
        const ownerPerson = rec.ownerPerson || 'Assign owner';
        return `
            <tr>
              <td>${rec.title || ''}</td>
              <td><span class="risk-badge risk-${(rec.priority || 'Med').toLowerCase()}">${rec.priority || 'Med'}</span></td>
              <td>${rec.ownerRole || 'Project team'}</td>
              <td>${ownerPerson}</td>
              <td>${rec.timeline || 'TBD'}</td>
              <td style="font-size: 8pt;">${rec.successMetric || ''}</td>
              <td style="font-size: 8pt;">${rec.dataBasis || ''}</td>
              <td style="font-size: 8pt;">${rec.linkedTo ? rec.linkedTo.join(', ') : ''}</td>
            </tr>
          `;
      }).join('')}
        </tbody>
      </table>
    </div>
  </div>
  ` : ''}

    <!-- METHODOLOGY & APPENDIX -->
    <div class="page">
      <div class="section" id="section-methodology">
        <div style="margin-bottom: 0.5cm;">
          <a href="#section-dashboard" style="color: #2563eb; text-decoration: underline; font-size: 9pt;">← Back to Dashboard</a>
        </div>
        <h2>Methodology & Data Sources</h2>
      <p>This report is generated using the Z-Inspection methodology for ethical AI evaluation.</p>
      
      <h3 style="margin-top: 0.8cm;">Data Sources</h3>
      <ul style="margin-left: 1.5cm; margin-top: 0.4cm;">
        <li><strong>responses collection:</strong> All expert answers and qualitative context</li>
        <li><strong>scores collection:</strong> Canonical computed metrics (ONLY source of quantitative scores)</li>
        <li><strong>tensions collection:</strong> Ethical tensions, claims, evidence, mitigations, and consensus</li>
        <li><strong>projectassignments collection:</strong> Expert assignments and participation tracking</li>
      </ul>
      
      <div style="margin-top: 0.8cm; padding: 0.5cm; background: #fef3c7; border-left: 4px solid #f59e0b;">
        <p><strong>IMPORTANT:</strong> Quantitative scores come from the scores collection and are NOT computed by Gemini AI. 
        All numeric metrics are deterministic and traceable to MongoDB data.</p>
      </div>
      
      <h3 style="margin-top: 0.8cm;">Risk Calculation Methodology</h3>
      <ul style="margin-left: 1.5cm; margin-top: 0.4cm;">
        <li><strong>Per-Question Risk:</strong> 0 to 4 scale (Question Importance × Unmitigated Ethical Risk).</li>
        <li><strong>Aggregated Risk:</strong> Cumulative sum of all per-question risks.</li>
      </ul>
      <p style="margin-top: 0.3cm; color: #6b7280;"><em>Note: Aggregated risk is cumulative and unbounded. Higher values indicate greater volume and severity of ethical concerns.</em></p>
      
      <p style="margin-top: 0.4cm;"><strong>Ethical Risk Formula:</strong> Computed as: Question Importance × (1 − Answer Score). Risk values are cumulative across questions and experts and are NOT normalized, averaged, or capped.</p>
      
      <!-- Data Integrity Checks -->
      ${(() => {
      const consistencyChecks = options.reportMetrics?.consistencyChecks || reportMetrics?.consistencyChecks || {};
      if (!consistencyChecks || Object.keys(consistencyChecks).length === 0) {
        return '';
      }

      const hasErrors = consistencyChecks.errors && consistencyChecks.errors.length > 0;
      const hasWarnings = consistencyChecks.warnings && consistencyChecks.warnings.length > 0;

      const htmlBlock = [];

      if (!hasErrors && !hasWarnings) {
        htmlBlock.push(`
          <div style="margin-top: 0.8cm; padding: 0.5cm; background: #d1fae5; border-left: 4px solid #10b981; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #065f46;">✓ Data Integrity: All consistency checks passed</p>
          </div>`);
      } else {
        htmlBlock.push(`
          <div style="margin-top: 0.8cm; padding: 0.5cm; background: ${hasErrors ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${hasErrors ? '#dc2626' : '#f59e0b'}; border-radius: 4px;">
            <p style="margin: 0 0 0.3cm 0; font-weight: bold; color: ${hasErrors ? '#991b1b' : '#92400e'};">
              ${hasErrors ? '⚠ Data mismatch detected' : '⚠ Data Integrity Warnings'}
            </p>`);

        if (hasErrors) {
          htmlBlock.push(`<ul style="margin: 0.3cm 0 0 1.5cm; padding: 0; color: #991b1b;">`);
          consistencyChecks.errors.forEach(err => htmlBlock.push(`<li style="margin: 0.2cm 0;">${err}</li>`));
          htmlBlock.push(`</ul>`);
        }
        if (hasWarnings) {
          htmlBlock.push(`<ul style="margin: 0.3cm 0 0 1.5cm; padding: 0; color: #92400e;">`);
          consistencyChecks.warnings.forEach(warn => htmlBlock.push(`<li style="margin: 0.2cm 0;">${warn}</li>`));
          htmlBlock.push(`</ul>`);
        }
        htmlBlock.push(`</div>`);
      }
      return htmlBlock.join('');
    })()}
    </div>

    <div class="section" id="section-appendix" style="margin-top: 1.5cm;">
      <h2>Appendix</h2>
      
      <h3>Evaluators</h3>
      <p style="margin-bottom: 0.4cm;">Only evaluators with submitted responses are listed below:</p>
      <table>
        <thead>
          <tr>
                <th>Principle</th>
                <th>Cumulative Risk</th>
                <th>Risk Level</th>
                <th>Evaluators</th>
          </tr>
        </thead>
        <tbody>
          ${(options.analytics?.evaluators && options.analytics.evaluators.length > 0)
      ? options.analytics.evaluators.map(e => `
              <tr>
                <td>${e.name || 'Unknown'}</td>
                <td>${e.role || 'unknown'}</td>
                <td style="font-size: 8pt;">${e.email || 'N/A'}</td>
                <td>Submitted</td>
              </tr>
            `).join('')
      : (evaluators.withScores && evaluators.withScores.length > 0
        ? evaluators.withScores.map(d => {
          const riskClass = getRiskTier(d.score).class;
          const riskLabel = getRiskTier(d.score).label;
          const badgeClass = `risk-${riskClass}`;
          return `
                <tr>
                    <td>${d.principle}</td>
                    <td class="risk-cell ${riskClass}">${d.score.toFixed(2)}</td>
                    <td><span class="badge ${badgeClass}">${riskLabel}</span></td>
                    <td>${d.count}</td>
                </tr>
              `;
        }).join('')
        : '<tr><td colspan="4">No evaluators with submitted responses.</td></tr>'
      )
    }
        </tbody>
      </table>
      
      <!-- Note about assigned-but-not-submitted evaluators intentionally omitted:
           reports should be based on submitted evaluators only (no "team" requirement). -->
      
      <h3 style="margin-top: 0.8cm;">Limitations</h3>
      ${(() => {
      // Build deterministic limitations from dataQuality (NOT from Gemini)
      const dataQuality = options.reportMetrics?.dataQuality || {};
      const limitations = [];

      // 1. Submitted count check (reports are based on submitted evaluators only)
      const submittedCount = options.reportMetrics?.team?.submittedCount || options.analytics?.evaluators?.length || 0;

      if (submittedCount === 0) {
        limitations.push('No evaluators have submitted their responses. This report is based on incomplete data.');
      }

      // 2. Missing scores
      if (dataQuality.missingScores && dataQuality.missingScores.count > 0) {
        limitations.push(`${dataQuality.missingScores.count} evaluator(s) submitted responses but have no canonical scores in MongoDB. Scores may need to be recomputed.`);
      }

      // 3. Missing answer texts
      if (dataQuality.answerTexts) {
        if (dataQuality.answerTexts.submittedCountWithMissingText > 0) {
          if (dataQuality.answerTexts.submittedCountWithText === 0) {
            limitations.push(`Evaluators submitted scores but did not provide answer texts (${dataQuality.answerTexts.submittedCountWithMissingText} evaluator(s)).`);
          } else {
            limitations.push(`${dataQuality.answerTexts.submittedCountWithMissingText} evaluator(s) submitted responses but some answer texts are empty or not captured.`);
          }
        }
      }

      // 4. Missing evidence
      if (dataQuality.evidence && dataQuality.evidence.tensionsWithoutEvidenceCount > 0) {
        limitations.push(`${dataQuality.evidence.tensionsWithoutEvidenceCount} tension(s) lack evidence attachments (evidence coverage: ${dataQuality.evidence.evidenceCoveragePct}%).`);
      }

      // 5. Missing mitigations
      if (dataQuality.mitigation && dataQuality.mitigation.missingCount > 0) {
        limitations.push(`${dataQuality.mitigation.missingCount} tension(s) lack proposed mitigations (${dataQuality.mitigation.missingPct}% without mitigation).`);
      }

      // 6. Incomplete responses
      if (dataQuality.incompleteResponses && dataQuality.incompleteResponses.count > 0) {
        limitations.push(`${dataQuality.incompleteResponses.count} response(s) are incomplete (less than 80% of required questions answered).`);
      }

      // 7. Missing answers
      if (dataQuality.missingAnswers && dataQuality.missingAnswers.count > 0) {
        limitations.push(`${dataQuality.missingAnswers.count} required question(s) have no answers from any evaluator.`);
      }

      if (limitations.length > 0) {
        return `<ul style="margin-left: 1.5cm; margin-top: 0.4cm;">${limitations.map(lim => `<li>${lim}</li>`).join('')}</ul>`;
      } else {
        return '<p>No significant data quality limitations identified.</p>';
      }
    })()}
      
      <h3 style="margin-top: 0.8cm;">Glossary</h3>
      <ul style="margin-left: 1.5cm; margin-top: 0.4cm; font-size: 9pt;">
        <li><strong>Risk Score:</strong> Cumulative Ethical Risk contribution (Unbounded). Higher score = Higher risk.</li>
        <li><strong>Severity Levels:</strong> Severity reflects the cumulative magnitude of ethical risk contributions, not an average or percentage-based score.</li>
        <li><strong>Evidence:</strong> Policy documents, test results, user feedback, logs, incidents, or other supporting materials</li>
        <li><strong>Review State:</strong> Proposed, Under Review, Accepted, Disputed, or Resolved</li>
      </ul>
    </div>
  </div>

  <div class="footer">
    <p>Ethical AI Evaluation Report - ${project.title || 'Project'} | Generated: ${formatDate(options.generatedAt || new Date())} | Z-Inspection Platform</p>
  </div>
</body>
</html>`;

  return html;
}

module.exports = {
  generateHTMLReport
};

