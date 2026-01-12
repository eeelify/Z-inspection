# Welcome Email with Role-Based PDF Attachments

This document describes the implementation of role-based welcome emails with PDF attachments in the Z-Inspection Platform.

## Overview

After successful user registration, a welcome email is automatically sent with a role-specific user guide PDF attachment. The system selects the appropriate PDF based on the user's role.

## Implementation Details

### Files Modified/Created

1. **`backend/utils/guideSelector.js`** (NEW)
   - Helper functions to select and read PDF guides based on user role
   - Functions: `getGuideFilename()`, `getGuidePath()`, `guideExists()`, `readGuideAsBase64()`

2. **`backend/services/emailService.js`** (MODIFIED)
   - Added `sendWelcomeEmail()` function with PDF attachment support
   - Uses Resend API attachments feature

3. **`backend/server.js`** (MODIFIED)
   - Updated `/api/auth/verify-code-and-register` endpoint to use `sendWelcomeEmail()`

4. **`backend/assets/guides/`** (NEW DIRECTORY)
   - Contains role-specific PDF guides
   - See `backend/assets/guides/README.md` for details

### Role Mapping

The system maps user roles to PDF guides as follows:

| User Role | PDF Guide |
|-----------|-----------|
| `admin` | `admin-guide.pdf` |
| `ethical-expert` | `experts-guide.pdf` |
| `medical-expert` | `experts-guide.pdf` |
| `technical-expert` | `experts-guide.pdf` |
| `legal-expert` | `experts-guide.pdf` |
| `education-expert` | `experts-guide.pdf` |
| `use-case-owner` | `usecase-owner-guide.pdf` |
| Other/Unknown | No attachment (email sent without PDF) |

**Note**: All expert roles share the same `experts-guide.pdf` file.

### Environment Variables

#### Required
- `RESEND_API_KEY` - Resend API key for sending emails
- `EMAIL_FROM` - Email sender address (optional, defaults to `Z-Inspection <no-reply@resend.dev>`)

#### Optional
- `WELCOME_ATTACHMENTS_ENABLED` - Enable/disable PDF attachments (default: `true`)
  - Set to `false` to send welcome emails without attachments
  - Example: `WELCOME_ATTACHMENTS_ENABLED=false`

### PDF File Requirements

Place the following PDF files in `backend/assets/guides/`:

1. **admin-guide.pdf** - Admin user guide
2. **experts-guide.pdf** - Expert roles user guide (shared by all expert types)
3. **usecase-owner-guide.pdf** - Use-case-owner user guide

**Important Notes:**
- File names are case-sensitive
- Files must be valid PDF format
- If a PDF is missing, the welcome email will still be sent but without attachment
- The system logs warnings when PDF files are missing

### Email Content

The welcome email includes:
- **Subject**: "Welcome to Z-Inspection Platform"
- **HTML Body**: Professional welcome message with user's name
- **Attachment**: Role-specific PDF guide (if enabled and file exists)
- **Text Version**: Plain text fallback for email clients

The email body includes: "Attached is your role-specific User Guide (PDF)." when an attachment is included.

### Logging

The system provides detailed logging for debugging:

```
[WELCOME] sending welcome mail to user@example.com role=admin attachment=admin-guide.pdf
[WELCOME] PDF attachment prepared: admin-guide.pdf
[WELCOME] sent status=200 to user@example.com
```

If attachment fails:
```
[WELCOME] Failed to attach PDF admin-guide.pdf: Guide file not found: ...
```

### Error Handling

- If `RESEND_API_KEY` is not configured, welcome email is skipped (non-blocking)
- If PDF file is missing, email is sent without attachment (non-blocking)
- If PDF read fails, email is sent without attachment (non-blocking)
- Registration never fails due to email issues (non-blocking)

### Railway Deployment

The implementation is Railway-compatible:

1. **Path Resolution**: Uses `path.resolve(__dirname, ...)` for reliable file paths
2. **Base64 Encoding**: PDFs are read and encoded as base64 for Resend API
3. **Environment Variables**: Configure in Railway dashboard → Variables

#### Railway Setup Steps

1. Add environment variables in Railway:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   EMAIL_FROM=Z-Inspection <noreply@yourdomain.com>
   WELCOME_ATTACHMENTS_ENABLED=true  # Optional, defaults to true
   ```

2. Ensure PDF files are in the repository:
   ```
   backend/assets/guides/admin-guide.pdf
   backend/assets/guides/experts-guide.pdf
   backend/assets/guides/usecase-owner-guide.pdf
   ```

3. Deploy to Railway (files are included in deployment)

### Testing

To test the welcome email:

1. Register a new user via `/api/auth/verify-code-and-register`
2. Check server logs for `[WELCOME]` messages
3. Verify email is received with correct PDF attachment
4. Test different roles to verify correct PDF selection

### Troubleshooting

#### Email Not Sent
- Check `RESEND_API_KEY` is set in environment variables
- Verify Resend API key is valid
- Check server logs for error messages

#### PDF Attachment Missing
- Verify PDF file exists in `backend/assets/guides/`
- Check file name matches exactly (case-sensitive)
- Verify `WELCOME_ATTACHMENTS_ENABLED` is not set to `false`
- Check logs for file read errors

#### Wrong PDF Attached
- Verify role mapping in `backend/utils/guideSelector.js`
- Check user's role value matches expected format
- Review logs to see which PDF was selected

### Code Structure

```
backend/
├── assets/
│   └── guides/
│       ├── admin-guide.pdf
│       ├── experts-guide.pdf
│       ├── usecase-owner-guide.pdf
│       └── README.md
├── services/
│   └── emailService.js          # sendWelcomeEmail() function
├── utils/
│   └── guideSelector.js          # PDF selection helpers
└── server.js                     # Registration endpoint
```

### Future Enhancements

Potential improvements:
- Support for multiple languages (PDFs per language)
- Custom email templates per role
- Email tracking and analytics
- Retry mechanism for failed email sends
- Email preview/testing endpoint

