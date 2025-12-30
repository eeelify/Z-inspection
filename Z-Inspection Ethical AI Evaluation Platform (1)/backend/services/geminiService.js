const path = require('path');
// Load environment variables:
// - Prefer `.env` (common convention)
// - Fallback to `env` (some Windows setups omit dotfiles)
const dotenv = require('dotenv');
const envPathDot = path.resolve(__dirname, '../.env');
const envPathNoDot = path.resolve(__dirname, '../env');
const dotResult = dotenv.config({ path: envPathDot });
if (dotResult.error) {
  const noDotResult = dotenv.config({ path: envPathNoDot });
  if (noDotResult.error) {
    // Keep running; platform env vars (Railway/Render) may still be present.
    console.warn(`⚠️  dotenv could not load ${envPathDot} or ${envPathNoDot}:`, noDotResult.error.message);
  }
}

const { GoogleGenerativeAI } = require("@google/generative-ai");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const { riskLabel: getRiskLabel } = require('../utils/riskLabel');
/* ============================================================
   1. API KEY KONTROLÜ
============================================================ */



if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY environment variable bulunamadı!");
  console.error(`📁 Kontrol edilen dosyalar: ${envPathDot}, ${envPathNoDot}`);
  throw new Error("❌ GEMINI_API_KEY environment variable bulunamadı! Lütfen backend/.env dosyanızda GEMINI_API_KEY değişkenini tanımlayın.");
}

// Log API key loaded status (without showing the actual key)
console.log(`✅ GEMINI_API_KEY yüklendi (uzunluk: ${GEMINI_API_KEY.length} karakter)`);

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/* ============================================================
   2. GENERATION CONFIG
============================================================ */

const generationConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192
};

/* ============================================================
   3. API KEY TEST (SADE & GÜVENİLİR)
============================================================ */

async function testApiKey() {
  const modelsToTry = [
    { id: "gemini-2.5-flash", names: ["models/gemini-2.5-flash", "gemini-2.5-flash"] }
  ];

  let lastError = null;

  for (const candidate of modelsToTry) {
    for (const modelName of candidate.names) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        const text = result?.response?.text?.();

        return {
          valid: Boolean(text),
          availableModels: [candidate.id]
        };
      } catch (error) {
        lastError = error;

        const msg = String(error?.message || "");
        const isModelNotFound = msg.includes("404") || msg.toLowerCase().includes("not found");

        // If the error isn't about model availability, don't continue trying fallbacks
        if (!isModelNotFound) {
          return {
            valid: false,
            availableModels: [],
            error: msg
          };
        }

        // Otherwise, try next model format / next model id
      }
    }
  }

  return {
    valid: false,
    availableModels: [],
    error: lastError?.message || "Model not available"
  };
}


/* ============================================================
   4. RAPOR ÜRETİMİ (TEK VE STABİL MODEL)
============================================================ */

async function generateReport(analysisData) {
  const userPrompt = buildUserPrompt(analysisData);

  const systemInstruction = `
You are an expert AI Ethics Evaluator and Auditor specializing in the Z-Inspection methodology.
Your task is to analyze raw AI ethics assessment data and generate a comprehensive, professional,
and actionable evaluation report for stakeholders. This report will be converted to PDF format.

==============================
NON-NEGOTIABLE RULES
==============================

1. SCORES ARE CANONICAL - DO NOT COMPUTE THEM
   - All scores are pre-computed in MongoDB scores collection
   - You MUST use ONLY the numbers provided in the data
   - NEVER calculate, recalculate, infer, or modify any score
   - Scores are deterministic and traceable to MongoDB
   - RISK LABELS ARE PROVIDED - DO NOT INFER THRESHOLDS
   - Risk labels (Low, Moderate, High, Critical) are pre-computed and provided
   - You MUST use the provided riskLabel values - NEVER infer or calculate risk labels
   - Risk scores are 0–4 where 4 is highest risk and 0 is lowest risk
   - Scoring interpretation: 0 = lowest risk (no/negligible risk), 4 = highest risk (high risk requiring immediate mitigation)
   - Higher score = Higher risk (e.g., score 4 = high likelihood of harm / major ethical concern)
   - Lower score = Lower risk (e.g., score 0 = no meaningful ethical risk identified)

2. CHARTS ARE GENERATED PROGRAMMATICALLY
   - Charts are generated server-side and embedded as images
   - DO NOT create, describe, or invent charts in your output
   - DO NOT include chart descriptions or visualizations in text
   - Charts will be added automatically to the final document

3. USE ACTUAL EVALUATORS - NO PLACEHOLDERS
   - Use ONLY evaluators who actually submitted responses
   - If only 1 technical expert submitted, show 1 (never show 2)
   - Use actual evaluator names from the provided data
   - Never use generic labels like "Expert 1", "Expert 2", or assumed roles

4. TENSION EVIDENCE - BE EXPLICIT
   - If a tension has no evidence (evidence.count = 0), explicitly state "No evidence attached"
   - DO NOT fabricate or assume evidence exists
   - Only reference evidence that is explicitly provided in the data

5. ROLE-SPECIFIC QUESTIONS - DO NOT COMPARE ACROSS ROLES
   - First 12 questions are COMMON CORE across all roles
   - Remaining questions are ROLE-SPECIFIC
   - DO NOT compare role-specific answer sets across different roles
   - Only compare answers for the common core questions (first 12)

==============================
REPORT REQUIREMENTS
==============================

- Clear structure and headings (use # for main title, ## for sections, ### for subsections)
- Evidence-based analysis (using only provided data)
- Identification of risks and strengths
- Actionable recommendations
- Professional Markdown formatting suitable for PDF conversion
- Clear and professional English
- Use proper Markdown syntax: **bold**, *italic*, lists (- or 1.), tables, code blocks
- Structure the report with clear sections that will render well in PDF format
- Include page-break considerations in your structure
`;

  const modelNamesToTry = [
    "models/gemini-2.5-flash",
    "gemini-2.5-flash"
  ];

  let lastError = null;

  for (const modelName of modelNamesToTry) {
    try {
      console.log(`🤖 Gemini (${modelName}) rapor üretiyor...`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig
      });

      const report = result.response.text();

      if (!report) {
        throw new Error("❌ Gemini boş yanıt döndü.");
      }

      console.log(`✅ Rapor başarıyla oluşturuldu (${modelName}).`);
      return report;

    } catch (error) {
      console.error(`❌ Model ${modelName} başarısız:`, error.message);
      lastError = error;
      
      // If it's not a 404 (model not found), don't try other models
      if (!error.message.includes("404") && !error.message.includes("not found")) {
        break;
      }
    }
  }

  // If we get here, all models failed
  console.error("❌ Tüm Gemini modelleri başarısız oldu.");

  if (lastError) {
    const errorMsg = lastError.message || '';
    const errorMsgLower = errorMsg.toLowerCase();
    
    // Check for API key expired or invalid (400 Bad Request)
    if (errorMsg.includes("400") || errorMsgLower.includes("expired") || errorMsgLower.includes("api_key_invalid") || errorMsgLower.includes("api key expired")) {
      throw new Error("❌ Gemini API Key süresi dolmuş veya geçersiz. Lütfen .env dosyanızdaki GEMINI_API_KEY değerini kontrol edin ve yeni bir API key oluşturun.");
    }

    if (errorMsg.includes("403") || errorMsgLower.includes("permission_denied")) {
      throw new Error("❌ Gemini API Key geçersiz veya yetkisiz.");
    }

    if (errorMsg.includes("429") || errorMsgLower.includes("resource_exhausted") || errorMsgLower.includes("quota")) {
      throw new Error("❌ Gemini API quota aşıldı. Lütfen daha sonra tekrar deneyin.");
    }

    if (errorMsg.includes("404") || errorMsgLower.includes("not found")) {
      throw new Error("❌ Gemini modeli bulunamadı. Lütfen API key'inizi ve model erişiminizi kontrol edin.");
    }

    throw new Error(`❌ Rapor oluşturulamadı: ${lastError.message}`);
  }

  throw new Error("❌ Rapor oluşturulamadı: Bilinmeyen hata.");
}

/* ============================================================
   5. PROMPT BUILDER (Z-INSPECTION VERİ ODAKLI)
============================================================ */

