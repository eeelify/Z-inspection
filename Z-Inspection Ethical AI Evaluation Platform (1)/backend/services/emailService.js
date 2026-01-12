const { Resend } = require('resend');
const { getGuideFilename, guideExists, readGuideAsBase64 } = require('../utils/guideSelector');

// Initialize Resend client only if API key is present
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Get the from email address
 */
function getFromEmail() {
  return process.env.EMAIL_FROM || 'Z-Inspection <no-reply@resend.dev>';
}

/**
 * Send verification email using Resend API
 * @param {string} to - Recipient email address
 * @param {string} code - 6-digit verification code
 * @throws {Error} If Resend API call fails
 */
async function sendVerificationEmail(to, code) {
  if (!resend || !process.env.RESEND_API_KEY) {
    console.log('[MAIL] Email service not configured (RESEND_API_KEY missing) - skipping email to:', to);
    throw new Error('Email service is not configured. Please set RESEND_API_KEY in environment variables.');
  }

  console.log('[MAIL] env present:', { 
    hasKey: !!process.env.RESEND_API_KEY, 
    hasFrom: !!process.env.EMAIL_FROM 
  });
  
  console.log('[MAIL] Resend sending to:', to);

  const from = getFromEmail();
  const subject = 'Your verification code for Z-Inspection Platform';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1F2937; margin-bottom: 20px;">Verification Code</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Your verification code for Z-Inspection Platform is:
      </p>
      <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="font-size: 32px; font-weight: bold; color: #1F2937; margin: 0; letter-spacing: 4px;">
          ${code}
        </p>
      </div>
      <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
        This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      <p style="color: #9CA3AF; font-size: 12px;">
        This is an automated message from Z-Inspection Platform.
      </p>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html
    });

    console.log('[MAIL] Resend sent successfully');
    return result;
  } catch (error) {
    console.error('[MAIL] Resend error:', error);
    throw error;
  }
}

/**
 * Send a generic email using Resend API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {string} text - Plain text content (optional)
 * @throws {Error} If Resend API call fails
 */
async function sendEmail(to, subject, html, text = null) {
  if (!resend || !process.env.RESEND_API_KEY) {
    console.log('[MAIL] Email service not configured (RESEND_API_KEY missing) - skipping email to:', to);
    throw new Error('Email service is not configured. Please set RESEND_API_KEY in environment variables.');
  }

  const from = getFromEmail();
  
  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(text && { text })
    });

    console.log('[MAIL] Resend sent successfully to:', to);
    return result;
  } catch (error) {
    console.error('[MAIL] Resend error:', error);
    throw error;
  }
}

/**
 * Send welcome email with role-based PDF attachment
 * @param {string} to - Recipient email address
 * @param {string} name - Recipient name
 * @param {string} role - User role (admin, ethical-expert, medical-expert, use-case-owner, etc.)
 * @throws {Error} If Resend API call fails
 */
async function sendWelcomeEmail(to, name, role) {
  if (!resend || !process.env.RESEND_API_KEY) {
    console.log('[WELCOME] Email service not configured (RESEND_API_KEY missing) - skipping welcome email to:', to);
    throw new Error('Email service is not configured. Please set RESEND_API_KEY in environment variables.');
  }

  const attachmentsEnabled = process.env.WELCOME_ATTACHMENTS_ENABLED !== 'false';
  const guideFilename = attachmentsEnabled ? getGuideFilename(role) : null;
  const attachmentFilename = guideFilename || 'none';

  console.log(`[WELCOME] sending welcome mail to ${to} role=${role} attachment=${attachmentFilename}`);

  const from = getFromEmail();
  const subject = 'Welcome to Z-Inspection Platform';

  // Build attachments array if enabled and guide exists
  let attachments = [];
  if (attachmentsEnabled && guideFilename && guideExists(guideFilename)) {
    try {
      const base64Content = await readGuideAsBase64(guideFilename);
      attachments.push({
        filename: guideFilename,
        content: base64Content,
        content_type: 'application/pdf'
      });
      console.log(`[WELCOME] PDF attachment prepared: ${guideFilename}`);
    } catch (attachmentError) {
      console.error(`[WELCOME] Failed to attach PDF ${guideFilename}:`, attachmentError.message);
      // Continue without attachment rather than failing the email
    }
  } else if (attachmentsEnabled && guideFilename && !guideExists(guideFilename)) {
    console.warn(`[WELCOME] Guide file not found: ${guideFilename} - sending email without attachment`);
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1F2937; margin-bottom: 20px;">Welcome!</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello ${name},</p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">Welcome to Z-Inspection Ethical AI Evaluation Platform.</p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">You can now sign in with your account and start adding your projects.</p>
      ${attachments.length > 0 ? '<p style="color: #374151; font-size: 16px; line-height: 1.6;">Attached is your role-specific User Guide (PDF).</p>' : ''}
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      <p style="color: #9CA3AF; font-size: 12px;">This is an automated message from Z-Inspection Platform.</p>
    </div>
  `;

  const text = `Hello ${name},\n\nWelcome to Z-Inspection Ethical AI Evaluation Platform.\n\nYou can now sign in with your account and start adding your projects.${attachments.length > 0 ? '\n\nAttached is your role-specific User Guide (PDF).' : ''}\n\nThis is an automated message from Z-Inspection Platform.`;

  try {
    const emailPayload = {
      from,
      to,
      subject,
      html,
      text
    };

    // Add attachments if present
    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const result = await resend.emails.send(emailPayload);

    const statusCode = result?.data?.id ? 200 : (result?.status || 'unknown');
    console.log(`[WELCOME] sent status=${statusCode} to ${to}`);

    return result;
  } catch (error) {
    console.error('[WELCOME] Resend error:', error);
    if (error.response) {
      console.error('[WELCOME] Resend error response:', error.response);
    }
    throw error;
  }
}

module.exports = {
  sendVerificationEmail,
  sendEmail,
  sendWelcomeEmail
};

