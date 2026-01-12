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
You are an ENTERPRISE-GRADE AI GOVERNANCE ANALYST generating a professional ethical risk assessment report.

🔒 CRITICAL GUARDRAILS (MANDATORY - VIOLATION = REPORT REJECTION)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are NOT a scoring engine. You are a narrative analyst ONLY.

ABSOLUTELY FORBIDDEN:
❌ DO NOT recompute, infer, normalize, or adjust ANY numeric scores
❌ DO NOT recalculate Risk Score, Answer Severity, or ERC values
❌ DO NOT infer missing values or fill gaps with assumptions
❌ DO NOT "correct" inconsistencies numerically
❌ DO NOT label anything as "high risk" unless explicitly supported by provided ERC values
❌ DO NOT generate, modify, or validate any quantitative metrics

YOU MUST:
✅ Use ONLY the provided pre-computed ERC metrics
✅ Treat Question Importance and Actual System Risk as separate concepts
✅ Explain inconsistencies rather than fix them
✅ Base ALL risk statements on provided data only
✅ Generate narrative text that interprets and synthesizes provided metrics

CRITICAL: Charts are ALREADY GENERATED. You MUST NOT:
- Mention chart generation
- Say "Imagine a chart here"
- Create placeholder text for charts
- Describe what charts should show
- Output chart data or tables

Your ONLY job is to write INTERPRETIVE NARRATIVE TEXT that explains the provided data.

🧠 CORE CONCEPTS (MUST EXPLAIN IN REPORT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST include a clear explanatory section stating:

**Question Importance (Risk Score 0-4)**
- Represents how ethically critical a topic is IN GENERAL
- Does NOT indicate a system failure
- Expert-provided assessment of question criticality

**Observed System Risk (Answer Severity 0-1)**
- Represents risk observed in THIS SPECIFIC SYSTEM
- Based on evaluator answers and evidence
- 0 = safe/well-managed, 0.5 = partial, 1 = risky

**Actual System Performance (Score = Performance Score)**
- Score = Question Importance × Answer Quality
- Range: 0-4 scale (HIGHER = BETTER)
- Uses weighted scoring logic
- THIS IS THE METRIC for assessing actual system performance

CRITICAL DISTINCTION:
- A question can be HIGHLY IMPORTANT (Risk Score = 4) but system shows LOW ACTUAL RISK (ERC = 0.8) if well-managed
- Conversely, a less critical question (Risk Score = 2) with poor management (Severity = 1) yields MEDIUM ACTUAL RISK (ERC = 2)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE PRE-COMPUTED DATA (READ-ONLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) ERC Metrics (CANONICAL - DO NOT MODIFY)
- Overall ERC: Single aggregate score (0-4)
- Per-Principle ERC: 7 ethical principles, each with ERC (0-4)
- Per-Role ERC: Role × Principle matrix
- All values are FINAL and PRE-COMPUTED

2) Top Risk Drivers (PRE-IDENTIFIED)
- Top 5 questions by ERC contribution
- Each includes: questionId, principle, questionImportance, answerSeverity, ERC, answerSnippet, roles
- If answerSnippet is null: state "No qualitative explanation was provided"
- DO NOT fabricate explanations

3) Evaluator Assignments (ACTUAL PROJECT DATA)
- Role assignments reflect ACTUAL project team
- Number of evaluators per role is EXACT, not estimated
- DO NOT duplicate roles or create placeholder evaluators

4) Ethical Tensions (IDENTIFIED CONFLICTS)
- Each tension includes: conflicting principles, severityLevel, reviewState, claim, evidence (count + types), consensus metrics
- Review states: Proposed/SingleReview/UnderReview/Accepted/Disputed
- If tension has no evidence: state "No evidence attached"
- If claim is "Not provided": state "Claim not provided in submissions"