function buildUserPrompt(data) {
  const project = data.project || {};
  const scores = data.scores || [];
  const generalAnswers = data.generalAnswers || [];
  const tensions = data.tensions || [];
  const evaluations = data.evaluations || [];
  const users = data.users || [];

  // Build user map for lookup
  const userMap = new Map();
  if (Array.isArray(users)) {
    users.forEach(u => {
      if (u._id) {
        userMap.set(u._id.toString(), u);
      }
    });
  }

  let prompt = `# AI ETHICS EVALUATION DATA\n\n`;
  prompt += `Analyze the following data using the Z-Inspection methodology.\n\n`;

  /* PROJECT CONTEXT */
  prompt += `## PROJECT CONTEXT\n`;
  prompt += `**Title:** ${project.title || "Untitled Project"}\n`;
  prompt += `**Description:** ${project.fullDescription || project.shortDescription || "N/A"}\n`;
  prompt += `**Status:** ${project.status || "N/A"}\n`;
  prompt += `**Progress:** ${project.progress || 0}%\n\n`;

  /* SCORES */
  prompt += `## ETHICAL PRINCIPLE SCORES\n`;
  if (scores.length === 0) {
    prompt += `No score data available.\n\n`;
  } else {
    scores.forEach((s, i) => {
      // Use actual evaluator name if available, otherwise use role
      const userId = s.userId ? s.userId.toString() : null;
      const user = userId ? userMap.get(userId) : null;
      const evaluatorLabel = user?.name 
        ? `${user.name}${s.role ? ` (${s.role})` : ""}`
        : (s.role ? `${s.role} Evaluator` : `Evaluator ${i + 1}`);
      
      prompt += `### ${evaluatorLabel}\n`;
      const totalAvg = s.totals?.avg;
      const totalRiskLabel = totalAvg !== undefined ? getRiskLabel(totalAvg) : "N/A";
      prompt += `Average Score: ${totalAvg?.toFixed(2) || "N/A"} / 4.0 (Risk Label: ${totalRiskLabel})\n`;
      prompt += `**IMPORTANT:** Risk scores are 0–4 where 4 is highest risk and 0 is lowest risk. Higher score = Higher risk.\n`;

      if (s.byPrinciple) {
        Object.entries(s.byPrinciple).forEach(([p, v]) => {
          if (v?.avg !== undefined) {
            const riskLabel = getRiskLabel(v.avg);
            prompt += `- ${p}: ${v.avg.toFixed(2)} / 4.0 (Risk Label: ${riskLabel})\n`;
          }
        });
      }
      prompt += `\n`;
    });
  }

  /* GENERAL ANSWERS */
  if (generalAnswers.length > 0) {
    prompt += `## GENERAL ASSESSMENT ANSWERS\n`;
    generalAnswers.forEach((a, i) => {
      prompt += `${i + 1}. **${a.question}**\n${a.answer}\n\n`;
    });
  }

  /* TENSIONS */
  prompt += `## ETHICAL TENSIONS\n`;
  if (tensions.length === 0) {
    prompt += `No ethical tensions identified.\n\n`;
  } else {
    tensions.forEach((t, i) => {
      prompt += `### Tension ${i + 1}: ${t.principle1} vs ${t.principle2}\n`;
      prompt += `- Description: ${t.claimStatement}\n`;
      prompt += `- Severity: ${t.severity}\n`;
      prompt += `- Status: ${t.status}\n`;
      
      // CRITICAL: Include evidence information
      const evidence = t.evidences || t.evidence || [];
      const evidenceCount = Array.isArray(evidence) ? evidence.length : 0;
      if (evidenceCount === 0) {
        prompt += `- Evidence: No evidence attached\n`;
      } else {
        prompt += `- Evidence: ${evidenceCount} item(s) attached\n`;
        if (Array.isArray(evidence)) {
          evidence.forEach((e, idx) => {
            const type = e.type || e.evidenceType || 'Unknown';
            prompt += `  ${idx + 1}. [${type}] ${e.title || e.description || 'Evidence item'}\n`;
          });
        }
      }
      prompt += `\n`;
    });
  }

  /* RISKS */
  prompt += `## RISKS & EVALUATIONS\n`;
  if (evaluations.length === 0) {
    prompt += `No detailed evaluation data available.\n\n`;
  } else {
    evaluations.forEach((e, i) => {
      prompt += `### Stage ${i + 1}: ${e.stage}\n`;
      if (e.generalRisks?.length) {
        e.generalRisks.forEach((r, j) => {
          prompt += `${j + 1}. ${r.title} (Severity: ${r.severity})\n${r.description}\n\n`;
        });
      } else {
        prompt += `No risks identified.\n\n`;
      }
    });
  }

  /* OUTPUT INSTRUCTIONS */
  prompt += `
---
# CRITICAL RULES FOR REPORT GENERATION

0) SCORES ARE CANONICAL - DO NOT COMPUTE THEM
   - All scores shown above are pre-computed in MongoDB scores collection
   - Use ONLY the numbers provided - NEVER calculate or modify them

1) CHARTS ARE GENERATED PROGRAMMATICALLY
   - Charts will be generated server-side and embedded as images
   - DO NOT create, describe, or invent charts in your output

2) USE ACTUAL EVALUATORS - NO PLACEHOLDERS
   - Use the actual evaluator count from the scores data above
   - If only 1 evaluator of a role submitted, show 1 (never show 2)
   - Never use generic labels like "Expert 1", "Expert 2"

3) TENSION EVIDENCE - BE EXPLICIT
   - If a tension shows "No evidence attached", explicitly state this in the report
   - DO NOT fabricate or assume evidence exists

4) ROLE-SPECIFIC QUESTIONS
   - First 12 questions are COMMON CORE across all roles
   - Remaining questions are ROLE-SPECIFIC
   - DO NOT compare role-specific answers across different roles

---
# REPORT STRUCTURE
Generate a comprehensive PDF-ready report with the following structure:

1. **Executive Summary**
   - Brief overview of the project
   - Key findings and overall risk assessment
   - Main recommendations

2. **Risk Assessment Matrix**
   - Visual representation of risks by principle
   - Severity levels and impact analysis

3. **Principle-by-Principle Analysis**
   - Detailed analysis for each ethical principle
   - Scores, evaluations, and evidence
   - Strengths and weaknesses identified

4. **Tension Analysis**
   - Identified ethical tensions
   - Conflict resolution strategies
   - Consensus building approaches

5. **Actionable Recommendations**
   - Prioritized recommendations
   - Implementation steps
   - Timeline and resource requirements

6. **Conclusion**
   - Summary of key points
   - Next steps
   - Contact information

**IMPORTANT FORMATTING REQUIREMENTS:**
- Use proper Markdown syntax for PDF conversion
- Use # for main title, ## for major sections, ### for subsections
- Use **bold** for emphasis, *italic* for important notes
- Use numbered lists (1., 2., 3.) for sequential items
- Use bullet points (- or *) for non-sequential items
- Use tables for structured data when appropriate
- Ensure all content is professional and suitable for PDF export
- Format dates, numbers, and technical terms clearly
`;

  return prompt;
}

/* ============================================================
   5. EXPERT COMMENTS ANALYZER
============================================================ */

