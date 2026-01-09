const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Question = require('../models/question');

// Enhanced pattern matching for Answer Quality (0-1 scale)
function inferAnswerQuality(optionKey, labelEN, labelTR) {
  const key = String(optionKey || '').toLowerCase();
  const en = String(labelEN || '').toLowerCase();
  const tr = String(labelTR || '').toLowerCase();
  const combined = `${key} ${en} ${tr}`;

  // EXCELLENT/BEST answers (1.0)
  if (/(^yes$|^evet$|very clear|çok açık|completely|tamamen|always|her zaman|definitely|kesinlikle|excellent|mükemmel|fully|tam olarak|very confident|çok güvenli|comprehensive|kapsamlı|strong|güçlü|highly|çok yüksek|optimal|en iyi)/.test(combined)) {
    return 1.0;
  }

  // VERY GOOD answers (0.9)
  if (/(mostly clear|çoğunlukla açık|very likely|çok muhtemel|usually|genellikle)/.test(combined)) {
    return 0.9;
  }

  // GOOD answers (0.75)
  if (/(mostly|çoğunlukla|generally|genel olarak|often|sıklıkla|confident|güvenli|adequate|yeterli|good|iyi)/.test(combined)) {
    return 0.75;
  }

  // ACCEPTABLE/MODERATE answers (0.5)
  if (/(partially|kısmen|somewhat|bir miktar|sometimes|bazen|moderate|orta|possible|olası|depends|bağlı|maybe|belki|neutral|nötr|average|ortalama)/.test(combined)) {
    return 0.5;
  }

  // WEAK answers (0.25)
  if (/(slightly|hafifçe|rarely|nadiren|unlikely|olası değil|unclear|belirsiz|limited|sınırlı|weak|zayıf|minor|küçük|somewhat confident|biraz güvenli)/.test(combined)) {
    return 0.25;
  }

  // POOR/BAD answers (0.1)
  if (/(^no$|^hayır$|not at all|hiç|never|asla|completely unclear|tamamen belirsiz|none|hiç yok|inadequate|yetersiz|not sure|emin değil|unknown|bilinmiyor)/.test(combined)) {
    return 0.1;
  }

  // WORST answers (0.0)
  if (/(critical|kritik|severe|ciddi|dangerous|tehlikeli|absent|yok|missing|eksik|failed|başarısız)/.test(combined)) {
    return 0.0;
  }

  // COMPLIANCE/LEGAL specific
  if (/(compliant|uyumlu|legal|yasal|certified|sertifikalı|approved|onaylı)/.test(combined)) {
    return 1.0;
  }
  if (/(non.?compliant|uyumsuz|illegal|yasa dışı|violation|ihlal)/.test(combined)) {
    return 0.0;
  }

  // EXTENT/DEGREE specific
  if (/(fully|completely|entirely|tümüyle)/.test(combined)) return 1.0;
  if (/(largely|büyük ölçüde|substantially|önemli ölçüde)/.test(combined)) return 0.75;
  if (/(minimally|minimum|barely|zar zor)/.test(combined)) return 0.25;

  // CONFIDENCE specific
  if (/(very confident|çok eminim)/.test(combined)) return 1.0;
  if (/(confident|eminim)/.test(combined)) return 0.75;
  if (/(somewhat confident|biraz eminim)/.test(combined)) return 0.5;
  if (/(not confident|emin değilim)/.test(combined)) return 0.25;

  return null; // No match - needs manual review
}

async function auditAllQuestions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all questions
    const allQuestions = await Question.find({}).lean();
    console.log(`📊 Total questions: ${allQuestions.length}\n`);

    // Focus on role-specific questionnaires
    const roleQuestionnaires = [
      'medical-expert-v1',
      'legal-expert-v1', 
      'technical-expert-v1',
      'ethical-expert-v1',
      'education-expert-v1'
    ];

    let totalMissing = 0;
    let totalFixed = 0;
    let needsManualReview = [];

    console.log(`${'='.repeat(80)}`);
    console.log(`AUDITING ROLE-SPECIFIC QUESTIONNAIRES`);
    console.log(`${'='.repeat(80)}\n`);

    for (const qKey of roleQuestionnaires) {
      const questions = allQuestions.filter(q => 
        q.questionnaireKey === qKey || 
        q.code?.startsWith(qKey.split('-')[0].charAt(0).toUpperCase())
      );

      console.log(`\n📋 ${qKey}: ${questions.length} questions\n`);

      for (const question of questions) {
        const qText = typeof question.text === 'string' ? question.text : (question.text?.en || 'N/A');
        
        if (!question.options || question.options.length === 0) {
          console.log(`   ⚠️  ${question.code}: No options (text/numeric question)`);
          continue;
        }

        let hasAnyMissing = false;
        const updates = [];

        for (const option of question.options) {
          if (option.answerQuality === undefined || option.answerQuality === null) {
            hasAnyMissing = true;
            totalMissing++;

            const labelEN = typeof option.label === 'string' ? option.label : option.label?.en;
            const labelTR = typeof option.label === 'object' ? option.label?.tr : '';
            
            const inferredAQ = inferAnswerQuality(option.key, labelEN, labelTR);

            if (inferredAQ !== null) {
              updates.push({
                key: option.key,
                label: labelEN,
                inferredAQ: inferredAQ
              });
            } else {
              needsManualReview.push({
                questionCode: question.code,
                questionText: qText.substring(0, 60),
                optionKey: option.key,
                optionLabel: labelEN
              });
            }
          }
        }

        if (hasAnyMissing) {
          console.log(`   🔴 ${question.code}: ${qText.substring(0, 50)}...`);
          
          if (updates.length > 0) {
            console.log(`      ✅ Auto-fixing ${updates.length} option(s):`);
            for (const upd of updates) {
              console.log(`         - ${upd.key} (${upd.label}) → AQ = ${upd.inferredAQ}`);
              
              // Update MongoDB
              await Question.updateOne(
                { _id: question._id, 'options.key': upd.key },
                { $set: { 'options.$.answerQuality': upd.inferredAQ } }
              );
              totalFixed++;
            }
          }

          const manualCount = question.options.filter(o => 
            (o.answerQuality === undefined || o.answerQuality === null) && 
            !updates.some(u => u.key === o.key)
          ).length;

          if (manualCount > 0) {
            console.log(`      ⚠️  ${manualCount} option(s) need manual review`);
          }
        }
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SUMMARY`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`Total missing Answer Quality: ${totalMissing}`);
    console.log(`Auto-fixed: ${totalFixed}`);
    console.log(`Needs manual review: ${needsManualReview.length}\n`);

    if (needsManualReview.length > 0) {
      console.log(`⚠️  OPTIONS NEEDING MANUAL REVIEW:\n`);
      needsManualReview.forEach(item => {
        console.log(`   ${item.questionCode}: ${item.questionText}`);
        console.log(`      - ${item.optionKey}: "${item.optionLabel}"`);
        console.log();
      });
    }

    console.log('✅ Audit complete');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

auditAllQuestions();
