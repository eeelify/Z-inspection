# User Guide PDFs

This directory contains role-specific user guide PDFs that are automatically attached to welcome emails.

## Required Files

Place the following PDF files in this directory:

1. **admin-guide.pdf** - User guide for admin role
2. **experts-guide.pdf** - User guide for all expert roles (ethical-expert, medical-expert, technical-expert, legal-expert, education-expert)
3. **usecase-owner-guide.pdf** - User guide for use-case-owner role

## Role Mapping

- `admin` → `admin-guide.pdf`
- `ethical-expert` → `experts-guide.pdf`
- `medical-expert` → `experts-guide.pdf`
- `technical-expert` → `experts-guide.pdf`
- `legal-expert` → `experts-guide.pdf`
- `education-expert` → `experts-guide.pdf`
- `use-case-owner` → `usecase-owner-guide.pdf`
- Other roles → No attachment (email sent without PDF)

## Configuration

The attachment feature can be disabled by setting the environment variable:
```
WELCOME_ATTACHMENTS_ENABLED=false
```

If a PDF file is missing for a role, the welcome email will still be sent but without the attachment.

## Notes

- Files must be valid PDF format
- File names are case-sensitive
- The system will log warnings if a guide file is missing
- Attachments are sent as base64-encoded content via Resend API

