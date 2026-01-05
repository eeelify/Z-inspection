# Enterprise-Grade Report Prompt - Gemini System Instructions Update

## Overview
Updated Gemini system instructions to generate professional, enterprise-grade ethical assessment reports with strict guardrails against score computation and clear separation of concerns.

## Key Changes

### 1. 🔒 Hard Guardrails (Mandatory)

**Added strict prohibitions:**
```
ABSOLUTELY FORBIDDEN:
❌ DO NOT recompute, infer, normalize, or adjust ANY numeric scores
❌ DO NOT recalculate Risk Score, Answer Severity, or ERC values
❌ DO NOT infer missing values or fill gaps with assumptions
❌ DO NOT "correct" inconsistencies numerically
❌ DO NOT label anything as "high risk" unless explicitly supported by provided ERC values
❌ DO NOT generate, modify, or validate any quantitative metrics
```

**Purpose:** Prevent Gemini from acting as a scoring engine. It must ONLY interpret provided data.

### 2. 🧠 Core Concepts Explanation (Mandatory Section)

**Added requirement to explain:**
- **Question Importance (Risk Score 0-4):** How critical a topic is in general (does NOT indicate system failure)
- **Observed System Risk (Answer Severity 0-1):** Risk observed in THIS specific system
- **Actual System Risk (ERC):** Question Importance × Answer Severity (the PRIMARY metric)

**Key Insight Section:**
Explains why high importance + good management = low ERC, preventing false alarms.

### 3. 📊 Required Visualizations (All Must Be Included)

**Explicitly listed:**
1. **Ethical Principle Bar Chart** (7 principles, ERC 0-4)
2. **Role × Principle Heatmap** (actual assignments only, no duplicates)
3. **Evidence Coverage Donut** (Policy/Test/Feedback/None with %)
4. **Tensions Table** (Conflict/Severity/Evidence/Consensus/Review State)

Charts are pre-generated; Gemini must NOT describe or mention chart generation.

### 4. ⚠️ Enhanced Risk Analysis

**Top Risk Drivers Section:**
- Top 5 questions by ERC
- For EACH: Question Importance, Answer Severity, ERC, Answer Snippet
- **Risk Source Analysis:** Explicitly state if risk comes from:
  - High question importance (critical topic)
  - Observed system weakness
  - Both factors

**Purpose:** Distinguish between "important questions" and "actual system problems."

### 5. 🔍 Tension Maturity Framework

**Three-dimensional assessment for EACH tension:**
1. **Evidence Presence:** High/Medium/Low (based on count and diversity)
2. **Consensus Level:** High/Medium/Low (based on agreement %)
3. **Review Status:** Active/Stalled (based on review state)

**High-Priority Flag:**
Tensions with: High severity + Low evidence + Low consensus = **GOVERNANCE MATURITY GAPS**

### 6. 🎯 Actionable Recommendations (Grounded in Data)

**Three tiers with specific requirements:**

**Short-Term (0-3 months):**
- Address top 3 ERC drivers (specific actions per driver)
- Close evidence gaps (specific tensions needing evidence)
- Immediate documentation fixes

**Medium-Term (3-9 months):**
- Governance structure adjustments
- Policy updates based on high-ERC questions
- Enhanced monitoring for principles with ERC > 2.0

**Long-Term (9-18 months):**
- ERC trend tracking with specific targets
- Periodic reassessment schedule
- KPIs for ethical governance maturity

**Critical Rule:** Recommendations MUST be grounded in observed ERC and tensions. NO generic AI ethics advice.

### 7. 🤖 LLM Disclosure (Mandatory)

**Added explicit disclosure section:**

**Gemini is used for:**
✅ Narrative synthesis and interpretation
✅ Explaining pre-computed metrics
✅ Identifying patterns
✅ Generating recommendations

**Gemini does NOT:**
❌ Compute, infer, or modify any ERC scores
❌ Calculate question importance or answer severity
❌ Generate or validate quantitative metrics
❌ Create missing data

**Purpose:** Transparency for compliance, auditability, and regulatory requirements.

### 8. 🧭 Enhanced Navigation

**Added quick navigation section:**
```
[Dashboard] | [Key Risks] | [Ethical Tensions] | [Evidence Coverage] | [Methodology]
```

All sections have anchor tags for internal PDF linking.

### 9. ⚠️ Report Limitations & Caveats

**Added structured limitations section:**
- Data coverage limitations (participation gaps, evidence gaps)
- Methodological constraints (ERC assumptions, evaluation boundaries)
- Interpretation boundaries (point-in-time assessment, context-specific)

