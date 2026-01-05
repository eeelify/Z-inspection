# 🚀 Quick Start: Atomic Report Generation

## TL;DR

**PDF and Word are now generated TOGETHER from the SAME snapshot.**  
**Admin and Expert always see the SAME latest version.**

---

## 📦 Installation (5 minutes)

```bash
# 1. Install dependencies
npm install puppeteer html-to-docx docx --save

# 2. Create upload directory
mkdir -p backend/uploads/reports
chmod 755 backend/uploads/reports

# 3. Start server
npm start

# 4. Test (optional)
curl -X POST http://localhost:3000/api/reports/generate-atomic \
  -H "Content-Type: application/json" \
  -d '{"projectId":"YOUR_PROJECT_ID","userId":"YOUR_ADMIN_ID"}'
```

---

## 🎯 Usage

### Generate Report (Admin)

```javascript
// Call new atomic endpoint
const response = await fetch('/api/reports/generate-atomic', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    projectId: 'abc123',
    userId: 'admin456'
  })
});

const result = await response.json();
console.log(result);
// {
//   success: true,
//   reportId: "64a5f...",
//   version: 1,
//   files: {
//     pdf: { downloadUrl: "...", size: 524288 },
//     word: { downloadUrl: "...", size: 327680 }
//   }
// }
```

### Get Latest Report (Admin + Expert)

```javascript
// Same endpoint for both Admin and Expert
const response = await fetch(`/api/reports/latest/${projectId}`);
const report = await response.json();

// Display files
document.getElementById('pdfLink').href = report.files.pdf.downloadUrl;
document.getElementById('wordLink').href = report.files.word.downloadUrl;
document.getElementById('version').textContent = report.versionLabel; // "v1 (Latest)"
```

---

## 🔄 Migration (If You Have Existing Reports)

```javascript
// backend/scripts/migrateReports.js
const mongoose = require('mongoose');
require('../server'); // Load models

async function migrate() {
  const Report = mongoose.model('Report');
  const projects = await Report.distinct('projectId');

  for (const projectId of projects) {
    const reports = await Report.find({ projectId }).sort({ generatedAt: -1 });
    
    if (reports.length > 0) {
      // Mark most recent as latest
      reports[0].latest = true;
      reports[0].version = reports[0].version || 1;
      await reports[0].save();
      
      // Mark others as not latest
      for (let i = 1; i < reports.length; i++) {
        reports[i].latest = false;
        reports[i].version = reports[i].version || (reports.length - i);
        await reports[i].save();
      }
      
      console.log(`✅ Migrated ${reports.length} report(s) for project ${projectId}`);
    }
  }
  
  console.log('✅ Migration complete');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
```

Run:
```bash
node backend/scripts/migrateReports.js
```

---

## 🧪 Quick Test

### Test 1: Generate Report

```bash
curl -X POST http://localhost:3000/api/reports/generate-atomic \
  -H "Content-Type: application/json" \
  -d '{"projectId":"PROJECT_ID","userId":"ADMIN_ID"}'
```

**Expected:** Success response with `reportId`, `version`, file URLs.

### Test 2: Get Latest

```bash
curl http://localhost:3000/api/reports/latest/PROJECT_ID
```

**Expected:** Same `reportId` and `version` as Test 1.

### Test 3: Download PDF

```bash
curl -O http://localhost:3000/api/reports/REPORT_ID/pdf
```

**Expected:** PDF file downloaded.

### Test 4: Download Word

```bash
curl -O http://localhost:3000/api/reports/REPORT_ID/word
```

**Expected:** Word file downloaded.

### Test 5: Validate

```bash
curl http://localhost:3000/api/reports/validate/REPORT_ID
```

**Expected:** `{ isValid: true, errors: [], warnings: [] }`

---

## 🎨 Frontend Example (React)

```javascript
import React, { useState, useEffect } from 'react';

function ReportPanel({ projectId, userId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load latest report
  useEffect(() => {
    fetch(`/api/reports/latest/${projectId}`)
      .then(res => res.json())
      .then(data => setReport(data))
      .catch(err => console.error(err));
  }, [projectId]);

  // Generate new report
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/generate-atomic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, userId })
      });
      const result = await res.json();
      alert(`Report ${result.versionLabel} generated successfully!`);
      // Reload latest
      const latest = await fetch(`/api/reports/latest/${projectId}`).then(r => r.json());
      setReport(latest);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!report) return <div>No reports yet. Generate one to get started.</div>;

  return (
    <div>
      <h2>Ethical Assessment Report</h2>
      <p>Version: <strong>{report.versionLabel}</strong></p>
      <p>Generated: {new Date(report.generatedAt).toLocaleString()}</p>
      
      <div>
        <a href={report.files.pdf.viewUrl} target="_blank" rel="noopener noreferrer">
          <button>📄 View PDF</button>
        </a>
        <a href={report.files.pdf.downloadUrl} download>
          <button>⬇️ Download PDF ({report.files.pdf.sizeFormatted})</button>
        </a>
        <a href={report.files.word.downloadUrl} download>
          <button>⬇️ Download Word ({report.files.word.sizeFormatted})</button>
        </a>
      </div>

      <button onClick={handleGenerate} disabled={loading}>
        {loading ? '⏳ Generating...' : '🔄 Generate New Report'}
      </button>
    </div>
  );
}

export default ReportPanel;
```

