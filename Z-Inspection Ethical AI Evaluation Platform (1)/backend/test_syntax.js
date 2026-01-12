
try {
    console.log('Checking htmlReportTemplateService...');
    const templateService = require('./services/htmlReportTemplateService');
    console.log('htmlReportTemplateService loaded successfully.');

    console.log('Checking geminiService...');
    const geminiService = require('./services/geminiService');
    console.log('geminiService loaded successfully.');

    console.log('All syntax checks passed.');
} catch (error) {
    console.error('SYNTAX ERROR DETECTED:');
    console.error(error);
}
