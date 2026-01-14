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
You are tasked with IMPROVING (not rewriting from scratch)
the qualitative analysis, recommendations, and conclusion sections
of an existing Ethical AI Evaluation Report.

CRITICAL CONSTRAINTS (DO NOT VIOLATE):
- DO NOT change any numeric values.
- DO NOT change ERC calculations or thresholds.
- DO NOT change risk levels or classifications.
- DO NOT add new metrics.
- DO NOT alter report structure or section order.

Your task is LIMITED to:
- Making qualitative insights more principle-specific
- Increasing clarity, depth, and audit-readiness
- Improving recommendations with project-specific actions
- Strengthening the conclusion narrative

--------------------------------------------------
SECTION 5 – Qualitative Analysis of Open-Text Responses
--------------------------------------------------

IMPROVEMENT REQUIREMENTS:
- Remove generic, repeated language.
- Each ethical principle MUST contain unique insights.
- For each principle:
  1. Reference at least one concrete concern or observation.
  2. Explain why it matters in this project context.
  3. Explicitly link the insight to the existing quantitative risk level.

You MUST:
- Demonstrate that expert open-text responses were interpreted.
- Use principle-specific terminology
  (e.g. bias for fairness, explainability for transparency).

EXAMPLE OUTPUT FOR ONE PRINCIPLE (Transparency):
---
Expert evaluators emphasized that transparency is partially addressed through internal documentation; however, several noted that explanations provided to candidates regarding automated screening outcomes remain limited.

A recurring theme was the absence of clear, user-facing communication on how automated decisions influence candidate progression. While this does not constitute a systemic transparency failure, experts warned that insufficient disclosure could undermine stakeholder trust over time.

These qualitative observations align with the quantitative assessment, which indicates a moderate transparency risk that could be mitigated through improved communication practices.
---

You MUST NOT:
- Use placeholder language.
- Repeat the same phrasing across principles.
- Claim lack of data or generation failure.

--------------------------------------------------
SECTION 6 – Ethical Tensions and Trade-Offs
--------------------------------------------------

YOU MUST:
- Identify at least 2 ethical tensions or trade-offs
- Explain WHY these tensions exist in this system
- Relate tensions to automation, fairness, transparency, efficiency, or human oversight

YOU MUST NOT:
- State that no tensions exist
- Use generic filler language

--------------------------------------------------
SECTION 7 – Improvement Recommendations
--------------------------------------------------

IMPROVEMENT REQUIREMENTS:
- Keep the Short / Medium / Long-term structure unchanged.
- For each time horizon:
  - Ensure at least one recommendation is clearly linked
    to a specific ethical principle or risk area.
  - Make recommendations concrete and actionable
    (avoid purely procedural statements).

You MUST NOT:
- Remove existing recommendations.
- Introduce new risk categories.
- Repeat the same recommendation across horizons.

--------------------------------------------------
SECTION 8 – Conclusion
--------------------------------------------------

IMPROVEMENT REQUIREMENTS:
- Strengthen linkage between:
  quantitative results (ERC values)
  and qualitative insights.
- Clearly articulate:
  - key strengths
  - key areas requiring attention
- End with a forward-looking governance statement
  tailored to this system.

The conclusion MUST be 2-3 substantive paragraphs.

You MUST NOT:
- Introduce new data.
- Recalculate or reinterpret scores.

--------------------------------------------------
OUTPUT FORMAT (STRICT JSON)
--------------------------------------------------
Return a RAW JSON OBJECT. No markdown formatting. No code blocks.

FINAL GOAL:
Produce a more insightful, project-specific, and audit-ready narrative
WITHOUT changing any calculations or conclusions.

==================================================
OUTPUT FORMAT (STRICT JSON)
==================================================
Return a RAW JSON OBJECT. No markdown formatting. No code blocks.

