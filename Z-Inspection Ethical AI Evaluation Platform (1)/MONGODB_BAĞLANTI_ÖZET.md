# MongoDB ve Proje Bağlantısı - Özet

## 🔌 MongoDB Bağlantısı

**Bağlantı Bilgileri:**
- MongoDB Atlas kullanılıyor (Cloud)
- Connection String: `MONGO_URI` (**backend/.env** içinden okunur)
- Database: `zinspection`
- Connection pooling: 10 socket bağlantısı

## 📊 Ana MongoDB Collections (Tablolar)

### 1. **Users** - Kullanıcılar
```javascript
{
  name, email, password, role,
  isOnline, lastSeen,
  preconditionApproved,
  profileImage (Base64)
}
```

### 2. **Projects** - Projeler
```javascript
{
  title, description,
  status, stage, progress,
  assignedUsers: [User IDs],
  useCase, inspectionContext,
  createdAt
}
```

### 3. **UseCaseQuestion** - Sorular (Use Case için)
```javascript
{
  id, questionEn, questionTr,
  type: 'text' | 'multiple-choice',
  options: [String],
  order
}
```

### 4. **UseCase** - Use Case Cevapları
```javascript
{
  title, description, status,
  ownerId, assignedExperts,
  answers: [{ questionId, answer }],
  supportingFiles, feedback
}
```

### 5. **Evaluation** - Değerlendirmeler (Eski sistem)
```javascript
{
  projectId, userId, stage,
  answers: Map,
  questionPriorities: Map,
  riskLevel,
  generalRisks: [{ id, title, severity }],
  status: 'draft' | 'completed'
}
```

### 6. **GeneralQuestionsAnswers** - Genel Sorular Cevapları
```javascript
{
  projectId, userId, userRole,
  principles: {
    TRANSPARENCY: { answers: {}, risks: {} },
    'HUMAN AGENCY & OVERSIGHT': { answers: {}, risks: {} },
    'TECHNICAL ROBUSTNESS & SAFETY': { answers: {}, risks: {} },
    'PRIVACY & DATA GOVERNANCE': { answers: {}, risks: {} },
    'DIVERSITY, NON-DISCRIMINATION & FAIRNESS': { answers: {}, risks: {} },
    'SOCIETAL & INTERPERSONAL WELL-BEING': { answers: {}, risks: {} },
    ACCOUNTABILITY: { answers: {}, risks: {} }
  },
  answers: {} (legacy),
  risks: {} (legacy)
}
```

### 7. **Response** - Yeni Sistem Cevapları
```javascript
{
  projectId, userId, role,
  questionnaireKey, questionnaireVersion,
  answers: [{
    questionId, questionCode,
    answer: { choiceKey | text | numeric | multiChoiceKeys },
    score: 0-4,
    scoreSuggested, scoreFinal,
    reviewerId, notes, evidence
  }],
  status: 'draft' | 'submitted' | 'locked'
}
```

### 8. **Score** - Hesaplanmış Puanlar
```javascript
{
  projectId, userId, role, questionnaireKey,
  totals: { avg, min, max, n },
  byPrinciple: {
    TRANSPARENCY: { avg, n, min, max },
    'HUMAN AGENCY & OVERSIGHT': { avg, n, min, max },
    // ... diğer prensipler
  },
  computedAt
}
```

## 🔄 Sorular-Cevaplar Akışı

### **1. Sorular Nerede Tutuluyor?**

**Use Case Soruları:**
- Collection: `UseCaseQuestion`
- Her soru ayrı bir doküman
- `id`, `questionEn`, `questionTr`, `type`, `options`, `order`

**Genel Değerlendirme Soruları:**
- Collection: `Question` (models/question.js)
- `questionnaireKey`, `code` (T1, H2, vb.), `principle`
- `answerType`: single_choice, multi_choice, open_text, numeric
- Her seçenek için `score: 0-4` değeri var

