# Risk Scale Migration

## Overview

This migration converts question scale labels from a **quality-based** scale to a **risk-based** scale.

### Old Scale (Quality-based)
- **4** = Excellent / Mükemmel
- **3** = Good / İyi
- **2** = Moderate / Orta
- **1** = Poor / Zayıf
- **0** = Unacceptable / Kabul Edilemez

### New Scale (Risk-based)
- **4** = High risk / Yüksek risk (highest risk, immediate mitigation required)
- **3** = Medium–High risk / Orta–yüksek risk (meaningful risk, mitigation before deployment)
- **2** = Medium risk / Orta risk (some risk, monitor and improve)
- **1** = Low risk / Düşük risk (minor risk, acceptable with basic controls)
- **0** = No / Negligible risk / Risk yok / ihmal edilebilir (no meaningful ethical risk)

## Important Notes

**Currently, scale labels are hardcoded in the frontend UI components:**
- `frontend/src/components/GeneralQuestions.tsx`
- `frontend/src/components/EvaluationForm.tsx`

**The database migration script (`migrateRiskScaleLabels.js`) is provided for future-proofing** in case scale options are stored in the database in the future.

## What Was Changed

### 1. UI Components
- ✅ Updated `GeneralQuestions.tsx` with new risk-based labels
- ✅ Updated `EvaluationForm.tsx` with new risk-based labels
- ✅ Inverted color scheme: 4 = red (high risk), 0 = green (no risk)
- ✅ Added Turkish translations for all labels and descriptions

### 2. Backend Services
- ✅ Updated `riskLabel.js` function to use new interpretation (0 = lowest risk, 4 = highest risk)
- ✅ Updated all Gemini prompts to explicitly state: "Risk scores are 0–4 where 4 is highest risk and 0 is lowest risk"
- ✅ Updated chart legends and report templates
- ✅ Updated all documentation strings

### 3. Tests
- ✅ Added unit tests in `backend/tests/riskLabel.test.js`
- ✅ Tests verify: `label(4)` returns "Critical", `label(0)` returns "Low"

## Running the Migration

**Note:** The migration script is optional since scale labels are currently hardcoded in UI.

If you need to run it (for future-proofing):

```bash
cd backend
node migrations/migrateRiskScaleLabels.js
```

## Verification

After migration, verify:
1. ✅ UI shows risk-based labels (4 = High risk, 0 = No risk)
2. ✅ Colors are inverted (4 = red, 0 = green)
3. ✅ Reports show "Scale 0–4 (0 = lowest risk, 4 = highest risk)"
4. ✅ Gemini prompts explicitly state the risk interpretation
5. ✅ Unit tests pass: `npm test -- riskLabel.test.js`

## Rollback

If you need to rollback:
1. Revert changes to `GeneralQuestions.tsx` and `EvaluationForm.tsx`
2. Revert `backend/utils/riskLabel.js` to old interpretation
3. Revert Gemini prompts
4. Revert chart legends

## Consistency Checks

The system now enforces:
- **Risk scores are 0–4 where 4 is highest risk and 0 is lowest risk**
- **Higher score = Higher risk**
- All UI components, reports, and prompts use this interpretation consistently


