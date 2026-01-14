/**
 * HTML Report Template Service
 * Generates professional dashboard-style HTML report for PDF conversion
 * Includes charts, tables, and internal navigation links
 */

const { getRiskLabel, colorForScore } = require('../utils/riskScale');
const fs = require('fs');
const path = require('path');

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

  // PHASE 6 FIX: Use normalized fields from reportEnrichmentService
  const overallTotals = reportMetrics.overallTotals || {};
  const scoringDisclosure = reportMetrics.scoringDisclosure || {};

  // Use pre-calculated normalized values
  // "displayRisk" here is the CUMULATIVE VOLUME, not a risk level
  const cumulativeRiskVolume = overallTotals.cumulativeRiskVolume ?? 0;

  // Normalized Average is what determines the label
  const normalizedAverage = overallTotals.averageERC ?? 0;
  const displayLabel = overallTotals.normalizedLabel || 'Unknown';
  // FORCE RECALCULATION of color to ensure new palette matches code
  const displayColor = colorForScore(normalizedAverage);

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
    
    .metric-row { display: flex; align-items: baseline; margin-bottom: 0.5cm; }
    .metric-value { font-size: 24pt; font-weight: bold; color: #1f2937; margin-right: 0.5cm; }
    .metric-label { font-size: 10pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    
    .sub-metric { font-size: 11pt; color: #4b5563; margin-top: 5px; }
    
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
    
    .disclosure-box {
      background-color: #f8fafc;
      border-left: 4px solid #64748b;
      padding: 15px;
      margin: 20px 0;
      font-size: 10pt;
      color: #334155;
    }
    
    .methodology-note {
      font-size: 9pt;
      color: #6b7280;
      font-style: italic;
      margin-top: 5px;
    }
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

    ${reportMetrics.validityStatus !== 'valid' ? `
    <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #b91c1c;">
      <strong>⚠️ DATA QUALITY NOTICE:</strong> The following data integrity issues were detected. Scores may be suppressed.
      <ul style="margin-left: 20px; margin-top: 5px;">
        ${(reportMetrics.validationErrors || []).map(e => `<li>${e}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <div class="dashboard-grid">
      <!-- Cumulative Risk Volume Card -->
      <div class="dashboard-card">
        <h3>Cumulative Risk Volume</h3>
        ${reportMetrics.overallTotals?._suppressed ? `
          <div class="metric-value" style="color: #9ca3af; font-size: 20pt;">Scores Suppressed</div>
          <div class="sub-metric">Data Validity Issue</div>
        ` : `
          <!-- Volume Display (Sum) -->
          <div class="metric-row">
            <div class="metric-value" style="color: #1f2937">
              ${cumulativeRiskVolume.toFixed(2)}
            </div>
          </div>

          <!-- MANDATORY CONTEXT -->
          <div style="font-size: 0.9em; color: #6b7280; margin-bottom: 10px;">
            Based on ${scoringDisclosure.quantitativeQuestions || 'N/A'} quantitative questions<br>
            (Maximum possible cumulative volume: ${scoringDisclosure.quantitativeQuestions ? (scoringDisclosure.quantitativeQuestions * 4).toFixed(2) : 'N/A'})
          </div>
          
          <!-- Normalized Average Display -->
          <div class="sub-metric">
            <strong>Normalized Average ERC:</strong> ${normalizedAverage.toFixed(2)} / 4
          </div>
          <div style="font-size: 0.8em; color: #9ca3af;">
            (ERC values are normalized on a 0–4 scale)
          </div>
          
          <!-- Risk Level Display based on NORMALIZED average -->
          <div class="sub-metric" style="margin-top: 10px;">
            Risk Level: 
            <span class="risk-badge" style="background-color: ${displayColor}">${displayLabel}</span>
          </div>
        `}
      </div>

      <!-- Ethical Tensions Card -->
      <div class="dashboard-card">
        <h3>Ethical Tensions</h3>
        <div class="metric-row">
          <div class="metric-value">${tensions.summary?.total || 0}</div>
          <div class="metric-label">Identified</div>
        </div>
        <div class="sub-metric">
          ${tensions.summary?.accepted || 0} Accepted, ${tensions.summary?.underReview || 0} Under Review
        </div>
      </div>
    </div>

    <!-- MANDATORY Qualitative Questions Disclosure -->
    <div class="disclosure-box">
      <strong>Total Questions Assessed:</strong> ${scoringDisclosure.totalQuestions || 93} total (${scoringDisclosure.quantitativeQuestions || 59} Quantitative, ${scoringDisclosure.qualitativeQuestions || 34} Qualitative)
      <br><br>
      ${scoringDisclosure.qualitativeQuestions || 34} qualitative (open-text) questions are excluded from quantitative risk scoring.
      These questions provide narrative insights that complement the quantitative analysis.
      ${scoringDisclosure.text ? `<br><br><span class="methodology-note">Note: ${scoringDisclosure.text}</span>` : ''}
    </div>

    <!-- RESTORED: Ethical Principles Risk Overview Table -->
    <div class="section">
      <h3>Ethical Principles Risk Overview</h3>
      <table>
        <thead>
          <tr>
            <th>Ethical Principle</th>
            <th>Cumulative Risk Volume</th>
            <th>Question Count</th>
            <th>Average ERC ( / 4 )</th>
            <th>Risk Level</th>
          </tr>
        </thead>
        <tbody>
          ${(() => {
      const byPrinciple = scoring.byPrincipleOverall || {};
      const principles = Object.keys(byPrinciple);
      if (principles.length === 0) {
        return '<tr><td colspan="5">No principle data available.</td></tr>';
      }
      return principles.map(principle => {
        const data = byPrinciple[principle];
        if (data === null) {
          return '<tr><td>' + principle + '</td><td>N/A</td><td>N/A</td><td>N/A</td><td>Not Evaluated</td></tr>';
        }

        // PHASE 6 FIX: Use correct fields from Phase 3 normalization
        const cumulativeRisk = data.cumulativeRisk ?? (data.risk || 0);
        // Average Risk IS the normalized ERC
        const averageRisk = data.averageRisk ?? 0;
        const normalizedLabel = data.normalizedLabel || data.riskLabel || 'Unknown';

        // FORCE RECALCULATION of color to ensure new palette matches code
        const normalizedColor = colorForScore(averageRisk);

        const questionCount = data.questionCount || 0;

        return '<tr>' +
          '<td>' + principle + '</td>' +
          '<td style="font-weight: bold; color: #4b5563;">' + cumulativeRisk.toFixed(2) + '</td>' +
          '<td>' + questionCount + '</td>' +
          '<td>' + averageRisk.toFixed(2) + ' / 4</td>' +
          '<td><span class="risk-badge" style="background-color: ' + normalizedColor + '; color: white;">' + normalizedLabel + '</span></td>' +
          '</tr>';
      }).join('');
    })()}
        </tbody>
      </table>
    </div>

    <!-- NEW: QUALITATIVE ANALYSIS SECTION -->
    ${geminiNarrative?.qualitativeAnalysis ? `
    <div class="section" style="page-break-before: always;">
      <h2>Qualitative Analysis of Open-Text Responses</h2>
      
      <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
        <h4 style="margin-top: 0; color: #1e40af;">Methodology</h4>
        <p style="margin-bottom: 10px; font-size: 10pt;">${geminiNarrative.qualitativeAnalysis.methodology || 'Qualitative analysis methodology.'}</p>
        <p style="margin-bottom: 0px; font-size: 10pt; font-style: italic;">${geminiNarrative.qualitativeAnalysis.interpretation || ''}</p>
      </div>

      ${geminiNarrative.qualitativeAnalysis.insights ? geminiNarrative.qualitativeAnalysis.insights.map(item => `
        <div style="margin-bottom: 15px;">
          <h3 style="font-size: 12pt; color: #374151; margin-bottom: 5px;">${item.principle} – Qualitative Insights</h3>
          <p>${item.insight}</p>
        </div>
      `).join('') : '<p>No specific qualitative insights recorded.</p>'}

      <div style="margin-top: 20px; padding: 10px; background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; font-size: 9pt; border-radius: 4px;">
        <strong>Disclaimer:</strong> ${geminiNarrative.qualitativeAnalysis.disclaimer || 'Qualitative insights are for context only.'}
      </div>
    </div>
    ` : ''}

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
              <td><span class="risk-badge" style="background:${t.severityLevel === 'Critical' ? '#b91c1c' : (t.severityLevel === 'High' ? '#ef4444' : '#f59e0b')}">${t.severityLevel || 'Unknown'}</span></td>
              <td>${t.reviewState || 'Proposed'}</td>
              <td>${agreePct.toFixed(0)}%</td>
              <td>${evidenceCount} items</td>
            </tr>
            `;
      }).join('')}
        </tbody>
      </table>
      ` : '<p>No explicit ethical tensions were formally flagged within the scoring model. However, qualitative considerations highlight areas that warrant continued attention.</p>'}
    </div>

  </div>

  <!-- PAGE 3: METHODOLOGY & APPENDIX -->
  <div class="page">
    <div class="section">
      <h2>Methodology & Data Sources</h2>
      <p>This report matches the Z-Inspection methodology for ethical AI evaluation.</p>
      
      <h3>Risk Calculation</h3>
      <ul>
        <li><strong>Question Risk:</strong> Importance (0-4) x Unmitigated Ethical Risk (0-1).</li>
        <li><strong>Cumulative Risk Volume:</strong> Sum of all ERC contributions. Used to understand total magnitude of risk.</li>
        <li><strong>Normalized Ethical Risk Level:</strong> Average ERC per question compared to 0-4 scale. This determines the Low/High/Critical label.</li>
      </ul>
      <p><em>Note: All numeric metrics are deterministic and traceable to MongoDB data.</em></p>
    </div>
    
    <div class="section">
      <h2>Appendix: Evaluators</h2>
      <p style="font-size: 10pt; color: #666; margin-bottom: 20px;">
        The ethical risk metrics aggregate all expert responses at the question level.
        While individual experts may differ, the normalized score reflects the combined
        judgment across evaluators rather than any single opinion.
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
           ${(() => {
      // PHASE 6 FIX: Deduplicate evaluators by name to hide reassigned duplicates
      const rawEvaluators = options.analytics?.evaluators || [];
      const uniqueMap = new Map();

      rawEvaluators.forEach(e => {
        const name = e.name || 'Unknown';
        // Priority: expert > evaluator
        if (!uniqueMap.has(name) || (e.role && e.role.includes('expert'))) {
          uniqueMap.set(name, e);
        }
      });

      return Array.from(uniqueMap.values()).map(e => `
              <tr>
                <td>${e.name || 'Unknown'}</td>
                <td>${e.role || 'unknown'}</td>
                <td>Submitted</td>
              </tr>
            `).join('');
    })()}
        </tbody>
      </table>
    </div>

    <!-- IMPROVEMENT RECOMMENDATIONS SECTION (Moved to End) -->
    ${geminiNarrative?.improvementRecommendations ? `
    <div class="section" id="section-recommendations" style="margin-top: 40px; page-break-before: always;">
      <h2>Improvement Recommendations</h2>
      
      ${geminiNarrative.improvementRecommendations.shortTerm && geminiNarrative.improvementRecommendations.shortTerm.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #ef4444; border-bottom: 1px solid #fee2e2; padding-bottom: 5px;">Short-Term (0-3 Months)</h3>
        <ul style="margin-left: 20px;">
          ${geminiNarrative.improvementRecommendations.shortTerm.map(rec => `<li style="margin-bottom: 8px;">${rec}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${geminiNarrative.improvementRecommendations.mediumTerm && geminiNarrative.improvementRecommendations.mediumTerm.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #f59e0b; border-bottom: 1px solid #fef3c7; padding-bottom: 5px;">Medium-Term (3-12 Months)</h3>
        <ul style="margin-left: 20px;">
          ${geminiNarrative.improvementRecommendations.mediumTerm.map(rec => `<li style="margin-bottom: 8px;">${rec}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${geminiNarrative.improvementRecommendations.longTerm && geminiNarrative.improvementRecommendations.longTerm.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #10b981; border-bottom: 1px solid #d1fae5; padding-bottom: 5px;">Long-Term (12+ Months)</h3>
        <ul style="margin-left: 20px;">
          ${geminiNarrative.improvementRecommendations.longTerm.map(rec => `<li style="margin-bottom: 8px;">${rec}</li>`).join('')}
        </ul>
      </div>` : ''}

    </div>
    ` : (geminiNarrative?.recommendations && geminiNarrative.recommendations.length > 0 ? `
      <!-- Fallback to old table if new structure missing -->
      <div class="section" id="section-recommendations" style="margin-top: 40px; page-break-before: always;">
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
    ` : '')}
    
    <!-- CONCLUSION SECTION (Moved to End) -->
    ${geminiNarrative?.conclusion && geminiNarrative.conclusion.length > 0 ? `
    <div class="section" id="section-conclusion">
      <h2>Conclusion</h2>
      ${geminiNarrative.conclusion.map(para => `<p>${para}</p>`).join('')}
    </div>
    ` : ''}

  </div>

  <div class="footer">
    <p>Ethical AI Evaluation Report - ${project.title} | Generated: ${formatDate(new Date())}</p>
  </div>
</body>
</html>`;
}

module.exports = { generateHTMLReport };
