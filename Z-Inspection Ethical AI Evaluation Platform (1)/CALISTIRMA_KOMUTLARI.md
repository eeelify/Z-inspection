# 🚀 Z-Inspection Uygulamasını Çalıştırma Komutları

## ⚡ Hızlı Başlatma

### Windows'ta Otomatik Başlatma

**Yöntem 1: Batch Dosyası ile (Önerilen)**
```bash
CALISTIR.bat
```

**Yöntem 2: PowerShell Script ile**
```powershell
.\CALISTIR.ps1
```

---

## 📋 Manuel Başlatma

### 1️⃣ Backend Sunucusunu Başlatma

**Terminal 1 - Backend:**
```powershell
cd backend
node server.js
```

veya npm script ile:
```powershell
cd backend
npm start
```

**Beklenen Çıktı:**
```
✅ MongoDB Atlas Bağlantısı Başarılı
🚀 Server running on port 5000
```

**Backend Adresi:** http://127.0.0.1:5000

---

### 2️⃣ Frontend Sunucusunu Başlatma

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

**Beklenen Çıktı:**
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

**Frontend Adresi:** http://localhost:3000

---

## 🔧 İlk Kurulum (Sadece İlk Çalıştırmada)

### Bağımlılıkları Yükleme

**Backend için:**
```powershell
cd backend
npm install
```

**Frontend için:**
```powershell
cd frontend
npm install
```

### Veritabanını Seed Etme (Opsiyonel)

Eğer veritabanı boşsa, soruları eklemek için:

```powershell
cd backend

# Genel soruları ekle
node scripts/seedGeneralQuestions.js

# Expert sorularını ekle (isteğe bağlı)
node scripts/seedEthicalExpertQuestions.js
node scripts/seedMedicalExpertQuestions.js
node scripts/seedTechnicalExpertQuestions.js
node scripts/seedLegalExpertQuestions.js
node scripts/seedEducationExpertQuestions.js
```

---

## 🛑 Sunucuları Durdurma

Her iki terminal penceresinde de:
- `Ctrl + C` tuşlarına basın
- Veya terminal pencerelerini kapatın

---

## 🐛 Sorun Giderme

### Port 5000 Zaten Kullanılıyor

```powershell
# Port'u kullanan işlemi bul
netstat -ano | findstr :5000

# İşlemi sonlandır (PID numarasını değiştirin)
taskkill /PID <PID_NUMARASI> /F
```

### Port 3000 Zaten Kullanılıyor

```powershell
# Port'u kullanan işlemi bul
netstat -ano | findstr :3000

# İşlemi sonlandır
taskkill /PID <PID_NUMARASI> /F
```

### MongoDB Bağlantı Hatası

1. `backend/.env` dosyasında `MONGO_URI` değerini kontrol edin
2. İnternet bağlantınızı kontrol edin
3. MongoDB Atlas cluster'ının aktif olduğundan emin olun

### "Module not found" Hatası

**Backend için:**
```powershell
cd backend
npm install
```

**Frontend için:**
```powershell
cd frontend
npm install
```

---

## 📍 Sunucu Adresleri

- **Backend API:** http://127.0.0.1:5000
- **Frontend UI:** http://localhost:3000

---

## ✅ Kontrol Listesi

Başlatmadan önce:
- [ ] Backend `.env` dosyası var ve `MONGO_URI` tanımlı
- [ ] Backend bağımlılıkları yüklü (`backend/node_modules` var)
- [ ] Frontend bağımlılıkları yüklü (`node_modules` var)
- [ ] Port 5000 ve 3000 kullanılabilir

Başlatma sonrası:
- [ ] Backend terminal'de "MongoDB Atlas Bağlantısı Başarılı" mesajı görünüyor
- [ ] Backend terminal'de "Server running on port 5000" mesajı görünüyor
- [ ] Frontend terminal'de Vite başarıyla başladı
- [ ] Tarayıcıda http://localhost:3000 açılıyor

---

## 🎯 Kullanım

1. Tarayıcıda **http://localhost:3000** adresine gidin
2. Login ekranında giriş yapın
3. Bir proje seçin veya yeni proje oluşturun
4. Değerlendirmeye başlayın!

---

**Not:** Her iki sunucu da çalışırken terminal pencerelerini açık tutun!

