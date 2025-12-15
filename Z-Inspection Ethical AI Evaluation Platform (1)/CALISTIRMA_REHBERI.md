# 🚀 Z-Inspection Projesi Çalıştırma Rehberi

## ✅ Kurulum Tamamlandı

Tüm bağımlılıklar kuruldu ve sunucular başlatıldı!

## 📍 Sunucu Adresleri

- **Backend Server:** http://127.0.0.1:5000
- **Frontend Server:** http://localhost:3000

## 🔍 Kontrol Listesi

### 1. Backend Server Kontrolü

Backend server'ın çalıştığını kontrol etmek için:
- Tarayıcıda şu adrese gidin: http://127.0.0.1:5000
- Veya terminal'de şu komutu çalıştırın:
  ```powershell
  curl http://127.0.0.1:5000/api/general-questions/test
  ```

**Beklenen Çıktı:**
```
✅ MongoDB Atlas Bağlantısı Başarılı
🚀 Server running on port 5000
```

### 2. Frontend Server Kontrolü

Frontend server'ın çalıştığını kontrol etmek için:
- Tarayıcıda şu adrese gidin: http://localhost:3000
- Otomatik olarak açılmalı

### 3. MongoDB Bağlantısı

Backend server başlarken şu mesajı görmelisiniz:
```
✅ MongoDB Atlas Bağlantısı Başarılı
```

Eğer hata görürseniz:
- MongoDB bağlantı string'i `server.js` dosyasında tanımlı
- İnternet bağlantınızı kontrol edin

## 🔄 Sunucuları Yeniden Başlatma

### Backend'i Yeniden Başlatma

1. Backend terminal'ini bulun (Ctrl+C ile durdurun)
2. Şu komutu çalıştırın:
   ```powershell
   cd backend
   node server.js
   ```

### Frontend'i Yeniden Başlatma

1. Frontend terminal'ini bulun (Ctrl+C ile durdurun)
2. Şu komutu çalıştırın:
   ```powershell
   npm run dev
   ```

## 🐛 Sorun Giderme

### Port 5000 Zaten Kullanılıyor

Eğer backend başlamazsa ve "port 5000 already in use" hatası alırsanız:

1. Port'u kullanan işlemi bulun:
   ```powershell
   netstat -ano | findstr :5000
   ```

2. İşlemi sonlandırın:
   ```powershell
   taskkill /PID <PID_NUMARASI> /F
   ```

### Port 3000 Zaten Kullanılıyor

Frontend için port 3000 kullanılıyorsa:

1. `vite.config.ts` dosyasında port'u değiştirebilirsiniz
2. Veya port'u kullanan işlemi sonlandırın

### MongoDB Bağlantı Hatası

Eğer MongoDB bağlantısı başarısız olursa:

1. İnternet bağlantınızı kontrol edin
2. MongoDB Atlas cluster'ının aktif olduğundan emin olun
3. `backend/server.js` dosyasındaki `MONGO_URI` değerini kontrol edin

### Bağımlılıklar Eksik

Eğer "module not found" hatası alırsanız:

**Frontend için:**
```powershell
npm install
```

**Backend için:**
```powershell
cd backend
npm install
```

## 📝 İlk Kurulum (Opsiyonel)

Eğer veritabanı boşsa, seed script'lerini çalıştırabilirsiniz:

```powershell
# Genel soruları ekle
cd backend
node scripts/seedGeneralQuestions.js

# Role-specific soruları ekle (opsiyonel)
node scripts/seedRoleQuestions.js
```

## 🎯 Kullanım

1. Tarayıcıda http://localhost:3000 adresine gidin
2. Login ekranında giriş yapın
3. Bir proje seçin veya yeni proje oluşturun
4. Değerlendirmeye başlayın!

## 📞 Yardım

Sorun yaşarsanız:
1. Terminal çıktılarını kontrol edin
2. Tarayıcı console'unu açın (F12)
3. Network tab'ında API isteklerini kontrol edin

---

**Not:** Her iki sunucu da şu anda arka planda çalışıyor. Terminal pencerelerini kapatmayın!