---

## ⚠️ Important Rules

### ✅ DO:
- Use `/api/reports/generate-atomic` for ALL new report generation
- Use `/api/reports/latest/:projectId` to get current report (Admin + Expert)
- Always query backend for latest report (never cache URLs in localStorage)
- Show version label (`v3 (Latest)`) in UI
- Disable "Generate" button while `loading=true`

### ❌ DON'T:
- Don't use old `/api/reports/generate` endpoint (if it exists)
- Don't generate PDF and Word separately
- Don't cache report URLs in browser storage
- Don't rely on frontend state to determine "latest"
- Don't serve files from old versions without warning

---

## 🔍 Debugging

### Check Latest Report in DB

```javascript
// MongoDB shell or Compass
db.reports.findOne({ 
  projectId: ObjectId("YOUR_PROJECT_ID"), 
  latest: true 
})
```

**Expected:** Exactly ONE document returned.

### Check Version History

```javascript
db.reports.find({ 
  projectId: ObjectId("YOUR_PROJECT_ID") 
}).sort({ version: -1 })
```

**Expected:** List of reports, newest first, only ONE with `latest: true`.

### Check Files on Disk

```bash
ls -lh backend/uploads/reports/
```

**Expected:** `.pdf` and `.docx` files with matching timestamps.

### Validate Report Integrity

```bash
curl http://localhost:3000/api/reports/validate/REPORT_ID | jq
```

**Expected:**
```json
{
  "isValid": true,
  "errors": [],
  "warnings": [],
  "files": {
    "pdf": { "exists": true, "size": 524288 },
    "word": { "exists": true, "size": 327680 }
  }
}
```

---

## 🚨 Common Issues

### Issue: "Puppeteer crashed"
**Solution:**
```bash
# Linux:
sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2

# Docker: Use puppeteer/puppeteer image or install dependencies in Dockerfile
```

### Issue: "Word file not found"
**Solution:**
```bash
# Check permissions
chmod 755 backend/uploads/reports

# Check if html-to-docx is installed
npm list html-to-docx
```

### Issue: "Multiple reports have latest=true"
**Solution:**
```javascript
// Fix manually in MongoDB
db.reports.updateMany(
  { projectId: ObjectId("..."), latest: true },
  { $set: { latest: false } }
);

// Mark correct one as latest
db.reports.updateOne(
  { _id: ObjectId("CORRECT_REPORT_ID") },
  { $set: { latest: true } }
);
```

---

## 📊 Monitoring

### Key Metrics to Track:

```javascript
// Average generation time
db.reports.aggregate([
  { $match: { status: 'final' } },
  { $group: {
      _id: null,
      avgDuration: { $avg: "$metadata.generationDurationMs" }
    }
  }
])

// Failure rate
db.reports.aggregate([
  { $group: {
      _id: "$status",
      count: { $sum: 1 }
    }
  }
])

// File sizes
db.reports.aggregate([
  { $match: { status: 'final' } },
  { $group: {
      _id: null,
      avgPdfSize: { $avg: "$pdfSize" },
      avgWordSize: { $avg: "$wordSize" }
    }
  }
])
```

---

## 📖 Full Documentation

For complete details, see:
- **`ATOMIC_REPORT_GENERATION_SYSTEM.md`** - Full system documentation (874 lines)
- **`IMPLEMENTATION_SUMMARY.md`** - Implementation summary and API reference

---

## ✅ Acceptance Checklist

After deploying, verify:

- [ ] Generate report → Success (reportId returned)
- [ ] Admin fetches latest → Same reportId
- [ ] Expert fetches latest → Same reportId
- [ ] Download PDF → File downloads correctly
- [ ] Download Word → File downloads correctly
- [ ] Generate 2nd report → Version increments (v1 → v2)
- [ ] Old v1 has `latest: false`
- [ ] New v2 has `latest: true`
- [ ] Validation endpoint returns `isValid: true`

---

## 🎉 You're Done!

**The Atomic Report Generation System is now live.**

Admin and Expert will always see the same, latest report.  
PDF and Word will always match.  
No more stale or mismatched files.

**Happy reporting! 📊✨**

