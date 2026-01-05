# Atomic Report Generation System Documentation

## Overview

The Atomic Report Generation System ensures that **PDF and Word reports are ALWAYS generated from the same snapshot** and that **Admin and Expert panels ALWAYS see the same latest version**.

This system implements a **Single Source of Truth** for report versioning and file management, eliminating the risk of:
- Stale or mismatched report files
- PDF and Word drifting apart
- Admin and Expert seeing different versions
- Partial report generation failures

---

## 🎯 Core Principles

### 1. Atomic Generation (MANDATORY)
**PDF and Word MUST be generated together in a single transaction.**

```
✅ CORRECT:
1. Collect data
2. Generate HTML
3. Generate PDF from HTML
4. Generate Word from HTML
5. Save both files
6. Mark as latest
→ If any step fails, nothing is published

❌ WRONG:
1. Generate PDF
2. Save PDF
3. (Later) Generate Word
4. Save Word
→ Risk: PDF exists but Word generation fails
```

### 2. Single Version Control
**Only ONE report per project can have `latest = true`**

When a new report is generated:
1. All existing reports for the project get `latest = false`
2. New report gets `latest = true`, `status = 'final'`
3. Version number auto-increments

### 3. Deterministic File URLs
**No client-side caching. Always resolve from backend.**

```javascript
// CORRECT: Always query backend for latest
GET /api/reports/latest/:projectId
→ Returns { reportId, version, files: { pdf: {downloadUrl, viewUrl}, word: {...} } }

// WRONG: Store URLs in localStorage
localStorage.setItem('pdfUrl', url) // ❌ Can become stale
```

---

## 📦 Database Schema

### Report Model (`backend/models/report.js` + `backend/server.js`)

```javascript
{
  projectId: ObjectId,       // Reference to Project
  version: Number,            // Auto-incremented per project
  latest: Boolean,            // Only ONE report per project can be true
  status: String,             // 'generating' | 'final' | 'archived' | 'failed'
  generatedAt: Date,
  generatedBy: ObjectId,

  // File references
  pdfPath: String,            // e.g., "reports/report_64a5f..._v2.pdf"
  wordPath: String,           // e.g., "reports/report_64a5f..._v2.docx"
  pdfSize: Number,            // bytes
  wordSize: Number,           // bytes

  // Content
  htmlContent: String,        // Full HTML for PDF/Word generation
  content: String,            // Legacy: Gemini markdown narrative
  sections: Array,            // Structured sections

  // Metadata
  metadata: {
    scoringModelVersion: 'erc_v1',
    questionsAnswered: Number,
    tensionsCount: Number,
    overallERC: Number,
    riskLabel: String,
    evaluatorCount: Number,
    evaluatorRoles: [String],
    generationDurationMs: Number,
    chartsGenerated: Number,
    chartTypes: [String]
  },

  // Error handling
  errorDetails: {
    message: String,
    stack: String,
    timestamp: Date
  }
}
```

### Indexes

```javascript
{ projectId: 1, version: 1 }  // unique=true (version uniqueness per project)
{ projectId: 1, latest: 1 }   // Fast "get latest report" queries
{ projectId: 1, generatedAt: -1 }
{ status: 1 }
```

---

## 🔧 Backend Services

### 1. `atomicReportGenerationService.js`

**Purpose:** THE ONLY service that generates report files.

#### Key Functions:

**`generateReportFilesAtomic({ projectId, htmlContent, metadata, narrative, userId })`**

Atomic operation flow:
1. Get next version number
2. Create Report document with `status='generating'`
3. Generate PDF from HTML (Puppeteer)
4. Generate Word from HTML (html-to-docx)
5. Save both files to `uploads/reports/`
6. Update Report document:
   - Set `pdfPath`, `wordPath`, `pdfSize`, `wordSize`
   - Call `Report.markAsLatest(reportId, projectId)` (transactional)
   - Set `status='final'`
7. Return `{ reportId, pdfPath, wordPath, version, status, latest }`

**Failure handling:**
- If ANY step fails, mark report as `status='failed'`
- Clean up partial files
- Throw error (no partial publish)

---

### 2. `reportRetrievalController.js`

**Purpose:** Unified retrieval layer for Admin and Expert panels.

#### Endpoints:

