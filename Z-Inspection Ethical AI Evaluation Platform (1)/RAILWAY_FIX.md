# Railway Deployment Düzeltmesi

## ❌ Hata
Railway build sırasında şu hatayı veriyor:
- "Script start.sh not found"
- "Railpack could not determine how to build the app"

## ✅ Çözüm

### Backend Service Ayarları

1. **Railway Dashboard'a gidin**
2. **Backend Service'i seçin** (Z.Inspection service)
3. **Settings** sekmesine gidin
4. **Root Directory** ayarını kontrol edin:
   - Root Directory: `backend` olmalı (kesinlikle!)
   - Eğer boşsa veya farklıysa, `backend` yazın

5. **Environment Variables** kontrol edin:
   ```
   MONGO_URI=mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0
   PORT=5000
   NODE_ENV=production
   ```

6. **Deploy Settings** kontrol edin:
   - Build Command: (boş bırakın, otomatik algılansın)
   - Start Command: (boş bırakın, backend/Procfile kullanılacak)

7. **Deploy'u yeniden başlatın**
   - Settings → Redeploy veya
   - Deployments → Latest → Redeploy

### Oluşturulan Dosyalar

Backend klasörüne şu dosyalar eklendi:
- ✅ `backend/nixpacks.toml` - Nixpacks build config
- ✅ `backend/railway.json` - Railway deployment config
- ✅ `backend/Procfile` - Start command

Bu dosyalar Railway'e backend'in nasıl build ve start edileceğini söyler.

---

## 🔄 Deployment Yeniden Başlatma

1. GitHub'a değişiklikleri push edin:
   ```bash
   git add .
   git commit -m "Add Railway deployment configs"
   git push
   ```

2. Railway otomatik olarak yeni deploy başlatacak

3. VEYA manuel olarak Railway dashboard'dan Redeploy yapın

---

## ✅ Başarılı Build Kontrolü

Build başarılı olduğunda loglarda şunları görmelisiniz:
- ✅ "Installing dependencies"
- ✅ "Starting application"
- ✅ "🚀 Server running on port 5000"

---

## 🆘 Hala Çalışmıyorsa

1. **Root Directory kontrolü** - Kesinlikle `backend` olmalı
2. **package.json kontrolü** - `backend/package.json` dosyası mevcut mu?
3. **Logları kontrol edin** - Detaylı hata mesajlarını okuyun
4. **Environment Variables** - MONGO_URI doğru mu?

