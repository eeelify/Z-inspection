const mongoose = require('mongoose');
const { generateReport } = require('../services/geminiService');
const { generatePDFFromMarkdown } = require('../services/pdfService');
const { buildReportMetrics } = require('../services/reportMetricsService');
const chartGenerationService = require('../services/chartGenerationService');
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

    // Ensure all scores are computed before generating report
    // This ensures medical and education scores are included
    const { computeScores } = require('../services/evaluationService');
    
    // Get all unique userId/questionnaireKey combinations for this project
    const responses = await Response.find({ 
      projectId: projectIdObj,
      status: { $in: ['draft', 'submitted'] }
    }).select('userId questionnaireKey').lean();
    
    const uniqueCombinations = new Set();
    responses.forEach(r => {
      uniqueCombinations.add(`${r.userId}_${r.questionnaireKey}`);
    });
    
    // Compute scores for all combinations (if not already computed or outdated)
    for (const combo of uniqueCombinations) {
      const [userId, questionnaireKey] = combo.split('_');
      try {
        await computeScores(projectIdObj, userId, questionnaireKey);
      } catch (error) {
        console.warn(`⚠️ Could not compute scores for ${userId}/${questionnaireKey}:`, error.message);
      }
    }

    // Get all scores (now including newly computed ones)
    const scores = await Score.find({ projectId: projectIdObj }).lean();

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
    let chartImages = {};
    let chartGenerationError = null;
    
    try {
      // Build metrics using reportMetricsService
      reportMetrics = await buildReportMetrics(projectId, 'general-v1');
      
      // Get analytics for chart data
      const analytics = await getProjectAnalytics(projectId, 'general-v1');
      
      // ============================================================
      // STEP 2: Generate charts BEFORE Gemini
      // ============================================================
      console.log('📊 Generating charts...');
      
      // Generate Principle Bar Chart (required chart)
      if (reportMetrics.scoring?.byPrincipleOverall) {
        try {
          chartImages.principleBarChart = await chartGenerationService.generatePrincipleBarChart(
            reportMetrics.scoring.byPrincipleOverall
          );
          console.log('✅ Principle bar chart generated');
        } catch (err) {
          console.error('❌ Principle bar chart generation failed:', err.message);
          chartGenerationError = err;
        }
      }

      // Generate Principle × Evaluator Heatmap
      if (reportMetrics.scoring?.byPrincipleTable && analytics.evaluators?.length > 0) {
        try {
          chartImages.principleEvaluatorHeatmap = await chartGenerationService.generatePrincipleEvaluatorHeatmap(
            reportMetrics.scoring.byPrincipleTable,
            analytics.evaluators
          );
          console.log('✅ Heatmap generated');
        } catch (err) {
          console.error('❌ Heatmap generation failed:', err.message);
          chartGenerationError = err;
        }
      }
      
      // TASK 7: Evidence charts removed (invalid/misleading per Z-Inspection methodology)
      
      // Generate Tension Severity Distribution
      if (tensions.length > 0) {
        try {
          const severityDist = {};
          tensions.forEach(t => {
            const severity = String(t.severity || 'unknown').toLowerCase();
            severityDist[severity] = (severityDist[severity] || 0) + 1;
          });
          chartImages.tensionSeverityChart = await chartGenerationService.generateTensionSeverityChart(severityDist);
          console.log('✅ Tension severity chart generated');
        } catch (err) {
          console.error('❌ Tension severity chart generation failed:', err.message);
        }
      }
      
      // Generate Tension Review State Distribution
      if (tensions.length > 0) {
        try {
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
          
          chartImages.tensionReviewStateChart = await chartGenerationService.generateTensionReviewStateChart({
            countsByReviewState: {
              proposed: reviewStateCounts.proposed,
              underreview: reviewStateCounts.underReview,
              accepted: reviewStateCounts.accepted,
              disputed: reviewStateCounts.disputed,
              resolved: reviewStateCounts.resolved
            },
            total: reviewStateCounts.total
          });
          console.log('✅ Tension review state chart generated');
        } catch (err) {
          console.error('❌ Tension review state chart generation failed:', err.message);
        }
      }
      
      // SAFETY GUARD: Validate charts were generated
      const chartCount = Object.keys(chartImages).length;
      
      // Guard 1: If scores exist but no heatmap generated → WARN
      if (scores.length > 0 && reportMetrics.scoring?.byPrincipleTable && !chartImages.principleEvaluatorHeatmap) {
        console.warn('⚠️  WARNING: Scores and principle table exist but heatmap was not generated');
      }
      
      // Guard 2: If chart service exists but no charts generated despite having data → WARN
      if (scores.length > 0 && chartCount === 0) {
        console.warn('⚠️  WARNING: Chart generation service exists but no charts were generated despite having score data');
      }
      
      // Guard 3: If tensions exist but no tension charts generated → WARN
      if (tensions.length > 0 && !chartImages.tensionSeverityChart && !chartImages.tensionReviewStateChart) {
        console.warn('⚠️  WARNING: Tensions exist but no tension charts were generated');
      }
      
      // Guard 4: If evidence data exists but no evidence charts → WARN
      if (analytics.evidenceMetrics?.typeDistribution?.length > 0 && !chartImages.evidenceTypeChart) {
        console.warn('⚠️  WARNING: Evidence data exists but evidence type chart was not generated');
      }
      
      console.log(`✅ Generated ${chartCount} chart(s): ${Object.keys(chartImages).join(', ')}`);
      
    } catch (error) {
      console.error('❌ Chart generation pipeline failed:', error.message);
      chartGenerationError = error;
      // Continue with report generation even if charts fail (non-blocking)
    }

    // ============================================================
    // STEP 2.5: NORMALIZE CHART OUTPUT (CRITICAL)
    // ============================================================
    console.log('🔄 Normalizing chart images format...');
    
    // Debug logging (temporary)
    console.log('🧪 ChartImages raw keys:', Object.keys(chartImages || {}));
    const chartTypes = {};
    for (const [k, v] of Object.entries(chartImages || {})) {
      if (!v) {
        chartTypes[k] = 'null/undefined';
      } else if (Buffer.isBuffer(v)) {
        chartTypes[k] = `Buffer(${v.length} bytes)`;
      } else if (v instanceof Uint8Array) {
        chartTypes[k] = `Uint8Array(${v.length} bytes)`;
      } else if (typeof v === 'string') {
        chartTypes[k] = `string(${v.length} chars)`;
      } else if (typeof v === 'object') {
        chartTypes[k] = `object(${Object.keys(v).join(', ')})`;
        // Log object structure for debugging
        console.log(`🧪   ${k} object keys:`, Object.keys(v));
        if (v.data) console.log(`🧪   ${k} has .data (type: ${typeof v.data}, length: ${v.data?.length || 'N/A'})`);
        if (v.buffer) console.log(`🧪   ${k} has .buffer (type: ${typeof v.buffer}, isBuffer: ${Buffer.isBuffer(v.buffer)})`);
      } else {
        chartTypes[k] = typeof v;
      }
    }
    console.log('🧪 ChartImages types:', chartTypes);
    
    // Normalize all chart images to base64 data URI strings
    const normalizedChartImages = {};
    for (const [key, value] of Object.entries(chartImages || {})) {
      if (!value) {
        console.warn(`⚠️  Chart ${key} is null/undefined, skipping`);
        continue;
      }

      let bufferToConvert = null;
      
      // Case 1: already base64 string (data URI)
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        normalizedChartImages[key] = value;
        continue;
      }
      
      // Case 2: Buffer (direct)
      if (Buffer.isBuffer(value)) {
        bufferToConvert = value;
      }
      // Case 3: Uint8Array (can be converted to Buffer)
      else if (value instanceof Uint8Array) {
        bufferToConvert = Buffer.from(value);
      }
      // Case 4: Object with .buffer property (common in some libraries)
      else if (value && typeof value === 'object' && value.buffer) {
        if (Buffer.isBuffer(value.buffer)) {
          bufferToConvert = value.buffer;
        } else if (value.buffer instanceof Uint8Array) {
          bufferToConvert = Buffer.from(value.buffer);
        } else if (Buffer.isBuffer(value)) {
          bufferToConvert = value;
        }
      }
      // Case 4b: Puppeteer screenshot returns Buffer-like object - try direct conversion
      else if (value && typeof value === 'object' && value.length !== undefined && typeof value.length === 'number') {
        // This might be a Buffer that Buffer.isBuffer() doesn't recognize
        // Try to convert it
        try {
          // Check if it has Buffer-like properties
          if (value.readUInt8 || value.toString) {
            bufferToConvert = Buffer.from(value);
          }
        } catch (e) {
          // Ignore conversion errors
        }
      }
      // Case 5: Object with .data property
      else if (value && typeof value === 'object' && value.data) {
        if (Buffer.isBuffer(value.data)) {
          bufferToConvert = value.data;
        } else if (value.data instanceof Uint8Array) {
          bufferToConvert = Buffer.from(value.data);
        } else if (typeof value.data === 'string') {
          // Might be base64 string
          normalizedChartImages[key] = value.data.startsWith('data:') ? value.data : `data:image/png;base64,${value.data}`;
          continue;
        }
      }
      // Case 6: Object with .image field (string)
      else if (value && typeof value === 'object' && value.image && typeof value.image === 'string') {
        normalizedChartImages[key] = value.image.startsWith('data:') ? value.image : `data:image/png;base64,${value.image}`;
        continue;
      }
      // Case 7: Try to convert object to Buffer (last resort - for objects that are actually Buffers but not detected)
      else if (value && typeof value === 'object' && value.length !== undefined && typeof value.length === 'number') {
        try {
          bufferToConvert = Buffer.from(value);
        } catch (e) {
          console.warn(`⚠️  Chart ${key} object could not be converted to Buffer:`, e.message);
        }
      }
      // Case 8: plain base64 string (without data: prefix)
      else if (typeof value === 'string' && value.length > 0) {
        normalizedChartImages[key] = `data:image/png;base64,${value}`;
        continue;
      }
      
      // Convert buffer to base64 data URI
      if (bufferToConvert) {
        try {
          normalizedChartImages[key] = `data:image/png;base64,${bufferToConvert.toString('base64')}`;
          console.log(`✅ Chart ${key} normalized from Buffer (${bufferToConvert.length} bytes)`);
          continue;
        } catch (e) {
          console.error(`❌ Failed to convert ${key} Buffer to base64:`, e.message);
        }
      }
      
      // If we get here, we couldn't normalize it
      console.warn(`⚠️  Chart ${key} has unknown format: ${typeof value}, structure: ${JSON.stringify(Object.keys(value || {}))}`);
    }
    
    // Replace chartImages with normalized version
    chartImages = normalizedChartImages;
    const normalizedChartCount = Object.keys(chartImages).length;
    console.log(`✅ Normalized ${normalizedChartCount} chart(s) to base64 data URIs`);

    // ============================================================
    // STEP 3: Generate report narrative using Gemini AI (NARRATIVE ONLY)
    // ============================================================
    console.log('🤖 Calling Gemini API for narrative generation...');
    
    // SAFETY GUARD: Validate charts before Gemini (check for base64 strings only)
    const validCharts = Object.values(chartImages).filter(v => 
      typeof v === 'string' && v.startsWith('data:image/')
    );
    
    if (scores.length > 0 && validCharts.length === 0) {
      console.error(`❌ ERROR: Charts must be generated before calling Gemini. Found ${normalizedChartCount} charts but none are valid base64 strings.`);
      throw new Error('CRITICAL: Chart generation failed or produced invalid charts. Cannot proceed with report generation.');
    }
    
    // SAFETY GUARD: Warn if chart generation had errors (non-blocking if charts exist)
    if (chartGenerationError && scores.length > 0) {
      if (validCharts.length > 0) {
        console.warn('⚠️  WARNING: Chart generation had errors but some charts were generated. Continuing with report generation.');
      } else {
        console.error('❌ ERROR: Chart generation failed and no valid charts were produced.');
        throw new Error('Chart generation failed. Cannot proceed with report generation.');
      }
    }
    
    console.log(`✅ Chart validation passed: ${validCharts.length} valid chart(s) ready for HTML report`);
    
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
    const geminiNarrative = await generateReport(analysisDataWithCharts);
    
    // DEFENSIVE VALIDATION: Validate narrative quality
    if (!geminiNarrative || geminiNarrative.trim().length === 0) {
      const error = new Error('Report generation failed: Empty narrative generated');
      error.statusCode = 500;
      throw error;
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
    console.error('❌ Error stack:', err.stack);
    console.error('❌ Error details:', JSON.stringify(err, null, 2));
    
    // More detailed error message
    let errorMessage = err.message || 'Failed to generate report';
    
    // Hata mesajı zaten geminiService'den detaylı geliyor, sadece ek kontroller yap
    if (err.message && (err.message.includes('404') || err.message.includes('NOT_FOUND'))) {
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
    if (projectId) {
      query.projectId = isValidObjectId(projectId)
        ? new mongoose.Types.ObjectId(projectId)
        : projectId;
    }
    if (status) {
      query.status = status;
    }

    const reports = await Report.find(query)
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
    const { userIdObj, roleCategory } = await loadRequestUser(req);

    const report = await Report.findById(id)
      .populate('projectId', 'title description')
      .populate('generatedBy', 'name email role')
      .lean();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Authorization: admin can view all. Expert/Viewer can only view reports for assigned projects.
    if (roleCategory !== 'admin') {
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
        const freshMetrics = await buildReportMetrics(projectIdObj, 'general-v1');
        
        // Add fresh metrics to report response
        report.freshMetrics = freshMetrics;
        console.log('✅ Added fresh metrics to draft report for review');
      } catch (metricsError) {
        // Don't fail the request if metrics can't be computed
        console.warn('⚠️ Could not compute fresh metrics for report review:', metricsError.message);
      }
    }

    res.json(report);
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
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

    // Always fetch fresh data for DOCX generation
    const reportMetrics = await buildReportMetrics(projectId, 'general-v1');
    
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


