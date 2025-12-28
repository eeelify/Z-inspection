const path = require('path');
// Load env vars:
// - Prefer `backend/.env`
// - Fallback to `backend/env` (Windows dotfile quirks)
const dotenv = require('dotenv');
const envPathDot = path.resolve(__dirname, '../.env');
const envPathNoDot = path.resolve(__dirname, '../env');
const dotResult = dotenv.config({ path: envPathDot });
if (dotResult.error) {
  const noDotResult = dotenv.config({ path: envPathNoDot });
  if (noDotResult.error) {
    console.warn(`⚠️  dotenv could not load ${envPathDot} or ${envPathNoDot}:`, noDotResult.error.message);
  }
}

const { GoogleGenerativeAI } = require("@google/generative-ai");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
/* ============================================================
   1. API KEY KONTROLÜ
============================================================ */



if (!GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY environment variable bulunamadı!");
}

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
    // Prefer 2.5, fallback to 1.5 if 2.5 isn't available for this API key/project
    { id: "gemini-2.5-flash", names: ["models/gemini-2.5-flash", "gemini-2.5-flash"] },
    { id: "gemini-1.5-flash", names: ["models/gemini-1.5-flash", "gemini-1.5-flash"] }
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

  // ============================================================
  // SYSTEM INSTRUCTION (DRAFT-ONLY)
  // Gemini MUST ONLY produce an initial, non-authoritative ethical draft.
  // ============================================================
  const systemInstruction = `
You are an assistant that drafts an INITIAL, NON-AUTHORITATIVE ethical analysis for the Z-Inspection methodology.
You are NOT a decision-maker. You must NOT issue final judgments, approvals, risk levels, severity rankings, or "stop/pause the project" recommendations.
Your text must be neutral, conditional, and explicitly revisable by human experts.
If information is missing or insufficient, you must clearly say so and ask open questions.

MANDATORY OUTPUT FORMAT (repeat this block for EACH SECTION):

SECTION_KEY: <Z-Inspection principle>

AI_DRAFT_TEXT:
<neutral description based only on available inputs; highlight missing info; use conditional language>

POTENTIAL_ETHICAL_CONCERNS:
- <possible concern 1 (no severity / ranking / conclusion)>
- <possible concern 2>

OPEN_QUESTIONS_FOR_EXPERTS:
- <question 1 requiring human ethical judgement>
- <question 2>

Rules:
- Use ONLY the exact labels: SECTION_KEY, AI_DRAFT_TEXT, POTENTIAL_ETHICAL_CONCERNS, OPEN_QUESTIONS_FOR_EXPERTS
- Do NOT add extra sections like Executive Summary / Recommendations.
- Do NOT invent facts. If unknown, say "Insufficient information" and ask.
`;

  // Try 2.5 first, fallback to 1.5 if 2.5 isn't available for this API key/project
  const modelNamesToTry = [
    "models/gemini-2.5-flash",
    "gemini-2.5-flash",
    "models/gemini-1.5-flash",
    "gemini-1.5-flash"
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
    if (lastError.message.includes("403")) {
      throw new Error("❌ Gemini API Key geçersiz veya yetkisiz.");
    }

    if (lastError.message.includes("429")) {
      throw new Error("❌ Gemini API quota aşıldı.");
    }

    if (lastError.message.includes("404") || lastError.message.includes("not found")) {
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
      prompt += `### Evaluator ${i + 1}${s.role ? ` (${s.role})` : ""}\n`;
      prompt += `Average Score: ${s.totals?.avg?.toFixed(2) || "N/A"} / 4.0\n`;

      if (s.byPrinciple) {
        Object.entries(s.byPrinciple).forEach(([p, v]) => {
          if (v?.avg !== undefined) {
            prompt += `- ${p}: ${v.avg.toFixed(2)} / 4.0\n`;
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
      prompt += `- Status: ${t.status}\n\n`;
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

  /* OUTPUT INSTRUCTIONS (DRAFT-ONLY, SECTION-BASED) */
  prompt += `
---
OUTPUT REQUIREMENTS:
- Produce EXACTLY 7 sections, one per Z-Inspection principle, in this order:
  1) TRANSPARENCY
  2) HUMAN AGENCY & OVERSIGHT
  3) TECHNICAL ROBUSTNESS & SAFETY
  4) PRIVACY & DATA GOVERNANCE
  5) DIVERSITY, NON-DISCRIMINATION & FAIRNESS
  6) SOCIETAL & INTERPERSONAL WELL-BEING
  7) ACCOUNTABILITY
- Use the mandatory labels described in the system instruction.
- Keep language neutral and conditional. Do NOT finalize or recommend stopping the project.
`;

  return prompt;
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  generateReport,
  testApiKey
};
