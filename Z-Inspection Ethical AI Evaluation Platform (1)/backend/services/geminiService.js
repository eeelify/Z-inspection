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
You are an expert AI Ethics Evaluator and Auditor specializing in the Z-Inspection methodology.
Your task is to analyze raw AI ethics assessment data and generate a comprehensive, professional,
and actionable evaluation report for stakeholders. This report will be converted to PDF format.

CRITICAL REQUIREMENTS (NON-NEGOTIABLE):
1. ALL expert answers MUST be referenced in the report. If a textAnswer exists, you MUST quote or reference it explicitly.
2. ALL ethical tensions MUST be explained with:
   - WHY each tension exists (link to expert answers that triggered it)
   - Severity analysis (low/medium/high/critical)
   - Evidence, votes, and mitigation strategies
   - NO tension may appear without explanation
3. HIGH-RISK BEHAVIOR REQUIREMENTS:
   - If a question has score < 3 OR a related tension severity ≥ High, you MUST generate detailed narrative explanation
   - High-risk scores and strong negative expert statements CANNOT result in empty or neutral narratives
   - Empty principle sections are NOT allowed if data exists
4. Principle-by-Principle Analysis:
   - For each ethical principle, aggregate ALL related answers (from all sources)
   - Include risk interpretation, concrete concerns, ethical trade-offs, and missing safeguards
   - Empty sections are NOT allowed if data exists for that principle

Requirements:
- Clear structure and headings (use # for main title, ## for sections, ### for subsections)
- Evidence-based analysis
- Identification of risks and strengths
- Actionable recommendations
- Professional Markdown formatting suitable for PDF conversion
- Clear and professional English
- Use proper Markdown syntax: **bold**, *italic*, lists (- or 1.), tables, code blocks
- Structure the report with clear sections that will render well in PDF format
- Include page-break considerations in your structure
- "No text answer provided" should ONLY appear if the expert truly gave no text answer
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
  const unifiedAnswers = data.unifiedAnswers || [];
  const tensions = data.tensions || [];
  const evaluations = data.evaluations || [];

  let prompt = `# AI ETHICS EVALUATION DATA\n\n`;
  prompt += `Analyze the following data using the Z-Inspection methodology.\n`;
  prompt += `**CRITICAL: ALL expert answers and ALL tensions MUST be fully analyzed and explained in the report.**\n\n`;

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

  /* UNIFIED EXPERT ANSWERS (from both responses and generalquestionanswers) */
  prompt += `## ALL EXPERT ANSWERS (UNIFIED FROM ALL SOURCES)\n`;
  if (unifiedAnswers.length === 0) {
    prompt += `No expert answers available.\n\n`;
  } else {
    prompt += `**Total Answers:** ${unifiedAnswers.length}\n\n`;
    
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
        prompt += `- **Questionnaire:** ${answer.questionnaireKey || 'N/A'}\n`;
        if (answer.selectedOption) {
          prompt += `- **Selected Option:** ${answer.selectedOption}\n`;
        }
        if (answer.score !== null && answer.score !== undefined) {
          prompt += `- **Risk Score:** ${answer.score} / 4 (${answer.score < 2 ? 'HIGH RISK' : answer.score < 3 ? 'MEDIUM-HIGH RISK' : 'LOWER RISK'})\n`;
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

  /* TENSIONS (FULL DETAILS) */
  prompt += `## ETHICAL TENSIONS (FULL DETAILS)\n`;
  if (tensions.length === 0) {
    prompt += `No ethical tensions identified.\n\n`;
  } else {
    prompt += `**Total Tensions:** ${tensions.length}\n\n`;
    tensions.forEach((t, i) => {
      prompt += `### Tension ${i + 1}: ${t.principle1 || 'Unknown'} vs ${t.principle2 || 'Unknown'}\n`;
      prompt += `- **Tension ID:** ${t._id || 'N/A'}\n`;
      prompt += `- **Claim Statement:** ${t.claimStatement || 'N/A'}\n`;
      prompt += `- **Description:** ${t.description || 'No additional description'}\n`;
      prompt += `- **Severity:** ${t.severity || 'Not specified'} ${t.severity && (t.severity.toLowerCase().includes('high') || t.severity.toLowerCase().includes('critical')) ? '⚠️ REQUIRES DETAILED ANALYSIS' : ''}\n`;
      prompt += `- **Status/Review State:** ${t.status || 'ongoing'}\n`;
      prompt += `- **Created By:** ${t.createdBy || 'N/A'}\n`;
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
      }
      
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
   - If ANY question has score < 3 OR a related tension has severity ≥ High, you MUST generate a detailed narrative explanation
   - High-risk scores and strong negative expert statements CANNOT result in empty or neutral narratives
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

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  generateReport,
  testApiKey
};