async function analyzeExpertComments(expertComments) {
  // Validate input
  if (!expertComments || (typeof expertComments !== 'string' && !Array.isArray(expertComments))) {
    throw new Error('expertComments must be a string or array of strings');
  }

  // Convert array to single string if needed
  const commentsText = Array.isArray(expertComments) 
    ? expertComments.join('\n\n---\n\n') 
    : expertComments;

  if (!commentsText.trim()) {
    throw new Error('expertComments cannot be empty');
  }

  const systemInstruction = `You are an AI assistant used STRICTLY as a semantic analysis and decision-support tool
within an ethical AI evaluation platform based on the Z-Inspection methodology.

IMPORTANT LIMITATIONS:
- You MUST NOT make final decisions.
- You MUST NOT approve, reject, or classify an AI system as compliant or non-compliant.
- You MUST NOT override or reinterpret expert intent.
- You MUST NOT invent risks, facts, or assumptions not explicitly stated.
- Your output is advisory only and non-binding.
- Human administrators retain full authority, responsibility, and accountability.
- Your role is limited to semantic interpretation of expert-written text.`;

  const userPrompt = `TASK:
You will receive one or more expert comments evaluating an AI system.

Your objectives are:
1. Summarize the main concerns, agreements, or recurring themes.
2. Identify which ethical principles are implicated by the expert language.
3. Estimate the overall risk tone expressed by the experts.
4. Detect whether explicit warning signals are present.
5. Estimate confidence based on clarity, strength, and consistency of expert statements.

--------------------------------------------------

ETHICAL PRINCIPLES (USE ONLY THESE LABELS - MATCH EXACTLY):
Match the expert comments to these Z-Inspection principles:
- TRANSPARENCY
- TRANSPARENCY & EXPLAINABILITY
- HUMAN AGENCY & OVERSIGHT
- HUMAN OVERSIGHT & CONTROL
- TECHNICAL ROBUSTNESS & SAFETY
- PRIVACY & DATA GOVERNANCE
- PRIVACY & DATA PROTECTION
- DIVERSITY, NON-DISCRIMINATION & FAIRNESS
- SOCIETAL & INTERPERSONAL WELL-BEING
- ACCOUNTABILITY
- ACCOUNTABILITY & RESPONSIBILITY
- LAWFULNESS & COMPLIANCE
- RISK MANAGEMENT & HARM PREVENTION
- PURPOSE LIMITATION & DATA MINIMIZATION
- USER RIGHTS & AUTONOMY

If a comment relates to a principle not in this list, map it to the closest match.
Use the exact capitalization and spelling shown above.

--------------------------------------------------

RISK TONE (SELECT EXACTLY ONE):
- low: Comments express minimal concern, positive outlook, or satisfaction
- medium: Comments express moderate concern, cautious optimism, or balanced views
- high: Comments express significant concern, serious risks, or negative outlook

--------------------------------------------------

WARNING SIGNAL RULE:
Set "warning_signal" to true ONLY if experts explicitly mention serious concerns such as:
- high risk, critical risk, severe risk
- potential harm, actual harm, risk of harm
- unsafe, dangerous, hazardous
- non-compliance, violation, breach
- unacceptable impact, severe impact, critical impact
- severe limitations, critical limitations
- urgent action needed, immediate concern

If concerns are cautious, conditional, exploratory, or speculative without strong language, set it to false.
When in doubt, prefer false (only flag explicit warnings).

--------------------------------------------------

CONFIDENCE LEVEL:
- low: Conflicting expert opinions, vague statements, or insufficient information
- medium: Generally consistent views with some uncertainty or limited detail
- high: Clear, consistent, well-supported expert statements with strong evidence

--------------------------------------------------

INPUT:
${commentsText}

--------------------------------------------------

OUTPUT REQUIREMENTS:
- Output MUST be valid JSON only (no markdown, no explanations, no extra text)
- Do NOT include assumptions beyond the input
- Ensure all string values are properly escaped
- Array of ethical_principles may contain 0 or more items
- risk_tone MUST be exactly one of: "low", "medium", "high"
- warning_signal MUST be exactly one of: true, false
- confidence MUST be exactly one of: "low", "medium", "high"

OUTPUT FORMAT (EXACT):

{
  "summary": "Brief summary of expert comments (2-4 sentences)",
  "ethical_principles": ["PRINCIPLE1", "PRINCIPLE2"],
  "risk_tone": "low | medium | high",
  "warning_signal": true | false,
  "confidence": "low | medium | high"
}

--------------------------------------------------

IMPORTANT:
- Return ONLY the JSON object, nothing else
- Do not include markdown code blocks (\`\`\`json)
- Do not include explanatory text before or after the JSON
- Ensure JSON is valid and parseable`;

  const modelNamesToTry = [
    "models/gemini-2.5-flash",
    "gemini-2.5-flash"
  ];

  // Lower temperature for more consistent JSON output
  const analysisConfig = {
    temperature: 0.3,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048
  };

  let lastError = null;

  for (const modelName of modelNamesToTry) {
    try {
      console.log(`🤖 Gemini (${modelName}) expert comments analiz ediyor...`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: analysisConfig
      });

      let rawResponse = result.response.text();

      if (!rawResponse) {
        throw new Error("❌ Gemini boş yanıt döndü.");
      }

      // Clean up response - remove markdown code blocks if present
      rawResponse = rawResponse.trim();
      if (rawResponse.startsWith('```json')) {
        rawResponse = rawResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (rawResponse.startsWith('```')) {
        rawResponse = rawResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      rawResponse = rawResponse.trim();

      // Try to find JSON object if there's extra text
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawResponse = jsonMatch[0];
      }

      // Parse JSON
      let analysis;
      try {
        analysis = JSON.parse(rawResponse);
      } catch (parseError) {
        console.error('❌ JSON parse hatası:', parseError.message);
        console.error('Raw response:', rawResponse.substring(0, 500));
        throw new Error(`JSON parse hatası: ${parseError.message}`);
      }

      // Validate required fields
      if (!analysis.summary || typeof analysis.summary !== 'string') {
        throw new Error('Invalid response: summary field missing or invalid');
      }
      if (!Array.isArray(analysis.ethical_principles)) {
        throw new Error('Invalid response: ethical_principles must be an array');
      }
      if (!['low', 'medium', 'high'].includes(analysis.risk_tone)) {
        throw new Error('Invalid response: risk_tone must be one of: low, medium, high');
      }
      if (typeof analysis.warning_signal !== 'boolean') {
        throw new Error('Invalid response: warning_signal must be a boolean');
      }
      if (!['low', 'medium', 'high'].includes(analysis.confidence)) {
        throw new Error('Invalid response: confidence must be one of: low, medium, high');
      }

      console.log(`✅ Expert comments analizi başarıyla tamamlandı (${modelName}).`);
      return analysis;

    } catch (error) {
      console.error(`❌ Model ${modelName} başarısız:`, error.message);
      lastError = error;
      
      // If it's not a 404 (model not found), don't try other models
      if (!error.message.includes("404") && !error.message.includes("not found") && !error.message.includes("JSON")) {
        break;
      }
    }
  }

  // If we get here, all models failed
  if (lastError) {
    const errorMsg = lastError.message || '';
    const errorMsgLower = errorMsg.toLowerCase();
    
    if (errorMsg.includes("400") || errorMsgLower.includes("expired") || errorMsgLower.includes("api_key_invalid")) {
      throw new Error("❌ Gemini API Key süresi dolmuş veya geçersiz.");
    }
    if (errorMsg.includes("403") || errorMsgLower.includes("permission_denied")) {
      throw new Error("❌ Gemini API Key geçersiz veya yetkisiz.");
    }
    if (errorMsg.includes("429") || errorMsgLower.includes("resource_exhausted") || errorMsgLower.includes("quota")) {
      throw new Error("❌ Gemini API quota aşıldı. Lütfen daha sonra tekrar deneyin.");
    }
    
    throw new Error(`❌ Expert comments analiz edilemedi: ${lastError.message}`);
  }

  throw new Error("❌ Expert comments analiz edilemedi: Bilinmeyen hata.");
}

/* ============================================================
   6. DASHBOARD NARRATIVE GENERATOR
============================================================ */

