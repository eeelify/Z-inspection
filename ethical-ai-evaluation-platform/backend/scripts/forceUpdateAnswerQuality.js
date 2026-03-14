const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Question = require('../models/question');

async function forceUpdateAnswerQuality() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔄 FORCE UPDATING all answerQuality values...\n');

    // Specific mappings to override
    const specificMappings = {
      // Risk levels
      'high_risk': 0.0,
      'yüksek_risk': 0.0,
      'moderate_risk': 0.5,
      'orta_risk': 0.5,
      'low_risk': 1.0,
      'düşük_risk': 1.0,
      'minimal_risk': 1.0,
      'no_risk': 1.0,
      'risk_yok': 1.0,
      
      // Numeric risk scale (1-5, where 1=best, 5=worst)
      'risk_1': 1.0,  // Lowest risk = best
      'risk_2': 0.75, // Low risk
      'risk_3': 0.5,  // Medium risk
      'risk_4': 0.25, // High risk
      'risk_5': 0.0,  // Highest risk = worst
      
      // Likelihood
      'very_likely': 0.0, // For harm context
      'possible': 0.5,
      'unlikely': 0.75,
      
      // Respect/restriction
      'fully_respects': 1.0,
      'tamamen_saygı': 1.0,
      'partially_respects': 0.75,
      'kısmen_saygı': 0.75,
      'may_unintentionally_restrict': 0.5,
      'significantly_restricts': 0.0,
      'severely_restricts': 0.0,
      
      // Reliability
      'fully_reliable': 1.0,
      'tamamen_güvenilir': 1.0,
      'partially_reliable': 0.5,
      'kısmen_güvenilir': 0.5,
      'unreliable': 0.0,
      'güvenilmez': 0.0,
      
      // Exposure levels (inverted: high exposure = bad)
      'highly_exposed': 0.0,     // Very exposed = bad
      'moderately_exposed': 0.5, // Medium exposure
      'slightly_exposed': 1.0,   // Little exposure = good
      
      // Learning types
      'active_learning': 1.0,  // Active learning = good
      'neutral': 0.5,          // Neutral
      'passive_use': 0.0       // Passive use = bad
    };

    const questions = await Question.find({
      answerType: { $in: ['single_choice', 'multi_choice'] }
    });

    console.log(`Found ${questions.length} select-based questions\n`);

    let totalUpdated = 0;
    let questionsModified = 0;

    for (const question of questions) {
      if (!question.options || question.options.length === 0) continue;

      let questionModified = false;

      for (const option of question.options) {
        if (!option.key) continue;

        let newValue = null;

        // Check specific mappings first
        if (specificMappings.hasOwnProperty(option.key)) {
          newValue = specificMappings[option.key];
        } else {
          // Infer from patterns
          const combined = `${option.key} ${option.label?.en || ''} ${option.label?.tr || ''}`.toLowerCase();
          const questionText = String(question.text?.en || question.text?.tr || question.text || '').toLowerCase();
          
          // Numeric risk scale (1-5)
          if (/^risk[_\s]1$/i.test(option.key)) newValue = 1.0;
          else if (/^risk[_\s]2$/i.test(option.key)) newValue = 0.75;
          else if (/^risk[_\s]3$/i.test(option.key)) newValue = 0.5;
          else if (/^risk[_\s]4$/i.test(option.key)) newValue = 0.25;
          else if (/^risk[_\s]5$/i.test(option.key)) newValue = 0.0;
          
          // Risk patterns
          else if (/\bhigh[_\s]risk\b/i.test(combined)) newValue = 0.0;
          else if (/\bmoderate[_\s]risk\b/i.test(combined)) newValue = 0.5;
          else if (/\blow[_\s]risk\b/i.test(combined)) newValue = 1.0;
          else if (/\bminimal[_\s]risk\b/i.test(combined)) newValue = 1.0;
          else if (/\bno[_\s]risk\b/i.test(combined)) newValue = 1.0;
          
          // Exposure patterns (inverted)
          else if (/\bhighly[_\s]exposed\b/i.test(combined)) newValue = 0.0;
          else if (/\bmoderately[_\s]exposed\b/i.test(combined)) newValue = 0.5;
          else if (/\bslightly[_\s]exposed\b/i.test(combined)) newValue = 1.0;
          
          // Learning type patterns
          else if (/\bactive[_\s]learning\b/i.test(combined)) newValue = 1.0;
          else if (/\bneutral\b/i.test(combined) && /learning|öğrenme/i.test(questionText)) newValue = 0.5;
          else if (/\bpassive[_\s]use\b/i.test(combined)) newValue = 0.0;
          
          // Respect patterns
          else if (/\bfully[_\s]respects\b/i.test(combined)) newValue = 1.0;
          else if (/\bpartially[_\s]respects\b/i.test(combined)) newValue = 0.75;
          else if (/\bmay[_\s]unintentionally[_\s]restrict\b/i.test(combined)) newValue = 0.5;
          else if (/\bsignificantly[_\s]restricts\b/i.test(combined)) newValue = 0.0;
          
          // Reliability patterns
          else if (/\bfully[_\s]reliable\b/i.test(combined)) newValue = 1.0;
          else if (/\bpartially[_\s]reliable\b/i.test(combined)) newValue = 0.5;
          else if (/\bunreliable\b/i.test(combined)) newValue = 0.0;
          
          // Likelihood patterns (for harm)
          else if (/\bvery[_\s]likely\b/i.test(combined) && /harm|risk|zarar|tehlike/i.test(questionText)) {
            newValue = 0.0;
          }
        }

        // Update if different or force update specific patterns
        if (newValue !== null && option.answerQuality !== newValue) {
          const oldValue = option.answerQuality;
          option.answerQuality = newValue;
          totalUpdated++;
          questionModified = true;
          console.log(`  ✏️  ${option.key}: ${oldValue} → ${newValue}`);
        }
      }

      if (questionModified) {
        question.markModified('options');
        await question.save();
        questionsModified++;
        console.log(`  ✅ ${question.code || `Q${question.order}`} updated\n`);
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Force Update Complete!`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Questions modified: ${questionsModified}`);
    console.log(`Options updated: ${totalUpdated}\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

forceUpdateAnswerQuality();
