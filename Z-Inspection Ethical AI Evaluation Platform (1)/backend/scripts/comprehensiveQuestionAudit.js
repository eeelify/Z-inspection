const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Question = require('../models/question');

async function comprehensiveQuestionAudit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all questions
    const questions = await Question.find({}).sort({ questionnaireName: 1, order: 1 }).lean();
    
    console.log(`Found ${questions.length} total questions\n`);

    // Group by questionnaire
    const byQuestionnaire = {};
    for (const q of questions) {
      const qKey = q.questionnaireName || 'unknown';
      if (!byQuestionnaire[qKey]) {
        byQuestionnaire[qKey] = [];
      }
      byQuestionnaire[qKey].push(q);
    }

    console.log(`${'='.repeat(120)}`);
    console.log(`COMPREHENSIVE QUESTION & ANSWER QUALITY AUDIT`);
    console.log(`${'='.repeat(120)}\n`);

    let totalQuestions = 0;
    let totalOptions = 0;
    let totalMissingQuality = 0;
    let totalDefaultQuality = 0;
    let totalTextQuestions = 0;

    for (const [qName, qList] of Object.entries(byQuestionnaire)) {
      console.log(`\n${'▬'.repeat(120)}`);
      console.log(`📋 QUESTIONNAIRE: ${qName.toUpperCase()}`);
      console.log(`${'▬'.repeat(120)}\n`);

      for (const question of qList) {
        totalQuestions++;
        
        const code = question.code || `Q${question.order || '?'}`;
        const principle = question.principle || 'N/A';
        const answerType = question.answerType || 'unknown';
        const riskScore = question.riskScore !== undefined ? question.riskScore : 'N/A';

        console.log(`\n📍 ${code} (${answerType})`);
        console.log(`   Principle: ${principle}`);
        console.log(`   Default Risk Score: ${riskScore}`);
        
        const questionText = typeof question.text === 'object' 
          ? (question.text.en || question.text.tr || 'N/A')
          : (question.text || 'N/A');
        console.log(`   Text: ${String(questionText).substring(0, 100)}...`);

        if (answerType === 'open_text') {
          totalTextQuestions++;
          console.log(`   ℹ️  Open text question - no options (default quality: 0.5)`);
          continue;
        }

        if (!question.options || question.options.length === 0) {
          console.log(`   ⚠️  NO OPTIONS DEFINED!`);
          continue;
        }

        console.log(`   Options (${question.options.length}):`);
        
        for (const option of question.options) {
          totalOptions++;
          
          const key = option.key;
          const labelEn = option.label?.en || 'N/A';
          const labelTr = option.label?.tr || 'N/A';
          const quality = option.answerQuality;

          let status = '';
          if (quality === undefined || quality === null) {
            status = '❌ MISSING';
            totalMissingQuality++;
          } else if (quality === 0.5) {
            status = '⚠️  DEFAULT (0.5)';
            totalDefaultQuality++;
          } else {
            status = '✅';
          }

          console.log(`      ${status} [${key}] Q=${quality !== undefined && quality !== null ? quality.toFixed(2) : 'N/A'}`);
          console.log(`         EN: ${labelEn}`);
          console.log(`         TR: ${labelTr}`);
        }

        // Check optionScores (legacy)
        if (question.optionScores) {
          console.log(`   ℹ️  Has optionScores (legacy): ${JSON.stringify(question.optionScores)}`);
        }
      }
    }

    console.log(`\n\n${'='.repeat(120)}`);
    console.log(`AUDIT SUMMARY`);
    console.log(`${'='.repeat(120)}\n`);
    console.log(`Total Questionnaires: ${Object.keys(byQuestionnaire).length}`);
    console.log(`Total Questions: ${totalQuestions}`);
    console.log(`  - Choice Questions: ${totalQuestions - totalTextQuestions}`);
    console.log(`  - Text Questions: ${totalTextQuestions}`);
    console.log(`Total Options: ${totalOptions}`);
    console.log(`\nAnswer Quality Status:`);
    console.log(`  ✅ Defined: ${totalOptions - totalMissingQuality - totalDefaultQuality}`);
    console.log(`  ⚠️  Default (0.5): ${totalDefaultQuality}`);
    console.log(`  ❌ Missing: ${totalMissingQuality}`);
    console.log(`\nCompletion Rate: ${(((totalOptions - totalMissingQuality) / totalOptions) * 100).toFixed(1)}%\n`);

    if (totalMissingQuality > 0) {
      console.log(`⚠️  WARNING: ${totalMissingQuality} options are missing answerQuality values!`);
      console.log(`   Run: node scripts/analyzeAndSetAnswerQuality.js to fix\n`);
    } else {
      console.log(`✅ ALL OPTIONS HAVE ANSWER QUALITY DEFINED!\n`);
    }

    if (totalDefaultQuality > 0) {
      console.log(`ℹ️  INFO: ${totalDefaultQuality} options use default value (0.5)`);
      console.log(`   These may need manual review for accuracy\n`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

comprehensiveQuestionAudit();
