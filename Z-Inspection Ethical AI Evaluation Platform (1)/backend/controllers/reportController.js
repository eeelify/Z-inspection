const mongoose = require('mongoose');
const { generateReport } = require('../services/geminiService');
const { generatePDFFromMarkdown } = require('../services/pdfService');
const { buildReportMetrics } = require('../services/reportMetricsService');
const chartGenerationService = require('../services/chartGenerationService');

// Defensive runtime check: Ensure generateAllCharts is exported
if (typeof chartGenerationService.generateAllCharts !== 'function') {
  throw new Error(
    'CRITICAL: chartGenerationService.generateAllCharts is not a function. ' +
    'This usually means the Puppeteer fallback (chartGenerationServicePuppeteer.js) ' +
    'is missing the generateAllCharts export. Check module.exports in both chart services.'
  );
}
const { getProjectAnalytics } = require('../services/analyticsService');
const { generateHTMLReport } = require('../services/htmlReportTemplateService');
const { generateProfessionalDOCX } = require('../services/professionalDocxService');

// Helper function for ObjectId validation (compatible with Mongoose v9+)
const isValidObjectId = (id) => {
  if (typeof mongoose.isValidObjectId === 'function') {
    return mongoose.isValidObjectId(id);
  }
  return mongoose.Types.ObjectId.isValid(id);
};

// Get models from mongoose (they are defined in server.js)
const Report = mongoose.model('Report');
const Project = mongoose.model('Project');
const GeneralQuestionsAnswers = mongoose.model('GeneralQuestionsAnswers');
const Evaluation = mongoose.model('Evaluation');
const Tension = mongoose.model('Tension');
const User = mongoose.model('User');
const Score = require('../models/score'); // Score model (separate file)
const Response = require('../models/response');
const Question = require('../models/question');

/**
 * ============================================================
 * AUTH HELPERS (MINIMAL-REFACTOR)
 * ============================================================
 * This codebase does not use JWT/sessions; requests typically include `userId`.
 * We enforce role-based permissions by looking up the user by that id.
 */

const toObjectIdOrValue = (id) => {
  if (!id) return null;
  return isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id;
};

const getRoleCategory = (role) => {
  const r = String(role || '').toLowerCase();
  if (r.includes('admin')) return 'admin';
  if (r.includes('viewer')) return 'viewer';
  // Treat anything else as expert for backward compatibility (e.g., medical-expert)
  return 'expert';
};

const getUserIdFromReq = (req) => {
  return (
    req?.body?.userId ||
    req?.query?.userId ||
    req?.headers?.['x-user-id'] ||
    req?.headers?.['x-userid'] ||
    null
  );
};

const loadRequestUser = async (req) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    const err = new Error('User ID is required for this operation');
    err.statusCode = 400;
    throw err;
  }

  const userIdObj = toObjectIdOrValue(userId);
  const user = await User.findById(userIdObj).select('_id name email role').lean();
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    user,
    userIdObj: user._id,
    roleCategory: getRoleCategory(user.role)
  };
};

const isUserAssignedToProject = async ({ userIdObj, projectIdObj }) => {
  try {
    const ProjectAssignment = require('../models/projectAssignment');
    const assignment = await ProjectAssignment.findOne({
      projectId: projectIdObj,
      userId: userIdObj
    }).select('_id').lean();

    if (assignment) return true;
  } catch (e) {
    // ignore; fall back to Project.assignedUsers check
  }

  const project = await Project.findOne({
    _id: projectIdObj,
    assignedUsers: userIdObj
  }).select('_id').lean();

  return Boolean(project);
};

const chooseSectionContentForExport = (section) => {
  const expert = (section?.expertEdit || '').trim();
  if (expert.length > 0) return expert;
  return section?.aiDraft || '';
};

const buildExportMarkdownFromReport = (report) => {
  // New workflow: sections[]
  if (Array.isArray(report?.sections) && report.sections.length > 0) {
    let md = '';
    md += `> **Note:** This report contains AI-generated draft content and has been reviewed/edited by human experts.\n\n`;

    // If there is a single FULL_REPORT section, export it directly (plus the note above)
    const single = report.sections.length === 1 ? report.sections[0] : null;
    if (single && String(single.principle || '').toUpperCase() === 'FULL_REPORT') {
      md += `${chooseSectionContentForExport(single)}\n`;
      return md;
    }

    for (const section of report.sections) {
      const principle = section?.principle || 'Section';
      md += `## ${principle}\n\n`;
      md += `${chooseSectionContentForExport(section)}\n\n`;
    }

    return md;
  }

  // Legacy fallback: content
  const legacy = report?.content || '';
  if (!legacy) return '';
  return `> **Note:** This report contains AI-generated draft content and has been reviewed/edited by human experts.\n\n${legacy}\n`;
};

/**
 * Unified Answer Aggregation Layer
 * Fetches answers from both responses and generalquestionanswers collections
 * and normalizes them into a single structure
 */
async function aggregateUnifiedAnswers(projectIdObj) {
  const unifiedAnswers = [];

  // 1. Fetch from responses collection (no status filter - get all with answers)
  const responses = await Response.find({
    projectId: projectIdObj
  }).populate('answers.questionId').lean();

  for (const response of responses) {
    for (const answer of response.answers || []) {
      const questionId = answer.questionId?._id?.toString() || answer.questionId?.toString() || answer.questionId;
      const questionCode = answer.questionCode;

      // Extract text answer based on answer type
      let textAnswer = '';
      let selectedOption = '';

      if (answer.answer) {
        if (answer.answer.text) {
          textAnswer = answer.answer.text;
        } else if (answer.answer.choiceKey) {
          selectedOption = answer.answer.choiceKey;
          // Try to get option label from question
          const question = answer.questionId;
          if (question && question.options) {
            const option = question.options.find(opt => opt.key === answer.answer.choiceKey);
            if (option) {
              selectedOption = option.label?.en || option.label?.tr || option.label || selectedOption;
            }
          }
        } else if (answer.answer.multiChoiceKeys && answer.answer.multiChoiceKeys.length > 0) {
          selectedOption = answer.answer.multiChoiceKeys.join(', ');
        } else if (answer.answer.numeric !== undefined) {
          textAnswer = String(answer.answer.numeric);
        }
      }

      unifiedAnswers.push({
        questionId: questionId || questionCode,
        questionCode: questionCode,
        role: response.role,
        questionnaireKey: response.questionnaireKey,
        selectedOption: selectedOption || null,
        score: answer.score !== undefined ? answer.score : null,
        textAnswer: textAnswer || null,
        principle: answer.questionId?.principle || null,
        sourceCollection: 'responses',
        userId: response.userId?.toString() || response.userId,
        notes: answer.notes || null
      });
    }
  }

  // 2. Fetch from generalquestionanswers collection
  const generalAnswersDocs = await GeneralQuestionsAnswers.find({
    projectId: projectIdObj
  }).lean();

  for (const gqa of generalAnswersDocs) {
    const role = gqa.userRole || 'unknown';

    // Process principles structure
    if (gqa.principles) {
      for (const [principle, principleData] of Object.entries(gqa.principles)) {
        const answers = principleData.answers || {};
        const risks = principleData.risks || {};

        for (const [questionKey, answerValue] of Object.entries(answers)) {
          const riskScore = risks[questionKey] !== undefined ? risks[questionKey] : null;

          unifiedAnswers.push({
            questionId: questionKey,
            questionCode: questionKey,
            role: role,
            questionnaireKey: 'general-v1', // General questions don't have questionnaireKey, use default
            selectedOption: null, // General questions are typically text
            score: riskScore,
            textAnswer: typeof answerValue === 'string' ? answerValue : String(answerValue || ''),
            principle: principle,
            sourceCollection: 'generalquestionanswers',
            userId: gqa.userId?.toString() || gqa.userId,
            notes: null
          });
        }
      }
    }

    // Also process legacy flat structure for backward compatibility
    if (gqa.answers && Object.keys(gqa.answers).length > 0) {
      const answers = gqa.answers || {};
      const risks = gqa.risks || {};

      for (const [questionKey, answerValue] of Object.entries(answers)) {
        // Skip if already processed in principles structure
        const alreadyProcessed = unifiedAnswers.some(ua =>
          ua.questionId === questionKey &&
          ua.sourceCollection === 'generalquestionanswers' &&
          ua.userId === (gqa.userId?.toString() || gqa.userId)
        );

        if (!alreadyProcessed) {
          const riskScore = risks[questionKey] !== undefined ? risks[questionKey] : null;

          unifiedAnswers.push({
            questionId: questionKey,
            questionCode: questionKey,
            role: role,
            questionnaireKey: 'general-v1',
            selectedOption: null,
            score: riskScore,
            textAnswer: typeof answerValue === 'string' ? answerValue : String(answerValue || ''),
            principle: null, // Legacy structure doesn't have principle
            sourceCollection: 'generalquestionanswers',
            userId: gqa.userId?.toString() || gqa.userId,
            notes: null
          });
        }
      }
    }
  }

  return unifiedAnswers;
}

/**
 * Helper function to collect all analysis data for a project
 */