{
  "executiveSummary": [
    "First paragraph must strictly state: 'The assessment identified a Cumulative Risk Volume of [X] across [Y] evaluated quantitative questions.'",
    "Second paragraph: 'The Normalized Average ERC is [Z] / 4, classified as [Label].'",
    "Bullet point 1 (Key risk driver)",
    "Bullet point 2 (Key strength)",
    "Bullet point 3 (Context)"
  ],
  "principleFindings": [
    {
      "principleName": "Transparency",
      "riskLevel": "Low",
      "analysis": "Detailed analysis text..."
    }
  ],
  "qualitativeAnalysis": {
    "methodology": "In addition to quantitative scoring, expert evaluators provided open-text responses...",
    "interpretation": "Insights are grouped by ethical principle and interpreted as complementary context...",
    "insights": [
      {
        "principle": "Transparency",
        "insight": "Experts noted..."
      }
    ],
    "disclaimer": "The qualitative insights presented above are intended to provide contextual understanding..."
  },
  "topRiskDriversNarrative": [
    {
      "questionId": "Q123",
      "whyRisky": "Reason...",
      "recommendedAction": "Action..."
    }
  ],
  "tensionsNarrative": [
    {
      "tensionId": "T1",
      "analysis": "Why it exists...",
      "mitigationStatus": "Proposed"
    }
  ],
  "improvementRecommendations": {
    "shortTerm": ["Detailed action 1 with What/Why/How", "Detailed action 2", "Detailed action 3", "Detailed action 4"],
    "mediumTerm": ["Strategic action 1 with justification", "Strategic action 2", "Strategic action 3", "Strategic action 4"],
    "longTerm": ["Governance action 1 with impact", "Governance action 2", "Governance action 3", "Governance action 4"]
  },
  "conclusion": [
    "First paragraph: Overall assessment of ethical risk synthesizing quantitative AND qualitative findings.",
    "Second paragraph: Areas of strength and areas needing improvement.",
    "Third paragraph: Final verdict on system readiness and future governance outlook."
  ],
  "limitations": [
    "Qualitative questions capture contextual, ethical nuance...",
    "Limitation 2..."
  ]
}
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

      const reportText = result.response.text();
      let reportData;

      try {
        // Attempt to parse JSON
        // Remove potential markdown code blocks if Gemini mimics them
        const jsonString = reportText.replace(/```json\n?|```/g, '').trim();
        reportData = JSON.parse(jsonString);
      } catch (e) {
        console.warn('⚠️ Gemini returned invalid JSON, attempting fallback parse or returning raw text if needed:', e.message);
        // Fallback: If parsing fails, we might have to throw or return partial data
        throw new Error("Failed to parse Gemini JSON response");
      }

      if (!reportData) {
        throw new Error("❌ Gemini boş yanıt döndü.");
      }

      console.log(`✅ Rapor başarıyla oluşturuldu (${modelName}).`);
      return reportData;

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
  const unifiedAnswers = data.unifiedAnswers || [];
  const tensions = data.tensions || [];
  const evaluations = data.evaluations || [];
  const reportMetrics = data.reportMetrics || {}; // E) Include dashboardMetrics
  const topDriversTable = data.topDriversTable || []; // E) Include top drivers with snippets
  const scoringDisclosure = reportMetrics.scoringDisclosure || null; // NEW: Question Breakdown

  let prompt = `# AI ETHICS EVALUATION DATA\n\n`;
  prompt += `Analyze the following data using the Z-Inspection methodology.\n`;
  prompt += `**CRITICAL: ALL expert answers and ALL tensions MUST be fully analyzed and explained in the report.**\n\n`;

  // NEW: Scoring Disclosure Injection
  if (scoringDisclosure) {
    prompt += `## METHODOLOGY CONTEXT (USE AS FACT)\n`;
    prompt += `Quantitative Scoring is based on ${scoringDisclosure.quantitativeQuestions || 'N/A'} quantitative questions.\n`;
    prompt += `Qualitative Analysis covers ${scoringDisclosure.qualitativeQuestions || 'N/A'} open-text questions.\n`;
    prompt += `Methodology: ${scoringDisclosure.methodology || 'N/A'}\n\n`;
  }

  // E) Add dashboardMetrics JSON section
  if (reportMetrics.scoring) {
    prompt += `## DASHBOARD METRICS (CANONICAL - USE ONLY THESE NUMBERS)\n`;
    prompt += `**IMPORTANT: These numbers are pre-computed from scores collection. DO NOT recompute or reinterpret.**\n\n`;

    if (reportMetrics.scoring.totalsOverall) {
      prompt += `### Overall Metrics\n`;
      prompt += `- Overall Risk: ${reportMetrics.scoring.totalsOverall.overallRisk || reportMetrics.scoring.totalsOverall.avg || 'N/A'}\n`;
      prompt += `- Overall Maturity: ${reportMetrics.scoring.totalsOverall.overallMaturity || 'N/A'}\n`;
      prompt += `- Risk Label: ${reportMetrics.scoring.totalsOverall.riskLabel || 'N/A'}\n`;
      prompt += `- Evaluator Count: ${reportMetrics.scoring.totalsOverall.uniqueEvaluatorCount || reportMetrics.scoring.totalsOverall.count || 'N/A'}\n\n`;
    }

    if (reportMetrics.scoring.byPrincipleOverall) {
      prompt += `### Principle-Level Metrics\n`;
      Object.entries(reportMetrics.scoring.byPrincipleOverall).forEach(([principle, data]) => {
        if (data && typeof data === 'object') {
          prompt += `- ${principle}:\n`;
          prompt += `  - Risk: ${data.risk || data.avg || data.avgScore || 'N/A'}\n`;
          prompt += `  - Maturity: ${data.maturity || 'N/A'}\n`;
          prompt += `  - Risk Label: ${data.riskLabel || 'N/A'}\n`;
          prompt += `  - Risk%: ${data.riskPct || 0}%\n`;
          prompt += `  - Answered Count: ${data.count || 0}\n`;
        }
      });
      prompt += `\n`;
    }

    // E) Add top drivers table
    if (topDriversTable && topDriversTable.length > 0) {
      prompt += `### Top Risk Drivers (from scores.byPrinciple[...].topDrivers)\n`;
      topDriversTable.forEach((driver, idx) => {
        prompt += `#### Driver ${idx + 1}: ${driver.questionCode || driver.questionId}\n`;
        prompt += `- **Principle:** ${driver.principle || 'Unknown'}\n`;
        prompt += `- **Question Text:** ${driver.questionText || 'N/A'}\n`;
        prompt += `- **Avg Risk Score (importance):** ${driver.avgRiskScore || 'N/A'}\n`;
        prompt += `- **Answer Quality (AQ):** ${driver.AQ || 'N/A'}\n`;
        prompt += `- **Risk Weight (RW):** ${driver.RW || 'N/A'}\n`;
        prompt += `- **Unmitigated Risk:** ${driver.unmitigatedRisk || 'N/A'}\n`;
        prompt += `- **Roles:** ${driver.roles?.join(', ') || 'N/A'}\n`;
        if (driver.answerSnippet) {
          prompt += `- **Answer Snippet:** "${driver.answerSnippet}"\n`;
        } else {
          prompt += `- **Answer Snippet:** No qualitative explanation was provided\n`;
        }
        prompt += `\n`;
      });
    } else {
      prompt += `### Top Risk Drivers\n`;
      prompt += `No drivers computed.\n\n`;
    }
  }

  /* PROJECT CONTEXT */
  prompt += `## PROJECT CONTEXT\n`;
  prompt += `**Title:** ${project.title || "Untitled Project"}\n`;
  prompt += `**Description:** ${project.fullDescription || project.shortDescription || "N/A"}\n`;
  prompt += `**Status:** ${project.status || "N/A"}\n`;
  prompt += `**Progress:** ${project.progress || 0}%\n\n`;

  /* EVALUATOR REPRESENTATION - MUST MATCH SUBMITTED EVALUATIONS (NO TEAM/ASSIGNMENT REQUIREMENT) */
  prompt += `## EVALUATOR REPRESENTATION\n`;
  prompt += `**CRITICAL: Evaluator counts/roles MUST match SUBMITTED evaluations (unique userId). Do not duplicate roles. Do NOT invent a "project" evaluator role.**\n`;
  if (reportMetrics.coverage) {
    const coverage = reportMetrics.coverage;
    prompt += `**Submitted Evaluators:** ${coverage.expertsSubmittedCount || 0}\n`;
    if (coverage.roles && Object.keys(coverage.roles).length > 0) {
      prompt += `**By Role (submitted-only):**\n`;
      Object.entries(coverage.roles).forEach(([role, stats]) => {
        const submitted = stats?.submitted || 0;
        if (submitted > 0) {
          prompt += `  - ${role}: ${submitted} submitted\n`;
        }
      });
    }
    if (coverage.core12Completion) {
      prompt += `**Core-12 Completion (submitted baseline):** ${Number(coverage.core12Completion.submittedPct || 0).toFixed(1)}%\n`;
    }
  }
  prompt += `\n`;

  /* SCORES */
  prompt += `## ETHICAL PRINCIPLE SCORES\n`;
  if (scores.length === 0) {
    prompt += `No score data available.\n\n`;
  } else {
    scores.forEach((s, i) => {
      prompt += `### Evaluator ${i + 1}${s.role ? ` (${s.role})` : ""}\n`;
      prompt += `Average Score: ${s.totals?.avg?.toFixed(2) || "N/A"}\n`;

      if (s.byPrinciple) {
        Object.entries(s.byPrinciple).forEach(([p, v]) => {
          if (v?.avg !== undefined) {
            prompt += `- ${p}: ${v.avg.toFixed(2)}\n`;
          }
        });
      }
      prompt += `\n`;
    });
  }

  /* UNIFIED EXPERT ANSWERS (from both responses and generalquestionanswers) */
  prompt += `## ALL EXPERT ANSWERS (UNIFIED FROM ALL SOURCES)\n`;
  if (unifiedAnswers.length === 0) {
    prompt += `No expert answers available.\n\n`;
  } else {
    // Count answers by questionnaire to show coverage
    const answersByQuestionnaire = {};
    unifiedAnswers.forEach(a => {
      const qKey = a.questionnaireKey || 'unknown';
      answersByQuestionnaire[qKey] = (answersByQuestionnaire[qKey] || 0) + 1;
    });

    prompt += `**Total Answers:** ${unifiedAnswers.length}\n`;
    prompt += `**Questionnaires Covered:** ${Object.keys(answersByQuestionnaire).length}\n`;
    Object.entries(answersByQuestionnaire).forEach(([qKey, count]) => {
      const label = qKey === 'general-v1' ? 'General Questions' :
        qKey.includes('expert') ? `Role-Specific (${qKey.replace('-v1', '')})` :
          qKey;
      prompt += `  - ${label}: ${count} answers\n`;
    });
    prompt += `\n`;

    // Group by principle for better organization
    const answersByPrinciple = {};
    const answersWithoutPrinciple = [];

    unifiedAnswers.forEach((answer) => {
      const principle = answer.principle || 'UNCATEGORIZED';
      if (principle === 'UNCATEGORIZED' || !principle) {
        answersWithoutPrinciple.push(answer);
      } else {
        if (!answersByPrinciple[principle]) {
          answersByPrinciple[principle] = [];
        }
        answersByPrinciple[principle].push(answer);
      }
    });

    // Output by principle
    Object.entries(answersByPrinciple).forEach(([principle, answers]) => {
      prompt += `### ${principle}\n`;
      answers.forEach((answer, idx) => {
        prompt += `#### Answer ${idx + 1} (${answer.role || 'unknown role'})\n`;
        prompt += `- **Question ID/Code:** ${answer.questionId || answer.questionCode || 'N/A'}\n`;
        // Show questionnaire key to indicate if it's general or role-specific
        const qKey = answer.questionnaireKey || 'N/A';
        const qKeyLabel = qKey === 'general-v1' ? 'General Questions' :
          qKey.includes('expert') ? `Role-Specific (${qKey.replace('-v1', '')})` :
            qKey;
        prompt += `- **Questionnaire:** ${qKeyLabel} (${qKey})\n`;
        if (answer.selectedOption) {
          prompt += `- **Selected Option:** ${answer.selectedOption}\n`;
        }
        if (answer.score !== null && answer.score !== undefined) {
          // CORRECT SCALE: 0=MINIMAL, 4=CRITICAL (Higher score = Higher risk)
          const { getRiskLabel } = require('../utils/riskClassification');
          prompt += `- **Risk Score:** ${answer.score} / 4 (${getRiskLabel(answer.score)})\n`;
        }
        if (answer.textAnswer) {
          prompt += `- **Text Answer:** "${answer.textAnswer}"\n`;
        } else {
          prompt += `- **Text Answer:** No text answer provided\n`;
        }
        if (answer.notes) {
          prompt += `- **Notes:** ${answer.notes}\n`;
        }
        prompt += `- **Source Collection:** ${answer.sourceCollection}\n`;
        prompt += `\n`;
      });
    });

    // Output uncategorized answers
    if (answersWithoutPrinciple.length > 0) {
      prompt += `### UNCATEGORIZED ANSWERS\n`;
      answersWithoutPrinciple.forEach((answer, idx) => {
        prompt += `#### Answer ${idx + 1} (${answer.role || 'unknown role'})\n`;
        prompt += `- **Question ID/Code:** ${answer.questionId || answer.questionCode || 'N/A'}\n`;
        if (answer.selectedOption) {
          prompt += `- **Selected Option:** ${answer.selectedOption}\n`;
        }
        if (answer.score !== null && answer.score !== undefined) {
          prompt += `- **Risk Score:** ${answer.score} / 4\n`;
        }
        if (answer.textAnswer) {
          prompt += `- **Text Answer:** "${answer.textAnswer}"\n`;
        }
        prompt += `- **Source Collection:** ${answer.sourceCollection}\n`;
        prompt += `\n`;
      });
    }
  }

  /* TENSIONS TABLE DATA */
  const tensionsTable = reportMetrics?.tensions?.list || [];
  if (tensionsTable.length > 0) {
    prompt += `## TENSIONS TABLE DATA (FOR REPORT TABLE GENERATION)\n`;
    prompt += `**Use this structured data to create a tensions table with columns: Conflict, Severity, Evidence Count, Consensus, Review State**\n\n`;
    tensionsTable.forEach((t, i) => {
      prompt += `### Tension ${i + 1} Table Row Data\n`;
      prompt += `- **Conflict:** ${t.conflict?.principle1 || 'Unknown'} vs ${t.conflict?.principle2 || 'Unknown'}\n`;
      prompt += `- **Severity:** ${t.severityLevel || 'Unknown'}\n`;
      prompt += `- **Evidence Count:** ${t.evidence?.count || 0} (Types: ${(t.evidence?.types || []).join(', ') || 'None'})\n`;
      prompt += `- **Consensus:** ${t.consensus?.agreePct?.toFixed(1) || 0}% agree (${t.consensus?.agreeCount || 0}/${t.consensus?.votesTotal || 0} votes), ${t.consensus?.participationPct?.toFixed(1) || 0}% participation\n`;
      prompt += `- **Review State:** ${t.consensus?.reviewState || 'Proposed'}\n`;
      prompt += `- **Maturity Flags:** Evidence=${t.evidence?.count > 0 ? 'High' : 'Low'}, Consensus=${(t.consensus?.agreePct || 0) >= 70 ? 'High' : (t.consensus?.agreePct || 0) >= 50 ? 'Medium' : 'Low'}, Review=${['Accepted', 'UnderReview'].includes(t.consensus?.reviewState) ? 'Active' : 'Stalled'}\n`;
      prompt += `- **High Severity + Low Evidence:** ${(t.severityLevel && (t.severityLevel.toLowerCase().includes('high') || t.severityLevel.toLowerCase().includes('critical')) && (t.evidence?.count || 0) === 0) ? 'YES ⚠️ REQUIRES IMMEDIATE ATTENTION' : 'No'}\n\n`;
    });
  }

  /* TENSIONS (FULL DETAILS) */
  prompt += `## ETHICAL TENSIONS (FULL DETAILS)\n`;
  if (tensions.length === 0) {
    prompt += `No ethical tensions identified.\n\n`;
  } else {
    prompt += `**Total Tensions:** ${tensions.length}\n`;
    if (reportMetrics?.tensions?.summary) {
      const summary = reportMetrics.tensions.summary;
      prompt += `**Summary:** ${summary.accepted || 0} accepted, ${summary.underReview || 0} under review, ${summary.disputed || 0} disputed\n`;
      prompt += `**Evidence Coverage:** ${summary.evidenceCoveragePct?.toFixed(1) || 0}%\n`;
      prompt += `**Average Participation:** ${summary.avgParticipationPct?.toFixed(1) || 0}%\n\n`;
    }
    tensions.forEach((t, i) => {
      // F) Use normalized mapping keys
      const claim = t.claim || t.claimStatement || t.description || 'Not provided';
      const createdBy = t.createdBy && t.createdBy !== 'unknown' ? t.createdBy : (t.createdBy || '');
      const reviewState = t.reviewState || t.status || 'Proposed';
      const severityLevel = t.severityLevel || t.severity || 'Unknown';

      prompt += `### Tension ${i + 1}: ${t.principle1 || t.conflict?.principle1 || 'Unknown'} vs ${t.principle2 || t.conflict?.principle2 || 'Unknown'}\n`;
      prompt += `- **Tension ID:** ${t._id || t.tensionId || 'N/A'}\n`;
      prompt += `- **Claim Statement:** ${claim}\n`;
      if (claim === 'Not provided') {
        prompt += `  ⚠️ Claim not provided in submissions - state this in report\n`;
      }
      prompt += `- **Description:** ${t.description || t.argument || 'No additional description'}\n`;
      prompt += `- **Severity Level:** ${severityLevel} ${severityLevel && (severityLevel.toLowerCase().includes('high') || severityLevel.toLowerCase().includes('critical')) ? '⚠️ REQUIRES DETAILED ANALYSIS' : ''}\n`;
      prompt += `- **Review State (normalized):** ${reviewState}\n`;
      prompt += `- **Created By:** ${createdBy || 'N/A'}\n`;
      if (!createdBy || createdBy === 'unknown') {
        prompt += `  ⚠️ CreatedBy is missing - check data mapping\n`;
      }
      prompt += `- **Created At:** ${t.createdAt ? new Date(t.createdAt).toISOString() : 'N/A'}\n\n`;

      // Votes
      if (t.votes && t.votes.length > 0) {
        prompt += `- **Votes:**\n`;
        const agreeCount = t.votes.filter(v => v.voteType === 'agree').length;
        const disagreeCount = t.votes.filter(v => v.voteType === 'disagree').length;
        prompt += `  - Agree: ${agreeCount}\n`;
        prompt += `  - Disagree: ${disagreeCount}\n`;
        t.votes.forEach((vote, vidx) => {
          prompt += `  - Vote ${vidx + 1}: ${vote.voteType || 'unknown'} by ${vote.userId || 'unknown user'}\n`;
        });
        prompt += `\n`;
      } else {
        prompt += `- **Votes:** No votes yet\n\n`;
      }

      // Comments
      if (t.comments && t.comments.length > 0) {
        prompt += `- **Comments:**\n`;
        t.comments.forEach((comment, cidx) => {
          prompt += `  - Comment ${cidx + 1} by ${comment.authorName || comment.authorId || 'unknown'}: "${comment.text || 'N/A'}" (${comment.date ? new Date(comment.date).toISOString() : 'N/A'})\n`;
        });
        prompt += `\n`;
      }

      // Evidence
      if (t.evidences && t.evidences.length > 0) {
        prompt += `- **Evidence (${t.evidences.length} items):**\n`;
        t.evidences.forEach((evidence, eidx) => {
          prompt += `  - Evidence ${eidx + 1}: ${evidence.title || 'Untitled'}\n`;
          if (evidence.description) {
            prompt += `    - Description: ${evidence.description}\n`;
          }
          if (evidence.type) {
            prompt += `    - Type: ${evidence.type}\n`;
          }
          if (evidence.fileName) {
            prompt += `    - File: ${evidence.fileName}\n`;
          }
          if (evidence.uploadedBy) {
            prompt += `    - Uploaded by: ${evidence.uploadedBy}\n`;
          }
          if (evidence.comments && evidence.comments.length > 0) {
            prompt += `    - Evidence Comments: ${evidence.comments.length}\n`;
          }
        });
        prompt += `\n`;
      } else {
        prompt += `- **Evidence:** No evidence attached.\n`;
        prompt += `  ⚠️ State "No evidence attached" in report\n\n`;
      }

      // Mitigation - F) Check if filled
      const hasMitigation = !!(t.mitigation?.proposedMitigations || t.mitigation?.proposed || t.mitigation?.tradeOffDecision || t.mitigation?.tradeoff?.decision);
      prompt += `- **Mitigation Filled:** ${hasMitigation ? 'Yes' : 'No'}\n`;

      // Impact
      if (t.impact) {
        prompt += `- **Impact:**\n`;
        if (t.impact.areas && t.impact.areas.length > 0) {
          prompt += `  - Areas: ${t.impact.areas.join(', ')}\n`;
        }
        if (t.impact.affectedGroups && t.impact.affectedGroups.length > 0) {
          prompt += `  - Affected Groups: ${t.impact.affectedGroups.join(', ')}\n`;
        }
        if (t.impact.description) {
          prompt += `  - Description: ${t.impact.description}\n`;
        }
        prompt += `\n`;
      }

      // Mitigation
      if (t.mitigation) {
        prompt += `- **Mitigation:**\n`;
        if (t.mitigation.proposed) {
          prompt += `  - Proposed: ${t.mitigation.proposed}\n`;
        }
        if (t.mitigation.tradeoff) {
          if (t.mitigation.tradeoff.decision) {
            prompt += `  - Tradeoff Decision: ${t.mitigation.tradeoff.decision}\n`;
          }
          if (t.mitigation.tradeoff.rationale) {
            prompt += `  - Tradeoff Rationale: ${t.mitigation.tradeoff.rationale}\n`;
          }
        }
        if (t.mitigation.action) {
          prompt += `  - Action Status: ${t.mitigation.action.status || 'N/A'}\n`;
          if (t.mitigation.action.ownerName) {
            prompt += `  - Action Owner: ${t.mitigation.action.ownerName}\n`;
          }
          if (t.mitigation.action.dueDate) {
            prompt += `  - Due Date: ${new Date(t.mitigation.action.dueDate).toISOString()}\n`;
          }
        }
        prompt += `\n`;
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
# REPORT GENERATION INSTRUCTIONS

## MANDATORY REQUIREMENTS (NON-NEGOTIABLE):

1. **ALL Expert Answers MUST Be Referenced:**
   - Every expert textAnswer that exists MUST be quoted, referenced, or analyzed in the report
   - If a textAnswer exists but is not mentioned, the report is INCOMPLETE
   - "No text answer provided" should ONLY appear if the expert truly gave no text answer

2. **ALL Ethical Tensions MUST Be Explained:**
   - Every tension MUST have a detailed explanation of WHY it exists
   - Link each tension to the exact expert answers that triggered it
   - Analyze severity (low/medium/high/critical) with justification
   - Include evidence, votes, and mitigation strategies when available
   - NO tension may appear in the report without explanation

3. **High-Risk Behavior Requirements:**
   - If ANY related tension has severity ≥ High, you MUST generate a detailed narrative explanation
   - Strong negative expert statements CANNOT result in empty or neutral narratives
   - The report MUST reflect the severity level - high-risk inputs produce high-risk narratives

4. **Principle-by-Principle Analysis:**
   - For EACH ethical principle with data:
     * Aggregate ALL related answers (from ALL sources)
     * Include risk interpretation
     * Identify concrete concerns
     * Discuss ethical trade-offs
     * Identify missing safeguards
   - Empty principle sections are NOT allowed if data exists for that principle

## REPORT STRUCTURE:
Generate a comprehensive PDF-ready report with the following structure:

1. **Executive Summary**
   - Brief overview of the project
   - Key findings and overall risk assessment
   - Main recommendations

2. **Risk Assessment Matrix**
   - Visual representation of risks by principle
   - Severity levels and impact analysis

3. **Principle-by-Principle Analysis**
   - Detailed analysis for each ethical principle with data
   - Scores, evaluations, and evidence
   - ALL expert answers related to that principle
   - Strengths and weaknesses identified
   - NO empty sections if data exists

4. **Tension Analysis**
   - ALL identified ethical tensions with FULL explanation
   - For each tension: WHY it exists, which answers triggered it, severity analysis
   - Evidence, votes, and mitigation strategies
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

/**
 * Analyze qualitative (open-text) responses to derive numeric severity
 * @param {Array} answers - Array of { responseId, text, questionText }
 * @returns {Promise<Array>} Array of { responseId, derivedSeverity, justification }
 */
async function analyzeQualitativeSeverity(answers) {
  if (!answers || answers.length === 0) return [];

  // Construct the prompt
  const itemsText = answers.map((a, i) =>
    `ITEM #${i + 1} (ID: ${a.responseId}):
    Question: "${a.questionText}"
    Expert Response: "${a.text}"`
  ).join('\n\n');

  const systemInstruction = `
You are tasked with DERIVING NUMERIC SEVERITY SIGNALS from OPEN-TEXT expert responses for inclusion in an ERC-based ethical risk assessment.

CRITICAL CONTEXT (DO NOT VIOLATE):
- ERC = Importance (0–4) × Severity (0–1) is LOCKED.
- Importance scores are already assigned by experts and MUST NOT be changed.
- Quantitative multiple-choice scoring is FINAL.
- This task applies ONLY to OPEN-TEXT responses.

Your role is NOT to interpret importance.
Your role is NOT to rewrite the report.
Your role is NOT to infer new ethical principles.

Your ONLY task is to assign a SEVERITY value to each open-text response using STRICT RULES.

--------------------------------------------------
HARD CONSTRAINTS (NON-NEGOTIABLE)
--------------------------------------------------

1. You MUST assign ONLY one of the following severity values:
   - 0.0 → No ethical risk indicated
   - 0.5 → Ambiguous, partial, or potential ethical risk
   - 1.0 → Clear ethical risk explicitly indicated

2. You MUST base severity ONLY on the content of the open-text response.

3. You MUST NOT:
   - Modify importanceScore
   - Invent numeric values other than {0, 0.5, 1}
   - Average, normalize, or label risk
   - Introduce new metrics or explanations

--------------------------------------------------
SEVERITY DECISION GUIDELINES
--------------------------------------------------

Assign severity = 1.0 IF the response:
- Explicitly states a risk, harm, bias, or ethical violation
- Describes concrete negative outcomes
- Indicates lack of safeguards, transparency, or accountability

Assign severity = 0.5 IF the response:
- Expresses uncertainty, partial concern, or conditional risk
- Uses cautious language (“may”, “could”, “depends”)
- Indicates mitigation exists but is incomplete

Assign severity = 0.0 IF the response:
- Explicitly states no ethical concern
- Describes strong safeguards or positive practices
- Clearly rejects the presence of risk

--------------------------------------------------
OUTPUT FORMAT (STRICT JSON)
--------------------------------------------------
Return a RAW JSON ARRAY. No markdown formatting. No code blocks.

[
  {
    "responseId": "<id>",
    "derivedSeverity": 0, // or 0.5 or 1
    "justification": "<one short sentence explaining why>"
  }
]

Justification must:
- Be factual
- Be neutral
- Avoid moral judgment

--------------------------------------------------
IMPORTANT DISCLAIMERS (MANDATORY)
--------------------------------------------------
Derived severity values are used exclusively to enable controlled inclusion of qualitative responses in the ERC model. They do not replace expert judgment.

--------------------------------------------------
FINAL RULE
--------------------------------------------------
If a response is unclear, default to severity = 0.5.
When in doubt, choose the MORE CONSERVATIVE interpretation.
`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro", // Use Pro for complex reasoning
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: 0.2, // Low temperature for deterministic/strict output
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    });

    const result = await model.generateContent(`Process the following ${answers.length} items:\n\n${itemsText}`);
    const responseText = result.response.text();

    console.log('🤖 Gemini Qualitative Analysis Complete');
    return JSON.parse(responseText);

  } catch (error) {
    console.error('❌ Gemini Qualitative Analysis Failed:', error.message);
    // Return empty array to allow graceful degradation (manual review required)
    return [];
  }
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  generateReport,
  generateReportNarrative: generateReport, // ALIAS to fix pdfReportService import
  testApiKey,
  analyzeQualitativeSeverity
};