**`GET /api/reports/latest/:projectId`**
Returns metadata for the latest report:
```json
{
  "reportId": "64a5f...",
  "version": 3,
  "versionLabel": "v3 (Latest)",
  "status": "final",
  "latest": true,
  "files": {
    "pdf": {
      "downloadUrl": "http://localhost:3000/api/reports/64a5f.../pdf",
      "viewUrl": "http://localhost:3000/api/reports/64a5f.../pdf?inline=true",
      "size": 524288,
      "sizeFormatted": "512.00 KB"
    },
    "word": {
      "downloadUrl": "http://localhost:3000/api/reports/64a5f.../word",
      "size": 327680,
      "sizeFormatted": "320.00 KB"
    }
  }
}
```

**`GET /api/reports/:reportId/pdf?inline=true`**
Serves PDF file (inline or download).

**Validation:**
- Checks if file exists on disk
- Warns if serving non-latest version (logs warning but allows)
- Sets headers: `X-Report-Version`, `X-Report-Latest`

**`GET /api/reports/:reportId/word`**
Serves Word file (always download).

**`GET /api/reports/list/:projectId`**
Lists all report versions for a project (Admin only).

**`GET /api/reports/validate/:reportId`**
Validates report consistency:
- PDF and Word paths exist
- Files exist on disk
- Status is not 'failed' or 'generating'
- Is latest version
- Returns `{ isValid, errors, warnings }`

---

### 3. `reportController.js` - New Function

**`exports.generateReportAtomic`** (POST `/api/reports/generate-atomic`)

Complete report generation flow:
1. Collect analysis data (`collectAnalysisData`)
2. Build report metrics (`buildReportMetrics`)
3. Generate charts (`chartGenerationService.generateAllCharts`)
4. Build top risk drivers (`buildTopRiskDriversTable`)
5. Generate narrative (`geminiService.generateReport`)
6. Generate HTML (`generateHTMLReport`)
7. **Call `generateReportFilesAtomic`** (PDF + Word atomically)
8. Notify assigned experts
9. Return success response with file URLs

---

## 🎨 Frontend Integration

### Admin Panel ("Created Reports")

```javascript
// On page load
async function loadLatestReport(projectId) {
  const response = await fetch(`/api/reports/latest/${projectId}`);
  const report = await response.json();
  
  // Display report info
  displayReportCard({
    version: report.versionLabel,
    generatedAt: report.generatedAt,
    pdfUrl: report.files.pdf.downloadUrl,
    wordUrl: report.files.word.downloadUrl,
    pdfSize: report.files.pdf.sizeFormatted,
    wordSize: report.files.word.sizeFormatted
  });
}

// Generate new report button
async function generateReport(projectId) {
  showLoading('Generating report (PDF + Word)...');
  
  const response = await fetch('/api/reports/generate-atomic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, userId })
  });
  
  const result = await response.json();
  
  if (result.success) {
    showSuccess(`Report v${result.version} generated successfully!`);
    // Reload report list (will show new version automatically)
    await loadLatestReport(projectId);
  } else {
    showError(result.error);
  }
}
```

### Expert Panel ("Reports" Section)

```javascript
// On page load
async function loadExpertReport(projectId) {
  const response = await fetch(`/api/reports/latest/${projectId}?userId=${currentUserId}`);
  const report = await response.json();
  
  // Display "View Report" button
  document.getElementById('viewReportBtn').onclick = () => {
    // Open PDF inline
    window.open(report.files.pdf.viewUrl, '_blank');
  };
  
  // Display "Download PDF" button
  document.getElementById('downloadPdfBtn').onclick = () => {
    window.location.href = report.files.pdf.downloadUrl;
  };
  
  // Display "Download Word" button
  document.getElementById('downloadWordBtn').onclick = () => {
    window.location.href = report.files.word.downloadUrl;
  };
}
```

### ⚠️ Critical UI Rules

1. **Never store file URLs in localStorage** - always fetch from backend
2. **Always show version label** (`v3 (Latest)`)
3. **Disable "Generate Report" button while generating** (status='generating')
4. **Show error if report failed** (status='failed')
5. **Refresh report list after generation** to show new version

---

## 🧪 Testing Checklist

### Scenario 1: Fresh Report Generation
```bash
# 1. Generate first report
POST /api/reports/generate-atomic
Body: { "projectId": "64a5f...", "userId": "admin123" }

# Expected:
# - Report v1 created
# - PDF and Word files created in uploads/reports/
# - Report.latest = true, Report.status = 'final'

# 2. Check Admin Panel
GET /api/reports/latest/64a5f...
# Expected: { version: 1, latest: true, files: { pdf: {...}, word: {...} } }

# 3. Check Expert Panel
GET /api/reports/latest/64a5f...?userId=expert123
# Expected: Same as Admin (same reportId, version, files)
```