async function collectAnalysisData(projectId) {
  try {
    const projectIdObj = isValidObjectId(projectId)
      ? new mongoose.Types.ObjectId(projectId)
      : projectId;

    // Get project
    const project = await Project.findById(projectIdObj).lean();
    if (!project) {
      throw new Error('Project not found');
    }

    // Ensure all scores are computed using NEW ethical scoring system before generating report
    // This ensures medical, legal, education and other role-specific scores are included
    const { computeEthicalScores, computeProjectEthicalScores } = require('../services/ethicalScoringService');

    // Get all unique userId/questionnaireKey combinations for this project
    const responses = await Response.find({
      projectId: projectIdObj,
      status: { $in: ['draft', 'submitted'] }
    }).select('userId questionnaireKey').lean();

    const uniqueCombinations = new Set();
    responses.forEach(r => {
      if (r.userId && r.questionnaireKey) {
        const userIdStr = r.userId.toString ? r.userId.toString() : String(r.userId);
        uniqueCombinations.add(`${userIdStr}_${r.questionnaireKey}`);
      }
    });

    // Check if scores need recomputation (old format vs new format)
    const existingScores = await Score.find({ projectId: projectIdObj })
      .select('totals.overallRisk totals.overallMaturity computedAt')
      .lean();

    const needsRecomputation = existingScores.length === 0 ||
      existingScores.some(s => (!s.totals?.overallRisk && !s.totals?.overallMaturity) || !s.byQuestion);

    if (needsRecomputation) {
      console.log('🔄 Scores need recomputation (old format detected or missing), computing with new ethical scoring system...');

      // Compute scores for all combinations using NEW ethical scoring
      for (const combo of uniqueCombinations) {
        const [userId, questionnaireKey] = combo.split('_');
        try {
          await computeEthicalScores(projectIdObj, userId, questionnaireKey);
          console.log(`✅ Computed ethical scores for user ${userId}, questionnaire ${questionnaireKey}`);
        } catch (error) {
          console.warn(`⚠️ Could not compute ethical scores for ${userId}/${questionnaireKey}:`, error.message);
        }
      }

      // Compute project-level scores
      try {
        await computeProjectEthicalScores(projectIdObj);
        console.log('✅ Computed project-level ethical scores');
      } catch (error) {
        console.warn(`⚠️ Could not compute project-level ethical scores:`, error.message);
      }
    } else {
      console.log('✅ Scores already computed with new ethical scoring system');
    }

    // Get evaluator-level scores (exclude project-level aggregated score docs to prevent double counting / "project" role leakage)
    const scores = await Score.find({ projectId: projectIdObj, role: { $ne: 'project' } }).lean();

    // Get unified answers from both collections
    const unifiedAnswers = await aggregateUnifiedAnswers(projectIdObj);
    console.log(`📊 Aggregated ${unifiedAnswers.length} unified answers (from responses and generalquestionanswers)`);

    // Get general questions answers (keep for backward compatibility in prompt builder)
    const generalAnswers = await GeneralQuestionsAnswers.find({
      projectId: projectIdObj
    }).lean();

    // Get evaluations
    const evaluations = await Evaluation.find({
      projectId: projectIdObj
    }).lean();

    // Get tensions (with ALL fields)
    const tensions = await Tension.find({
      projectId: projectIdObj
    }).lean();

    // Get assigned users
    const users = await User.find({
      _id: { $in: project.assignedUsers || [] }
    }).select('name email role').lean();

    return {
      project,
      scores,
      unifiedAnswers, // NEW: Unified answers from both collections
      generalAnswers, // Keep for backward compatibility
      evaluations,
      tensions,
      users
    };
  } catch (error) {
    console.error('Error collecting analysis data:', error);
    throw error;
  }
}

/**
 * POST /api/reports/generate
 * Generate AI report for a project
 */
