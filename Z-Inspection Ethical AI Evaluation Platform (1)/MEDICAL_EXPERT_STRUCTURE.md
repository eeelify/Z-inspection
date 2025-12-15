# Medical Expert Structure - Verification

## ✅ Yapı Doğrulandı

Medical expert için sistem doğru şekilde yapılandırılmış:

### 📋 Questionnaires

1. **general-v1** - General Questions v1
   - Tüm expert'ler için genel sorular
   - 12 soru

2. **medical-expert-v1** - Medical Expert Questions v1
   - Sadece medical expert'ler için özel sorular
   - 25 soru

### 📝 Questions

**general-v1 Questions (12 adet):**
- T1, T2 (TRANSPARENCY)
- H1, H2 (HUMAN AGENCY & OVERSIGHT)
- S1 (TECHNICAL ROBUSTNESS & SAFETY)
- P1, P2 (PRIVACY & DATA GOVERNANCE)
- F1 (DIVERSITY, NON-DISCRIMINATION & FAIRNESS)
- W1, W2 (SOCIETAL & INTERPERSONAL WELL-BEING)
- A1, A2 (ACCOUNTABILITY)

**medical-expert-v1 Questions (25 adet):**
- S3, S4, S5, S6, S7, S8, S9 (TECHNICAL ROBUSTNESS & SAFETY)
- H11, H12, H13, H14, H15, H16, H17 (HUMAN AGENCY & OVERSIGHT)
- T10, T11 (TRANSPARENCY)
- F4, F5 (DIVERSITY, NON-DISCRIMINATION & FAIRNESS)
- W9 (SOCIETAL & INTERPERSONAL WELL-BEING)
- P5, P6, P7 (PRIVACY & DATA GOVERNANCE)
- A13, A14, A15 (ACCOUNTABILITY)

### 💾 Responses

Medical expert soruları cevaplandığında:

1. **general-v1 responses** collection'ına kaydedilir
   - Sadece genel soruların cevapları (T1, T2, H1, H2, vb.)
   - `questionnaireKey: "general-v1"`

2. **medical-expert-v1 responses** collection'ına kaydedilir
   - Sadece medical expert sorularının cevapları (S3, S4, H11, vb.)
   - `questionnaireKey: "medical-expert-v1"`

**Örnek Response Yapısı:**
```javascript
// general-v1 response
{
  projectId: ObjectId("..."),
  userId: ObjectId("..."),
  role: "medical-expert",
  questionnaireKey: "general-v1",
  questionnaireVersion: 1,
  answers: [
    { questionCode: "T1", answer: { choiceKey: "very_clear" }, score: 4 },
    { questionCode: "H1", answer: { choiceKey: "yes" }, score: 4 },
    // ... diğer genel sorular
  ],
  status: "submitted"
}

// medical-expert-v1 response
{
  projectId: ObjectId("..."),
  userId: ObjectId("..."),
  role: "medical-expert",
  questionnaireKey: "medical-expert-v1",
  questionnaireVersion: 1,
  answers: [
    { questionCode: "S3", answer: { text: "..." }, score: 3 },
    { questionCode: "H11", answer: { choiceKey: "high_risk" }, score: 1 },
    // ... diğer medical sorular
  ],
  status: "submitted"
}
```

### 📊 Scores

Medical expert cevapları kaydedildikten sonra:

1. **general-v1 scores** collection'ına kaydedilir
   - Genel soruların puanları
   - `questionnaireKey: "general-v1"`

2. **medical-expert-v1 scores** collection'ına kaydedilir
   - Medical expert sorularının puanları
   - `questionnaireKey: "medical-expert-v1"`

**Örnek Score Yapısı:**
```javascript
// general-v1 score
{
  projectId: ObjectId("..."),
  userId: ObjectId("..."),
  role: "medical-expert",
  questionnaireKey: "general-v1",
  totals: { avg: 3.2, min: 2, max: 4, n: 12 },
  byPrinciple: {
    TRANSPARENCY: { avg: 3.5, n: 2, min: 3, max: 4 },
    // ... diğer prensipler
  },
  computedAt: Date
}

// medical-expert-v1 score
{
  projectId: ObjectId("..."),
  userId: ObjectId("..."),
  role: "medical-expert",
  questionnaireKey: "medical-expert-v1",
  totals: { avg: 2.8, min: 1, max: 4, n: 25 },
  byPrinciple: {
    "TECHNICAL ROBUSTNESS & SAFETY": { avg: 2.5, n: 7, min: 1, max: 4 },
    // ... diğer prensipler
  },
  computedAt: Date
}
```

## 🔄 Otomatik İşlem Akışı

1. Medical expert soruları cevaplar
2. Frontend `/api/general-questions` endpoint'ine gönderir
3. Backend:
   - Genel soruları `general-v1` questionnaire key ile `responses` collection'ına kaydeder
   - Medical soruları `medical-expert-v1` questionnaire key ile `responses` collection'ına kaydeder
   - `general-v1` için scores hesaplar ve `scores` collection'ına kaydeder
   - `medical-expert-v1` için scores hesaplar ve `scores` collection'ına kaydeder

## ✅ Doğrulama

Sistem şu şekilde çalışıyor:
- ✅ Questionnaires: `general-v1`, `medical-expert-v1`
- ✅ Questions: Her questionnaire'da doğru sorular
- ✅ Responses: Her questionnaire için ayrı response document
- ✅ Scores: Her questionnaire için ayrı score document

## 🧪 Test

Test script'i çalıştırın:
```bash
node backend/scripts/verifyMedicalExpertStructure.js
```

Expected output:
- ✅ Questionnaires: general-v1, medical-expert-v1
- ✅ Questions: general-v1 (12), medical-expert-v1 (25)
- ✅ No code overlap between questionnaires
- ✅ Responses will be saved to both questionnaires
- ✅ Scores will be computed for both questionnaires