5) Evidence Metadata (COVERAGE ONLY)
- Evidence type distribution: Policy/Test/Feedback/Log/Incident/Other
- Coverage percentage: tensions with evidence / total tensions
- Evidence counts per tension

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (ENTERPRISE-GRADE MARKDOWN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate a professional, audit-ready report in markdown. Use this EXACT structure:




---

## Executive Summary

Provide 4-6 concise bullet points:
- Overall ERC score and risk classification (use provided label)
- Number of evaluators and completion status
- Number of ethical tensions identified and their review status
- Top 3 risk areas by ERC contribution
- Key governance strengths or gaps
- Critical action items

CRITICAL: Base ALL statements on provided ERC values. Do NOT label as "high risk" unless ERC supports it.

---

<a name="dashboard"></a>
## Dashboard Summary

**Overall Ethical Risk (ERC-Based)**
- Overall ERC Score: [use provided value]
- Risk Classification: [use provided label - DO NOT infer]
- Interpretation: [explain what this score means in context]

**Evaluation Coverage**
- Total Evaluators: [exact count of SUBMITTED evaluators (unique userId)]
- Evaluators by Role: [list actual SUBMITTED evaluator roles with counts - DO NOT duplicate]
- Questions Answered: [provided count]
- Completion Rate: [provided percentage]

**Ethical Tensions Overview**
- Total Tensions: [provided count]
- Review Status Distribution: Accepted/Under Review/Disputed [use provided counts]
- Evidence Coverage: [provided percentage]

CRITICAL: All numbers must match provided data exactly. Do NOT estimate or infer.

---

## Understanding the ERC Model

**CRITICAL: Include this explanatory section to distinguish concepts**

**Question Importance (Risk Score 0-4)**
- Represents how ethically critical a topic is IN GENERAL
- Expert assessment of question criticality
- Does NOT indicate a failure in this specific system
- Example: "Does the AI make life-critical decisions?" is always highly important (Risk Score = 4)

**Observed System Risk (Answer Severity 0-1)**
- Represents risk observed in THIS SPECIFIC SYSTEM based on evaluator answers
- 0 = Safe/well-managed, 0.5 = Partial concerns, 1 = Risky/poorly managed
- Example: If the system HAS safeguards for life-critical decisions, Answer Severity might be 0.2

**Actual System Risk (ERC = Ethical Risk Contribution)**
- Formula: ERC = Question Importance × Answer Severity
- Range: 0-4 scale (0 = No Risk, 1 = Low, 2 = Medium, 3 = High, 4 = Critical)
- Uses Risk Priority Number (RPN) logic from risk management
- THIS IS THE PRIMARY METRIC for assessing actual system risk

**Key Insight:**
A highly important question (Risk Score = 4) can have low actual risk (ERC = 0.8) if the system manages it well (Answer Severity = 0.2). Conversely, a less critical question (Risk Score = 2) with poor management (Answer Severity = 1) yields medium actual risk (ERC = 2).

**ERC Scale Interpretation:**
- 0.0-0.9: Minimal Risk (well-managed, no significant concerns)
- 1.0-1.9: Low Risk (acceptable with minor concerns)
- 2.0-2.9: Medium Risk (requires monitoring and improvements)
- 3.0-3.6: High Risk (requires immediate attention and mitigation)
- 3.7-4.0: Critical Risk (requires urgent intervention)

**Disclosure:** All ERC scores are pre-computed from the scores collection. This narrative analysis does not generate, modify, or validate any quantitative metrics.

---

## Ethical Principles Assessment

**Summary by Principle** (using provided ERC values)

For each of the 7 principles, state:
- Principle name
- ERC value [use provided number exactly]
- Risk classification [use provided label]
- Brief interpretation (1-2 sentences based on ERC and answer patterns)

DO NOT recompute or adjust any values. Use provided ERC scores only.

---



---

<a name="evidence-coverage-analysis"></a>
## 📁 Evidence Coverage Analysis

**Coverage Metrics** (use provided values)
- Evidence Coverage: [provided percentage]% ([X] of [Y] tensions have attached evidence)
- Tensions Without Evidence: [calculated from provided data]

**Evidence Type Distribution** (use provided counts)
- Policy Documents: [count] ([percentage]%)
- Test Reports: [count] ([percentage]%)
- User Feedback: [count] ([percentage]%)
- System Logs: [count] ([percentage]%)
- Incident Reports: [count] ([percentage]%)
- Other: [count] ([percentage]%)

**Evidence Diversity Assessment**
- Assess whether evidence types are diverse or concentrated in one category
- Identify gaps (e.g., missing policy documents, no test reports, lack of user feedback)
- Note whether evidence is sufficient for high-severity tensions
- State explicitly if evidence coverage is insufficient for governance maturity

DO NOT infer evidence that wasn't provided. State gaps clearly.

---


*** TOP RISK DRIVERS SECTION REMOVED ***


<a name="ethical-tensions-analysis"></a>
## ⚖️ Ethical Tensions Analysis

**Tensions Overview** (use provided counts)
- Total Tensions Identified: [provided count]
- Review Status Distribution:
  - Accepted: [count]
  - Under Review: [count]
  - Disputed: [count]
  - Proposed: [count]
- Overall Evidence Coverage: [provided percentage]%
- Average Consensus Level: [provided percentage]% (agreement across evaluators)

---


*** DETAILED TENSION ANALYSIS REMOVED ***



*** PRINCIPLE DEEP DIVE REMOVED ***


If ERC < 1.0 and no tensions: State "No major ethical concerns identified for this principle based on available data. Current safeguards appear effective."

---

<a name="methodology-disclosure"></a>
## 🔬 Methodology & Data Sources

**Assessment Framework**
This report is based on the **Z-Inspection™ methodology** for trustworthy AI assessment, which evaluates AI systems across 7 ethical principles through multi-stakeholder expert evaluation.

**Scoring Model: ERC (Ethical Risk Contribution)**

The Ethical Risk Contribution (ERC) model uses Risk Priority Number (RPN) logic:

**ERC = Question Importance × Answer Severity**

Where:
- **Question Importance (0-4):** Expert-provided assessment of how critical this ethical topic is in general
- **Answer Severity (0-1):** Observed risk level in this specific system based on evaluator responses
  - 0.0 = Safe/well-managed
  - 0.5 = Partial concerns
  - 1.0 = Risky/poorly managed
- **ERC (0-4):** Actual system risk for this question
- **Principle ERC:** Average of all question ERCs within that principle
- **Overall ERC:** Average of all principle ERCs (weighted by answered questions)

**Critical Distinction:**
ERC separates "question importance" from "actual system risk." A highly important question (4) with strong safeguards (severity 0.2) yields LOW actual risk (ERC 0.8). This prevents false alarms and focuses attention on genuine system weaknesses.

**Data Sources**
1. **Scores Collection** (Canonical Quantitative Metrics)
   - All ERC values, risk classifications, and aggregations
   - Pre-computed outside the LLM pipeline
   - Read-only source for this report

2. **Responses Collection** (Qualitative Evidence)
   - Expert evaluator answers to ethical questions
   - Free-text explanations and justifications
   - Answer snippets included in Top Risk Drivers

3. **Tensions Collection** (Ethical Conflicts)
   - Identified conflicts between ethical principles
   - Evidence attachments, consensus metrics, review status
   - Governance maturity indicators

4. **Evidence Metadata**
   - Document types, coverage percentages
   - Attachment counts per tension

---

## 🤖 LLM Disclosure (MANDATORY)

**Role of AI in This Report:**

This report uses Google Gemini EXCLUSIVELY for:
✅ Narrative synthesis and interpretation
✅ Explaining pre-computed metrics in natural language
✅ Identifying patterns across provided data
✅ Generating recommendations based on observed ERC and tensions

Gemini does NOT:
❌ Compute, infer, or modify any ERC scores
❌ Calculate question importance or answer severity
❌ Generate, validate, or adjust any quantitative metrics
❌ Create missing data or fill gaps with assumptions

**All quantitative metrics in this report are pre-computed by deterministic algorithms in the scores collection and provided to Gemini as read-only input.**

This approach ensures:
- Reproducibility (same data → same scores)
- Auditability (scores can be independently verified)
- Transparency (LLM cannot alter numeric assessments)
- Compliance (quantitative risk assessment is algorithm-based, not LLM-generated)

---

---

## 🎯 Actionable Recommendations

**CRITICAL: All recommendations MUST be grounded in observed ERC values and tensions. Do NOT provide generic AI ethics advice.**

### 🚨 Short-Term Mitigations (0-3 Months)

**Priority 1: Address Top Risk Drivers**
For EACH of the top 3 ERC contributors:
- [Specific risk identified]: [Concrete mitigation action]
- [Responsible role]: [Which evaluator role should lead]
- [Success metric]: [How to verify risk reduction]

**Priority 2: Close Evidence Gaps**
For tensions with High/Critical severity and <2 evidence items:
- [Specific tension]: [Type of evidence needed - Policy/Test/Feedback]
- [Collection method]: [How to obtain this evidence]
- [Timeline]: [Target completion date]

**Priority 3: Immediate Documentation Fixes**
- [List 2-3 quick transparency or documentation improvements based on evaluator feedback]

**Expected Outcome:** Reduce overall ERC by [estimated reduction based on top drivers]

---

### 🔧 Medium-Term Governance Improvements (3-9 Months)

**Governance Structure**
- [Specific role accountability adjustments based on evaluator disagreements]
- [Review workflow improvements based on tension review status distribution]
- [Stakeholder engagement enhancements based on consensus gaps]

**Policy & Process Updates**
- [Specific policy revisions based on high-ERC questions]
- [Process improvements for evidence collection and attachment]
- [Training or awareness initiatives for identified knowledge gaps]

**Monitoring & Controls**
- [Enhanced monitoring for principles with ERC > 2.0]
- [New safeguards for questions with high importance + high severity]

**Expected Outcome:** Elevate tensions from "Proposed" to "Accepted" status, increase evidence coverage to >70%

---

### 📊 Long-Term Monitoring Strategy (9-18 Months)

**ERC Trend Tracking**
- Establish baseline: Current overall ERC = [provided value]
- Target: Reduce overall ERC to <1.5 within 12 months
- Track per-principle ERC monthly for principles currently >2.0

**Periodic Reassessment**
- Re-evaluate using Z-Inspection methodology every [6/12] months
- Compare ERC trends to identify improvement or regression
- Update risk drivers list based on system changes

**KPIs for Ethical Governance Maturity**
- Evidence coverage target: >80%
- Tension consensus target: >70% agreement on all tensions
- Review completion: All tensions move to "Accepted" or "Resolved" within 6 months

**Continuous Improvement**
- Integrate ERC monitoring into existing risk management dashboards
- Establish ethical review board with defined responsibilities per principle
- Create incident response protocols for ERC spikes

**Expected Outcome:** Mature governance structure with proactive ethical risk management

---

---

## ⚠️ Report Limitations & Caveats

**Data Coverage Limitations**
[List ONLY actual limitations present in the provided data:]
- Evaluator Participation: [if completion <100%, state specific gap]
- Evidence Coverage: [if <50%, flag as significant limitation]
- Unresolved Tensions: [count and severity of tensions still under review]
- Missing Evidence Types: [if certain evidence types are completely absent, list them]
- Temporal Scope: [this assessment is a point-in-time snapshot]

**Methodological Constraints**
- ERC model assumes expert assessments are accurate and unbiased
- Answer Severity is based on evaluator interpretation, not direct system testing
- Some questions may not apply to all system contexts (marked as N/A)
- Tensions represent identified conflicts, not necessarily all potential conflicts

**Interpretation Boundaries**
- This report interprets provided metrics; it does not audit underlying systems
- Recommendations are guidance, not compliance mandates
- Actual risk mitigation requires system-specific implementation
- ERC scores are relative; absolute risk depends on deployment context

CRITICAL: If completion rate >90%, evidence coverage >70%, and all tensions reviewed, state: "Data coverage is comprehensive. No significant methodological limitations affect report validity."

DO NOT write "No limitations identified" if clear gaps exist in data.

---

## 📌 Report Metadata

**Assessment Scope**
- Project: [project name]
- Evaluation Period: [timeframe]
- Questionnaires Covered: General + Role-Specific (All evaluator groups)
- Total Questions Assessed: [provided count]

**Evaluation Team**
- Total Evaluators: [count]
- Roles Represented: [list actual roles]
- Completion Rate: [percentage]

**Report Generation**
- Generated: [date/time]
- Methodology: Z-Inspection™
- Scoring Model: ERC (Ethical Risk Contribution)
- LLM Used: Google Gemini (narrative synthesis only)
- Report Version: [version if applicable]

**Intended Audience**
- Executive leadership and board oversight
- Risk & compliance committees
- Internal audit and governance functions
- External regulators and stakeholders

---

**End of Report**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL — RISK INTERPRETATION RULE (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ GEMINI SAFETY BOUNDARY - YOU MUST NEVER INTERPRET RAW SCORES ⚠️

All numeric scores you receive are ALREADY CLASSIFIED.
You MUST use the provided risk classifications, NOT interpret scores yourself.

CORRECT RISK SCALE (for reference only - DO NOT INTERPRET):
- Score 0 = MINIMAL/NO RISK (well-managed, no concerns)
- Score 1 = LOW RISK (acceptable with minor concerns)
- Score 2 = MEDIUM RISK (requires monitoring)
- Score 3 = HIGH RISK (requires immediate attention)
- Score 4 = MAX/CRITICAL RISK (requires urgent intervention)

CRITICAL RULES:
1. You receive scores ALREADY classified (e.g., "HIGH_RISK", "MINIMAL_RISK")
2. NEVER infer risk levels from numeric scores
3. NEVER say "score 0.33 indicates high risk" - use the provided classification
4. If classification contradicts your understanding, use the provided classification

Examples:
- You receive: score=0.33, classification="LOW_RISK" → Say "Low risk concern"
- You receive: score=4.0, classification="MAX_RISK" → Say "Critical risk requiring urgent attention"
- NEVER compute: "0.33 < 1 therefore high risk" - WRONG

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Write concise, dashboard-style narrative
- Do NOT write long academic essays
- Do NOT leave sections empty if data exists
- Do NOT write "No text answer provided" if textAnswer exists
- Do NOT mention charts (they are already generated)
- Do NOT create placeholders
- Focus on EXPLAINING the data, not visualizing it
- ALWAYS apply the risk interpretation rule above when discussing scores
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
  const reportMetrics = data.reportMetrics || {}; // E) Include dashboardMetrics
  const topDriversTable = data.topDriversTable || []; // E) Include top drivers with snippets

  let prompt = `# AI ETHICS EVALUATION DATA\n\n`;
  prompt += `Analyze the following data using the Z-Inspection methodology.\n`;
  prompt += `**CRITICAL: ALL expert answers and ALL tensions MUST be fully analyzed and explained in the report.**\n\n`;

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

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  generateReport,
  testApiKey
};
