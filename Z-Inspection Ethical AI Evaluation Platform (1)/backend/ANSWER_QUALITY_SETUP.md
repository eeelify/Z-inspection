# Answer Quality (AQ) Setup Guide

## 📊 Skor Hesaplama Sistemi

### Formül
```
Final Score = Importance (0-4) × Answer Quality (0-1)
```

### Bileşenler

1. **Importance (0-4)** - Sorunun önemi
   - 4: Çok önemli / Kritik
   - 3: Önemli
   - 2: Orta derecede önemli
   - 1: Az önemli
   - 0: Önemsiz

2. **Answer Quality (0-1)** - Cevabın kalitesi
   - 1.0: Mükemmel cevap (örn: "Yes", "Very clear", "Fully implemented")
   - 0.75: İyi cevap (örn: "Mostly clear", "Frequently")
   - 0.5: Orta/Nötr cevap (örn: "Depends", "Partially", "Sometimes")
   - 0.25: Zayıf cevap (örn: "Rarely", "Unclear")
   - 0.0: Kötü cevap (örn: "No", "Never", "Not implemented")

## 🚀 Kurulum

### 1. MongoDB'ye Answer Quality Değerlerini Yükle

```bash
# Backend klasöründe çalıştır
cd backend
node scripts/setAnswerQualityValues.js
```

Bu script:
- ✅ Tüm çoktan seçmeli soruları tarar
- ✅ Her seçenek için `answerQuality` değeri atar
- ✅ Otomatik pattern matching yapar
- ✅ Geriye dönük uyumluluk için `optionScores` da doldurur

### 2. Otomatik Eşleştirme Kalıpları

Script şu kalıpları otomatik tanır:

#### Netlik (Clarity)
```javascript
"Very clear"           → 1.0
"Mostly clear"         → 0.75
"Somewhat unclear"     → 0.5
"Completely unclear"   → 0.25
```

#### Güven (Confidence)
```javascript
"Very confident"       → 1.0
"Somewhat confident"   → 0.67
"Not very confident"   → 0.33
"Not at all"          → 0.0
```

#### Evet/Hayır
```javascript
"Yes" / "Evet"        → 1.0
"Depends" / "Bağlı"   → 0.5
"No" / "Hayır"        → 0.0
```

#### Uygulama Durumu
```javascript
"Fully implemented"    → 1.0
"Mostly implemented"   → 0.75
"Partially"           → 0.5
"Not implemented"     → 0.0
```

#### Sıklık (Frequency)
```javascript
"Always"              → 1.0
"Frequently"          → 0.75
"Sometimes"           → 0.5
"Rarely"              → 0.25
"Never"               → 0.0
```

### 3. Manuel Ayarlama (İsteğe Bağlı)

Eğer otomatik mapping doğru değilse, MongoDB'de manuel düzenleyebilirsiniz:

```javascript
// MongoDB'de
db.questions.updateOne(
  { code: "T1", questionnaireKey: "general-v1" },
  {
    $set: {
      "options.0.answerQuality": 1.0,  // First option
      "options.1.answerQuality": 0.75, // Second option
      // ...
    }
  }
)
```

Veya Compass GUI'de:
1. Questions collection'ı aç
2. İlgili soruyu bul
3. `options` array'ini düzenle
4. Her option'a `answerQuality` değeri ekle (0-1 arası)

## 📈 Örnek Hesaplamalar

### Örnek 1: Kritik Soru + Mükemmel Cevap
```
Soru: "Is the AI system's decision-making process transparent?"
Importance: 4 (Very Important)
Answer: "Yes" (answerQuality: 1.0)
Score: 4 × 1.0 = 4.0
```

### Örnek 2: Önemli Soru + Kısmi Cevap
```
Soru: "Are privacy measures in place?"
Importance: 3 (Important)
Answer: "Partially" (answerQuality: 0.5)
Score: 3 × 0.5 = 1.5
```

### Örnek 3: Az Önemli Soru + Kötü Cevap
```
Soru: "Is documentation available?"
Importance: 1 (Less Important)
Answer: "No" (answerQuality: 0.0)
Score: 1 × 0.0 = 0.0
```

## 🔍 Doğrulama

Migration sonrası kontrol edin:

```bash
# MongoDB'de
db.questions.find(
  { answerType: "single_choice" },
  { code: 1, "options.key": 1, "options.answerQuality": 1 }
).limit(5)
```

Beklenen çıktı:
```json
{
  "code": "T1",
  "options": [
    { "key": "yes", "answerQuality": 1.0 },
    { "key": "partially", "answerQuality": 0.5 },
    { "key": "no", "answerQuality": 0.0 }
  ]
}
```

## 🔧 Sorun Giderme

### Problem: Bazı options için answerQuality eksik
**Çözüm:** Script'i tekrar çalıştırın veya manuel ekleyin

### Problem: Yanlış değerler atanmış
**Çözüm:** MongoDB'de manuel düzeltin veya script'teki ANSWER_QUALITY_PATTERNS'i güncellayip tekrar çalıştırın

### Problem: Yeni soru türleri eklenmiş
**Çözüm:** 
1. `setAnswerQualityValues.js` dosyasındaki `ANSWER_QUALITY_PATTERNS`'e yeni kalıplar ekleyin
2. Script'i tekrar çalıştırın

## 📝 Notlar

- ✅ Script idempotent'tir (tekrar çalıştırılabilir, mevcut değerleri korur)
- ✅ Hem İngilizce hem Türkçe kalıpları tanır
- ✅ `optionScores` alanını geriye dönük uyumluluk için doldurur
- ✅ Tanınamayan seçenekler için default 0.5 kullanır ve uyarı verir

## 🎯 Sonraki Adımlar

1. ✅ Migration script'ini çalıştır
2. ✅ MongoDB'de değerleri doğrula
3. ⏭️ Scoring logic'i güncelle (gerekirse)
4. ⏭️ Report generation'da yeni skorları kullan
