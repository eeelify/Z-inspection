const {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  BorderStyle,
  ShadingType,
  ImageRun,
  Media,
  Bookmark,
  InternalHyperlink
} = require("docx");
const { riskLabel } = require('../utils/riskLabel');

/**
 * Generate professional DOCX report from reportMetrics and geminiNarrative
 * This creates a structured, verifiable report with tables, charts, and proper formatting
 */
async function generateProfessionalDOCX(reportMetrics, geminiNarrative, generatedAt = new Date(), chartBuffers = null) {
  const children = [];
  
  // Helper to add chart image to document with caption, legend, and threshold explanation
  const addChartImage = async (chartBuffer, title, width = 500, height = 300, options = {}) => {
    if (!chartBuffer) return;
    
    try {
      // Create image run from buffer (docx library format)
      const imageRun = new ImageRun({
        data: chartBuffer,
        transformation: {
          width: width * 9525, // Convert to EMU (1/914400 inch)
          height: height * 9525
        }
      });
      
      children.push(createParagraph(''));
      
      // Add chart title/caption
      if (title) {
        children.push(createParagraph(`Figure: ${title}`, { bold: true, italics: true }));
      }
      
      // Add the chart image
      children.push(new Paragraph({
        children: [imageRun],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 }
      }));
      
      // Add legend text if provided
      if (options.legend) {
        children.push(createParagraph(options.legend, { italics: true, alignment: AlignmentType.CENTER }));
      }
      
      // Add threshold explanation if provided (for principle charts)
      if (options.thresholdExplanation) {
        children.push(createParagraph('Thresholds:', { bold: true }));
        if (Array.isArray(options.thresholdExplanation)) {
          options.thresholdExplanation.forEach(threshold => {
            children.push(createParagraph(threshold));
          });
        } else {
          children.push(createParagraph(options.thresholdExplanation));
        }
      }
      
      // Add note if provided
      if (options.note) {
        children.push(createParagraph(options.note, { italics: true }));
      }
      
      children.push(createParagraph(''));
    } catch (error) {
      console.warn(`Failed to add chart image: ${error.message}`);
      // Continue without chart - add placeholder text
      if (title) {
        children.push(createParagraph(`[Chart: ${title} - Image generation failed]`, { italics: true }));
      }
    }
  };

  // Helper to create a paragraph with text runs
  const createParagraph = (text, options = {}) => {
    return new Paragraph({
      children: [new TextRun({ text, ...options })],
      spacing: { after: options.spacingAfter || 120 },
      ...options
    });
  };

  // Helper to create a heading with bookmark
  const createHeading = (text, level = 1, bookmarkId = null) => {
    const headingLevel = level === 1 ? HeadingLevel.HEADING_1 :
                        level === 2 ? HeadingLevel.HEADING_2 :
                        HeadingLevel.HEADING_3;
    
    // Create bookmark ID from text (sanitize for bookmark name)
    const bookmarkName = bookmarkId || text.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    
    const children = [];
    if (bookmarkId || level === 1) {
      // Add bookmark at start of heading
      children.push(new Bookmark({
        id: bookmarkName,
        children: [new TextRun({ text: '', bold: true })]
      }));
    }
    children.push(new TextRun({ text, bold: true }));
    
    return new Paragraph({
      heading: headingLevel,
      children: children,
      spacing: { before: level === 1 ? 0 : 200, after: 120 }
    });
  };

  // Helper to create internal hyperlink
  const createInternalLink = (text, bookmarkId) => {
    return new Paragraph({
      children: [
        new InternalHyperlink({
          anchor: bookmarkId,
          children: [new TextRun({ text, style: 'Hyperlink' })]
        })
      ],
      spacing: { after: 80 }
    });
  };

  // ============================================================
  // 1) COVER PAGE
  // ============================================================
  children.push(createHeading(reportMetrics.project.title || 'Ethical AI Evaluation Report', 1, 'cover'));
  children.push(createParagraph(''));
  children.push(createParagraph(`Category: ${reportMetrics.project.category || 'Not provided'}`));
  children.push(createParagraph(`Questionnaire: ${reportMetrics.project.questionnaireKey || 'general-v1'}`));
  children.push(createParagraph(`Version: ${reportMetrics.project.questionnaireVersion || 1}`));
  children.push(createParagraph(`Generated on: ${generatedAt.toISOString().split('T')[0]}`));
  children.push(createParagraph(''));

  // ============================================================
  // 1.1) NAVIGATION MENU (Clickable Internal Links)
  // ============================================================
  children.push(createParagraph('Navigation:', { bold: true }));
  children.push(createInternalLink('Dashboard', 'dashboard'));
  children.push(createInternalLink('Risks', 'risks'));
  children.push(createInternalLink('Tensions', 'tensions'));
  children.push(createInternalLink('Recommendations', 'recommendations'));
  children.push(createParagraph(''));

  // ============================================================
  // 2) METHODOLOGY & DATA SOURCES
  // ============================================================
  children.push(createHeading('Methodology & Data Sources', 1));
  children.push(createParagraph('This report is generated using the Z-Inspection methodology for ethical AI evaluation.'));
  children.push(createParagraph(''));
  children.push(createParagraph('Data Sources:', { bold: true }));
  children.push(createParagraph('• responses collection: All expert answers and qualitative context'));
  children.push(createParagraph('• scores collection: Canonical computed metrics (ONLY source of quantitative scores)'));
  children.push(createParagraph('• tensions collection: Ethical tensions, claims, evidence, mitigations, and consensus'));
  children.push(createParagraph('• projectassignments collection: Expert assignments and participation tracking'));
  children.push(createParagraph(''));
  children.push(createParagraph('IMPORTANT: Quantitative scores come from the scores collection and are NOT computed by Gemini AI. All numeric metrics are deterministic and traceable to MongoDB data.', { italics: true }));

  // Risk mapping explanation
  children.push(createParagraph(''));
  children.push(createParagraph('Risk Score Mapping:', { bold: true }));
  children.push(createParagraph('• Score 0 = Minimal/No Risk (best case)'));
  children.push(createParagraph('• Score 1 = Low Risk'));
  children.push(createParagraph('• Score 2 = Medium Risk'));
  children.push(createParagraph('• Score 3 = High Risk'));
  children.push(createParagraph('• Score 4 = Critical/Max Risk (worst case)'));
  children.push(createParagraph(''));
  children.push(createParagraph('Risk Percentage Formula: Percentage of evaluator scores with score > 2.5 (scores ≤ 2.5 are treated as safe)'));
  children.push(createParagraph(''));
  
  // Data Integrity Checks
  const consistencyChecks = reportMetrics.consistencyChecks || {};
  if (consistencyChecks && (consistencyChecks.errors?.length > 0 || consistencyChecks.warnings?.length > 0)) {
    children.push(createParagraph(''));
    const hasErrors = consistencyChecks.errors && consistencyChecks.errors.length > 0;
    children.push(createParagraph(
      hasErrors ? '⚠ Data mismatch detected' : '⚠ Data Integrity Warnings',
      { bold: true, color: hasErrors ? 'dc2626' : 'f59e0b' }
    ));
    
    if (hasErrors && consistencyChecks.errors.length > 0) {
      consistencyChecks.errors.forEach(err => {
        children.push(createParagraph(`• ${err}`, { color: '991b1b' }));
      });
    }
    
    if (consistencyChecks.warnings && consistencyChecks.warnings.length > 0) {
      consistencyChecks.warnings.forEach(warn => {
        children.push(createParagraph(`• ${warn}`, { color: '92400e' }));
      });
    }
  } else if (consistencyChecks && consistencyChecks.passed) {
    children.push(createParagraph(''));
    children.push(createParagraph('✓ Data Integrity: All consistency checks passed', { color: '065f46' }));
  }
  children.push(createParagraph(''));

  // ============================================================
  // 3) EVALUATION COVERAGE (Submitted Evaluators Only)
  // ============================================================
  children.push(createHeading('Evaluation Coverage', 1));
  children.push(createParagraph(`Submitted Evaluators: ${reportMetrics.coverage.expertsSubmittedCount}`));
  
  // Deterministic role breakdown (submitted-only)
  if (reportMetrics.coverage && reportMetrics.coverage.roles) {
    const roleCounts = Object.entries(reportMetrics.coverage.roles)
      .map(([role, stats]) => ({ role, submitted: stats?.submitted || 0 }))
      .filter(r => r.submitted > 0);
    if (roleCounts.length > 0) {
      children.push(createParagraph(`Evaluators by Role: ${roleCounts.map(r => `${r.submitted} ${r.role}`).join(', ')}`));
    }
  }
  
  // CRITICAL: Show evaluators who actually submitted (no duplicates)
  if (reportMetrics.evaluators && reportMetrics.evaluators.submitted.length > 0) {
    children.push(createParagraph(''));
    children.push(createParagraph('Evaluators Who Submitted:', { bold: true }));
    reportMetrics.evaluators.submitted.forEach(e => {
      children.push(createParagraph(`• ${e.name} (${e.role})`));
    });
  }
  
  // Data quality notes (missing scores)
  if (reportMetrics.dataQuality && reportMetrics.dataQuality.notes && reportMetrics.dataQuality.notes.length > 0) {
    children.push(createParagraph(''));
    children.push(createParagraph('Data Quality Notes:', { bold: true, color: 'FF0000' }));
    reportMetrics.dataQuality.notes.forEach(note => {
      children.push(createParagraph(`⚠️ ${note}`, { italics: true }));
    });
  }
  
  children.push(createParagraph(''));

  // Team completion chart intentionally omitted: reports are based on submitted evaluators only.

  // Role breakdown table (submitted-only)
  if (Object.keys(reportMetrics.coverage.roles).length > 0) {
    children.push(createParagraph('Role Breakdown:', { bold: true }));
    
    const roleTableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [createParagraph('Role', { bold: true })] }),
          new TableCell({ children: [createParagraph('Submitted', { bold: true })] })
        ]
      })
    ];

    Object.entries(reportMetrics.coverage.roles).forEach(([role, stats]) => {
      const submitted = stats?.submitted || 0;
      if (submitted <= 0) return;
      roleTableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [createParagraph(role)] }),
            new TableCell({ children: [createParagraph(String(submitted))] })
          ]
        })
      );
    });

    children.push(
      new Table({
        rows: roleTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
    children.push(createParagraph(''));
  }

  // Core-12 completion omitted (team baseline varies). Metrics remain available in reportMetrics.coverage.core12Completion.

  // ============================================================
  // 4) EXECUTIVE SUMMARY
  // ============================================================
  children.push(createHeading('Executive Summary', 1));
  
  if (geminiNarrative && Array.isArray(geminiNarrative.executiveSummary)) {
    geminiNarrative.executiveSummary.forEach(point => {
      children.push(createParagraph(`• ${point}`));
    });
  } else {
    // Fallback: generate from metrics
    const overallAvg = reportMetrics.scoring.totalsOverall?.avg || 0;
    // Use riskLabel function for consistent mapping (0 = minimal risk, 4 = critical risk)
    const riskLevel = riskLabel(overallAvg);
    children.push(createParagraph(`• Overall ethical risk level: ${riskLevel} (Average score: ${overallAvg.toFixed(2)}/4.0)`));
    children.push(createParagraph(`• ${reportMetrics.coverage.expertsSubmittedCount} evaluator(s) submitted evaluations`));
    children.push(createParagraph(`• ${reportMetrics.tensions.summary.total} ethical tensions identified`));
  }

  children.push(createParagraph(''));

  // ============================================================
  // 5) ETHICS PRINCIPLES DASHBOARD
  // ============================================================
  children.push(createHeading('Ethics Principles Dashboard', 1, 'dashboard'));
  children.push(createInternalLink('Back to Top', 'cover'));
  children.push(createParagraph(''));

  const principleTableRows = [
    new TableRow({
      children: [
        new TableCell({ children: [createParagraph('Principle', { bold: true })] }),
        new TableCell({ children: [createParagraph('Avg Score', { bold: true })] }),
        new TableCell({ children: [createParagraph('Risk %', { bold: true })] }),
        new TableCell({ children: [createParagraph('Safe %', { bold: true })] }),
        new TableCell({ children: [createParagraph('Safe/Not Safe', { bold: true })] }),
        new TableCell({ children: [createParagraph('Notes', { bold: true })] })
      ]
    })
  ];

  const principles = [
    'TRANSPARENCY',
    'HUMAN AGENCY & OVERSIGHT',
    'TECHNICAL ROBUSTNESS & SAFETY',
    'PRIVACY & DATA GOVERNANCE',
    'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
    'SOCIETAL & INTERPERSONAL WELL-BEING',
    'ACCOUNTABILITY'
  ];

  principles.forEach(principle => {
    const principleData = reportMetrics.scoring.byPrincipleOverall[principle];
    if (principleData) {
      const notes = [];
      if (geminiNarrative && Array.isArray(geminiNarrative.principleFindings)) {
        const finding = geminiNarrative.principleFindings.find(f => f.principle === principle);
        if (finding && finding.keyRisks && finding.keyRisks.length > 0) {
          notes.push(finding.keyRisks[0]);
        }
      }

      principleTableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [createParagraph(principle)] }),
            new TableCell({ children: [createParagraph(principleData.avgScore.toFixed(2))] }),
            new TableCell({ children: [createParagraph(`${principleData.riskPct.toFixed(1)}%`)] }),
            new TableCell({ children: [createParagraph(`${principleData.safePct.toFixed(1)}%`)] }),
            new TableCell({ children: [createParagraph(`${principleData.safeCount}/${principleData.notSafeCount}`)] }),
            new TableCell({ children: [createParagraph(notes[0] || '')] })
          ]
        })
      );
    }
  });

  children.push(
    new Table({
      rows: principleTableRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    })
  );
  children.push(createParagraph(''));

  // Add principle bar chart with legend and threshold explanation
  if (chartBuffers && chartBuffers.principleBarChart) {
    await addChartImage(
      chartBuffers.principleBarChart,
      '7 Ethical Principles Score Overview',
      800,
      500
    );
    // Add legend and threshold explanation as text (next to chart)
    children.push(createParagraph('Legend & Thresholds:', { bold: true }));
    children.push(createParagraph('Scale 0–4 (0 = lowest risk, 4 = highest risk)'));
    children.push(createParagraph('Thresholds:'));
    children.push(createParagraph('• 0.0–0.5 = Minimal'));
    children.push(createParagraph('• 0.5–1.5 = Low'));
    children.push(createParagraph('• 1.5–2.5 = Medium'));
    children.push(createParagraph('• 2.5–3.5 = High'));
    children.push(createParagraph('• 3.5–4.0 = Critical'));
    
    // Calculate and show evaluator counts and N/A excluded
    const principles = Object.keys(reportMetrics.scoring.byPrincipleOverall);
    const totalEvaluators = principles.reduce((sum, p) => {
      return sum + (reportMetrics.scoring.byPrincipleOverall[p]?.count || 0);
    }, 0);
    const avgEvaluators = totalEvaluators / principles.length;
    const totalPossibleEvaluators = reportMetrics.evaluators.withScores.length;
    const naExcluded = totalPossibleEvaluators - Math.round(avgEvaluators);
    children.push(createParagraph(`Evaluators used in averages: ${Math.round(avgEvaluators)}`));
    if (naExcluded > 0) {
      children.push(createParagraph(`N/A excluded: ${naExcluded}`));
    }
    children.push(createParagraph(''));
  }

  // Add short version of top risky questions table in Dashboard
  if (reportMetrics.topRiskDrivers && reportMetrics.topRiskDrivers.questions.length > 0) {
    children.push(createHeading('Top Risky Questions (Summary)', 2));
    children.push(createParagraph('See "Risks" section for detailed view with answer snippets.', { italics: true }));
    
    const shortRiskTableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [createParagraph('Question ID', { bold: true })] }),
          new TableCell({ children: [createParagraph('Principle', { bold: true })] }),
          new TableCell({ children: [createParagraph('Avg Risk', { bold: true })] }),
          new TableCell({ children: [createParagraph('Type', { bold: true })] })
        ]
      })
    ];

    reportMetrics.topRiskDrivers.questions.slice(0, 5).forEach(q => {
      const questionType = q.isCommonQuestion ? 'Common (Core)' : 'Role-Specific';
      shortRiskTableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [createParagraph(q.questionCode || q.questionId)] }),
            new TableCell({ children: [createParagraph(q.principle)] }),
            new TableCell({ children: [createParagraph(q.avgRiskScore.toFixed(2))] }),
            new TableCell({ children: [createParagraph(questionType)] })
          ]
        })
      );
    });

    children.push(
      new Table({
        rows: shortRiskTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
    children.push(createInternalLink('View Full Risks Table →', 'risks'));
    children.push(createParagraph(''));
  }

  // ============================================================
  // 5.1) PRINCIPLE-BY-PRINCIPLE TABLE (Dynamic Evaluator Columns)
  // ============================================================
  if (reportMetrics.scoring.byPrincipleTable && Object.keys(reportMetrics.scoring.byPrincipleTable).length > 0) {
    children.push(createHeading('Principle-by-Principle Scores (Per Evaluator)', 2));
    children.push(createParagraph('This table shows individual evaluator scores for each principle. Columns are dynamically generated based on actual evaluators who submitted responses.', { italics: true }));
    children.push(createParagraph(''));

    // Get all unique evaluators across all principles
    const allEvaluators = new Set();
    Object.values(reportMetrics.scoring.byPrincipleTable).forEach(principleData => {
      principleData.evaluators.forEach(e => {
        allEvaluators.add(`${e.userId}_${e.name}_${e.role}`);
      });
    });

    const evaluatorList = Array.from(allEvaluators).map(key => {
      const [userId, name, role] = key.split('_');
      return { userId, name, role };
    });

    // Build table header
    const dynamicTableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [createParagraph('Principle', { bold: true })] }),
          ...evaluatorList.map(e => 
            new TableCell({ children: [createParagraph(`${e.name}\n(${e.role})`, { bold: true })] })
          ),
          new TableCell({ children: [createParagraph('Range\n(Min-Max)', { bold: true })] }),
          new TableCell({ children: [createParagraph('Average', { bold: true })] })
        ]
      })
    ];

    // Build table rows for each principle
    Object.entries(reportMetrics.scoring.byPrincipleTable).forEach(([principle, principleData]) => {
      const rowCells = [
        new TableCell({ children: [createParagraph(principle)] })
      ];

      // Add evaluator scores (or N/A if they don't have a score for this principle)
      evaluatorList.forEach(evaluator => {
        const evaluatorScore = principleData.evaluators.find(e => e.userId === evaluator.userId);
        const scoreText = evaluatorScore 
          ? evaluatorScore.score.toFixed(2)
          : 'N/A';
        rowCells.push(
          new TableCell({ children: [createParagraph(scoreText)] })
        );
      });

      // Add range and average
      rowCells.push(
        new TableCell({ children: [createParagraph(`${principleData.range.min.toFixed(2)} - ${principleData.range.max.toFixed(2)}`)] }),
        new TableCell({ children: [createParagraph(principleData.average.toFixed(2))] })
      );

      dynamicTableRows.push(new TableRow({ children: rowCells }));
    });

    children.push(
      new Table({
        rows: dynamicTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
    children.push(createParagraph(''));
  }

  // Add principle-evaluator heatmap chart
  if (chartBuffers && chartBuffers.principleEvaluatorHeatmap) {
    await addChartImage(
      chartBuffers.principleEvaluatorHeatmap,
      'Role × Principle Heatmap',
      900,
      500,
      {
        note: 'Role-specific coverage: only submitted roles appear. N/A cells are shown in gray.'
      }
    );
  }

  // ============================================================
  // 6) TOP RISK DRIVERS (Question-level)
  // ============================================================
  children.push(createHeading('Top Risk Drivers', 1, 'risks'));
  children.push(createInternalLink('Back to Dashboard', 'dashboard'));
  children.push(createParagraph(''));

  if (reportMetrics.topRiskDrivers.questions.length > 0) {
    const riskTableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [createParagraph('Question ID', { bold: true })] }),
          new TableCell({ children: [createParagraph('Question Text', { bold: true })] }),
          new TableCell({ children: [createParagraph('Principle', { bold: true })] }),
          new TableCell({ children: [createParagraph('Avg Risk Score', { bold: true })] }),
          new TableCell({ children: [createParagraph('Type', { bold: true })] }),
          new TableCell({ children: [createParagraph('Role(s) Who Answered', { bold: true })] }),
          new TableCell({ children: [createParagraph('Answer Snippet', { bold: true })] })
        ]
      })
    ];

    reportMetrics.topRiskDrivers.questions.slice(0, 10).forEach(q => {
      // Get best answer excerpt (longest available, truncated to 120 chars for table)
      let excerpt = '';
      if (q.answerExcerpts && q.answerExcerpts.length > 0) {
        // Find longest excerpt
        const longestExcerpt = q.answerExcerpts.reduce((longest, current) => 
          current.length > longest.length ? current : longest
        , '');
        // Check if it's the empty marker
        if (longestExcerpt === '[Answer is empty / not captured]') {
          excerpt = 'Answer is empty / not captured';
        } else {
          excerpt = longestExcerpt.trim().substring(0, 120) + (longestExcerpt.length > 120 ? '...' : '');
        }
      } else if (q.answerStatus === 'submitted_empty') {
        excerpt = 'Answer is empty / not captured';
      } else {
        // Skip questions without submitted text answers (should not appear in table)
        return;
      }
      
      // Use questionText if available, otherwise fallback to questionCode or questionId
      const questionDisplay = q.questionText || q.questionCode || q.questionId;
      
      // Determine question type (first 12 = common/core)
      const questionType = q.isCommonQuestion !== undefined 
        ? (q.isCommonQuestion ? 'Common (Core)' : 'Role-Specific')
        : (q.questionOrder && q.questionOrder <= 12 ? 'Common (Core)' : 'Role-Specific');
      
      // Get roles who answered (prefer rolesWhoAnswered if available, fallback to rolesMostAtRisk)
      const rolesLabel = (q.rolesWhoAnswered && q.rolesWhoAnswered.length > 0)
        ? q.rolesWhoAnswered.join(', ')
        : (q.rolesMostAtRisk && q.rolesMostAtRisk.length > 0)
          ? q.rolesMostAtRisk.join(', ')
          : 'N/A';
      
      riskTableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [createParagraph(q.questionId || q.questionCode || 'N/A')] }), // Question ID
            new TableCell({ children: [createParagraph(questionDisplay)] }), // Question Text
            new TableCell({ children: [createParagraph(q.principle)] }), // Principle
            new TableCell({ children: [createParagraph(q.avgRiskScore.toFixed(2))] }), // Avg Risk Score
            new TableCell({ children: [createParagraph(questionType)] }), // Type (Common/Role-Specific)
            new TableCell({ children: [createParagraph(rolesLabel)] }), // Role(s) Who Answered
            new TableCell({ children: [createParagraph(excerpt)] }) // Answer Snippet
          ]
        })
      );
    });

    children.push(
      new Table({
        rows: riskTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
    children.push(createParagraph(''));

    // Narrative from Gemini
    if (geminiNarrative && Array.isArray(geminiNarrative.topRiskDriversNarrative)) {
      children.push(createParagraph('Analysis:', { bold: true }));
      geminiNarrative.topRiskDriversNarrative.slice(0, 3).forEach(narrative => {
        children.push(createParagraph(`• ${narrative.whyRisky}`));
        children.push(createParagraph(`  Recommended: ${narrative.recommendedAction}`));
      });
      children.push(createParagraph(''));
    }
  } else {
    children.push(createParagraph('No risk drivers identified.'));
    children.push(createParagraph(''));
  }

  // ============================================================
  // 7) ETHICAL TENSIONS (Z-Inspection style)
  // ============================================================
  children.push(createHeading('Ethical Tensions', 1, 'tensions'));
  children.push(createInternalLink('Back to Dashboard', 'dashboard'));
  children.push(createParagraph(''));

  // Add tension visualizations
  if (chartBuffers) {
    if (chartBuffers.tensionReviewStateChart) {
      await addChartImage(
        chartBuffers.tensionReviewStateChart,
        'Tension Review State Distribution (with Consensus Maturity)',
        600,
        500,
        {
          legend: 'Shows distribution of tensions by review state (Proposed, Under Review, Accepted, Disputed) and consensus maturity.'
        }
      );
    }
    
    if (chartBuffers.evidenceCoverageDonut) {
      await addChartImage(
        chartBuffers.evidenceCoverageDonut,
        'Evidence Coverage Donut (Evidence Types Distribution)',
        600,
        500,
        {
          legend: 'Distribution of evidence types across tensions (Policy, Test, User feedback, Logs, Incident, Other).'
        }
      );
    }
    
    if (chartBuffers.severityChart) {
      await addChartImage(
        chartBuffers.severityChart,
        'Tension Severity Distribution',
        500,
        400,
        {
          legend: 'Distribution of tensions by severity level (Critical, High, Medium, Low).'
        }
      );
    }
    
    if (chartBuffers.evidenceTypeChart) {
      await addChartImage(
        chartBuffers.evidenceTypeChart,
        'Evidence Type Distribution (Bar Chart)',
        600,
        400,
        {
          legend: 'Count of evidence items by type across all tensions.'
        }
      );
    }
  }

  // ============================================================
  // 7.1) TENSIONS TABLE (Summary View)
  // ============================================================
  if (reportMetrics.tensions.list.length > 0) {
    children.push(createHeading('Tensions Summary Table', 2));
    
    const tensionsTableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [createParagraph('Conflict', { bold: true })] }),
          new TableCell({ children: [createParagraph('Severity', { bold: true })] }),
          new TableCell({ children: [createParagraph('Review State', { bold: true })] }),
          new TableCell({ children: [createParagraph('Votes (Agree/Disagree)', { bold: true })] }),
          new TableCell({ children: [createParagraph('Agree %', { bold: true })] }),
          new TableCell({ children: [createParagraph('Evidence Count', { bold: true })] }),
          new TableCell({ children: [createParagraph('Evidence Types', { bold: true })] }),
          new TableCell({ children: [createParagraph('Discussions', { bold: true })] }),
          new TableCell({ children: [createParagraph('Claim (One-line)', { bold: true })] })
        ]
      })
    ];

    reportMetrics.tensions.list.forEach(tension => {
      const conflictLabel = `${tension.conflict.principle1} ↔ ${tension.conflict.principle2}`;
      const votesLabel = `${tension.consensus.agreeCount}/${tension.consensus.disagreeCount}`;
      const evidenceTypesLabel = tension.evidence.types.length > 0 
        ? tension.evidence.types.join(', ')
        : 'N/A';
      const claimOneLine = (tension.claim || 'Not provided').substring(0, 80) + 
        ((tension.claim && tension.claim.length > 80) ? '...' : '');
      
      tensionsTableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [createParagraph(conflictLabel)] }),
            new TableCell({ children: [createParagraph(tension.severityLevel || 'Unknown')] }),
            new TableCell({ children: [createParagraph(tension.consensus.reviewState)] }),
            new TableCell({ children: [createParagraph(votesLabel)] }),
            new TableCell({ children: [createParagraph(`${tension.consensus.agreePct.toFixed(1)}%`)] }),
            new TableCell({ children: [createParagraph(String(tension.evidence.count))] }),
            new TableCell({ children: [createParagraph(evidenceTypesLabel)] }),
            new TableCell({ children: [createParagraph(String(tension.discussionCount || 0))] }),
            new TableCell({ children: [createParagraph(claimOneLine)] })
          ]
        })
      );
    });

    children.push(
      new Table({
        rows: tensionsTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
    children.push(createParagraph(''));
    children.push(createParagraph('Note: Votes exclude the tension creator/owner (they cannot vote on their own tensions).', { italics: true }));
    children.push(createParagraph(''));
  }

  // ============================================================
  // 7.2) TENSIONS DETAILED VIEW
  // ============================================================
  if (reportMetrics.tensions.list.length > 0) {
    children.push(createHeading('Tensions Detailed View', 2));
    
    reportMetrics.tensions.list.forEach((tension, idx) => {
      const header = `Conflict: ${tension.conflict.principle1} ↔ ${tension.conflict.principle2} | Severity: ${tension.severityLevel} | Review State: ${tension.consensus.reviewState}`;
      children.push(createHeading(`Tension ${idx + 1}: ${header}`, 2));
      
      children.push(createParagraph('Claim:', { bold: true }));
      children.push(createParagraph(tension.claim || 'Not provided'));
      children.push(createParagraph(''));
      
      if (tension.argument) {
        children.push(createParagraph('Argument:', { bold: true }));
        children.push(createParagraph(tension.argument));
        children.push(createParagraph(''));
      }

      if (tension.impactArea.length > 0 || tension.affectedGroups.length > 0 || tension.impactDescription) {
        children.push(createParagraph('Impact:', { bold: true }));
        if (tension.impactArea.length > 0) {
          children.push(createParagraph(`Areas: ${tension.impactArea.join(', ')}`));
        }
        if (tension.affectedGroups.length > 0) {
          children.push(createParagraph(`Affected Groups: ${tension.affectedGroups.join(', ')}`));
        }
        if (tension.impactDescription) {
          children.push(createParagraph(`Description: ${tension.impactDescription}`));
        }
        children.push(createParagraph(''));
      }

      // Evidence section
      children.push(createParagraph('Evidence:', { bold: true }));
      children.push(createParagraph(`Evidence Count: ${tension.evidence.count}`));
      if (tension.evidence.count > 0) {
        children.push(createParagraph(`Evidence Types: ${tension.evidence.types.join(', ')}`));
        tension.evidence.items.forEach((item, i) => {
          children.push(createParagraph(`  ${i + 1}. [${item.evidenceType}] ${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}`));
          if (item.attachmentsCount > 0) {
            children.push(createParagraph(`     Attachments: ${item.attachmentsCount}`));
          }
        });
      } else {
        children.push(createParagraph('No evidence attached', { italics: true }));
      }
      children.push(createParagraph(''));

      // Mitigation
      children.push(createParagraph('Mitigation/Resolution:', { bold: true }));
      if (tension.mitigation.proposedMitigations) {
        children.push(createParagraph(`Proposed: ${tension.mitigation.proposedMitigations}`));
      }
      if (tension.mitigation.tradeOffDecision) {
        children.push(createParagraph(`Trade-off Decision: ${tension.mitigation.tradeOffDecision}`));
      }
      if (tension.mitigation.tradeOffRationale) {
        children.push(createParagraph(`Rationale: ${tension.mitigation.tradeOffRationale}`));
      }
      if (!tension.mitigation.proposedMitigations && !tension.mitigation.tradeOffDecision) {
        children.push(createParagraph('No mitigation proposed', { italics: true }));
      }
      children.push(createParagraph(''));

      // Consensus
      children.push(createParagraph('Consensus:', { bold: true }));
      children.push(createParagraph(`Votes: ${tension.consensus.agreeCount} agree, ${tension.consensus.disagreeCount} disagree`));
      children.push(createParagraph(`Participation: ${tension.consensus.votesTotal}/${tension.consensus.assignedExpertsCount} (${tension.consensus.participationPct.toFixed(1)}%)`));
      children.push(createParagraph(`Agree %: ${tension.consensus.agreePct.toFixed(1)}%`));
      children.push(createParagraph(''));

      // Next step from narrative
      if (geminiNarrative && Array.isArray(geminiNarrative.tensionsNarrative)) {
        const narrative = geminiNarrative.tensionsNarrative.find(n => n.tensionId === tension.tensionId);
        if (narrative && narrative.nextStep) {
          children.push(createParagraph('Next Step:', { bold: true }));
          children.push(createParagraph(narrative.nextStep));
          children.push(createParagraph(''));
        }
      }

      children.push(createParagraph('---'));
      children.push(createParagraph(''));
    });
  } else {
    children.push(createParagraph('No ethical tensions identified.'));
    children.push(createParagraph(''));
  }

  // ============================================================
  // 8) ACTION PLAN
  // ============================================================
  children.push(createHeading('Action Plan', 1, 'recommendations'));
  children.push(createInternalLink('Back to Dashboard', 'dashboard'));
  children.push(createParagraph(''));

  if (geminiNarrative && Array.isArray(geminiNarrative.recommendations) && geminiNarrative.recommendations.length > 0) {
    const actionTableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [createParagraph('Recommendation', { bold: true })] }),
          new TableCell({ children: [createParagraph('Priority', { bold: true })] }),
          new TableCell({ children: [createParagraph('Owner Role', { bold: true })] }),
          new TableCell({ children: [createParagraph('Owner (Person)', { bold: true })] }),
          new TableCell({ children: [createParagraph('Timeline', { bold: true })] }),
          new TableCell({ children: [createParagraph('Success Metric', { bold: true })] }),
          new TableCell({ children: [createParagraph('Data Basis', { bold: true })] }),
          new TableCell({ children: [createParagraph('Linked To', { bold: true })] })
        ]
      })
    ];

    geminiNarrative.recommendations.forEach(rec => {
      // Owner person: use ownerPerson if available, otherwise "Assign owner"
      const ownerPerson = rec.ownerPerson || 'Assign owner';
      
      actionTableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [createParagraph(rec.title || '')] }),
            new TableCell({ children: [createParagraph(rec.priority || '')] }),
            new TableCell({ children: [createParagraph(rec.ownerRole || '')] }),
            new TableCell({ children: [createParagraph(ownerPerson)] }),
            new TableCell({ children: [createParagraph(rec.timeline || '')] }),
            new TableCell({ children: [createParagraph(rec.successMetric || '')] }),
            new TableCell({ children: [createParagraph(rec.dataBasis || '')] }),
            new TableCell({ children: [createParagraph(rec.linkedTo ? rec.linkedTo.join(', ') : '')] })
          ]
        })
      );
    });

    children.push(
      new Table({
        rows: actionTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
  } else {
    children.push(createParagraph('No specific recommendations generated.'));
  }
  children.push(createParagraph(''));

  // ============================================================
  // 9) LIMITATIONS & ASSUMPTIONS (DETERMINISTIC - from dataQuality)
  // ============================================================
  children.push(createHeading('Limitations & Assumptions', 1));
  
  // Build deterministic limitations from dataQuality (NOT from Gemini)
  const dataQuality = reportMetrics.dataQuality || {};
  const limitations = [];
  
  // 1. Submitted count check (reports are based on submitted evaluators only)
  const submittedCount = reportMetrics.team?.submittedCount || reportMetrics.coverage?.expertsSubmittedCount || 0;
  
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
  
  // Display limitations
  if (limitations.length > 0) {
    limitations.forEach(limitation => {
      children.push(createParagraph(`• ${limitation}`));
    });
  } else {
    children.push(createParagraph('No significant data quality limitations identified.'));
  }
  children.push(createParagraph(''));

  // ============================================================
  // 10) APPENDIX
  // ============================================================
  children.push(createHeading('Appendix', 1));

  children.push(createParagraph('Glossary:', { bold: true }));
  children.push(createParagraph('• Risk Score: 0-4 scale where 0 = lowest risk (no/negligible risk), 4 = highest risk (high risk requiring immediate mitigation)'));
  children.push(createParagraph('• Risk %: Percentage of evaluator scores with score > 2.5'));
  children.push(createParagraph('• Safe %: Percentage of evaluator scores with score ≤ 2.5'));
  children.push(createParagraph('• Severity Levels: Critical, High, Medium, Low (based on avgRiskScore)'));
  children.push(createParagraph(''));

  children.push(createParagraph('Data Snapshot:', { bold: true }));
  children.push(createParagraph(`Report Generation Timestamp: ${generatedAt.toISOString()}`));
  children.push(createParagraph(`Questionnaire Key: ${reportMetrics.project.questionnaireKey}`));
  children.push(createParagraph(`Questionnaire Version: ${reportMetrics.project.questionnaireVersion}`));
  children.push(createParagraph(''));

  if (geminiNarrative && Array.isArray(geminiNarrative.appendixNotes)) {
    geminiNarrative.appendixNotes.forEach(note => {
      children.push(createParagraph(`• ${note}`));
    });
  }

  // ============================================================
  // BUILD DOCUMENT
  // ============================================================
  const doc = new Document({
    creator: "Z-Inspection Platform",
    title: reportMetrics.project.title || "Ethical AI Evaluation Report",
    sections: [
      {
        properties: {},
        children: children
      }
    ]
  });

  return await Packer.toBuffer(doc);
}

module.exports = {
  generateProfessionalDOCX
};

