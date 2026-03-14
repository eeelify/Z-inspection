const path = require('path');
const fs = require('fs');

/**
 * Get the PDF guide filename based on user role
 * @param {string} role - User role (admin, ethical-expert, medical-expert, etc.)
 * @returns {string|null} - PDF filename or null if no guide for this role
 */
function getGuideFilename(role) {
  if (!role) {
    return null;
  }

  const normalizedRole = role.toLowerCase().trim();

  // Admin guide
  if (normalizedRole === 'admin') {
    return 'admin-guide.pdf';
  }

  // Use-case-owner guide
  if (normalizedRole === 'use-case-owner') {
    return 'usecase-owner-guide.pdf';
  }

  // All expert roles share the same guide
  // Expert roles: ethical-expert, medical-expert, technical-expert, legal-expert, education-expert
  if (normalizedRole.includes('-expert') || normalizedRole.endsWith('expert')) {
    return 'experts-guide.pdf';
  }

  // Default: no attachment (safer option - don't send wrong guide)
  return null;
}

/**
 * Get the full path to a guide PDF file
 * @param {string} filename - PDF filename (e.g., 'admin-guide.pdf')
 * @returns {string} - Full path to the PDF file
 */
function getGuidePath(filename) {
  // Use path.resolve with __dirname to ensure Railway compatibility
  // __dirname will be the directory where this file is located (utils/)
  // So we go up one level (..) then into assets/guides/
  return path.resolve(__dirname, '../assets/guides', filename);
}

/**
 * Check if a guide PDF file exists
 * @param {string} filename - PDF filename
 * @returns {boolean} - True if file exists
 */
function guideExists(filename) {
  if (!filename) {
    return false;
  }
  const filePath = getGuidePath(filename);
  return fs.existsSync(filePath);
}

/**
 * Read a guide PDF file and return as base64
 * @param {string} filename - PDF filename
 * @returns {Promise<string>} - Base64 encoded PDF content
 * @throws {Error} If file doesn't exist or can't be read
 */
async function readGuideAsBase64(filename) {
  if (!filename) {
    throw new Error('Guide filename is required');
  }

  const filePath = getGuidePath(filename);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Guide file not found: ${filePath}`);
  }

  const fileBuffer = await fs.promises.readFile(filePath);
  return fileBuffer.toString('base64');
}

module.exports = {
  getGuideFilename,
  getGuidePath,
  guideExists,
  readGuideAsBase64
};

