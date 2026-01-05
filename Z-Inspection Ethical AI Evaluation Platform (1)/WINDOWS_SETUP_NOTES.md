# Windows Setup Notes for Atomic Report Generation

## ✅ Installation Complete

Dependencies installed successfully:
- ✅ `html-to-docx` - Word generation
- ✅ `docx` - Word document creation (fallback)
- ✅ `puppeteer` - PDF generation (without Chrome bundle)

---

## 🔧 Windows-Specific Adjustments

### 1. Puppeteer Without Chrome

Puppeteer was installed **without** bundled Chrome to avoid download corruption issues on Windows.

**Solution:** The system will use your installed Chrome browser.

**To specify Chrome path** (if needed), add to your environment or code:

```javascript
// backend/services/atomicReportGenerationService.js
// Puppeteer will automatically detect Chrome in common locations:
// - C:\Program Files\Google\Chrome\Application\chrome.exe
// - C:\Program Files (x86)\Google\Chrome\Application\chrome.exe

// Or specify explicitly:
const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

### 2. Directory Permissions (chmod)

On Windows, `chmod` doesn't exist. **No action needed** - the directory created by `mkdir` already has correct permissions for the current user.

The command that failed:
```bash
chmod 755 backend/uploads/reports  # ❌ Unix command, not needed on Windows
```

Windows equivalent (optional, only if you need to modify permissions):
```powershell
# Grant full control to current user
icacls "backend\uploads\reports" /grant "${env:USERNAME}:(OI)(CI)F"

# But this is NOT necessary for development - default permissions are fine
```

### 3. File Paths

Windows uses backslashes (`\`), but Node.js handles this automatically with `path.join()`.

Our code already uses:
```javascript
const path = require('path');
const filePath = path.join(__dirname, '..', 'uploads', 'reports', filename);
// This works on both Windows and Linux
```

---

## 🚀 Ready to Test

Your environment is now ready. Test report generation:

```powershell
# Start server (if not already running)
npm start

# In another terminal, test atomic report generation:
curl -X POST http://localhost:3000/api/reports/generate-atomic `
  -H "Content-Type: application/json" `
  -d '{"projectId":"TEST_PROJECT_ID","userId":"ADMIN_USER_ID"}'
```

---

## 🔍 Troubleshooting

### If Puppeteer can't find Chrome:

**✅ SOLUTION (Already Implemented):**

Chrome has been installed for Puppeteer:
```powershell
npx @puppeteer/browsers install chrome@stable
# Installed at: C:\Users\[USERNAME]\chrome\win64-143.0.7499.169\chrome-win64\chrome.exe
```

The code now auto-detects Chrome from multiple locations:
1. Environment variable `PUPPETEER_EXECUTABLE_PATH` (if set)
2. Puppeteer's cache: `%USERPROFILE%\chrome\win64-*\chrome-win64\chrome.exe`
3. Puppeteer's cache (alternate): `%USERPROFILE%\.cache\puppeteer\chrome\...`
4. System Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`
5. System Chrome (x86): `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
6. User Chrome: `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`

**If you still get errors:**

**Option 1: Set environment variable** (most reliable)
```powershell
# Add to your PowerShell profile or set before running server:
$env:PUPPETEER_EXECUTABLE_PATH = "C:\Users\merve\chrome\win64-143.0.7499.169\chrome-win64\chrome.exe"
npm start
```

**Option 2: Install system Chrome** (if not installed)
Download from: https://www.google.com/chrome/

**Option 3: Reinstall Chrome for Puppeteer**
```powershell
npx @puppeteer/browsers clear
npx @puppeteer/browsers install chrome@stable
```

### If Word generation fails:

The fallback Word generator will activate automatically. Check logs for:
```
⚠️  html-to-docx not available, using fallback method
📝 Generating Word document (fallback mode)...
```

This is expected and produces a simplified Word document.

---

## 📊 Verify Installation

Check that files exist:
```powershell
# Check directory
ls backend\uploads\reports

# Check dependencies
npm list puppeteer html-to-docx docx
```

Expected output:
```
Z-Inspection-Platform@1.0.0
├── docx@8.x.x
├── html-to-docx@1.x.x
└── puppeteer@23.x.x
```

---

## ✅ Summary

| Component | Status | Notes |
|-----------|--------|-------|
| html-to-docx | ✅ Installed | Primary Word generator |
| docx | ✅ Installed | Fallback Word generator |
| puppeteer | ✅ Installed | PDF generator (no bundled Chrome) |
| Upload directory | ✅ Created | `backend/uploads/reports/` |
| Permissions | ✅ OK | Default Windows permissions sufficient |

**You're ready to generate reports!**

---

## 🎯 Next Steps

1. **Start the server:**
   ```powershell
   npm start
   ```

2. **Generate a test report** (see `QUICK_START_ATOMIC_REPORTS.md`)

3. **If you encounter Chrome issues,** add explicit Chrome path as shown in Troubleshooting section above.

---

**Windows Setup Complete** ✅