### **2. Cevaplar Nasıl Kaydediliyor?**

**Use Case Cevapları:**
```
POST /api/usecases/:id/answers
→ UseCase collection'ında answers array'ine eklenir
```

**Genel Sorular Cevapları:**
```
POST /api/general-questions
→ GeneralQuestionsAnswers collection'ına kaydedilir
→ Her prensip için ayrı ayrı (TRANSPARENCY, HUMAN AGENCY, vb.)
→ Hem answers hem risks (0-4 puan) tutulur
```

**Yeni Sistem Cevapları:**
```
POST /api/evaluations
→ Hem Evaluation (eski) hem Response (yeni) collection'larına kaydedilir
→ Response collection'ında her cevap için:
   - answer formatı (choiceKey, text, vb.)
   - score: 0-4 (otomatik hesaplanır)
   - questionId, questionCode
```

### **3. Puanlar Nasıl Hesaplanıyor?**

**Puan Hesaplama Yöntemleri:**

1. **Single Choice Sorular:**
   - Seçilen seçeneğin `score` değeri kullanılır
   - Örnek: "Very Clear" → score: 4

2. **Open Text Sorular:**
   - `scoreSuggested`: AI tarafından önerilen puan
   - `scoreFinal`: İnceleme sonrası final puan
   - `reviewerId`: Puanı veren kullanıcı

3. **Priority-Based (Eski Sistem):**
   - `questionPriorities` map'inden:
     - `low` → score: 3
     - `medium` → score: 2
     - `high` → score: 1

**Puanlar Nerede Tutuluyor?**

1. **Response Collection'ında:**
   - Her cevap için `score: 0-4` değeri
   - `scoreSuggested`, `scoreFinal` (open_text için)

2. **GeneralQuestionsAnswers Collection'ında:**
   - `principles[PRINCIPLE_NAME].risks[questionId]` → 0-4 puan

3. **Score Collection'ında (Hesaplanmış):**
   - Toplam ortalama: `totals.avg`
   - Prensip bazında ortalamalar: `byPrinciple[PRINCIPLE].avg`
   - Min, max, toplam soru sayısı (n)

## 🔗 Proje-MongoDB Bağlantı Akışı

```
Frontend (React)
    ↓
API Endpoints (Express.js)
    ↓
Mongoose Models
    ↓
MongoDB Atlas
```

**Örnek Akış:**

1. **Kullanıcı cevap verir:**
   ```
   Frontend → POST /api/general-questions
   → GeneralQuestionsAnswers.findOneAndUpdate()
   → MongoDB'ye kaydedilir
   ```

2. **Puanlar hesaplanır:**
   ```
   Response collection'ındaki score'lar
   → Score collection'ına toplu hesaplama
   → byPrinciple ve totals hesaplanır
   ```

3. **Veriler okunur:**
   ```
   GET /api/general-questions?projectId=xxx&userId=yyy
   → GeneralQuestionsAnswers.findOne()
   → Frontend'e döner
   ```

## 📍 Önemli Endpoint'ler

- `POST /api/general-questions` - Genel sorular cevaplarını kaydet
- `GET /api/general-questions` - Cevapları getir
- `POST /api/evaluations` - Değerlendirme kaydet (hem eski hem yeni sistem)
- `GET /api/evaluations` - Değerlendirmeleri getir
- `POST /api/usecases/:id/answers` - Use case cevaplarını kaydet

## 🎯 Özet

- **Sorular:** `UseCaseQuestion` ve `Question` collection'larında
- **Cevaplar:** `UseCase.answers`, `GeneralQuestionsAnswers`, `Response` collection'larında
- **Puanlar:** 
  - Her cevapta: `Response.answers[].score` (0-4)
  - Toplu hesaplama: `Score` collection'ında
  - Prensip bazında: `Score.byPrinciple[PRINCIPLE].avg`
- **Bağlantı:** Express.js + Mongoose ODM ile MongoDB Atlas'a bağlanıyor

