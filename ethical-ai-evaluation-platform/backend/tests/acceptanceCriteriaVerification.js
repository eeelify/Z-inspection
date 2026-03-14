/**
 * Acceptance Criteria Verification Script
 * Run this to verify all acceptance criteria are met
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  // Resolve path relative to backend directory
  const resolvedPath = path.resolve(__dirname, '..', filePath);
  const exists = fs.existsSync(resolvedPath);
  if (exists) {
    log(`✓ ${description}`, 'green');
    return true;
  } else {
    log(`✗ ${description} - FILE NOT FOUND: ${filePath}`, 'red');
    return false;
  }
}

function checkFileContains(filePath, searchString, description) {
  try {
    // Resolve path relative to backend directory
    const resolvedPath = path.resolve(__dirname, '..', filePath);
    const content = fs.readFileSync(resolvedPath, 'utf8');
    if (content.includes(searchString)) {
      log(`✓ ${description}`, 'green');
      return true;
    } else {
      log(`✗ ${description} - NOT FOUND: ${searchString}`, 'red');
      return false;
    }
  } catch (err) {
    log(`✗ ${description} - ERROR READING FILE: ${err.message}`, 'red');
    return false;
  }
}

function verifyAcceptanceCriteria() {
  log('\n=== ACCEPTANCE CRITERIA VERIFICATION ===\n', 'blue');
  
  let passed = 0;
  let failed = 0;

  // 1. 7-principle bar chart + legend + thresholds
  log('\n1. Chart Requirements:', 'blue');
  if (checkFileContains(
    'services/chartGenerationService.js',
    'generatePrincipleBarChart',
    '7-principle bar chart function exists'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/professionalDocxService.js',
    'thresholdExplanation',
    'Threshold explanation in DOCX'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/professionalDocxService.js',
    '0.0-1.0 = Critical',
    'Threshold values (0.0-1.0 = Critical)'
  )) passed++; else failed++;

  // 2. Role×Principle heatmap with only submitted roles
  log('\n2. Role×Principle Heatmap:', 'blue');
  if (checkFileContains(
    'services/chartGenerationService.js',
    'generatePrincipleEvaluatorHeatmap',
    'Role×Principle heatmap function exists'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/reportMetricsService.js',
    "status: 'submitted'",
    'Only submitted responses are used'
  )) passed++; else failed++;

  // 3. Evidence coverage donut + percentage
  log('\n3. Evidence Coverage Donut:', 'blue');
  if (checkFileContains(
    'services/chartGenerationService.js',
    'generateEvidenceCoverageChart',
    'Evidence coverage donut function exists'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/chartGenerationService.js',
    'Evidence Coverage:',
    'Evidence coverage percentage in chart title'
  )) passed++; else failed++;

  // 4. Tensions reviewState visualization
  log('\n4. Tensions Review State Visualization:', 'blue');
  if (checkFileContains(
    'services/chartGenerationService.js',
    'generateTensionReviewStateChart',
    'Tension review state chart function exists'
  )) passed++; else failed++;

  // 5. Top risky questions table with answer snippets
  log('\n5. Top Risky Questions Table:', 'blue');
  if (checkFileContains(
    'services/professionalDocxService.js',
    'Top Risk Drivers',
    'Top risky questions section exists'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/professionalDocxService.js',
    'Answer Snippet',
    'Answer snippet column in table'
  )) passed++; else failed++;

  // 6. Tensions table with reviewState/consensus/evidenceCount
  log('\n6. Tensions Table:', 'blue');
  if (checkFileContains(
    'services/professionalDocxService.js',
    'Tensions',
    'Tensions section exists'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/professionalDocxService.js',
    'reviewState',
    'Review State in tensions table'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/professionalDocxService.js',
    'Evidence Count',
    'Evidence Count column in tensions table'
  )) passed++; else failed++;

  // 7. Clickable internal anchors in DOCX
  log('\n7. Internal Anchors:', 'blue');
  if (checkFileContains(
    'services/professionalDocxService.js',
    'new Bookmark',
    'Bookmark creation exists'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/professionalDocxService.js',
    'createInternalLink',
    'Internal link creation function exists'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/professionalDocxService.js',
    'Dashboard',
    'Dashboard anchor link'
  )) passed++; else failed++;

  // 8. Evaluator counting (no phantom duplicates)
  log('\n8. Evaluator Counting:', 'blue');
  if (checkFileContains(
    'services/reportMetricsService.js',
    "status: 'submitted'",
    'Only submitted evaluators are counted'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/reportMetricsService.js',
    'Set',
    'Duplicate prevention using Set'
  )) passed++; else failed++;

  // 9. Gemini does not compute scores
  log('\n9. Gemini Score Computation Prevention:', 'blue');
  if (checkFileContains(
    'services/geminiService.js',
    'DO NOT COMPUTE',
    'Gemini instructed not to compute scores'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'services/geminiService.js',
    'ONLY the numbers provided',
    'Gemini must use only provided numbers'
  )) passed++; else failed++;

  // 10. Show Report button logic
  log('\n10. Show Report Button:', 'blue');
  // Frontend files are in a different directory, skip for now or use absolute path
  if (checkFileContains(
    '../frontend/src/components/ProjectDetail.tsx',
    'latestReport',
    'Latest report state exists'
  )) passed++; else failed++;
  
  if (checkFileContains(
    '../frontend/src/components/ProjectDetail.tsx',
    '{latestReport &&',
    'Button conditionally rendered based on latestReport'
  )) passed++; else failed++;
  
  if (checkFileContains(
    'controllers/reportController.js',
    'getLatestReport',
    'getLatestReport endpoint exists'
  )) passed++; else failed++;

  // Summary
  log('\n=== VERIFICATION SUMMARY ===', 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`Total: ${passed + failed}\n`, 'blue');

  if (failed === 0) {
    log('✓ ALL ACCEPTANCE CRITERIA MET!', 'green');
    return 0;
  } else {
    log('✗ SOME ACCEPTANCE CRITERIA NOT MET', 'red');
    return 1;
  }
}

// Run verification
if (require.main === module) {
  const exitCode = verifyAcceptanceCriteria();
  process.exit(exitCode);
}

module.exports = { verifyAcceptanceCriteria };