async function generateDashboardNarrative(inputData) {
  // Validate input
  if (!inputData || typeof inputData !== 'object') {
    throw new Error('inputData must be an object');
  }

  const {
    dashboardMetrics,
    topRiskyQuestions,
    responseExcerpts,
    tensionSummaries
  } = inputData;

  // Build the input JSON string for the prompt
  // CRITICAL: Only pass dashboardMetrics (deterministic JSON) + selected excerpts + tension summaries
  const inputJson = JSON.stringify({
    dashboardMetrics: dashboardMetrics || {},
    selectedAnswerExcerpts: responseExcerpts || [], // Selected excerpts only
    selectedTensionSummaries: tensionSummaries || [] // Selected tension summaries (short)
  }, null, 2);

  const systemInstruction = `You are an AI assistant used STRICTLY as a narrative synthesis and explanation tool
within an Ethical AI Evaluation Platform based on the Z-Inspection methodology.

==============================
NON-NEGOTIABLE RULES
==============================

0) SCORES ARE CANONICAL - DO NOT COMPUTE THEM
   - Scores are pre-computed in MongoDB scores collection
   - You MUST use ONLY the numbers provided in dashboardMetrics
   - NEVER calculate, recalculate, infer, normalize, or modify any score
   - Scores are deterministic and traceable to MongoDB
   - If a number is not in dashboardMetrics, DO NOT use it
   - RISK LABELS ARE PROVIDED - DO NOT INFER THRESHOLDS
   - Risk labels (Low, Moderate, High, Critical) are pre-computed in dashboardMetrics
   - You MUST use the provided riskLabel values from dashboardMetrics - NEVER infer or calculate risk labels
   - Risk scores are 0–4 where 4 is highest risk and 0 is lowest risk
   - Scoring interpretation: 0 = lowest risk (no/negligible risk), 4 = highest risk (high risk requiring immediate mitigation)
   - Higher score = Higher risk

1) CHARTS ARE GENERATED PROGRAMMATICALLY
   - Charts are generated server-side and embedded as images
   - DO NOT create, describe, or invent charts in your output
   - DO NOT include chart descriptions or visualizations in text

2) USE ACTUAL EVALUATORS - NO PLACEHOLDERS
   - Use ONLY evaluators who actually submitted responses
   - If only 1 technical expert submitted, show 1 (never show 2)
   - Use actual evaluator names/roles from the provided data
   - Never use generic labels like "Expert 1", "Expert 2", or assumed roles

3) TENSION EVIDENCE - BE EXPLICIT
   - If a tension has no evidence (evidenceCount = 0 or evidenceCoverage.tensionsWithoutEvidence > 0), 
     explicitly state "No evidence attached"
   - DO NOT fabricate or assume evidence exists
   - Only reference evidence that is explicitly provided in selectedTensionSummaries
   - If evidence is missing, say "No evidence attached" - do not invent or infer

4) ROLE-SPECIFIC QUESTIONS - DO NOT COMPARE ACROSS ROLES
   - First 12 questions are COMMON CORE across all roles
   - Remaining questions are ROLE-SPECIFIC
   - DO NOT compare role-specific answer sets across different roles
   - Only compare answers for the common core questions (first 12)

5) NO TABLES WITH NUMERIC VALUES
   - DO NOT produce tables with numeric values in your output
   - Tables are rendered server-side from dashboardMetrics JSON
   - Your output should be PURE NARRATIVE TEXT ONLY
   - If you need to reference numbers, do so in narrative form (e.g., "The overall average score is 2.3")
   - DO NOT create markdown tables, HTML tables, or any structured data tables

==============================
ABSOLUTE CONSTRAINTS
==============================

- You MUST NOT compute, recalculate, infer, normalize, or modify any numerical score.
- You MUST NOT invent risks, evidence, expert opinions, or mitigations.
- You MUST NOT override or reinterpret expert intent.
- You MUST NOT treat your output as binding, final, or authoritative.
- You MUST NOT generalize beyond the provided data.
- You MUST NOT compare role-specific answers unless explicitly instructed that "core mode" is active.

All numerical values are precomputed server-side and provided to you.
All ethical judgments remain human-controlled.
Your role is explanatory, interpretative, and supportive only.

==============================
AUTHORITATIVE DATA SOURCES (MongoDB Collections)
==============================

You MUST assume the following MongoDB collections as the ONLY sources of truth:

(1) responses collection (answers)
   - Source of ALL question answers (text)
   - Fields: projectId, userId, role, questionnaireKey, questionnaireVersion
   - answers: Array (contains questionId, answerText/selectedOption/etc.)
   - status, submittedAt, createdAt, updatedAt
   - NOTE: First 12 questions are common across all expert roles; remaining are role-specific
   - Use ONLY short excerpts if provided in responseExcerpts
   - DO NOT extrapolate beyond given excerpts

(2) scores collection (risk scoring) — CANONICAL METRICS
   - Source of computed scoring per expert submission
   - Fields: projectId, userId, role, questionnaireKey
   - byPrinciple: Object (per ethical principle scores/aggregates)
   - totals: Object (overall aggregates)
   - computedAt, createdAt, updatedAt
   - The dashboard/report MUST treat these as source-of-truth numeric metrics
   - You MUST NOT recompute or reinterpret scores

(3) tensions collection (claims + mitigations + trade-offs + impact + evidence)
   - Fields used:
     * createdBy, createdAt
     * principle1, principle2 (conflict)
     * claim, argument
     * evidence (text), evidenceType (Policy/Test/User feedback/Logs/Incident/Other) [optional]
     * attachments (files) if present
     * severityLevel
     * impactArea[], affectedGroups[]
     * mitigation/resolution fields: proposedMitigations, tradeOffDecision, tradeOffRationale
     * votes/consensus (agree/disagree counts) and computed reviewState (Proposed/Under Review/Accepted/Disputed)
   - Dashboard/report computes:
     * counts by reviewState (underReview, disputed, accepted, etc.)
     * evidence coverage: evidence count + evidenceType distribution
     * mitigation maturity signals (accepted ratio, evidence count)
   - If no evidence exists, you MUST explicitly state: "No evidence attached"
   - You may summarize tension texts, but MUST NOT invent evidence or numbers

(4) Discussions/comments (optional)
   - If stored separately (e.g., shareddiscussions): use it to count discussion activity per tension
   - If embedded under tensions, use tensions.comments and/or tensions.evidence[].comments
   - Used ONLY to indicate discussion activity or review intensity
   - Do NOT infer risk or severity from discussion volume alone

==============================
INPUT YOU WILL RECEIVE
==============================

You will be given a structured JSON object that may include:

- dashboardMetrics:
  - overallScores: { avg, min, max, count } (from scores.totals)
  - byPrinciple: { principleName: { avg, min, max, count } }
  - roleBreakdowns: { roleName: { avg, count } }
  - evaluator variance indicators (if provided)

- topRiskyQuestions:
  - questionId, questionCode
  - principle
  - avgRisk (already computed, 0-4 scale)
  - count (number of evaluators who answered)

- responseExcerpts (optional):
  - questionCode
  - excerpt: short expert answer text snippets (200 chars max)
  - Use these to understand expert reasoning and concerns behind low scores

- roleSignals (optional):
  - which expert roles (medical, technical, legal, ethical, education) consistently scored low or high
  - role-specific patterns and concerns

- tensionSummaries:
  - claim / claimStatement
  - principle1, principle2 (conflicting principles)
  - severity / severityLevel
  - reviewState: "Proposed" | "Under Review" | "Accepted" | "Disputed"
- IMPORTANT: Do NOT write sentences like "This tension is in 'Proposed' review state" - the reviewState is already displayed in the table/template. Only reference it if needed for context, but do not create separate sentences about review state.
  - evidenceCount, evidenceTypes: []
  - votes: { agree: count, disagree: count } (if provided)

==============================
CRITICAL GROUNDING RULE
==============================

EVERY major conclusion or claim you make MUST be grounded in at least ONE of:
- a low-scoring ethical principle (score < 2.0 indicates risk)
- a high-risk question (avgRisk >= 3.0)
- a documented ethical tension
- a consistent signal from a specific expert role (roleSignals)
- a specific expert answer excerpt (from responseExcerpts)

If grounding is NOT possible, explicitly state:
"There is insufficient evidence in the current data to support this conclusion."

Do NOT make unsupported assertions. Every insight must trace back to the provided data.

==============================
YOUR TASK - NARRATIVE OUTPUT ONLY
==============================

You MUST output ONLY narrative text sections. DO NOT produce tables, JSON, or structured data.

Using ONLY the provided dashboardMetrics JSON + selected answer excerpts + selected tension summaries:

Generate the following narrative sections:

1) EXECUTIVE SUMMARY
   - Explain WHY the overall ethical risk level is what it is (use dashboardMetrics.scores.totals.overallAvg and riskLevel)
   - Ground in principle scores from dashboardMetrics.scores.byPrinciple
   - Reference top risky questions from dashboardMetrics.topRiskyQuestions if available
   - Keep to 3-5 sentences

2) KEY RISKS INTERPRETATION (text narrative)
   - Identify WHICH principles are driving the risk and WHY
   - Use specific scores from dashboardMetrics.scores.byPrinciple (do not compute)
   - Reference selected answer excerpts to understand expert reasoning
   - Explain what concerns experts express in their answers
   - Identify patterns in how different roles express concerns (from dashboardMetrics.scores.rolePrincipleMatrix)
   - Explain evaluator disagreement when present (by role or principle)
   - For each high-risk principle, explain the practical implications

3) RECOMMENDATIONS (actionable; prioritized; owner + timeline suggestions)
   - Produce PRIORITIZED, ACTIONABLE recommendations grounded in the data
   - Which principles need immediate attention? (prioritize by dashboardMetrics.scores.byPrinciple scores)
   - What concrete steps can address the identified risks?
   - Suggest owners (roles) who should take action
   - Suggest specific person names if available, otherwise use "Assign owner"
   - Suggest timelines (immediate, short-term, medium-term)
   - IMPORTANT: Scoring interpretation is 0 = worst (highest risk), 4 = best (lowest risk)
     - For score improvements, use "Increase average scores to above 3.0" (Low risk level) or "Increase average scores to above 2.0" (Moderate risk level)
     - DO NOT use "Resolved state" - valid review states are: "Proposed", "Under review", "Accepted", "Disputed"
     - Use specific metrics like "Reduce tensions in 'Under review' state to 0", "Achieve 'Accepted' state for all critical tensions"
   - Include dataBasis field: what data this recommendation is based on (e.g., "principle avg + top risky questions + unresolved tensions + evidence gap")
   - Ground each recommendation in specific data from dashboardMetrics

4) DATA GAPS / LIMITATIONS
   - Reference dashboardMetrics.dataQuality for missing scores, missing answers, incomplete responses
   - Identify what additional information is needed
   - Note limitations in evidence coverage (from dashboardMetrics.tensionsSummary.evidenceCoverage)
   - Note unresolved tensions that need attention (from dashboardMetrics.tensionsSummary.topUnresolvedTensions)
   - Be explicit about what data is missing or incomplete

==============================
OUTPUT FORMAT - NARRATIVE TEXT ONLY
==============================

You MUST output PURE NARRATIVE TEXT in Markdown format. DO NOT output JSON, tables, or structured data.

Structure your output as follows:

## Executive Summary

[2-4 paragraphs of narrative text explaining the overall ethical risk level, grounded in dashboardMetrics.scores.totals.overallAvg and riskLevel. Reference specific principle scores from dashboardMetrics.scores.byPrinciple. Use numbers exactly as provided - do not compute or modify them.]

## Key Risks Interpretation

[Multiple paragraphs of narrative text analyzing:
- Which principles are driving risk (use dashboardMetrics.scores.byPrinciple scores exactly as provided)
- Why these principles are at risk (reference selectedAnswerExcerpts if available)
- Expert concerns expressed in answers (from selectedAnswerExcerpts)
- Patterns in role-based concerns (from dashboardMetrics.scores.rolePrincipleMatrix)
- Evaluator disagreement when present
- Practical implications of each high-risk principle]

[For each high-risk principle, write 1-2 paragraphs explaining the risk in narrative form. Use scores from dashboardMetrics exactly as provided.]

## Recommendations

[Prioritized, actionable recommendations in narrative form. For each recommendation:

1. State the priority (e.g., "Highest Priority", "High Priority", "Medium Priority")
2. Identify the principle or area of concern (use dashboardMetrics data)
3. Provide concrete, actionable steps
4. Suggest owner(s) - which role(s) should take action
5. Suggest timeline (immediate, short-term within 1-3 months, medium-term 3-6 months)

Ground each recommendation in specific data from dashboardMetrics. Use narrative paragraphs, not bullet points or tables.]

## Data Gaps / Limitations

[Narrative text describing:
- Missing scores (from dashboardMetrics.dataQuality.missingScores)
- Missing answers (from dashboardMetrics.dataQuality.missingAnswers)
- Incomplete responses (from dashboardMetrics.dataQuality.incompleteResponses)
- Evidence coverage gaps (from dashboardMetrics.tensionsSummary.evidenceCoverage)
- Unresolved tensions needing attention (from dashboardMetrics.tensionsSummary.topUnresolvedTensions)
- Any other data limitations

Be explicit about what information is missing or incomplete.]

==============================
OUTPUT RULES - STRICT ENFORCEMENT
==============================

- Use ONLY the numbers provided in dashboardMetrics - NEVER compute, recalculate, or modify them
- Ground every insight in at least one data point from dashboardMetrics, selectedAnswerExcerpts, or selectedTensionSummaries
- DO NOT generate tables, JSON, or structured data - ONLY narrative text
- DO NOT restate raw JSON or data structures
- DO NOT exaggerate or speculate beyond the provided data
- If information is missing, explicitly state "No evidence attached" or "Data not available"
- Response excerpts must be used verbatim or with clear attribution - do not invent expert quotes
- If a tension has no evidence (evidenceCount = 0), explicitly state "No evidence attached"
- All numeric values MUST come from dashboardMetrics - reference them in narrative form (e.g., "The Transparency principle scored 1.8 out of 4.0")
- DO NOT create markdown tables, HTML tables, or any tabular format
- Your output should be readable narrative prose suitable for a professional report

==============================
FINAL REMINDER
==============================

You are NOT an evaluator.
You are NOT a scoring engine.
You are NOT a decision-maker.

You are a narrative assistant that explains deterministic ethical evaluation results,
analyzes expert responses and question patterns,
and highlights where human deliberation is required.

Your output is advisory, explanatory, and non-binding.`;

  const userPrompt = `INPUT DATA:
${inputJson}

--------------------------------------------------

CRITICAL OUTPUT REQUIREMENTS:
- Output MUST be PURE NARRATIVE TEXT in Markdown format (## headings, paragraphs)
- DO NOT output JSON, tables, or structured data
- Use ONLY numbers from dashboardMetrics - do not compute or modify them
- If evidence is missing, explicitly state "No evidence attached"
- Ground EVERY insight in at least one data point from the input
- Structure output as: Executive Summary, Key Risks Interpretation, Recommendations, Data Gaps / Limitations
- Write in professional, readable prose suitable for a stakeholder report
- Reference specific scores and metrics from dashboardMetrics in narrative form

FIELD VALIDATION:
- overallRiskLevel MUST be exactly one of: "LOW", "MEDIUM", "HIGH"
- riskLevelNarrative MUST be exactly one of: "Safe", "Needs improvement", "High risk"
- confidenceLevel MUST be exactly one of: "LOW", "MEDIUM", "HIGH"
- reviewState MUST be exactly one of: "Proposed", "Under Review", "Accepted", "Disputed"
- evidenceStatus MUST be exactly one of: "Evidence attached", "No evidence attached"
- consensusLevel MUST be exactly one of: "High consensus", "Mixed", "Disputed" (or omit if votes not provided)

REQUIRED FIELDS:
- executiveInterpretation (object with overallRiskLevel, whyThisRiskLevel, overallSummary)
- principleDeepDive (array)
- questionAnalysis (object with highRiskQuestions array and patterns array)
- tensionAnalysis (array)
- tensionOverview (object with counts and keyTensions array)
- priorityActions (array)
- confidenceAndLimitations (object with confidenceLevel, limitations array, dataCompleteness object)

IMPORTANT:
- Return ONLY the JSON object, nothing else
- Do not include markdown code blocks (\`\`\`json)
- Do not include explanatory text before or after the JSON
- Ensure JSON is valid and parseable
- Every claim in whyThisRiskLevel, whyLowOrModerate, whyItExists must reference specific scores, questions, or excerpts`;

  const modelNamesToTry = [
    "models/gemini-2.5-flash",
    "gemini-2.5-flash"
  ];

  // Lower temperature for more consistent JSON output, but slightly higher for better narrative quality
  const narrativeConfig = {
    temperature: 0.4,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192 // Increased for more detailed analysis
  };

  let lastError = null;

  for (const modelName of modelNamesToTry) {
    try {
      console.log(`🤖 Gemini (${modelName}) dashboard narrative oluşturuyor...`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: narrativeConfig
      });

      let rawResponse = result.response.text();

      if (!rawResponse) {
        throw new Error("❌ Gemini boş yanıt döndü.");
      }

      // Clean up response - remove markdown code blocks if present
      rawResponse = rawResponse.trim();
      if (rawResponse.startsWith('```json')) {
        rawResponse = rawResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (rawResponse.startsWith('```')) {
        rawResponse = rawResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      rawResponse = rawResponse.trim();

      // Try to find JSON object if there's extra text
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawResponse = jsonMatch[0];
      }

      // Parse JSON
      let narrative;
      try {
        narrative = JSON.parse(rawResponse);
      } catch (parseError) {
        console.error('❌ JSON parse hatası:', parseError.message);
        console.error('Raw response:', rawResponse.substring(0, 500));
        throw new Error(`JSON parse hatası: ${parseError.message}`);
      }

      // Validate executiveInterpretation
      if (!narrative.executiveInterpretation || typeof narrative.executiveInterpretation !== 'object') {
        throw new Error('Invalid response: executiveInterpretation field missing or invalid');
      }
      if (!['LOW', 'MEDIUM', 'HIGH'].includes(narrative.executiveInterpretation.overallRiskLevel)) {
        throw new Error('Invalid response: executiveInterpretation.overallRiskLevel must be one of: LOW, MEDIUM, HIGH');
      }
      if (!Array.isArray(narrative.executiveInterpretation.whyThisRiskLevel)) {
        throw new Error('Invalid response: executiveInterpretation.whyThisRiskLevel must be an array');
      }
      if (!narrative.executiveInterpretation.overallSummary || typeof narrative.executiveInterpretation.overallSummary !== 'string') {
        throw new Error('Invalid response: executiveInterpretation.overallSummary must be a string');
      }

      // Validate principleDeepDive
      if (!Array.isArray(narrative.principleDeepDive)) {
        throw new Error('Invalid response: principleDeepDive must be an array');
      }
      for (const insight of narrative.principleDeepDive) {
        if (!insight.principle || typeof insight.principle !== 'string') {
          throw new Error('Invalid response: principleDeepDive[].principle must be a string');
        }
        if (typeof insight.score !== 'number') {
          throw new Error('Invalid response: principleDeepDive[].score must be a number');
        }
        if (!Array.isArray(insight.whyLowOrModerate)) {
          throw new Error('Invalid response: principleDeepDive[].whyLowOrModerate must be an array');
        }
        if (!['Safe', 'Needs improvement', 'High risk'].includes(insight.riskLevelNarrative)) {
          throw new Error('Invalid response: principleDeepDive[].riskLevelNarrative must be one of: Safe, Needs improvement, High risk');
        }
        if (!insight.practicalRisk || typeof insight.practicalRisk !== 'string') {
          throw new Error('Invalid response: principleDeepDive[].practicalRisk must be a string');
        }
      }

      // Validate questionAnalysis
      if (!narrative.questionAnalysis || typeof narrative.questionAnalysis !== 'object') {
        throw new Error('Invalid response: questionAnalysis field missing or invalid');
      }
      if (!Array.isArray(narrative.questionAnalysis.highRiskQuestions)) {
        throw new Error('Invalid response: questionAnalysis.highRiskQuestions must be an array');
      }
      if (!Array.isArray(narrative.questionAnalysis.patterns)) {
        throw new Error('Invalid response: questionAnalysis.patterns must be an array');
      }

      // Validate tensionAnalysis
      if (!Array.isArray(narrative.tensionAnalysis)) {
        throw new Error('Invalid response: tensionAnalysis must be an array');
      }
      for (const tension of narrative.tensionAnalysis) {
        if (!tension.tension || typeof tension.tension !== 'string') {
          throw new Error('Invalid response: tensionAnalysis[].tension must be a string');
        }
        if (!tension.whyItExists || typeof tension.whyItExists !== 'string') {
          throw new Error('Invalid response: tensionAnalysis[].whyItExists must be a string');
        }
        if (!tension.riskIfUnresolved || typeof tension.riskIfUnresolved !== 'string') {
          throw new Error('Invalid response: tensionAnalysis[].riskIfUnresolved must be a string');
        }
        if (!['Evidence attached', 'No evidence attached'].includes(tension.evidenceStatus)) {
          throw new Error('Invalid response: tensionAnalysis[].evidenceStatus must be one of: Evidence attached, No evidence attached');
        }
        if (!['Proposed', 'Under Review', 'Accepted', 'Disputed'].includes(tension.reviewState)) {
          throw new Error('Invalid response: tensionAnalysis[].reviewState must be one of: Proposed, Under Review, Accepted, Disputed');
        }
      }

      // Validate tensionOverview
      if (!narrative.tensionOverview || typeof narrative.tensionOverview !== 'object') {
        throw new Error('Invalid response: tensionOverview field missing or invalid');
      }
      if (typeof narrative.tensionOverview.underReviewCount !== 'number') {
        throw new Error('Invalid response: tensionOverview.underReviewCount must be a number');
      }
      if (typeof narrative.tensionOverview.disputedCount !== 'number') {
        throw new Error('Invalid response: tensionOverview.disputedCount must be a number');
      }
      if (typeof narrative.tensionOverview.acceptedCount !== 'number') {
        throw new Error('Invalid response: tensionOverview.acceptedCount must be a number');
      }
      if (!Array.isArray(narrative.tensionOverview.keyTensions)) {
        throw new Error('Invalid response: tensionOverview.keyTensions must be an array');
      }

      // Validate keyTensions structure
      for (const tension of narrative.tensionOverview.keyTensions) {
        if (!Array.isArray(tension.principles)) {
          throw new Error('Invalid response: keyTensions[].principles must be an array');
        }
        if (!tension.claimSummary || typeof tension.claimSummary !== 'string') {
          throw new Error('Invalid response: keyTensions[].claimSummary must be a string');
        }
        if (!['Proposed', 'Under Review', 'Accepted', 'Disputed'].includes(tension.reviewState)) {
          throw new Error('Invalid response: keyTensions[].reviewState must be one of: Proposed, Under Review, Accepted, Disputed');
        }
        if (!['Evidence attached', 'No evidence attached'].includes(tension.evidenceStatus)) {
          throw new Error('Invalid response: keyTensions[].evidenceStatus must be one of: Evidence attached, No evidence attached');
        }
      }

      // Validate priorityActions
      if (!Array.isArray(narrative.priorityActions)) {
        throw new Error('Invalid response: priorityActions must be an array');
      }
      for (const action of narrative.priorityActions) {
        if (typeof action.priority !== 'number') {
          throw new Error('Invalid response: priorityActions[].priority must be a number');
        }
        if (!action.focusPrinciple || typeof action.focusPrinciple !== 'string') {
          throw new Error('Invalid response: priorityActions[].focusPrinciple must be a string');
        }
        if (!action.justification || typeof action.justification !== 'string') {
          throw new Error('Invalid response: priorityActions[].justification must be a string');
        }
        if (!action.suggestedNextStep || typeof action.suggestedNextStep !== 'string') {
          throw new Error('Invalid response: priorityActions[].suggestedNextStep must be a string');
        }
      }

      // Validate confidenceAndLimitations
      if (!narrative.confidenceAndLimitations || typeof narrative.confidenceAndLimitations !== 'object') {
        throw new Error('Invalid response: confidenceAndLimitations field missing or invalid');
      }
      if (!['LOW', 'MEDIUM', 'HIGH'].includes(narrative.confidenceAndLimitations.confidenceLevel)) {
        throw new Error('Invalid response: confidenceAndLimitations.confidenceLevel must be one of: LOW, MEDIUM, HIGH');
      }
      if (!Array.isArray(narrative.confidenceAndLimitations.limitations)) {
        throw new Error('Invalid response: confidenceAndLimitations.limitations must be an array');
      }

      console.log(`✅ Dashboard narrative başarıyla oluşturuldu (${modelName}).`);
      return narrative;

    } catch (error) {
      console.error(`❌ Model ${modelName} başarısız:`, error.message);
      lastError = error;
      
      // If it's not a 404 (model not found), don't try other models
      if (!error.message.includes("404") && !error.message.includes("not found") && !error.message.includes("JSON")) {
        break;
      }
    }
  }

  // If we get here, all models failed
  if (lastError) {
    const errorMsg = lastError.message || '';
    const errorMsgLower = errorMsg.toLowerCase();
    
    if (errorMsg.includes("400") || errorMsgLower.includes("expired") || errorMsgLower.includes("api_key_invalid")) {
      throw new Error("❌ Gemini API Key süresi dolmuş veya geçersiz.");
    }
    if (errorMsg.includes("403") || errorMsgLower.includes("permission_denied")) {
      throw new Error("❌ Gemini API Key geçersiz veya yetkisiz.");
    }
    if (errorMsg.includes("429") || errorMsgLower.includes("resource_exhausted") || errorMsgLower.includes("quota")) {
      throw new Error("❌ Gemini API quota aşıldı. Lütfen daha sonra tekrar deneyin.");
    }
    
    throw new Error(`❌ Dashboard narrative oluşturulamadı: ${lastError.message}`);
  }

  throw new Error("❌ Dashboard narrative oluşturulamadı: Bilinmeyen hata.");
}