**Rule:** If data is comprehensive (>90% completion, >70% evidence), state explicitly. Do NOT fabricate limitations.

### 10. 📌 Report Metadata

**Added standard metadata section:**
- Assessment scope (project, period, questionnaires)
- Evaluation team (counts, roles, completion rate)
- Report generation (date, methodology, LLM used)
- Intended audience (executives, compliance, audit, regulators)

## Report Structure

### Complete Report Outline:

1. **🧭 Quick Navigation**
2. **📋 Executive Summary** (4-6 bullets, ERC-based)
3. **📊 Dashboard Summary** (Overall ERC, evaluators, tensions)
4. **🧠 Understanding the ERC Model** (mandatory explanation)
5. **📈 Ethical Principles Assessment** (7 principles with ERC)
6. **🔥 Role × Principle Heatmap Interpretation**
7. **📁 Evidence Coverage Analysis** (types, gaps, diversity)
8. **⚠️ Top Risk Drivers** (top 5 questions, risk source analysis)
9. **⚖️ Ethical Tensions Analysis** (maturity framework, high-priority flags)
10. **📋 Individual Tension Details** (each tension with maturity assessment)
11. **🎯 Principle-by-Principle Deep Dive** (7 principles)
12. **🎯 Actionable Recommendations** (3 tiers, data-grounded)
13. **⚠️ Report Limitations & Caveats**
14. **🔬 Methodology & Data Sources** (Z-Inspection, ERC model)
15. **🤖 LLM Disclosure** (Gemini role and boundaries)
16. **📌 Report Metadata**

## Key Improvements

### Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Guardrails** | Basic ("don't recompute") | Explicit list of forbidden actions |
| **ERC Explanation** | Brief mention | Full explanatory section with examples |
| **Risk Analysis** | Generic top drivers | Risk source analysis (importance vs. weakness) |
| **Tensions** | Basic list | Maturity framework (evidence/consensus/review) |
| **Recommendations** | Generic | 3-tier, data-grounded, specific actions |
| **LLM Disclosure** | None | Explicit transparency section |
| **Tone** | Technical | Enterprise-grade, audit-ready |

### Compliance & Auditability

**This prompt ensures:**
1. ✅ **Reproducibility:** Same data → same narrative (LLM doesn't change scores)
2. ✅ **Auditability:** All quantitative claims traceable to provided data
3. ✅ **Transparency:** Clear disclosure of LLM role and limitations
4. ✅ **Regulatory Compliance:** Suitable for external governance review
5. ✅ **Executive Readability:** Professional tone, clear structure, actionable insights

## Testing & Validation

### How to Verify Report Quality

**Check for guardrail compliance:**
- [ ] No recomputed ERC values
- [ ] No inferred missing data
- [ ] All risk statements reference provided ERC values
- [ ] Distinction between question importance and actual risk is clear

**Check for completeness:**
- [ ] All 7 principles covered
- [ ] Top 5 risk drivers analyzed with risk source analysis
- [ ] All tensions have maturity assessment
- [ ] 3-tier recommendations present and data-grounded
- [ ] LLM disclosure section included

**Check for professionalism:**
- [ ] Audit-ready tone (not alarmist, not dismissive)
- [ ] Consistent terminology throughout
- [ ] Clear navigation with anchor links
- [ ] Limitations stated honestly (no fabrication)

## Impact

**For Executives:**
- Clear, actionable insights grounded in data
- Risk priority clearly communicated (ERC-based)
- Governance maturity gaps explicitly flagged

**For Compliance:**
- Transparent methodology (LLM role disclosed)
- Auditable (all numbers traceable to source)
- Reproducible (deterministic scoring outside LLM)

**For Technical Teams:**
- Specific actions per risk driver
- Evidence gaps clearly identified
- Short/medium/long-term roadmap

**For Regulators:**
- Professional, standards-compliant format
- Clear separation of quantitative (algorithm) and qualitative (LLM) analysis
- Honest limitations disclosure

## Files Modified

- **`backend/services/geminiService.js`** (Lines 104-317)
  - Updated `systemInstruction` with enterprise-grade prompt
  - Added 🔒 hard guardrails
  - Added 🧠 core concepts explanation requirement
  - Added structured sections for all report components
  - Added mandatory LLM disclosure

## Conclusion

This prompt transformation elevates the ethical assessment report from a technical document to an **enterprise-grade governance artifact** suitable for:
- Board presentations
- Regulatory submissions
- External audits
- Compliance reviews
- Executive decision-making

The strict guardrails ensure Gemini operates as a **narrative analyst**, not a scoring engine, maintaining the integrity and auditability of the quantitative risk assessment.

