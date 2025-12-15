# Z-Inspection Platform - Kurulum ve Çalıştırma Rehberi

## Adım 1: Backend Server'ı Başlatma

### Terminal 1 - Backend
```bash
cd backend
node server.js
```

Backend server `http://127.0.0.1:5000` adresinde çalışacak.

## Adım 2: Veritabanını Seed Etme (İlk Kurulum)

Yeni collection'ları oluşturmak ve soruları eklemek için:

### Terminal 2 - Seed Script'leri

```bash
# 1. Genel soruları ekle (7 etik ilke)
node backend/scripts/seedGeneralQuestions.js

# 2. Etik expert sorularını ekle
node backend/scripts/seedEthicalExpertQuestions.js

# 3. (Opsiyonel) Role-specific soruları ekle
node backend/scripts/seedRoleQuestions.js
```

Bu script'ler:
- `questionnaires` collection'ına `general-v1` anketini ekler
- `questions` collection'ına 12 genel soruyu ekler (7 etik ilkeye göre)

## Adım 3: Frontend'i Başlatma

### Terminal 3 - Frontend
```bash
npm run dev
```

Frontend genellikle `http://localhost:3000` adresinde çalışır.

## Adım 4: Test Etme

1. Tarayıcıda `http://localhost:3000` adresine gidin
2. Login olun
3. Bir proje seçin
4. "Start Evaluation" butonuna tıklayın
5. Genel soruları cevaplayın
6. "Save Draft" veya "Next Question" butonlarına tıklayın

## Sorun Giderme

### Collection'lar Boş Görünüyor

Eğer MongoDB'de `responses`, `questionnaires`, `questions` collection'ları boş görünüyorsa:

1. **Seed script'lerini çalıştırın:**
   ```bash
   node backend/scripts/seedGeneralQuestions.js
   ```

2. **Backend server'ı yeniden başlatın:**
   ```bash
   # Terminal'de Ctrl+C ile durdurun
   node server.js
   ```

3. **Frontend'den tekrar test edin**

### Veriler Kaydedilmiyor

1. **Backend console'unu kontrol edin:**
   - `✅ Saved X answers to responses collection` mesajını görmelisiniz
   - Hata varsa console'da görünecek

2. **Tarayıcı console'unu kontrol edin (F12):**
   - Network tab'ında API isteklerini kontrol edin
   - Hata mesajları varsa göreceksiniz

3. **MongoDB bağlantısını kontrol edin:**
   - Backend server başlarken MongoDB bağlantı mesajını görmelisiniz

## Mevcut Durum

- ✅ Eski `Evaluation` collection'ı çalışıyor
- ✅ Yeni `responses` collection'ına da yazıyor (non-blocking)
- ✅ Genel sorular `GeneralQuestions` component'inde çalışıyor
- ⚠️ Role-specific sorular henüz `questions` collection'ında yok (boş array)

## Sonraki Adımlar

1. Role-specific soruları eklemek için `seedRoleQuestions.js` script'ini çalıştırın
2. Frontend'i yeni API endpoint'lerine geçirin (opsiyonel)
3. Migration script'ini çalıştırarak eski verileri yeni yapıya taşıyın