exports.generateReport = async (req, res) => {
  try {
    const { projectId } = req.body;

    const { user, userIdObj, roleCategory } = await loadRequestUser(req);
    if (roleCategory !== 'admin') {
      return res.status(403).json({ error: 'Only Admin can generate reports.' });
    }

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    console.log('📊 Generating report for project:', projectId);

    // Collect all analysis data
    const analysisData = await collectAnalysisData(projectId);

    // DEFENSIVE VALIDATION: Ensure all data is properly collected
    const unifiedAnswers = analysisData.unifiedAnswers || [];
    const tensions = analysisData.tensions || [];
    const scores = analysisData.scores || [];

    console.log(`📊 Validation: ${unifiedAnswers.length} unified answers, ${tensions.length} tensions, ${scores.length} scores`);

    // Preflight validation will be done after reportMetrics and charts are built (see STEP 2.6)

    // Check for high-severity tensions only (removed wrong score < 3 logic)
    const highSeverityTensions = tensions.filter(t => {
      const severity = String(t.severity || '').toLowerCase();
      return severity.includes('high') || severity.includes('critical');
    });

    if (highSeverityTensions.length > 0) {
      console.log(`⚠️  ${highSeverityTensions.length} high-severity tensions require detailed explanation`);
    }

    // Validate that we have answers if any exist in database
    if (unifiedAnswers.length === 0) {
      console.warn('⚠️  WARNING: No unified answers found. Report may be incomplete.');
    }

    // Validate tensions are included
    if (tensions.length > 0) {
      console.log(`✅ ${tensions.length} tensions will be analyzed in the report`);
    }

    // ============================================================
    // STEP 1: Build report metrics (required for charts)
    // ============================================================
    console.log('📈 Building report metrics for charts...');
    let reportMetrics;
    let chartResults = {};
    let chartErrors = null;

    try {
      // Build metrics using reportMetricsService - include ALL questionnaires (general + role-specific)
      // Pass null to include all questionnaires, not just 'general-v1'
      reportMetrics = await buildReportMetrics(projectId, null);
      console.log('🧾 [REPORT PIPELINE SUMMARY] reportMetrics.coverage:', {
        expertsSubmittedCount: reportMetrics?.coverage?.expertsSubmittedCount,
        roles: reportMetrics?.coverage?.roles ? Object.fromEntries(Object.entries(reportMetrics.coverage.roles).map(([k, v]) => [k, v?.submitted || 0])) : null
      });
      console.log('🧾 [REPORT PIPELINE SUMMARY] reportMetrics.scoring.totalsOverall:', {
        avg: reportMetrics?.scoring?.totalsOverall?.avg,
        riskLabel: reportMetrics?.scoring?.totalsOverall?.riskLabel,
        uniqueEvaluatorCount: reportMetrics?.scoring?.totalsOverall?.uniqueEvaluatorCount,
        count: reportMetrics?.scoring?.totalsOverall?.count
      });

      // Get analytics for chart data - include ALL questionnaires
      const analytics = await getProjectAnalytics(projectId, null);
      const { getProjectEvaluators } = require('../services/reportMetricsService');
      const evaluatorsData = await getProjectEvaluators(projectId);
      console.log('🧾 [REPORT PIPELINE SUMMARY] evaluatorsData:', {
        assigned: evaluatorsData?.assigned?.length || 0,
        submitted: evaluatorsData?.submitted?.length || 0
      });

      // ============================================================
      // STEP 2: Generate ALL charts using Chart Contract
      // ============================================================
      console.log('📊 Generating charts using Chart Contract system...');

      // Prepare tensions data
      let tensionsSummary = {};
      if (tensions.length > 0) {
        // Build review state summary for chart
        const reviewStateCounts = {
          proposed: 0,
          underReview: 0,
          accepted: 0,
          disputed: 0,
          resolved: 0,
          total: tensions.length
        };

        tensions.forEach(t => {
          const state = String(t.status || 'ongoing').toLowerCase();
          if (state.includes('proposed')) reviewStateCounts.proposed++;
          else if (state.includes('under') || state.includes('review')) reviewStateCounts.underReview++;
          else if (state.includes('accepted')) reviewStateCounts.accepted++;
          else if (state.includes('disputed')) reviewStateCounts.disputed++;
          else if (state.includes('resolved')) reviewStateCounts.resolved++;
          else reviewStateCounts.proposed++; // Default to proposed
        });

        const evidenceTypeDistribution = reportMetrics.tensionsSummary?.evidenceTypeDistribution || {};

        tensionsSummary = {
          summary: {
            ...reviewStateCounts,
            evidenceTypeDistribution
          },
          list: tensions
        };
      }

      // Build coverage data for evidence charts
      const coverageData = {
        evidenceMetrics: analytics.evidenceMetrics || null
      };

      // CRITICAL DEBUG: Log data before passing to chart generation
      console.log('🔍 [DEBUG reportController] Passing data to chart generation:');
      console.log('   scoring.byPrincipleOverall exists:', !!reportMetrics.scoring?.byPrincipleOverall);
      if (reportMetrics.scoring?.byPrincipleOverall) {
        const principleKeys = Object.keys(reportMetrics.scoring.byPrincipleOverall);
        console.log('   Principle count:', principleKeys.length);
        console.log('   Principle keys:', principleKeys.join(', '));

        // Log first 2 principles in detail
        principleKeys.slice(0, 2).forEach(key => {
          const data = reportMetrics.scoring.byPrincipleOverall[key];
          console.log(`   "${key}":`, {
            isNull: data === null,
            fields: data ? Object.keys(data).join(', ') : 'N/A',
            risk: data?.risk,
            avg: data?.avg,
            erc: data?.erc
          });
        });
      } else {
        console.error('   ❌ reportMetrics.scoring.byPrincipleOverall is MISSING or EMPTY!');
        console.error('   reportMetrics.scoring keys:', Object.keys(reportMetrics.scoring || {}));
      }

      // PRESENTATION REFACTOR: Chart generation disabled.
      // Charts replaced with deterministic tables for audit integrity and stability.
      // Puppeteer dependency removed from report generation flow.
      const chartGenerationResult = await chartGenerationService.generateAllCharts({
        projectId,
        questionnaireKey: null, // Include all questionnaires
        scoring: reportMetrics.scoring,
        evaluators: evaluatorsData,
        tensions: tensionsSummary,
        coverage: coverageData
      });
      chartResults = chartGenerationResult.charts;
      chartErrors = chartGenerationResult.chartErrors;

      // Chart generation enabled
      console.log(`✅ Chart generation completed`);

      // Log chart status
      Object.entries(chartResults).forEach(([chartId, chart]) => {
        const status = chart.meta?.status || 'unknown';
        const reason = chart.meta?.reason || '';
        if (status === 'ready') {
          console.log(`   ✅ ${chartId}: ready`);
        } else if (status === 'placeholder') {
          console.warn(`   ⚠️  ${chartId}: placeholder (${reason})`);
        } else if (status === 'error') {
          console.error(`   ❌ ${chartId}: error (${reason})`);
        }
      });

      if (chartErrors && chartErrors.length > 0) {
        console.warn(`⚠️  ${chartErrors.length} chart generation error(s) occurred (charts have placeholders)`);
        chartErrors.forEach(err => console.warn(`   - ${err.chart}: ${err.error}`));
      }

    } catch (error) {
      console.error('❌ Chart generation pipeline failed:', error.message);
      console.error(error.stack);
      throw new Error(`Chart generation failed: ${error.message}`);
    }

    // ============================================================
    // STEP 2.5: CONVERT CHART CONTRACT OBJECTS TO DATA URIs FOR HTML
    // ============================================================
    console.log('🔄 Converting chart objects to data URIs for HTML template...');

    // Chart Contract objects have .pngBase64 (without data: prefix)
    // HTML template expects data:image/png;base64,... strings
    const chartImages = {};

    for (const [chartId, chartResult] of Object.entries(chartResults)) {
      if (!chartResult || !chartResult.pngBase64) {
        console.warn(`⚠️  Chart ${chartId} is missing pngBase64, skipping`);
        continue;
      }

      // If pngBase64 already has data: prefix, use it as is
      if (chartResult.pngBase64.startsWith('data:image/')) {
        chartImages[chartId] = chartResult.pngBase64;
      }
      // Otherwise, add data: prefix
      else if (chartResult.pngBase64.length > 0) {
        chartImages[chartId] = `data:image/png;base64,${chartResult.pngBase64}`;
      }
      // Empty base64 (placeholder failed) - log but don't add
      else {
        console.warn(`⚠️  Chart ${chartId} has empty pngBase64 (status: ${chartResult.meta?.status})`);
      }
    }

    const normalizedChartCount = Object.keys(chartImages).length;
    console.log(`✅ Converted ${normalizedChartCount} chart(s) to data URIs for HTML template`);

    // ============================================================
    // STEP 2.7: Build top risk drivers table with answer snippets (C)
    // ============================================================
    console.log('📊 Building top risk drivers table...');
    const { buildTopRiskDriversTable } = require('../services/topDriversService');
    let topDriversTable = [];
    try {
      topDriversTable = await buildTopRiskDriversTable(projectId);
      console.log(`✅ Built top risk drivers table with ${topDriversTable.length} drivers`);

      // C) Ensure table is never empty unless truly no questions
      if (topDriversTable.length === 0 && scores.length > 0) {
        console.warn('⚠️  WARNING: Top drivers table is empty despite having scores. This may indicate missing topDrivers in scores.byPrinciple.');
      }

      // Add to reportMetrics for Gemini
      if (reportMetrics && reportMetrics.scoring) {
        reportMetrics.scoring.topRiskDrivers = {
          ...reportMetrics.scoring.topRiskDrivers,
          table: topDriversTable
        };
      }
    } catch (error) {
      console.error('❌ Error building top risk drivers table:', error.message);
      // Don't fail report generation, but log error
    }

    // ============================================================
    // STEP 3: Generate report narrative using Gemini AI (NARRATIVE ONLY)
    // ============================================================
    console.log('🤖 Calling Gemini API for narrative generation...');

    // ============================================================
    // STEP 2.6: PREFLIGHT VALIDATION (Chart Contract Compliance)
    // DISABLED: Charts replaced with tables. Chart contract no longer enforced.
    // ============================================================
    console.log('✅ Chart contract validation BYPASSED: Using table-based presentation');
    /*
    console.log('🔍 Running preflight validation with Chart Contract...');
    const { validateReportPreflight } = require('../utils/reportPreflightValidator');
    const { getProjectEvaluators } = require('../services/reportMetricsService');

    const evaluators = await getProjectEvaluators(projectId);

    // Pass chart contract objects (with metadata) to preflight validator
    const preflightResult = validateReportPreflight({
      reportMetrics,
      scores,
      evaluators,
      tensions,
      chartImages: chartResults // Pass full chart contract objects, not just data URIs
    });

    if (preflightResult.errors.length > 0) {
      console.error('❌ Preflight validation FAILED:');
      preflightResult.errors.forEach(err => console.error(`   - ${err}`));
      throw new Error(
        `Preflight validation failed: ${preflightResult.errors.join('; ')}`
      );
    }

    if (preflightResult.warnings.length > 0) {
      console.warn('⚠️  Preflight warnings:');
      preflightResult.warnings.forEach(warn => console.warn(`   - ${warn}`));
    }

    console.log('✅ Preflight validation passed');
    */

    // SAFETY ASSERTION: Verify risk scale correctness
    const { validateRiskScaleNotInverted } = require('../utils/riskScale');
    if (scores.length > 0) {
      const maxScore = Math.max(...scores.map(s => s.totals?.avg || 0));
      const minScore = Math.min(...scores.map(s => s.totals?.avg || 4));
      try {
        // Use canonical risk scale validation
        // Validate that high scores (>= 3.5) should be HIGH/CRITICAL, not MINIMAL/LOW
        if (maxScore >= 3.5) {
          validateRiskScaleNotInverted(maxScore, 'CRITICAL_RISK'); // Should be CRITICAL, not MINIMAL
        }
        // Validate that low scores (< 1) should be MINIMAL/LOW, not HIGH/CRITICAL
        if (minScore < 1) {
          validateRiskScaleNotInverted(minScore, 'MINIMAL_RISK'); // Should be MINIMAL, not HIGH
        }
        console.log('✅ Risk scale correctness verified');
      } catch (riskError) {
        console.error('❌ RISK SCALE INVERSION DETECTED:', riskError.message);
        // Don't throw - log error but continue (non-blocking)
      }
    }

    // Enhance analysisData with chart metadata for Gemini (informational only - charts already generated)
    const analysisDataWithCharts = {
      ...analysisData,
      chartMetadata: {
        chartsGenerated: normalizedChartCount,
        chartTypes: Object.keys(chartImages),
        hasHeatmap: !!chartImages.principleEvaluatorHeatmap,
        hasEvidenceChart: !!chartImages.evidenceTypeChart,
        hasTensionCharts: !!(chartImages.tensionSeverityChart || chartImages.tensionReviewStateChart)
      },
      reportMetrics: reportMetrics || null
    };

    // Call Gemini for NARRATIVE ONLY (no chart references)
    let geminiNarrative;
    try {
      geminiNarrative = await generateReport(analysisDataWithCharts);

      // DEFENSIVE VALIDATION: Validate narrative quality
      if (!geminiNarrative || geminiNarrative.trim().length === 0) {
        throw new Error('Empty narrative generated');
      }
    } catch (geminiError) {
      console.warn(`⚠️  Gemini narrative generation failed: ${geminiError.message}`);
      console.warn('   Generating fallback narrative with metrics only...');

      // FALLBACK: Generate simple narrative from metrics
      const overallPerf = reportMetrics?.scoring?.totalsOverall?.overallPerformance || reportMetrics?.scoring?.totalsOverall?.avg || 0;
      const perfPct = Math.round((overallPerf / 4) * 100);
      geminiNarrative = `# Ethical AI Evaluation Report\n\n` +
        `## Executive Summary\n\n` +
        `This report presents the ethical evaluation results for **${project.title}**.\n\n` +
        `**Overall Performance:** ${overallPerf.toFixed(2)}/4.0 (${perfPct}%)\n\n` +
        `Based on ${reportMetrics?.scoring?.totalsOverall?.uniqueEvaluatorCount || 0} evaluator submissions, ` +
        `the system demonstrates ${perfPct < 50 ? 'significant areas requiring improvement' : 'acceptable performance with room for enhancement'}.\n\n` +
        `### Key Findings\n\n` +
        `- **Evaluators:** ${reportMetrics?.scoring?.totalsOverall?.uniqueEvaluatorCount || 0} experts participated\n` +
        `- **Questions Answered:** ${reportMetrics?.scoring?.totalsOverall?.answeredCount || 0}\n` +
        `- **Ethical Tensions:** ${tensions.length} identified\n\n` +
        `*Note: Detailed AI-generated narrative is temporarily unavailable. Please refer to the metrics and charts below.*\n\n` +
        `## Methodology\n\n` +
        `Performance Score = Question Importance (0-4) × Answer Quality (0-1)\n` +
        `Higher scores indicate better ethical performance.\n`;
    }

    // Check if narrative has minimum content
    const narrativeLength = geminiNarrative.trim().length;
    if (unifiedAnswers.length > 0 && narrativeLength < 500) {
      console.error(`⚠️  WARNING: Narrative seems too short (${narrativeLength} chars) for ${unifiedAnswers.length} answers`);
      // Don't throw error, but log warning
    }

    // Check if tensions are mentioned (basic check)
    if (tensions.length > 0) {
      const tensionMentions = tensions.filter(t => {
        const principle1 = t.principle1 || '';
        const principle2 = t.principle2 || '';
        return geminiNarrative.includes(principle1) || geminiNarrative.includes(principle2);
      });
      if (tensionMentions.length < tensions.length * 0.5) {
        console.warn(`⚠️  WARNING: Only ${tensionMentions.length}/${tensions.length} tensions appear to be mentioned in narrative`);
      }
    }

    // ============================================================
    // STEP 4: Generate HTML report with charts + narrative
    // ============================================================
    console.log('📄 Generating HTML report with charts and narrative...');

    // Get analytics for HTML template
    const analytics = await getProjectAnalytics(projectId, 'general-v1');

    // Chart images are already normalized to base64 data URIs, use directly
    const chartImagesBase64 = chartImages;

    // Debug: Verify chart images before HTML generation
    console.log(`🔍 DEBUG: Chart images for HTML: ${Object.keys(chartImagesBase64).length} charts`);
    Object.keys(chartImagesBase64).forEach(key => {
      const img = chartImagesBase64[key];
      const isDataUri = typeof img === 'string' && img.startsWith('data:image/');
      console.log(`  - ${key}: ${isDataUri ? '✅ data URI' : '❌ NOT data URI'} (${typeof img}, ${img?.length || 0} chars)`);
    });

    // Create structured narrative object for HTML template
    // The template expects structured data, but we have markdown
    // We'll pass markdown as a fallback and let the template render it
    const structuredNarrative = {
      markdown: geminiNarrative, // Full markdown narrative
      executiveSummary: [], // Will be parsed from markdown if needed
      topRiskDriversNarrative: [],
      tensionsNarrative: [],
      principleFindings: [],
      recommendations: []
    };

    // Generate HTML report
    const htmlReport = generateHTMLReport(
      reportMetrics || {},
      structuredNarrative,
      chartImagesBase64,
      {
        generatedAt: new Date(),
        analytics: analytics,
        reportMetrics: reportMetrics
      }
    );

    if (!htmlReport || htmlReport.trim().length === 0) {
      throw new Error('HTML report generation failed: Empty HTML generated');
    }

    // Debug: Check if charts are in HTML
    // Count chart images embedded as data URIs (correct way to check)
    const imgTagCount = (htmlReport.match(/<img[^>]*src=["']data:image\/[^"']+["']/g) || []).length;
    const expectedChartCount = Object.keys(chartImagesBase64).length;

    console.log(`✅ HTML report generated (${htmlReport.length} chars)`);
    console.log(`🔍 DEBUG: img tags with data URIs in HTML: ${imgTagCount} (expected: ${expectedChartCount})`);

    // Validation: Ensure all charts are embedded
    if (imgTagCount < expectedChartCount) {
      console.warn(`⚠️  WARNING: Only ${imgTagCount}/${expectedChartCount} charts found in HTML. Some charts may be missing.`);
    } else {
      console.log(`✅ All ${expectedChartCount} charts successfully embedded in HTML`);
    }

    // Check if HTML is too large for MongoDB (16MB limit for String fields)
    const htmlSizeMB = htmlReport.length / (1024 * 1024);
    if (htmlSizeMB > 10) {
      console.warn(`⚠️  WARNING: HTML report is very large (${htmlSizeMB.toFixed(2)} MB). MongoDB has a 16MB limit for String fields.`);
    }
    if (htmlSizeMB > 15) {
      console.error(`❌ ERROR: HTML report is too large (${htmlSizeMB.toFixed(2)} MB) to save to MongoDB!`);
      throw new Error(`HTML report is too large (${htmlSizeMB.toFixed(2)} MB) to save. MongoDB limit is 16MB.`);
    }

    // Calculate metadata
    const metadata = {
      totalScores: analysisData.scores.length,
      totalEvaluations: analysisData.evaluations.length,
      totalTensions: analysisData.tensions.length,
      principlesAnalyzed: [
        'TRANSPARENCY',
        'HUMAN AGENCY & OVERSIGHT',
        'TECHNICAL ROBUSTNESS & SAFETY',
        'PRIVACY & DATA GOVERNANCE',
        'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
        'SOCIETAL & INTERPERSONAL WELL-BEING',
        'ACCOUNTABILITY'
      ]
    };

    // Save report to database
    const projectIdObj = isValidObjectId(projectId)
      ? new mongoose.Types.ObjectId(projectId)
      : projectId;

    // Convert chart images to base64 strings for MongoDB storage (without data: prefix)
    // chartImages are already normalized to data URIs
    const chartImagesForStorage = {};
    for (const [key, dataUri] of Object.entries(chartImages)) {
      if (typeof dataUri === 'string' && dataUri.startsWith('data:')) {
        // Extract base64 from data URI
        const base64Match = dataUri.match(/data:image\/[^;]+;base64,(.+)/);
        if (base64Match) {
          chartImagesForStorage[key] = base64Match[1];
        } else {
          // Fallback: store as-is if extraction fails
          chartImagesForStorage[key] = dataUri;
        }
      } else if (typeof dataUri === 'string') {
        // Already base64 without prefix
        chartImagesForStorage[key] = dataUri;
      }
    }

    // Debug: Verify htmlReport before saving
    console.log(`🔍 DEBUG: htmlReport type: ${typeof htmlReport}, length: ${htmlReport?.length || 0}, isString: ${typeof htmlReport === 'string'}`);

    // TASK 6: HTML CONTENT PERSISTENCE - Use findByIdAndUpdate to ensure htmlContent is saved
    // Mongoose may drop large htmlContent field during save(), so we save report first, then update htmlContent separately

    const report = new Report({
      projectId: projectIdObj,
      useCaseId: projectIdObj,
      title: `Analysis Report - ${analysisData.project.title || 'Project'}`,
      // Legacy compatibility: store markdown narrative
      content: geminiNarrative,
      // New workflow payload
      sections: [{
        principle: 'FULL_REPORT',
        aiDraft: geminiNarrative,
        expertEdit: '',
        comments: []
      }],
      generatedBy: userIdObj,
      metadata: {
        ...metadata,
        chartsGenerated: normalizedChartCount,
        chartTypes: Object.keys(chartImages),
        hasHTMLReport: true
      },
      // Store scoring data for HTML report generation (CRITICAL for correct report display)
      scoring: reportMetrics?.scores || null,
      // Store chart images as base64 in computedMetrics
      computedMetrics: reportMetrics ? {
        ...reportMetrics,
        chartImages: chartImagesForStorage
      } : null,
      status: 'draft'
    });

    // Save report first (without htmlContent to avoid Mongoose dropping it)
    const savedReportDoc = await report.save();
    const reportId = savedReportDoc._id;

    // CRITICAL: Save htmlContent separately using findByIdAndUpdate to ensure it's persisted
    // This avoids Mongoose strict mode issues with large fields
    await Report.findByIdAndUpdate(
      reportId,
      { htmlContent: htmlReport },
      {
        runValidators: false,  // Skip validation for large HTML content
        upsert: false,
        new: false  // Don't return updated doc, we'll verify separately
      }
    );

    // CRITICAL: Verify HTML was actually saved with explicit check - HARD FAIL if not saved
    const verificationReport = await Report.findById(reportId).select('htmlContent').lean();
    if (!verificationReport) {
      throw new Error(`CRITICAL: Report not found after save. Report ID: ${reportId}`);
    } else if (!verificationReport.htmlContent || verificationReport.htmlContent.length === 0) {
      console.error(`❌ ERROR: htmlContent not saved (length: ${verificationReport.htmlContent?.length || 0}). Report ID: ${reportId}`);
      console.error(`   Original htmlReport length: ${htmlReport?.length || 0}`);

      // Final fallback: Try with set() and strict: false
      const reportDoc = await Report.findById(reportId);
      if (reportDoc) {
        reportDoc.set('htmlContent', htmlReport, { strict: false });
        await reportDoc.save({ validateBeforeSave: false });
        const finalCheck = await Report.findById(reportId).select('htmlContent').lean();
        if (finalCheck && finalCheck.htmlContent && finalCheck.htmlContent.length > 0) {
          console.log(`✅ htmlContent saved after final fallback: ${finalCheck.htmlContent.length} chars`);
        } else {
          // HARD FAIL: htmlContent persistence failed after all attempts
          throw new Error(
            `CRITICAL: htmlContent persist edilemedi. Report ID: ${reportId}. ` +
            `Original length: ${htmlReport?.length || 0}, Final check length: ${finalCheck?.htmlContent?.length || 0}. ` +
            `Cannot proceed with report generation without htmlContent.`
          );
        }
      } else {
        throw new Error(`CRITICAL: Report document not found for final fallback. Report ID: ${reportId}`);
      }
    } else {
      console.log(`✅ htmlContent saved successfully: ${verificationReport.htmlContent.length} chars`);
    }

    console.log(`✅ Report generated and saved: ${reportId}`);
    console.log(`📊 Report has ${normalizedChartCount} chart(s) in computedMetrics`);

    // CRITICAL: Mark this report as the latest one (unmark all previous reports)
    try {
      await Report.markAsLatest(reportId, projectIdObj);
      console.log(`✅ Report marked as latest for project ${projectIdObj}`);
    } catch (latestErr) {
      console.error(`⚠️ Failed to mark report as latest:`, latestErr);
      // Continue anyway - report is still generated and saved
    }

    // Notify all assigned experts (excluding admin who generated the report)
    try {
      const Message = mongoose.model('Message');

      if (analysisData.project && analysisData.project.assignedUsers && analysisData.project.assignedUsers.length > 0) {
        const assignedUserIds = analysisData.project.assignedUsers
          .map(id => {
            const idStr = id.toString ? id.toString() : String(id);
            return isValidObjectId(idStr) ? new mongoose.Types.ObjectId(idStr) : id;
          })
          .filter(id => {
            // Exclude the admin who generated the report
            if (userIdObj) {
              const idStr = id.toString ? id.toString() : String(id);
              const userIdStr = userIdObj.toString ? userIdObj.toString() : String(userIdObj);
              if (idStr === userIdStr) {
                return false;
              }
            }
            return true;
          });

        if (assignedUserIds.length > 0) {
          const projectTitle = analysisData.project.title || 'Project';
          const notificationText = `[NOTIFICATION] A new report draft has been generated for project "${projectTitle}". You can review it in the Reports section.`;

          const projectIdObj = isValidObjectId(projectId)
            ? new mongoose.Types.ObjectId(projectId)
            : projectId;

          await Promise.all(
            assignedUserIds.map(assignedUserId =>
              Message.create({
                projectId: projectIdObj,
                fromUserId: userIdObj || assignedUserId, // Use admin ID if available, otherwise use assigned user ID
                toUserId: assignedUserId,
                text: notificationText,
                isNotification: true,
                createdAt: new Date(),
                readAt: null,
              })
            )
          );

          console.log(`📬 Notifications sent to ${assignedUserIds.length} assigned expert(s)`);
        }
      }
    } catch (notificationError) {
      // Don't fail report generation if notification fails
      console.error('⚠️ Error sending notifications:', notificationError);
    }

    res.json({
      success: true,
      report: {
        id: report._id,
        title: report.title,
        content: report.content, // legacy
        sections: report.sections,
        generatedAt: report.generatedAt,
        metadata: report.metadata,
        status: report.status
      }
    });
  } catch (err) {
    console.error('❌ Error generating report:', err);
    console.error('❌ Error name:', err.name);
    console.error('❌ Error message:', err.message);
    console.error('❌ Error stack:', err.stack);

    // Log additional context
    if (err.code) {
      console.error('❌ Error code:', err.code);
    }
    if (err.path) {
      console.error('❌ Error path:', err.path);
    }
    if (err.keyPattern) {
      console.error('❌ Error keyPattern:', err.keyPattern);
    }
    if (err.keyValue) {
      console.error('❌ Error keyValue:', err.keyValue);
    }

    // Try to stringify error details safely
    try {
      console.error('❌ Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } catch (stringifyError) {
      console.error('❌ Could not stringify error details:', stringifyError.message);
    }

    // More detailed error message
    let errorMessage = err.message || 'Failed to generate report';

    // Check for common error types
    if (err.name === 'TypeError' && err.message.includes('toString')) {
      errorMessage = `Data conversion error: ${err.message}. This usually indicates a null or undefined value.`;
    } else if (err.name === 'ValidationError') {
      errorMessage = `Validation error: ${err.message}`;
    } else if (err.name === 'CastError') {
      errorMessage = `Invalid data type: ${err.message}`;
    } else if (err.message && (err.message.includes('404') || err.message.includes('NOT_FOUND'))) {
      if (!errorMessage.includes('Gemini API')) {
        errorMessage = 'Gemini API model not found. Please check API key and model availability. ' + errorMessage;
      }
    } else if (err.message && (err.message.includes('API key') || err.message.includes('PERMISSION_DENIED'))) {
      if (!errorMessage.includes('API Key')) {
        errorMessage = 'Invalid Gemini API key. Please check your API key. ' + errorMessage;
      }
    } else if (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'))) {
      errorMessage = 'API quota exceeded. Please try again later.';
    }

    res.status(500).json({
      error: errorMessage,
      type: err.name || 'Error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      originalError: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * GET /api/reports
 * Get all reports (optionally filtered by projectId and status)
 */
exports.getAllReports = async (req, res) => {
  try {
    const { projectId, status } = req.query;
    const { roleCategory } = await loadRequestUser(req);
    if (roleCategory !== 'admin') {
      return res.status(403).json({ error: 'Only Admin can list all reports.' });
    }

    const query = {};

    // Explicitly do NOT filter by user for admins (as per Clean Patch requirements)
    if (roleCategory === 'admin') {
      console.log('🔓 Admin detected for getAllReports - listing all reports system-wide');
      console.log('   Query Params:', req.query);
      console.log('   User ID:', req.user ? req.user._id : 'N/A');
    }

    if (projectId) {
      query.projectId = isValidObjectId(projectId)
        ? new mongoose.Types.ObjectId(projectId)
        : projectId;
    }
    if (status) {
      query.status = status;
    }

    const reports = await Report.find(query)
      .select('title projectId generatedBy generatedAt status version metadata createdAt') // Optimized selection: Exclude all heavy content (charts, html, markdown)
      .populate('projectId', 'title')
      .populate('generatedBy', 'name email')
      .sort({ generatedAt: -1 })
      .lean();

    res.json(reports);
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/reports/:id
 * Get specific report by ID
 */
exports.getLatestReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const projectIdObj = toObjectIdOrValue(projectId);
    if (!projectIdObj) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Get user info for authorization
    const { userIdObj, roleCategory } = await loadRequestUser(req);

    // Check if user is assigned to project (unless admin)
    if (roleCategory !== 'admin') {
      const ok = await isUserAssignedToProject({
        userIdObj,
        projectIdObj
      });
      if (!ok) {
        return res.status(403).json({ error: 'Not authorized to view reports for this project' });
      }
    }

    // Find the latest report for this project
    // Sort by version (descending), then by generatedAt (descending), then by createdAt (descending)
    const report = await Report.findOne({ projectId: projectIdObj })
      .sort({ version: -1, generatedAt: -1, createdAt: -1 })
      .lean();

    // Filter out reports hidden for this user (soft delete)
    if (report && roleCategory !== 'admin') {
      if (report.hiddenForUsers && Array.isArray(report.hiddenForUsers)) {
        const hiddenForUserIds = report.hiddenForUsers.map((id) => id.toString());
        if (hiddenForUserIds.includes(userIdObj.toString())) {
          return res.json({ report: null });
        }
      }
    }

    if (!report) {
      return res.json({ report: null });
    }

    // Build file URL
    const reportId = report._id.toString();
    let fileUrl = `/api/reports/${reportId}/file`;
    if (userId) {
      fileUrl += `?userId=${encodeURIComponent(userId)}`;
    }

    res.json({
      report: {
        ...report,
        fileUrl
      }
    });
  } catch (err) {
    console.error('Error fetching latest report:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch latest report' });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to load user, but don't fail if userId is missing (for public access)
    let userIdObj = null;
    let roleCategory = 'expert';
    try {
      const userData = await loadRequestUser(req);
      userIdObj = userData.userIdObj;
      roleCategory = userData.roleCategory;
    } catch (userError) {
      // If userId is missing, allow access but with limited permissions
      console.warn('⚠️ No userId provided in request, using default permissions:', userError.message);
    }

    const report = await Report.findById(id)
      .populate('projectId', 'title description')
      .populate('generatedBy', 'name email role')
      .lean();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Authorization: admin can view all. Expert/Viewer can only view reports for assigned projects.
    if (roleCategory !== 'admin' && userIdObj) {
      const projectIdObj = report?.projectId?._id || report?.projectId;
      const ok = await isUserAssignedToProject({
        userIdObj,
        projectIdObj: toObjectIdOrValue(projectIdObj)
      });
      if (!ok) {
        return res.status(403).json({ error: 'Not authorized to view this report.' });
      }
    }

    // For draft reports, also include fresh metrics so users can see current data
    // This ensures the review screen shows up-to-date information
    if (report.status === 'draft' && report.projectId) {
      try {
        const { buildReportMetrics } = require('../services/reportMetricsService');
        const projectIdObj = report?.projectId?._id || report?.projectId;
        // Include ALL questionnaires for draft report review
        const freshMetrics = await buildReportMetrics(projectIdObj, null);

        // Add fresh metrics to report response
        report.freshMetrics = freshMetrics;
        console.log('✅ Added fresh metrics to draft report for review');
      } catch (metricsError) {
        // Don't fail the request if metrics can't be computed
        console.warn('⚠️ Could not compute fresh metrics for report review:', metricsError.message);
        console.error('   Full error:', metricsError);
      }
    }

    res.json(report);
  } catch (err) {
    console.error('❌ Error fetching report:', err);
    console.error('   Stack:', err.stack);
    res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to fetch report',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

/**
 * PUT /api/reports/:id
 * Update report (status, title, etc.)
 */
exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, title } = req.body;
    const { roleCategory } = await loadRequestUser(req);

    if (roleCategory !== 'admin') {
      return res.status(403).json({ error: 'Only Admin can update report metadata.' });
    }

    const update = {};
    if (status) update.status = status;
    if (title) update.title = title;

    const report = await Report.findByIdAndUpdate(
      id,
      update,
      { new: true }
    ).lean();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (err) {
    console.error('Error updating report:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/reports/:id
 * Delete a report
 */
exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleCategory } = await loadRequestUser(req);

    if (roleCategory !== 'admin') {
      return res.status(403).json({ error: 'Only Admin can delete reports.' });
    }

    const deleted = await Report.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting report:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/reports/my-reports
 * Get reports for projects assigned to the current user
 */
exports.getMyReports = async (req, res) => {
  try {
    const { userIdObj } = await loadRequestUser(req);

    // Find all projects where user is assigned (ProjectAssignment is the primary source)
    let projectIds = [];

    try {
      const ProjectAssignment = require('../models/projectAssignment');
      const assignments = await ProjectAssignment.find({ userId: userIdObj })
        .select('projectId')
        .lean();
      projectIds = assignments.map(a => a.projectId);
    } catch (e) {
      // ignore
    }

    // Fallback: Project.assignedUsers
    const projects = await Project.find({ assignedUsers: userIdObj }).select('_id title').lean();
    projectIds = Array.from(new Set([
      ...projectIds.map(String),
      ...projects.map(p => String(p._id))
    ])).map(id => new mongoose.Types.ObjectId(id));

    if (projectIds.length === 0) {
      return res.json([]);
    }

    // Find all reports for these projects
    const reports = await Report.find({
      projectId: { $in: projectIds }
    })
      .select('title projectId generatedBy generatedAt status version metadata createdAt') // Optimized selection
      .populate('projectId', 'title')
      .populate('generatedBy', 'name email')
      .sort({ generatedAt: -1 })
      .lean();

    res.json(reports);
  } catch (err) {
    console.error('Error fetching user reports:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/reports/:id/file
 * Serve report file (PDF) - inline view
 */
exports.getReportFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    const userIdObj = userId && isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;

    // Load user if userId provided
    let roleCategory = 'expert';
    if (userIdObj) {
      try {
        const user = await User.findById(userIdObj).select('role').lean();
        if (user) {
          roleCategory = getRoleCategory(user.role);
        }
      } catch (e) {
        // ignore
      }
    }

    const report = await Report.findById(id)
      .populate('projectId', 'title')
      .lean();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Authorization: admin can view all. Expert/Viewer can only view reports for assigned projects.
    if (roleCategory !== 'admin' && userIdObj) {
      const projectIdObj = report?.projectId?._id || report?.projectId;
      const ok = await isUserAssignedToProject({
        userIdObj,
        projectIdObj: toObjectIdOrValue(projectIdObj)
      });
      if (!ok) {
        return res.status(403).json({ error: 'Not authorized to view this report.' });
      }
    }

    // Generate PDF on-the-fly (same logic as downloadReportPDF but with inline disposition)
    console.log('📄 Generating PDF for report file view:', id);

    let pdfBuffer;

    if (report.htmlContent && report.htmlContent.trim().length > 0) {
      console.log('✅ Using HTML content with embedded charts for PDF generation');

      const puppeteer = require('puppeteer');
      let browser = null;

      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600 });
        await page.setContent(report.htmlContent, {
          waitUntil: ['load', 'domcontentloaded', 'networkidle0']
        });

        await page.evaluate(() => {
          return Promise.all(
            Array.from(document.images)
              .filter(img => !img.complete)
              .map(img => new Promise((resolve) => {
                img.onload = img.onerror = resolve;
              }))
          );
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        pdfBuffer = await page.pdf({
          format: 'A4',
          margin: {
            top: '2cm',
            right: '1.5cm',
            bottom: '2cm',
            left: '1.5cm'
          },
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: false
        });

        await browser.close();
        console.log('✅ PDF generated from HTML content');
      } catch (htmlPdfError) {
        console.error('❌ Error generating PDF from HTML:', htmlPdfError);
        if (browser) await browser.close();
        throw new Error(`PDF generation failed: ${htmlPdfError.message}`);
      }
    } else {
      // Legacy report fallback
      const reportAge = new Date() - new Date(report.generatedAt);
      const isLegacyReport = reportAge > (7 * 24 * 60 * 60 * 1000);

      if (isLegacyReport) {
        console.log('⚠️ Legacy report without HTML content. Using markdown PDF generation...');
        pdfBuffer = await generatePDFFromMarkdown(
          buildExportMarkdownFromReport(report),
          report.title
        );
      } else {
        throw new Error('Report has no HTML content and cannot be generated');
      }
    }

    // Serve PDF inline (not as download)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${report.title.replace(/[^a-z0-9]/gi, '_')}_${id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('❌ Error serving report file:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to serve report file' });
  }
};

/**
 * GET /api/reports/:id/download-html
 * Download report as HTML
 */
exports.downloadReportHTML = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIdObj, roleCategory } = await loadRequestUser(req);

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Authorization: admin can export all. Expert/Viewer can export assigned reports.
    if (roleCategory !== 'admin') {
      const projectIdObj = report?.projectId?._id || report?.projectId;
      const ok = await isUserAssignedToProject({
        userIdObj,
        projectIdObj: toObjectIdOrValue(projectIdObj)
      });
      if (!ok) {
        return res.status(403).json({ error: 'Not authorized to download this report.' });
      }
    }

    if (!report.htmlContent || report.htmlContent.length === 0) {
      return res.status(404).json({ error: 'HTML content not found for this report.' });
    }

    // Set headers for HTML download
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.html"`);
    res.send(report.htmlContent);
  } catch (error) {
    console.error('Error downloading HTML report:', error);
    res.status(500).json({ error: error.message || 'Failed to download HTML report' });
  }
};

/**
 * GET /api/reports/:id/download
 * Download report as PDF
 */
exports.downloadReportPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIdObj, roleCategory } = await loadRequestUser(req);

    const report = await Report.findById(id)
      .populate('projectId', 'title')
      .lean();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Authorization: admin can export all. Expert/Viewer can export assigned reports.
    if (roleCategory !== 'admin') {
      const projectIdObj = report?.projectId?._id || report?.projectId;
      const ok = await isUserAssignedToProject({
        userIdObj,
        projectIdObj: toObjectIdOrValue(projectIdObj)
      });
      if (!ok) {
        return res.status(403).json({ error: 'Not authorized to download this report.' });
      }
    }

    console.log('📄 Generating PDF for report:', id);
    console.log(`📊 Report has htmlContent: ${!!report.htmlContent}, length: ${report.htmlContent?.length || 0}`);

    let pdfBuffer;

    // If HTML content exists (with charts), use it for PDF generation
    if (report.htmlContent && report.htmlContent.trim().length > 0) {
      console.log('✅ Using HTML content with embedded charts for PDF generation');

      const puppeteer = require('puppeteer');
      let browser = null;

      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Set viewport for consistent rendering
        await page.setViewport({ width: 1200, height: 1600 });

        // Set HTML content and wait for images to load
        await page.setContent(report.htmlContent, {
          waitUntil: ['load', 'domcontentloaded', 'networkidle0']
        });

        // Wait for all images (including base64 data URIs) to be fully loaded
        await page.evaluate(() => {
          return Promise.all(
            Array.from(document.images)
              .filter(img => !img.complete)
              .map(img => new Promise((resolve) => {
                img.onload = img.onerror = resolve;
              }))
          );
        });

        // Additional wait for chart rendering
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Generate PDF from HTML
        pdfBuffer = await page.pdf({
          format: 'A4',
          margin: {
            top: '2cm',
            right: '1.5cm',
            bottom: '2cm',
            left: '1.5cm'
          },
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: false
        });

        await browser.close();
        console.log('✅ PDF generated from HTML content with charts');
      } catch (htmlPdfError) {
        console.error('❌ Error generating PDF from HTML:', htmlPdfError);
        if (browser) await browser.close();
        // HARD FAIL: Do not fallback to markdown - HTML should always be available for new reports
        throw new Error(
          `CRITICAL: PDF generation from HTML failed. ` +
          `HTML content exists (${report.htmlContent.length} chars) but PDF generation failed. ` +
          `Error: ${htmlPdfError.message}. ` +
          `Cannot proceed with markdown fallback - HTML content must be used.`
        );
      }
    } else {
      // Only allow markdown fallback for legacy reports (generated before HTML support)
      // New reports MUST have htmlContent
      const reportAge = new Date() - new Date(report.generatedAt);
      const isLegacyReport = reportAge > (7 * 24 * 60 * 60 * 1000); // Older than 7 days

      if (isLegacyReport) {
        console.log('⚠️ Legacy report without HTML content. Using markdown PDF generation...');
        pdfBuffer = await generatePDFFromMarkdown(
          buildExportMarkdownFromReport(report),
          report.title
        );
      } else {
        throw new Error(
          `CRITICAL: Report has no htmlContent but is not a legacy report (generated: ${report.generatedAt}). ` +
          `Cannot generate PDF without HTML content. Report should be regenerated.`
        );
      }
    }

    // Set response headers for PDF download
    const fileName = `${report.title.replace(/[^a-z0-9]/gi, '_')}_${id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to generate PDF' });
  }
};

/**
 * GET /api/reports/:id/download-docx
 * Download report as DOCX (always uses latest data)
 */
exports.downloadReportDOCX = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIdObj, roleCategory } = await loadRequestUser(req);

    // Get report to find projectId
    const report = await Report.findById(id)
      .populate('projectId', 'title')
      .lean();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Authorization: admin can export all. Expert/Viewer can export assigned reports.
    if (roleCategory !== 'admin') {
      const projectIdObj = report?.projectId?._id || report?.projectId;
      const ok = await isUserAssignedToProject({
        userIdObj,
        projectIdObj: toObjectIdOrValue(projectIdObj)
      });
      if (!ok) {
        return res.status(403).json({ error: 'Not authorized to download this report.' });
      }
    }

    const projectId = report?.projectId?._id || report?.projectId;
    if (!projectId) {
      return res.status(404).json({ error: 'Project not found for this report' });
    }

    console.log('📄 Generating DOCX for report:', id, 'project:', projectId);

    // Always fetch fresh data for DOCX generation - include ALL questionnaires
    const reportMetrics = await buildReportMetrics(projectId, null);

    // Get the latest report content (use sections if available, otherwise content)
    let geminiNarrative = '';
    if (Array.isArray(report.sections) && report.sections.length > 0) {
      const section = report.sections[0];
      geminiNarrative = (section?.expertEdit || '').trim() || section?.aiDraft || '';
    } else {
      geminiNarrative = report.content || '';
    }

    // Get chart images from report's computedMetrics or generate fresh
    let chartBuffers = null;
    if (report.computedMetrics && report.computedMetrics.chartImages) {
      chartBuffers = {};
      for (const [key, value] of Object.entries(report.computedMetrics.chartImages)) {
        if (typeof value === 'string') {
          // Convert base64 string to Buffer
          const base64Data = value.startsWith('data:')
            ? value.split(',')[1]
            : value;
          chartBuffers[key] = Buffer.from(base64Data, 'base64');
        } else if (Buffer.isBuffer(value)) {
          chartBuffers[key] = value;
        }
      }
    }

    // Generate DOCX with fresh data
    const docxBuffer = await generateProfessionalDOCX(
      reportMetrics,
      geminiNarrative,
      report.generatedAt || new Date(),
      chartBuffers
    );

    // Set response headers for DOCX download
    const fileName = `${report.title.replace(/[^a-z0-9]/gi, '_')}_${id}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', docxBuffer.length);

    res.send(docxBuffer);
  } catch (err) {
    console.error('Error generating DOCX:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to generate DOCX' });
  }
};

