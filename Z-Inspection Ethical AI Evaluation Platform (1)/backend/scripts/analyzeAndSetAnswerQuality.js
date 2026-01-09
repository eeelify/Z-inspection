/**
 * Intelligent Answer Quality Analyzer & Setter
 * 
 * 1. Scans all questions in MongoDB
 * 2. Finds all unique answer options
 * 3. Automatically assigns answerQuality based on comprehensive patterns
 * 4. Reports what was found and assigned
 * 
 * Run with: node backend/scripts/analyzeAndSetAnswerQuality.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI environment variable not found!');
}

mongoose.connect(MONGO_URI).catch((err) => {
  console.error('❌ MongoDB connection failed:', err);
  process.exit(1);
});

const Question = require('../models/question');

/**
 * Comprehensive Answer Quality mapping
 * Covers ALL patterns we've seen so far
 */
function inferAnswerQuality(optionKey, labelEn, labelTr) {
  const key = (optionKey || '').toLowerCase().trim();
  const en = (labelEn || '').toLowerCase().trim();
  const tr = (labelTr || '').toLowerCase().trim();
  const combined = `${key} ${en} ${tr}`;
  
  // === 1.0 - EXCELLENT/BEST ANSWERS ===
  const excellent = [
    // Yes patterns
    /\b(yes|evet)\b/,
    /\bexplicit consent obtained\b/,
    /\baçık rıza alınıyor\b/,
    /\banother legal basis\b/,
    /\bbir hukuki dayanak\b/,
    
    // Clarity
    /\bvery clear\b/,
    /\bçok net\b/,
    
    // Confidence
    /\bvery confident\b/,
    /\bçok emin\b/,
    
    // Compliance
    /\bfully compliant\b/,
    /\btam uyumlu\b/,
    /\bcompliant\b/,
    /\buyumlu\b/,
    
    // Implementation
    /\bfully implemented\b/,
    /\btamamen uygulan\b/,
    /\bin place\b/,
    
    // Degree
    /\bfully\b/,
    /\btamamen\b/,
    /\bcomplete\b/,
    
    // Likelihood
    /\bvery likely\b/,
    /\bçok muhtemel\b/,
    
    // Frequency
    /\balways\b/,
    /\bher zaman\b/,
    
    // Strength
    /\bstrong\b/,
    /\bgüçlü\b/,
    /\brobust\b/,
    
    // Quality
    /\badequate\b/,
    /\byeterli\b/,
    /\bsufficient\b/
  ];
  
  // === 0.75 - GOOD ANSWERS ===
  const good = [
    // Mostly
    /\bmostly\b/,
    /\bçoğunlukla\b/,
    
    // Clarity
    /\bmostly clear\b/,
    
    // Likelihood
    /\blikely\b/,
    /\bmuhtemel\b/,
    
    // Frequency
    /\bfrequently\b/,
    /\bsık sık\b/,
    
    // Implementation
    /\bmostly implemented\b/
  ];
  
  // === 0.5 - PARTIAL/NEUTRAL ANSWERS ===
  const partial = [
    // Partial
    /\bpartially\b/,
    /\bkısmen\b/,
    /\bpartially compliant\b/,
    
    // Clarity
    /\bsomewhat unclear\b/,
    /\bsomewhat clear\b/,
    
    // Confidence
    /\bsomewhat confident\b/,
    
    // Sometimes
    /\bsometimes\b/,
    /\bbazen\b/,
    
    // Possible
    /\bpossible\b/,
    /\bolası\b/,
    /\bmümkün\b/,
    
    // Unknown (neutral - we don't know)
    /\bunknown\b/,
    /\bbilinmiyor\b/,
    
    // Not enough information (neutral - can't assess)
    /\bnot enough information\b/,
    /\byeterli bilgi yok\b/,
    
    // Moderate
    /\bmoderate\b/,
    /\borta\b/,
    
    // Depends
    /\bdepends\b/,
    /\bbağlı\b/
  ];
  
  // === 0.25 - WEAK/POOR ANSWERS ===
  const weak = [
    // Not very
    /\bnot very confident\b/,
    /\bpek emin değil\b/,
    
    // Slightly
    /\bslightly\b/,
    /\bhafifçe\b/,
    /\bbiraz\b/,
    
    // Rarely
    /\brarely\b/,
    /\bnadiren\b/,
    
    // Unclear
    /\bunclear\b/,
    /\bbelirsiz\b/,
    
    // Unlikely
    /\bunlikely\b/,
    /\bolası değil\b/,
    
    // Weak
    /\bweak\b/,
    /\bzayıf\b/,
    
    // Inadequate
    /\binadequate\b/,
    /\byetersiz\b/
  ];
  
  // === 0.0 - BAD/NEGATIVE ANSWERS ===
  const bad = [
    // No
    /\b(^no$|^hayır$)\b/,
    /\bno\s*\/\s*hayır\b/,
    
    // Not at all
    /\bnot at all\b/,
    /\bhiç\b/,
    /\bhiçbir\b/,
    
    // Non-compliant
    /\bnon-compliant\b/,
    /\buyumlu değil\b/,
    
    // Not implemented
    /\bnot implemented\b/,
    /\buygulanmıyor\b/,
    
    // Completely unclear
    /\bcompletely unclear\b/,
    /\btamamen belirsiz\b/,
    
    // Never
    /\bnever\b/,
    /\bhiçbir zaman\b/,
    
    // Missing/None
    /\bmissing\b/,
    /\bnone\b/,
    /\byok\b/
  ];
  
  // Check in order: bad, weak, good, excellent, then partial (default)
  if (bad.some(pattern => pattern.test(combined))) return 0.0;
  if (weak.some(pattern => pattern.test(combined))) return 0.25;
  if (good.some(pattern => pattern.test(combined))) return 0.75;
  if (excellent.some(pattern => pattern.test(combined))) return 1.0;
  if (partial.some(pattern => pattern.test(combined))) return 0.5;
  
  // Default to 0.5 if no pattern matches
  console.warn(`⚠️  No pattern match for: "${key}" / "${en}" / "${tr}" - defaulting to 0.5`);
  return 0.5;
}