/* ============================================================
   EXPORTS
============================================================ */

/* ============================================================
   7. REPORT NARRATIVE GENERATOR (STRICT, GROUNDED)
============================================================ */

async function generateReportNarrative(reportMetrics) {
  // Validate input
  if (!reportMetrics || typeof reportMetrics !== 'object') {
    throw new Error('reportMetrics must be an object');
  }

  const inputJson = JSON.stringify(reportMetrics, null, 2);

  const systemInstruction = `You are an AI assistant used STRICTLY as a narrative synthesis tool
within an Ethical AI Evaluation Platform based on the Z-Inspection methodology.

==============================
NON-NEGOTIABLE RULES
==============================

0) SCORES ARE CANONICAL - DO NOT COMPUTE THEM
   - Scores are pre-computed in MongoDB scores collection
   - You MUST use ONLY the numbers provided in reportMetrics
   - NEVER calculate, recalculate, infer, normalize, or modify any score
   - Scores are deterministic and traceable to MongoDB
   - RISK LABELS ARE PROVIDED - DO NOT INFER THRESHOLDS
   - Risk labels (Low, Moderate, High, Critical) are pre-computed in reportMetrics
   - You MUST use the provided riskLabel values from reportMetrics - NEVER infer or calculate risk labels
   - Risk scores are 0–4 where 4 is highest risk and 0 is lowest risk
   - Scoring interpretation: 0 = lowest risk (no/negligible risk), 4 = highest risk (high risk requiring immediate mitigation)
   - Higher score = Higher risk

1) CHARTS ARE GENERATED PROGRAMMATICALLY
   - Charts are generated server-side and embedded as images
   - DO NOT create, describe, or invent charts in your output
   - DO NOT include chart descriptions or visualizations in text
   - Charts will be added automatically to the final document

2) USE ACTUAL EVALUATORS - NO PLACEHOLDERS
   - Use ONLY evaluators listed in reportMetrics.evaluators.withScores
   - If only 1 technical expert submitted, show 1 (never show 2)
   - Use actual evaluator names from the provided data
   - Never use generic labels like "Expert 1", "Expert 2", or assumed roles

3) TENSION EVIDENCE - BE EXPLICIT
   - If a tension has no evidence (evidence.count = 0), explicitly state "No evidence attached"
   - DO NOT fabricate or assume evidence exists
   - Only reference evidence that is explicitly provided in tensions.list[].evidence.items[]

4) ROLE-SPECIFIC QUESTIONS - DO NOT COMPARE ACROSS ROLES
   - First 12 questions are COMMON CORE across all roles
   - Remaining questions are ROLE-SPECIFIC
   - DO NOT compare role-specific answer sets across different roles
   - Only compare answers for the common core questions (first 12)

==============================
ABSOLUTE CONSTRAINTS
==============================

- You MUST NOT compute, recalculate, infer, normalize, or modify any numerical score.
- You MUST NOT invent risks, evidence, expert opinions, mitigations, or use-case details.
- You MUST NOT override or reinterpret expert intent.
- You MUST NOT treat your output as binding, final, or authoritative.
- You MUST NOT generalize beyond the provided data.
- You MUST NOT invent system/use-case details that are not present in the reportMetrics JSON.
- If a field is missing, explicitly state "Not provided" or "No evidence attached".
- All numeric metrics MUST come from reportMetrics JSON - never compute them.

==============================
AUTHORITATIVE DATA SOURCES (MongoDB Collections)
==============================

The reportMetrics JSON you receive is derived from these MongoDB collections:

(1) responses collection (answers)
   - Source of ALL question answers (text)
   - Fields: projectId, userId, role, questionnaireKey, questionnaireVersion
   - answers: Array (contains questionId, answerText/selectedOption/etc.)
   - status, submittedAt, createdAt, updatedAt
   - NOTE: First 12 questions are common across all expert roles; remaining are role-specific

(2) scores collection (risk scoring) — CANONICAL METRICS
   - Source of computed scoring per expert submission
   - Fields: projectId, userId, role, questionnaireKey
   - byPrinciple: Object (per ethical principle scores/aggregates)
   - totals: Object (overall aggregates)
   - computedAt, createdAt, updatedAt
   - The dashboard/report MUST treat these as source-of-truth numeric metrics
   - You MUST use ONLY these numbers - never compute or modify them

(3) tensions collection (claims + mitigations + trade-offs + impact + evidence)
   - Fields used:
     * createdBy, createdAt
     * principle1, principle2 (conflict)
     * claim, argument
     * evidence (text), evidenceType (Policy/Test/User feedback/Logs/Incident/Other) [optional]
     * attachments (files) if present
     * severityLevel
     * impactArea[], affectedGroups[]
     * mitigation/resolution fields: proposedMitigations, tradeOffDecision, tradeOffRationale
     * votes/consensus (agree/disagree counts) and computed reviewState (Proposed/Under Review/Accepted/Disputed)
   - Dashboard/report computes:
     * counts by reviewState (underReview, disputed, accepted, etc.)
     * evidence coverage: evidence count + evidenceType distribution
     * mitigation maturity signals (accepted ratio, evidence count)
   - If no evidence exists (evidence count = 0), you MUST explicitly state: "No evidence attached"
   - You may summarize tension texts, but MUST NOT invent evidence or numbers

(4) Discussions/comments (optional)
   - If stored separately (e.g., shareddiscussions): use it to count discussion activity per tension
   - If embedded under tensions, use tensions.comments and/or tensions.evidence[].comments

==============================
CRITICAL GROUNDING RULES
==============================

EVERY major conclusion or claim you make MUST be grounded in at least ONE of:
- A specific score from scoring.byPrincipleOverall or scoring.totalsOverall
- A specific question from topRiskDrivers.questions
- A specific tension from tensions.list
- A specific answer excerpt from topRiskDrivers.questions[].answerExcerpts

If grounding is NOT possible, explicitly state:
"There is insufficient evidence in the current data to support this conclusion."

Do NOT make unsupported assertions. Every insight must trace back to the provided data.

==============================
EVIDENCE INTEGRITY
==============================

- Tension evidence shown MUST come from tensions.list[].evidence.items[]
- If tension.evidence.count = 0 => ALWAYS state "No evidence attached" (explicitly, not implied)
- Never fabricate evidence or evidence types
- Use evidenceType from evidence items exactly as provided
- In the report output, if evidence.count = 0, display "No evidence attached" clearly

==============================
YOUR TASK
==============================

Generate a structured JSON narrative that:
1) Explains findings using ONLY numbers from reportMetrics
2) References specific questions, principles, and tensions
3) Highlights evidence gaps explicitly ("No evidence attached" when count = 0)
4) Provides actionable recommendations linked to specific data points
5) Acknowledges limitations and missing data

==============================
OUTPUT FORMAT (JSON ONLY)
==============================

Return a JSON object with this EXACT structure:

{
  "executiveSummary": [
    "Bullet point 1 (grounded in scoring.totalsOverall or principle scores)",
    "Bullet point 2 (grounded in topRiskDrivers or tensions.summary)",
    "Bullet point 3 (grounded in coverage or specific findings)"
  ],
  "principleFindings": [
    {
      "principle": "TRANSPARENCY | HUMAN AGENCY & OVERSIGHT | etc.",
      "whatLooksGood": ["Specific positive finding from scores or excerpts"],
      "keyRisks": ["Specific risk from scores < 2.0 or topRiskDrivers"],
      "evidenceFromData": ["Quote or reference to answerExcerpts or scores"],
      "recommendedActions": ["Actionable step linked to specific question or principle"]
    }
  ],
  "topRiskDriversNarrative": [
    {
      "questionId": "from topRiskDrivers.questions[].questionId",
      "principle": "from topRiskDrivers.questions[].principle",
      "whyRisky": "Explanation using avgRiskScore and answerExcerpts",
      "recommendedAction": "Concrete action",
      "noteOnEvidence": "Reference to answerExcerpts or 'No evidence provided'"
    }
  ],
  "tensionsNarrative": [
    {
      "tensionId": "from tensions.list[].tensionId",
      "summary": "Brief summary of claim and conflict",
      "whyItMatters": "Impact based on impactDescription and affectedGroups",
      "evidenceStatus": "Evidence attached | No evidence attached (MUST be "No evidence attached" if evidence.count = 0)",
      "mitigationAssessment": "Assessment of mitigation fields (or 'No mitigation proposed')",
      "nextStep": "Actionable next step based on reviewState and consensus"
    }
  ],
  "recommendations": [
    {
      "title": "Specific recommendation title",
      "priority": "High | Med | Low",
      "ownerRole": "Role responsible (or 'Project team')",
      "ownerPerson": "Specific person name if available, or 'Assign owner' if not specified",
      "timeline": "Suggested timeline",
      "successMetric": "How to measure success (e.g., 'Increase average scores to above 3.0' for Low risk level, NOT 'Resolved state')",
      "dataBasis": "What data this recommendation is based on (e.g., 'principle avg + top risky questions + unresolved tensions + evidence gap')",
      "linkedTo": ["principle:TRANSPARENCY", "tension:...", "question:..."]
    }
  ],
  "limitations": [
    "Missing data explicitly listed (e.g., 'No evidence attached for tension X')",
    "Evidence gaps (e.g., 'X tensions lack evidence')",
    "Role-specific question comparability warning if applicable"
  ],
  "appendixNotes": [
    "Glossary notes (risk score meaning, severity meaning)",
    "Data snapshot info (scores.computedAt timestamps)"
  ]
}

==============================
OUTPUT RULES - STRICT ENFORCEMENT
==============================

- Use ONLY numbers from reportMetrics.dashboardMetrics (if available) or reportMetrics JSON
- NEVER compute, recalculate, infer, normalize, or modify any score
- Ground every insight in at least one data point from reportMetrics
- Do NOT generate tables with numeric values - tables are rendered server-side
- Do NOT restate raw JSON structures
- Do NOT exaggerate or speculate beyond provided data
- If information is missing, explicitly state "Not provided" or "No evidence attached"
- If tension evidence count = 0, explicitly state "No evidence attached"
- Answer excerpts must be used verbatim or with clear attribution
- Do NOT invent use-case/domain details; use only project fields given
- DO NOT create markdown tables, HTML tables, or any tabular format in your output
- If reportMetrics.dashboardMetrics is provided, use it as the single source of truth for all numeric values

==============================
FINAL REMINDER
==============================

You are NOT an evaluator.
You are NOT a scoring engine.
You are NOT a decision-maker.

You are a narrative assistant that explains deterministic ethical evaluation results,
analyzes expert responses and question patterns,
and highlights where human deliberation is required.

Your output is advisory, explanatory, and non-binding.`;

  // Build evaluator context for prompt
  const evaluatorContext = reportMetrics.evaluators ? `
EVALUATORS (Actual assigned and submitted):
- Assigned: ${reportMetrics.evaluators.assigned.length} expert(s)
  ${reportMetrics.evaluators.assigned.map(e => `  - ${e.name} (${e.role})`).join('\n')}
- Submitted: ${reportMetrics.evaluators.submitted.length} expert(s)
  ${reportMetrics.evaluators.submitted.map(e => `  - ${e.name} (${e.role})`).join('\n')}
- With Scores: ${reportMetrics.evaluators.withScores.length} expert(s)
  ${reportMetrics.evaluators.withScores.map(e => `  - ${e.name} (${e.role})`).join('\n')}

CRITICAL RULES:
1. Report tables must ONLY include evaluators listed in "withScores" above.
2. Do NOT reference "Expert 1/2" or "Medical Expert 3/4" - use actual names from the list above.
3. If only 1 technical expert submitted, show 1 (never show 2 or assume more).
4. Use the exact count of evaluators who submitted - no placeholders or assumptions.
5. Role-specific questions (after first 12) should NOT be compared across roles.
` : '';

  const userPrompt = `INPUT DATA (reportMetrics JSON):
${inputJson}

${evaluatorContext}
--------------------------------------------------

OUTPUT REQUIREMENTS:
- Output MUST be valid JSON only (no markdown, no explanations, no extra text)
- Do NOT include assumptions beyond the input
- Ensure all string values are properly escaped
- Ground EVERY insight in at least one data point from the input
- If tension evidence count = 0 => ALWAYS state "No evidence attached" (explicitly, not implied)
- Do NOT invent use-case/domain details; use only project fields given
- Use ONLY evaluator names from evaluators.withScores list - never use generic labels like "Expert 1/2"
- If only 1 evaluator of a role submitted, show 1 (never show 2 or assume more)
- Role-specific questions (after first 12) should NOT be compared across roles in your narrative
- If general assessment answers are missing => state "Missing / Not provided" and list missing fields
- NEVER print the literal string "undefined" - use "Not provided" or "Missing" instead
- DO NOT compute or recalculate scores - use only the numbers provided from reportMetrics.dashboardMetrics (if available) or reportMetrics
- DO NOT describe or invent charts - charts are generated programmatically
- DO NOT create tables with numeric values in your JSON output - tables are rendered server-side
- If reportMetrics.dashboardMetrics is provided, it is the SINGLE SOURCE OF TRUTH for all numeric metrics

FIELD VALIDATION:
- priority MUST be exactly one of: "High", "Med", "Low"
- evidenceStatus MUST be exactly one of: "Evidence attached", "No evidence attached"
- principle MUST match one of the 7 Z-Inspection principles

REQUIRED FIELDS:
- executiveSummary (array of strings)
- principleFindings (array of objects)
- topRiskDriversNarrative (array of objects)
- tensionsNarrative (array of objects)
- recommendations (array of objects)
- limitations (array of strings)
- appendixNotes (array of strings)

IMPORTANT:
- Return ONLY the JSON object, nothing else
- Do not include markdown code blocks (\`\`\`json)
- Do not include explanatory text before or after the JSON
- Ensure JSON is valid and parseable
- Every claim must reference specific scores, questions, or excerpts from reportMetrics
- Use actual evaluator names from evaluators.withScores, not generic labels`;

  const modelNamesToTry = [
    "models/gemini-2.5-flash",
    "gemini-2.5-flash"
  ];

  const narrativeConfig = {
    temperature: 0.3, // Lower temperature for more consistent, grounded output
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192
  };

  let lastError = null;

  for (const modelName of modelNamesToTry) {
    try {
      console.log(`🤖 Gemini (${modelName}) generating report narrative...`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: narrativeConfig
      });

      let rawResponse = result.response.text();

      if (!rawResponse) {
        throw new Error("❌ Gemini returned empty response.");
      }

      // Clean up response - remove markdown code blocks if present
      rawResponse = rawResponse.trim();
      if (rawResponse.startsWith('```json')) {
        rawResponse = rawResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (rawResponse.startsWith('```')) {
        rawResponse = rawResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      rawResponse = rawResponse.trim();

      // Try to find JSON object if there's extra text
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawResponse = jsonMatch[0];
      }

      // Parse JSON
      let narrative;
      try {
        narrative = JSON.parse(rawResponse);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError.message);
        console.error('Raw response:', rawResponse.substring(0, 500));
        throw new Error(`JSON parse error: ${parseError.message}`);
      }

      // Basic validation
      if (!Array.isArray(narrative.executiveSummary)) {
        throw new Error('Invalid response: executiveSummary must be an array');
      }
      if (!Array.isArray(narrative.principleFindings)) {
        throw new Error('Invalid response: principleFindings must be an array');
      }
      if (!Array.isArray(narrative.tensionsNarrative)) {
        throw new Error('Invalid response: tensionsNarrative must be an array');
      }
      if (!Array.isArray(narrative.recommendations)) {
        throw new Error('Invalid response: recommendations must be an array');
      }
      if (!Array.isArray(narrative.limitations)) {
        throw new Error('Invalid response: limitations must be an array');
      }

      console.log(`✅ Report narrative successfully generated (${modelName}).`);
      return narrative;

    } catch (error) {
      console.error(`❌ Model ${modelName} failed:`, error.message);
      lastError = error;
      
      if (!error.message.includes("404") && !error.message.includes("not found") && !error.message.includes("JSON")) {
        break;
      }
    }
  }

  if (lastError) {
    const errorMsg = lastError.message || '';
    const errorMsgLower = errorMsg.toLowerCase();
    
    if (errorMsg.includes("400") || errorMsgLower.includes("expired") || errorMsgLower.includes("api_key_invalid")) {
      throw new Error("❌ Gemini API Key expired or invalid.");
    }
    if (errorMsg.includes("403") || errorMsgLower.includes("permission_denied")) {
      throw new Error("❌ Gemini API Key invalid or unauthorized.");
    }
    if (errorMsg.includes("429") || errorMsgLower.includes("resource_exhausted") || errorMsgLower.includes("quota")) {
      throw new Error("❌ Gemini API quota exceeded. Please try again later.");
    }
    
    throw new Error(`❌ Report narrative generation failed: ${lastError.message}`);
  }

  throw new Error("❌ Report narrative generation failed: Unknown error.");
}

module.exports = {
  generateReport,
  analyzeExpertComments,
  generateDashboardNarrative,
  generateReportNarrative,
  testApiKey
};
