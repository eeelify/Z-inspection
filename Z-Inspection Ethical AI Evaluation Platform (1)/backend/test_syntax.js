
try {
    console.log('Checking htmlReportTemplateService...');
    const templateService = require('./services/htmlReportTemplateService');
    console.log('htmlReportTemplateService loaded successfully.');

    console.log('Checking geminiService...');
    const geminiService = require('./services/geminiService');
    console.log('geminiService loaded successfully.');

    console.log('Checking reportMetricsService...');
    const reportMetricsService = require('./services/reportMetricsService');
    console.log('reportMetricsService loaded successfully.');

    console.log('All syntax checks passed.');
} catch (error) {
    console.error('SYNTAX ERROR DETECTED:');
    const fs = require('fs');
    fs.writeFileSync('error_details.txt', error.toString() + '\n' + (error.stack || ''));
    console.error('SYNTAX ERROR DETECTED. See error_details.txt');
    process.exit(1);
}