### Scenario 2: Regenerate Report (Version Increment)
```bash
# 1. Generate second report
POST /api/reports/generate-atomic
Body: { "projectId": "64a5f...", "userId": "admin123" }

# Expected:
# - Report v2 created
# - Old v1: latest=false
# - New v2: latest=true

# 2. Check latest
GET /api/reports/latest/64a5f...
# Expected: { version: 2, latest: true }

# 3. Verify old version still accessible
GET /api/reports/list/64a5f...
# Expected: [{ version: 2, latest: true }, { version: 1, latest: false }]
```

### Scenario 3: Partial Generation Failure
```bash
# 1. Simulate failure (e.g., Puppeteer crashes during PDF generation)
POST /api/reports/generate-atomic
# → Exception thrown during PDF generation

# Expected:
# - Report marked as status='failed'
# - Report.latest = false
# - No partial files created (cleanup runs)
# - Old latest report remains latest=true
# - Error response returned to client

# 2. Verify old report still latest
GET /api/reports/latest/64a5f...
# Expected: Still returns old version (latest=true unchanged)
```

### Scenario 4: File Consistency Validation
```bash
# 1. Validate a report
GET /api/reports/validate/64a5f...

# Expected response:
{
  "reportId": "64a5f...",
  "projectId": "project123",
  "version": 2,
  "status": "final",
  "latest": true,
  "isValid": true,
  "errors": [],
  "warnings": [],
  "files": {
    "pdf": { "exists": true, "size": 524288 },
    "word": { "exists": true, "size": 327680 }
  }
}
```

### Scenario 5: Stale Report Access
```bash
# 1. User bookmarks old report URL
# (Report v1 URL is bookmarked)

# 2. Admin generates new report (v2)
POST /api/reports/generate-atomic
# → v2 becomes latest

# 3. User clicks bookmarked URL (v1)
GET /api/reports/64a5f_OLD_ID/pdf

# Expected:
# - PDF is served (backward compatibility)
# - Console logs: "⚠️ STALE REPORT ACCESS: User requested v1 but latest is v2"
# - Response headers include: X-Report-Latest: false, X-Report-Version: 1
```

---

## 🔒 Acceptance Criteria (MUST PASS)

### ✅ After Generating a New Report:

1. **Admin Panel:**
   - Shows updated PDF + Word immediately (no cache, no refresh needed)
   - Version number increments correctly
   - File sizes displayed correctly

2. **Expert Panel:**
   - Shows updated View + PDF + Word immediately
   - "View Report" opens latest PDF inline
   - "Download PDF/Word" downloads latest files

3. **Version Consistency:**
   - Admin and Expert see the SAME `reportId`
   - Admin and Expert see the SAME `version`
   - Admin and Expert get files from the SAME report document

4. **File Integrity:**
   - PDF and Word exist on disk
   - PDF size > 0, Word size > 0
   - Files contain expected content (charts, narrative)

5. **Database Integrity:**
   - Only ONE report has `latest=true` per project
   - All other reports have `latest=false`
   - Version numbers are sequential (no gaps)

6. **Error Handling:**
   - If generation fails, old report remains `latest=true`
   - Failed report is marked `status='failed'`, `latest=false`
   - No partial files left on disk
   - Client receives clear error message

7. **Notifications:**
   - Assigned experts receive notification
   - Notification includes report version and deep link

---

## 🚀 Deployment Checklist

### Before Deploying:

1. **Run migrations** (if using migration scripts)
   - Add `latest`, `pdfPath`, `wordPath`, `pdfSize`, `wordSize` fields to existing reports
   - Mark most recent report per project as `latest=true`

2. **Create `uploads/reports/` directory**
   ```bash
   mkdir -p backend/uploads/reports
   chmod 755 backend/uploads/reports
   ```

3. **Install dependencies**
   ```bash
   npm install puppeteer html-to-docx docx --save
   ```

4. **Test Puppeteer on server**
   ```bash
   # If running on Linux server, install dependencies:
   sudo apt-get install -y \
     libnss3 libatk1.0-0 libatk-bridge2.0-0 \
     libcups2 libxcomposite1 libxdamage1 libxrandr2 \
     libgbm1 libasound2
   ```

5. **Update environment variables** (if needed)
   ```env
   UPLOADS_DIR=./uploads
   MAX_REPORT_SIZE_MB=50
   ```

