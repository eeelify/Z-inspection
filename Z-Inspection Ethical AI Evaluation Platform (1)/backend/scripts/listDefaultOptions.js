const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Question = require('../models/question');

async function listDefaultOptions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const questions = await Question.find({
      answerType: { $in: ['single_choice', 'multi_choice'] }
    }).sort({ questionnaireName: 1, order: 1 }).lean();

    console.log(`${'='.repeat(100)}`);
    console.log(`OPTIONS USING DEFAULT VALUE (0.5)`);
    console.log(`${'='.repeat(100)}\n`);

    let totalDefault = 0;
    const categoryCount = {};

    for (const question of questions) {
      if (!question.options || question.options.length === 0) continue;

      const defaultOptions = question.options.filter(opt => opt.answerQuality === 0.5);
      
      if (defaultOptions.length > 0) {
        const code = question.code || `Q${question.order || '?'}`;
        console.log(`\n📍 ${code} - ${question.principle}`);
        
        const questionText = typeof question.text === 'object' 
          ? (question.text.en || question.text.tr || 'N/A')
          : (question.text || 'N/A');
        console.log(`   "${String(questionText).substring(0, 80)}..."`);
        console.log(`   Options with 0.5:`);

        for (const opt of defaultOptions) {
          totalDefault++;
          const labelEn = opt.label?.en || 'N/A';
          const labelTr = opt.label?.tr || 'N/A';
          
          console.log(`      [${opt.key}]`);
          console.log(`         EN: ${labelEn}`);
          console.log(`         TR: ${labelTr}`);

          // Categorize
          const key = opt.key.toLowerCase();
          const label = labelEn.toLowerCase();
          
          let category = 'other';
          if (/partial|somewhat|slightly|moderately/.test(key) || /partial|somewhat|slightly|moderately/.test(label)) {
            category = 'partial/moderate';
          } else if (/sometimes|occasionally|depends/.test(key) || /sometimes|occasionally|depends/.test(label)) {
            category = 'frequency';
          } else if (/possible|may|might/.test(key) || /possible|may|might/.test(label)) {
            category = 'possibility';
          } else if (/unclear|unknown|not sure/.test(key) || /unclear|unknown|not sure/.test(label)) {
            category = 'uncertainty';
          } else if (/need|investigation|review/.test(key) || /need|investigation|review/.test(label)) {
            category = 'needs_review';
          }

          categoryCount[category] = (categoryCount[category] || 0) + 1;
        }
      }
    }

    console.log(`\n\n${'='.repeat(100)}`);
    console.log(`SUMMARY - Default (0.5) Options`);
    console.log(`${'='.repeat(100)}\n`);
    console.log(`Total: ${totalDefault}\n`);
    console.log(`By Category:`);
    
    const sortedCategories = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
    for (const [category, count] of sortedCategories) {
      const percentage = ((count / totalDefault) * 100).toFixed(1);
      console.log(`   ${category.padEnd(20)} : ${count.toString().padStart(3)} (${percentage}%)`);
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`WHY ARE THESE DEFAULT (0.5)?`);
    console.log(`${'='.repeat(100)}\n`);
    console.log(`✅ APPROPRIATE for 0.5 (neutral/middle value):`);
    console.log(`   - "partially", "somewhat", "slightly" → Orta seviye cevaplar`);
    console.log(`   - "sometimes", "occasionally" → Ara sıra/bazen`);
    console.log(`   - "possible", "may", "might" → Olasılık orta`);
    console.log(`   - "depends", "it depends" → Context'e bağlı`);
    console.log(`   - "moderate", "moderately" → Orta seviye`);
    console.log(`   - "need investigation" → Belirsiz, orta değer mantıklı\n`);
    
    console.log(`⚠️  MIGHT NEED REVIEW (context-dependent):`);
    console.log(`   - Bazı şıklar soru context'ine göre farklı değer alabilir`);
    console.log(`   - Örn: "somewhat unclear" → Transparency için 0.5 mantıklı`);
    console.log(`   - Örn: "slightly" control → 0.5 veya 0.25 olabilir\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

listDefaultOptions();
