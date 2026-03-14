const puppeteer = require('puppeteer');
const marked = require('marked');

/**
 * Convert Markdown content to PDF
 * @param {string} markdownContent - Markdown formatted content
 * @param {string} title - Report title
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generatePDFFromMarkdown(markdownContent, title = 'Report') {
  let browser;
  try {
    // Convert Markdown to HTML
    const htmlContent = marked.parse(markdownContent);
    
    // Create full HTML document with styling
    const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      margin: 2cm;
      size: A4;
    }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      margin: 0;
      padding: 20px;
    }
    h1 {
      font-size: 24pt;
      color: #1a1a1a;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
      margin-top: 0;
      margin-bottom: 20px;
      page-break-after: avoid;
    }
    h2 {
      font-size: 18pt;
      color: #2563eb;
      margin-top: 30px;
      margin-bottom: 15px;
      page-break-after: avoid;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 5px;
    }
    h3 {
      font-size: 14pt;
      color: #4b5563;
      margin-top: 20px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    h4 {
      font-size: 12pt;
      color: #6b7280;
      margin-top: 15px;
      margin-bottom: 8px;
    }
    p {
      margin: 10px 0;
      text-align: justify;
    }
    ul, ol {
      margin: 10px 0;
      padding-left: 30px;
    }
    li {
      margin: 5px 0;
    }
    strong {
      font-weight: bold;
      color: #1a1a1a;
    }
    em {
      font-style: italic;
    }
    code {
      background-color: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 10pt;
    }
    pre {
      background-color: #f3f4f6;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #2563eb;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    blockquote {
      border-left: 4px solid #2563eb;
      padding-left: 15px;
      margin: 15px 0;
      color: #6b7280;
      font-style: italic;
    }
    hr {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 30px 0;
    }
    .page-break {
      page-break-before: always;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
    `;

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set content and wait for it to load
    await page.setContent(fullHTML, {
      waitUntil: 'networkidle0'
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '2cm',
        right: '2cm',
        bottom: '2cm',
        left: '2cm'
      },
      printBackground: true,
      preferCSSPageSize: true
    });

    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  generatePDFFromMarkdown
};