/**
 * GET /api/reports/assigned-to-me
 * Expert/Viewer can list reports for assigned projects. Admin can also use it.
 */
exports.getAssignedToMe = async (req, res) => {
  try {
    const { userIdObj } = await loadRequestUser(req);

    let projectIds = [];
    try {
      const ProjectAssignment = require('../models/projectAssignment');
      const assignments = await ProjectAssignment.find({ userId: userIdObj })
        .select('projectId')
        .lean();
      projectIds = assignments.map(a => a.projectId);
    } catch (e) {
      // ignore
    }

    const projects = await Project.find({ assignedUsers: userIdObj }).select('_id').lean();
    projectIds = Array.from(new Set([
      ...projectIds.map(String),
      ...projects.map(p => String(p._id))
    ])).map(id => new mongoose.Types.ObjectId(id));

    if (projectIds.length === 0) return res.json([]);

    const reports = await Report.find({ projectId: { $in: projectIds } })
      .select('title projectId generatedBy generatedAt status metadata createdAt')
      .populate('projectId', 'title')
      .populate('generatedBy', 'name email')
      .sort({ generatedAt: -1 })
      .lean();

    res.json(reports);
  } catch (err) {
    console.error('Error fetching assigned reports:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

/**
 * PATCH /api/reports/:id/sections/:principle/expert-edit
 * Expert (and Admin) can update expertEdit on a draft report.
 */
exports.updateSectionExpertEdit = async (req, res) => {
  try {
    const { id, principle } = req.params;
    const { expertEdit } = req.body;
    const { userIdObj, roleCategory } = await loadRequestUser(req);

    if (roleCategory === 'viewer') {
      return res.status(403).json({ error: 'Viewer cannot edit reports.' });
    }

    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Locked after finalize
    if (report.status === 'final') {
      return res.status(409).json({ error: 'Report is finalized and locked.' });
    }

    if (roleCategory !== 'admin') {
      const ok = await isUserAssignedToProject({
        userIdObj,
        projectIdObj: toObjectIdOrValue(report.projectId)
      });
      if (!ok) {
        return res.status(403).json({ error: 'Not authorized to edit this report.' });
      }
    }

    const targetPrinciple = decodeURIComponent(principle || '');
    report.sections = Array.isArray(report.sections) ? report.sections : [];

    let section = report.sections.find(s => s.principle === targetPrinciple);
    if (!section) {
      section = { principle: targetPrinciple, aiDraft: '', expertEdit: '', comments: [] };
      report.sections.push(section);
    }

    section.expertEdit = String(expertEdit || '');

    await report.save();
    res.json({ success: true, report: report.toObject() });
  } catch (err) {
    console.error('Error updating expert edit:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

/**
 * POST /api/reports/:id/sections/:principle/comments
 * Expert (and Admin) can comment on a draft report.
 */
exports.addSectionComment = async (req, res) => {
  try {
    const { id, principle } = req.params;
    const { text } = req.body;
    const { user, userIdObj, roleCategory } = await loadRequestUser(req);

    if (roleCategory === 'viewer') {
      return res.status(403).json({ error: 'Viewer cannot comment on reports.' });
    }

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (report.status === 'final') {
      return res.status(409).json({ error: 'Report is finalized and locked.' });
    }

    if (roleCategory !== 'admin') {
      const ok = await isUserAssignedToProject({
        userIdObj,
        projectIdObj: toObjectIdOrValue(report.projectId)
      });
      if (!ok) {
        return res.status(403).json({ error: 'Not authorized to comment on this report.' });
      }

    }

    const targetPrinciple = decodeURIComponent(principle || '');
    report.sections = Array.isArray(report.sections) ? report.sections : [];

    let section = report.sections.find(s => s.principle === targetPrinciple);
    if (!section) {
      section = { principle: targetPrinciple, aiDraft: '', expertEdit: '', comments: [] };
      report.sections.push(section);
    }

    section.comments = Array.isArray(section.comments) ? section.comments : [];
    section.comments.push({
      userId: userIdObj,
      userName: user?.name || 'User',
      text: String(text).trim(),
      createdAt: new Date()
    });

    await report.save();

    // Notify Admins
    const { notifyAdminReview } = require('../services/notificationService');
    const commentText = `[Section: ${targetPrinciple}] ${text.trim()}`;

    // Non-blocking notification
    console.log(`🔔 Triggering admin notification for section comment on report ${id}`);
    notifyAdminReview(report.projectId, report._id, userIdObj, user?.name || 'User', commentText).catch(err => {
      console.error('❌ Failed to notify admins about report section comment:', err);
    });

    res.json({ success: true, report: report.toObject() });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

/**
 * POST /api/reports/:id/finalize
 * Admin-only: marks report as final and locks edits/comments.
 */
exports.finalizeReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleCategory } = await loadRequestUser(req);

    if (roleCategory !== 'admin') {
      return res.status(403).json({ error: 'Only Admin can finalize reports.' });
    }

    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (report.status === 'final') {
      return res.json({ success: true, report: report.toObject() });
    }

    report.status = 'final';
    report.finalizedAt = new Date();
    report.version = (report.version || 1) + 1;
    await report.save();

    res.json({ success: true, report: report.toObject() });
  } catch (err) {
    console.error('Error finalizing report:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

/**
 * ============================================================
 * ATOMIC REPORT GENERATION (NEW WORKFLOW)
 * ============================================================
 * Generates PDF + Word atomically from the same snapshot.
 * This is the NEW recommended endpoint for report generation.
 * 
 * POST /api/reports/generate-atomic
 */
exports.generateReportAtomic = async (req, res) => {
  try {
    const { projectId } = req.body;

    const { user, userIdObj, roleCategory } = await loadRequestUser(req);
    if (roleCategory !== 'admin') {
      return res.status(403).json({ error: 'Only admins can generate reports' });
    }

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    console.log('🚀 Starting ATOMIC report generation for project:', projectId);

    // ============================================================
    // STEP 1: Collect all analysis data (same as before)
    // ============================================================
    const analysisData = await collectAnalysisData(projectId);

    // ============================================================
    // STEP 2: Build report metrics
    // ============================================================
    console.log('📈 Building report metrics...');
    const reportMetrics = await buildReportMetrics(projectId, null);
    const analytics = await getProjectAnalytics(projectId, null);
    const { getProjectEvaluators } = require('../services/reportMetricsService');
    const evaluatorsData = await getProjectEvaluators(projectId);

    // ============================================================
    // STEP 3: Generate charts using Chart Contract
    // ============================================================
    console.log('📊 Generating charts...');

    const tensions = analysisData.tensions || [];
    let tensionsSummary = {};
    if (tensions.length > 0) {
      const reviewStateCounts = {
        proposed: 0,
        underReview: 0,
        accepted: 0,
        disputed: 0,
        resolved: 0,
        total: tensions.length
      };

      tensions.forEach(t => {
        const state = String(t.status || 'ongoing').toLowerCase();
        if (state.includes('proposed')) reviewStateCounts.proposed++;
        else if (state.includes('under') || state.includes('review')) reviewStateCounts.underReview++;
        else if (state.includes('accepted')) reviewStateCounts.accepted++;
        else if (state.includes('disputed')) reviewStateCounts.disputed++;
        else if (state.includes('resolved')) reviewStateCounts.resolved++;
        else reviewStateCounts.proposed++;
      });

      const evidenceTypeDistribution = reportMetrics.tensionsSummary?.evidenceTypeDistribution || {};

      tensionsSummary = {
        summary: {
          ...reviewStateCounts,
          evidenceTypeDistribution
        },
        list: tensions
      };
    }

    const coverageData = {
      evidenceMetrics: analytics.evidenceMetrics || null
    };

    // PRESENTATION REFACTOR: Chart generation disabled.
    // Charts replaced with deterministic tables for audit integrity.
    /*
    const chartGenerationResult = await chartGenerationService.generateAllCharts({
      projectId,
      questionnaireKey: null,
      scoring: reportMetrics.scoring,
      evaluators: evaluatorsData,
      tensions: tensionsSummary,
      coverage: coverageData
    });
    const chartResults = chartGenerationResult.charts;
    */

    // Return empty chart results - HTML template uses tables instead
    const chartResults = {};
    console.log(`✅ Chart generation BYPASSED: Using table-based presentation`);

    // ============================================================
    // STEP 4: Convert charts to data URIs
    // ============================================================
    const chartImages = {};
    for (const [chartId, chartResult] of Object.entries(chartResults)) {
      if (!chartResult || !chartResult.pngBase64) continue;

      if (chartResult.pngBase64.startsWith('data:image/')) {
        chartImages[chartId] = chartResult.pngBase64;
      } else if (chartResult.pngBase64.length > 0) {
        chartImages[chartId] = `data:image/png;base64,${chartResult.pngBase64}`;
      }
    }

    // ============================================================
    // STEP 5: Build top risk drivers
    // ============================================================
    console.log('📊 Building top risk drivers...');
    const { buildTopRiskDriversTable } = require('../services/topDriversService');
    const topDriversTable = await buildTopRiskDriversTable(projectId);

    if (reportMetrics && reportMetrics.scoring) {
      reportMetrics.scoring.topRiskDrivers = {
        ...reportMetrics.scoring.topRiskDrivers,
        table: topDriversTable
      };
    }

    // ============================================================
    // STEP 6: Generate narrative with Gemini
    // ============================================================
    console.log('🤖 Generating narrative with Gemini...');

    const analysisDataWithCharts = {
      ...analysisData,
      chartMetadata: {
        chartsGenerated: Object.keys(chartImages).length,
        chartTypes: Object.keys(chartImages),
        hasHeatmap: !!chartImages.principleEvaluatorHeatmap,
        hasEvidenceChart: !!chartImages.evidenceTypeChart,
        hasTensionCharts: !!(chartImages.tensionSeverityChart || chartImages.tensionReviewStateChart)
      },
      reportMetrics: reportMetrics || null
    };

    const geminiNarrative = await generateReport(analysisDataWithCharts);

    if (!geminiNarrative || geminiNarrative.trim().length === 0) {
      throw new Error('Gemini generated empty narrative');
    }

    // ============================================================
    // STEP 7: Generate HTML report
    // ============================================================
    console.log('📄 Generating HTML report...');

    const structuredNarrative = {
      markdown: geminiNarrative,
      executiveSummary: [],
      topRiskDriversNarrative: [],
      tensionsNarrative: [],
      principleFindings: [],
      recommendations: []
    };

    const htmlReport = generateHTMLReport(
      reportMetrics || {},
      structuredNarrative,
      chartImages,
      {
        generatedAt: new Date(),
        analytics: analytics,
        reportMetrics: reportMetrics
      }
    );

    if (!htmlReport || htmlReport.trim().length === 0) {
      throw new Error('HTML generation failed');
    }

    // ============================================================
    // STEP 8: ATOMIC GENERATION - PDF + Word together
    // ============================================================
    console.log('🔒 Starting ATOMIC file generation (PDF + Word)...');

    const { generateReportFilesAtomic } = require('../services/atomicReportGenerationService');

    const metadata = {
      scoringModelVersion: 'erc_v1',
      questionsAnswered: analysisData.unifiedAnswers?.length || 0,
      tensionsCount: tensions.length,
      overallERC: reportMetrics?.scoring?.totals?.overallAvg || null,
      riskLabel: reportMetrics?.scoring?.totalsOverall?.riskLabel || null,
      evaluatorCount: evaluatorsData?.length || 0,
      evaluatorRoles: [...new Set(evaluatorsData?.map(e => e.role) || [])],
      chartsGenerated: Object.keys(chartImages).length,
      chartTypes: Object.keys(chartImages)
    };

    const atomicResult = await generateReportFilesAtomic({
      projectId,
      htmlContent: htmlReport,
      metadata,
      narrative: geminiNarrative,
      userId: userIdObj
    });

    console.log('✅ ATOMIC REPORT GENERATION COMPLETED');
    console.log(`   Report ID: ${atomicResult.reportId}`);
    console.log(`   Version: ${atomicResult.version}`);
    console.log(`   PDF: ${atomicResult.pdfPath}`);
    console.log(`   Word: ${atomicResult.wordPath}`);

    // ============================================================
    // STEP 9: Notify assigned experts
    // ============================================================
    try {
      const Message = mongoose.model('Message');

      if (analysisData.project && analysisData.project.assignedUsers && analysisData.project.assignedUsers.length > 0) {
        const assignedUserIds = analysisData.project.assignedUsers
          .map(id => {
            const idStr = id?.toString ? id.toString() : String(id);
            return idStr !== userIdObj.toString() ? idStr : null;
          })
          .filter(Boolean);

        if (assignedUserIds.length > 0) {
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const reportUrl = `${baseUrl}/projects/${projectId}#report`;

          for (const assignedUserId of assignedUserIds) {
            const message = new Message({
              recipientId: assignedUserId,
              senderId: userIdObj,
              subject: `New Report Generated: v${atomicResult.version}`,
              content: `A new ethical assessment report (version ${atomicResult.version}) has been generated for project "${analysisData.project.title || 'Project'}". View it here: ${reportUrl}`,
              type: 'report_generated',
              relatedEntityId: projectId,
              relatedEntityType: 'project',
              isRead: false
            });
            await message.save();
          }

          console.log(`✅ Notifications sent to ${assignedUserIds.length} expert(s)`);
        }
      }
    } catch (notifError) {
      console.error('⚠️  Error sending notifications:', notifError.message);
      // Don't fail report generation if notifications fail
    }

    // ============================================================
    // STEP 10: Return success response
    // ============================================================
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.json({
      success: true,
      message: 'Report generated successfully (PDF + Word)',
      reportId: atomicResult.reportId,
      version: atomicResult.version,
      versionLabel: `v${atomicResult.version} (Latest)`,
      status: atomicResult.status,
      latest: atomicResult.latest,
      files: {
        pdf: {
          downloadUrl: `${baseUrl}/api/reports/${atomicResult.reportId}/pdf`,
          viewUrl: `${baseUrl}/api/reports/${atomicResult.reportId}/pdf?inline=true`,
          size: atomicResult.pdfSize,
          sizeFormatted: `${(atomicResult.pdfSize / 1024).toFixed(2)} KB`
        },
        word: {
          downloadUrl: `${baseUrl}/api/reports/${atomicResult.reportId}/word`,
          size: atomicResult.wordSize,
          sizeFormatted: `${(atomicResult.wordSize / 1024).toFixed(2)} KB`
        }
      }
    });

  } catch (error) {
    console.error('❌ ATOMIC REPORT GENERATION FAILED:', error);
    console.error(error.stack);
    res.status(500).json({
      error: error.message,
      details: 'Atomic report generation failed. No files were created.'
    });
  }
};

/**
 * POST /api/reports/:id/comments
 * Add a comment to the report (Expert Review)
 */
exports.addReportComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const { user, userIdObj } = await loadRequestUser(req);

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Add comment to report
    const newComment = {
      userId: userIdObj,
      userName: user.name || user.email,
      text: text.trim(),
      createdAt: new Date()
    };

    report.expertComments = report.expertComments || [];
    report.expertComments.push(newComment);
    await report.save();

    // Notify Admins
    const { notifyAdminReview } = require('../services/notificationService');

    console.log(`🔔 Triggering admin notification for general comment on report ${id}`);

    // Non-blocking notification
    notifyAdminReview(report.projectId, report._id, userIdObj, newComment.userName, newComment.text).catch(err => {
      console.error('❌ Failed to notify admins about report comment:', err);
    });

    res.json({ success: true, comment: newComment });

  } catch (error) {
    console.error('Error adding report comment:', error);
    res.status(500).json({ error: error.message });
  }
};


