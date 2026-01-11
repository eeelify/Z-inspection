# Çoktan Seçmeli Sorular Test Adımları

## Backend ✅
- MongoDB bağlantısı başarılı
- Server çalışıyor (port 5000)

## Frontend Test Adımları:

### 1. Tarayıcıyı Yenileyin
- **CTRL + SHIFT + R** (Hard Refresh - cache temizle)
- Veya tarayıcıyı tamamen kapatıp açın

### 2. Console'u Açın
- F12 tuşuna basın
- "Console" sekmesine gidin

### 3. Bir Proje Açın ve Uzman Değerlendirmeye Gidin
- Medical Expert, Technical Expert, veya Legal Expert olarak giriş yapın
- Bir projeye tıklayın
- "Start Evaluation" veya "Continue Evaluation" butonuna tıklayın

### 4. Console'da Arayın:
Şu log mesajlarını kontrol edin:

#### A. Cevaplar Yükleniyor mu?
```
📥 GET /api/evaluations/responses
📝 Loading X answers from Y response
💾 Mapping answer for question
📊 Loaded X answers, Y risk scores
```

#### B. Çoktan Seçmeli Soruda:
Bir çoktan seçmeli soruya geldiğinizde:
```
🔍 getAnswerValue for T1
```

### 5. Bir Çoktan Seçmeli Soruyu Test Edin
- Henüz cevaplanmamış bir çoktan seçmeli soruya gidin
- Bir seçenek işaretleyin
- "Next" butonuna tıklayın
- Önceki soruya geri dönün (Back butonu)
- Cevabınız hala seçili mi?

### 6. Daha Önce Cevaplanmış Bir Soruyu Test Edin
- Daha önce cevapladığınız bir çoktan seçmeli soruya gidin
- Cevabınız işaretli görünüyor mu?

## Beklenen Sonuçlar:
✅ Yeni verilen cevaplar kaydediliyor
✅ Daha önce verilen cevaplar işaretli görünüyor
✅ Console'da hata yok

## Hata Durumunda:
Lütfen şunları gönderin:
1. Console'daki tüm hata mesajları (kırmızı yazılar)
2. `📊 Loaded X answers` mesajındaki sayı (kaç cevap yüklenmiş?)
3. `🔍 getAnswerValue` mesajının tüm içeriği
4. Bir çoktan seçmeli sorunun soru metni (örnek)