/**
 * Main analysis and update function
 */
async function analyzeAndSetAnswerQuality() {
  try {
    console.log('🔍 Starting comprehensive Answer Quality analysis...\n');
    
    // Get all select-based questions
    const questions = await Question.find({
      answerType: { $in: ['single_choice', 'multi_choice'] }
    });
    
    console.log(`📊 Found ${questions.length} select-based questions\n`);
    
    // Collect all unique options
    const allOptions = new Map(); // key -> {labelEn, labelTr, count, questions[]}
    
    for (const question of questions) {
      if (!question.options || question.options.length === 0) continue;
      
      for (const option of question.options) {
        if (!option.key) continue;
        
        const key = option.key;
        if (!allOptions.has(key)) {
          allOptions.set(key, {
            key: key,
            labelEn: option.label?.en || '',
            labelTr: option.label?.tr || '',
            count: 0,
            questions: [],
            hasAnswerQuality: false
          });
        }
        
        const optData = allOptions.get(key);
        optData.count++;
        optData.questions.push(`${question.code} (${question.questionnaireKey})`);
        
        if (option.answerQuality !== undefined && option.answerQuality !== null) {
          optData.hasAnswerQuality = true;
        }
      }
    }
    
    console.log(`📋 Found ${allOptions.size} unique answer options\n`);
    
    // Analyze and assign
    let totalUpdated = 0;
    let optionsUpdated = 0;
    let optionsSkipped = 0;
    
    const assignedValues = new Map(); // answerQuality -> options[]
    
    for (const question of questions) {
      if (!question.options || question.options.length === 0) {
        continue;
      }
      
      let needsUpdate = false;
      
      for (const option of question.options) {
        if (!option.key) continue;
        
        // Check if already has valid answerQuality
        if (option.answerQuality !== undefined && 
            option.answerQuality !== null && 
            option.answerQuality >= 0 && 
            option.answerQuality <= 1) {
          optionsSkipped++;
          continue;
        }
        
        // Infer and assign
        const aq = inferAnswerQuality(
          option.key, 
          option.label?.en, 
          option.label?.tr
        );
        
        option.answerQuality = aq;
        needsUpdate = true;
        optionsUpdated++;
        
        // Track assignments
        if (!assignedValues.has(aq)) {
          assignedValues.set(aq, []);
        }
        assignedValues.get(aq).push({
          key: option.key,
          en: option.label?.en || '',
          tr: option.label?.tr || '',
          question: question.code
        });
      }
      
      if (needsUpdate) {
        // Also update optionScores for backward compatibility
        const optionScores = {};
        for (const option of question.options) {
          if (option.key && option.answerQuality !== undefined) {
            optionScores[option.key] = option.answerQuality;
          }
        }
        question.optionScores = optionScores;
        
        await question.save();
        totalUpdated++;
      }
    }
    
    // === REPORT ===
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALYSIS COMPLETE');
    console.log('='.repeat(80) + '\n');
    
    console.log(`✅ Questions updated: ${totalUpdated}`);
    console.log(`✅ Options assigned answerQuality: ${optionsUpdated}`);
    console.log(`⏭️  Options skipped (already have): ${optionsSkipped}`);
    console.log(`📝 Total unique options: ${allOptions.size}\n`);
    
    // Show assignments by value
    console.log('='.repeat(80));
    console.log('📈 ASSIGNED VALUES BREAKDOWN');
    console.log('='.repeat(80) + '\n');
    
    const sortedValues = Array.from(assignedValues.keys()).sort((a, b) => b - a);
    
    for (const value of sortedValues) {
      const options = assignedValues.get(value);
      console.log(`\n🎯 Answer Quality: ${value} (${options.length} options)`);
      console.log('-'.repeat(80));
      
      // Show first 5 examples
      for (const opt of options.slice(0, 5)) {
        console.log(`   "${opt.key}"`);
        if (opt.en) console.log(`      EN: ${opt.en}`);
        if (opt.tr) console.log(`      TR: ${opt.tr}`);
        console.log(`      (in question: ${opt.question})`);
      }
      
      if (options.length > 5) {
        console.log(`   ... and ${options.length - 5} more`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Migration Complete!');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the analysis
analyzeAndSetAnswerQuality()
  .then(() => {
    console.log('✅ Analysis completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