### After Deploying:

1. **Smoke test:**
   ```bash
   # Generate a report for a test project
   curl -X POST http://localhost:3000/api/reports/generate-atomic \
     -H "Content-Type: application/json" \
     -d '{"projectId":"TEST_PROJECT_ID","userId":"ADMIN_USER_ID"}'
   ```

2. **Verify files created:**
   ```bash
   ls -lh backend/uploads/reports/
   # Should see .pdf and .docx files
   ```

3. **Check database:**
   ```javascript
   // In mongo shell:
   db.reports.find({ projectId: ObjectId("TEST_PROJECT_ID") }).sort({ version: -1 })
   // Should see latest=true on most recent report
   ```

4. **Test from UI:**
   - Log in as Admin → Generate report → Verify PDF + Word download
   - Log in as Expert → View report → Verify same version as Admin

---

## 📊 Monitoring & Logging

### Key Log Messages:

```
✅ Success:
🚀 Starting ATOMIC report generation for project: 64a5f...
📊 Generating charts...
📄 Generating HTML report...
🔒 Starting ATOMIC file generation (PDF + Word)...
✅ ATOMIC REPORT GENERATION COMPLETED in 4523ms

❌ Errors:
❌ ATOMIC REPORT GENERATION FAILED: Puppeteer crashed
⚠️  Report 64a5f... marked as failed

⚠️  Warnings:
⚠️  STALE REPORT ACCESS: User requested report 64a5f_OLD but latest is 64a5f_NEW
⚠️  Report 64a5f... validation warnings: Word path missing
```

### Metrics to Track:

- **Report generation duration** (metadata.generationDurationMs)
- **PDF file size** (pdfSize)
- **Word file size** (wordSize)
- **Failed generation rate** (count of status='failed')
- **Stale access count** (how often users access old versions)

---

## 🔄 Migration Guide (Existing Projects)

If you already have reports in the old format (without `latest`, `pdfPath`, `wordPath`):

### Migration Script:

```javascript
// backend/scripts/migrateReportsToVersionControl.js
const mongoose = require('mongoose');
const Report = mongoose.model('Report');

async function migrateReports() {
  console.log('🔄 Migrating reports to version control...');

  const projects = await Report.distinct('projectId');

  for (const projectId of projects) {
    // Get all reports for this project, sorted by generatedAt desc
    const reports = await Report.find({ projectId }).sort({ generatedAt: -1 });

    // Mark the most recent one as latest=true
    if (reports.length > 0) {
      const latestReport = reports[0];
      latestReport.latest = true;
      latestReport.version = latestReport.version || 1;
      await latestReport.save();
      console.log(`✅ Marked report ${latestReport._id} as latest for project ${projectId}`);
    }

    // Mark all others as latest=false
    for (let i = 1; i < reports.length; i++) {
      reports[i].latest = false;
      reports[i].version = reports[i].version || (reports.length - i);
      await reports[i].save();
    }
  }

  console.log('✅ Migration complete');
}

// Run migration
migrateReports().then(() => process.exit(0)).catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
```

Run:
```bash
node backend/scripts/migrateReportsToVersionControl.js
```

---

## 🎯 Summary

### What This System Guarantees:

1. ✅ **PDF and Word ALWAYS generated together** (no drift)
2. ✅ **Admin and Expert ALWAYS see the same version** (no mismatch)
3. ✅ **Only ONE latest report per project** (no ambiguity)
4. ✅ **Atomic operations** (no partial failures)
5. ✅ **File integrity validation** (before serving)
6. ✅ **Version history** (all old reports accessible)
7. ✅ **Clear error handling** (failed generation doesn't break latest)

### What This System Does NOT Do:

- ❌ Does NOT regenerate files on download (files are generated once, served many times)
- ❌ Does NOT rely on frontend state to determine "latest" (backend is source of truth)
- ❌ Does NOT allow PDF and Word to be generated independently (atomic only)

---

## 📞 Support

For issues or questions:
1. Check logs: `backend/uploads/reports/` for files, MongoDB for Report documents
2. Run validation: `GET /api/reports/validate/:reportId`
3. Check version consistency: `GET /api/reports/list/:projectId`
4. If generation fails, check `errorDetails` field in Report document

---

**Implementation Date:** January 2026  
**Scoring Model:** ERC v1 (Ethical Risk Contribution)  
**Status:** ✅ Production-Ready

