/**
 * Seed general questions (7 ethical principles) into the questions collection
 * Run with: node backend/scripts/seedGeneralQuestions.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Connect to MongoDB - Use same connection string as server.js
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error("❌ MONGO_URI environment variable bulunamadı!");
}

mongoose.connect(MONGO_URI);

const Questionnaire = require('../models/questionnaire');
const Question = require('../models/question');

const generalQuestions = [
  // TRANSPARENCY
  {
    code: 'T1',
    principleKey: 'transparency_explainability',
    principleLabel: { en: 'Transparency & Explainability', tr: 'Şeffaflık ve Açıklanabilirlik' },
    appliesToRoles: ['any'],
    text: {
      en: 'Is it clear to you what the AI system can and cannot do?',
      tr: 'AI sisteminin ne yapabildiği ve ne yapamadığı sizin için açık mı?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'very_clear', label: { en: 'Very clear', tr: 'Çok net' }, answerScore: 1.0 },
      { key: 'mostly_clear', label: { en: 'Mostly clear', tr: 'Büyük ölçüde net' }, answerScore: 0.75 },
      { key: 'somewhat_unclear', label: { en: 'Somewhat unclear', tr: 'Kısmen belirsiz' }, answerScore: 0.5 },
      { key: 'completely_unclear', label: { en: 'Completely unclear', tr: 'Tamamen belirsiz' }, answerScore: 0.0 }
    ],
    required: true,
    order: 1
  },
  {
    code: 'T2',
    principleKey: 'transparency_explainability',
    principleLabel: { en: 'Transparency & Explainability', tr: 'Şeffaflık ve Açıklanabilirlik' },
    appliesToRoles: ['any'],
    text: {
      en: 'Do you understand that the system may sometimes be wrong or uncertain?',
      tr: 'Sistemin bazen hatalı veya belirsiz olabileceğini anlıyor musunuz?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', tr: 'Evet' }, answerScore: 1.0 },
      { key: 'partially', label: { en: 'Partially', tr: 'Kısmen' }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', tr: 'Hayır' }, answerScore: 0.0 }
    ],
    required: true,
    order: 2
  },
  // HUMAN AGENCY & OVERSIGHT
  {
    code: 'H1',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['any'],
    text: {
      en: 'Do you feel that you remain in control when using the AI system?',
      tr: 'AI sistemini kullanırken kontrolün sizde olduğunu hissediyor musunuz?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully', label: { en: 'Fully', tr: 'Tamamen' }, answerScore: 1.0 },
      { key: 'mostly', label: { en: 'Mostly', tr: 'Büyük ölçüde' }, answerScore: 0.75 },
      { key: 'slightly', label: { en: 'Slightly', tr: 'Kısmen' }, answerScore: 0.5 },
      { key: 'not_at_all', label: { en: 'Not at all', tr: 'Hiç' }, answerScore: 0.0 }
    ],
    required: true,
    order: 3
  },
  {
    code: 'H2',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['any'],
    text: {
      en: 'Would you feel comfortable disagreeing with the system\'s output?',
      tr: 'Sistemin çıktısına katılmamayı rahatça hisseder misiniz?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', tr: 'Evet' }, answerScore: 1.0 },
      { key: 'sometimes', label: { en: 'Sometimes', tr: 'Bazen' }, answerScore: 0.75 },
      { key: 'rarely', label: { en: 'Rarely', tr: 'Nadiren' }, answerScore: 0.25 },
      { key: 'no', label: { en: 'No', tr: 'Hayır' }, answerScore: 0.0 }
    ],
    required: true,
    order: 4
  },
  // TECHNICAL ROBUSTNESS & SAFETY
  {
    code: 'S1',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', tr: 'Teknik Dayanıklılık ve Güvenlik' },
    appliesToRoles: ['any'],
    text: {
      en: 'Do you think incorrect outputs from this system could cause real harm if not noticed?',
      tr: 'Fark edilmezse bu sistemin hatalı çıktıları gerçek zarara yol açabilir mi?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'very_likely', label: { en: 'Very likely', tr: 'Çok muhtemel' }, answerScore: 0.25 },
      { key: 'possible', label: { en: 'Possible', tr: 'Mümkün' }, answerScore: 0.5 },
      { key: 'unlikely', label: { en: 'Unlikely', tr: 'Pek olası değil' }, answerScore: 0.75 },
      { key: 'not_at_all', label: { en: 'Not at all', tr: 'Hiç' }, answerScore: 1.0 }
    ],
    required: true,
    order: 5
  },
  // PRIVACY & DATA GOVERNANCE
  {
    code: 'P1',
    principleKey: 'privacy_data_governance',
    principleLabel: { en: 'Privacy & Data Governance', tr: 'Gizlilik ve Veri Yönetişimi' },
    appliesToRoles: ['any'],
    text: {
      en: 'Do you feel confident that your personal or sensitive data is handled responsibly?',
      tr: 'Kişisel veya hassas verilerinizin sorumlu şekilde işlendiğine güveniyor musunuz?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'very_confident', label: { en: 'Very confident', tr: 'Çok güveniyorum' }, answerScore: 1.0 },
      { key: 'somewhat_confident', label: { en: 'Somewhat confident', tr: 'Kısmen güveniyorum' }, answerScore: 0.75 },
      { key: 'not_very_confident', label: { en: 'Not very confident', tr: 'Pek güvenmiyorum' }, answerScore: 0.25 },
      { key: 'not_at_all', label: { en: 'Not at all', tr: 'Hiç güvenmiyorum' }, answerScore: 0.0 }
    ],
    required: true,
    order: 6
  },
  {
    code: 'P2',
    principleKey: 'privacy_data_governance',
    principleLabel: { en: 'Privacy & Data Governance', tr: 'Gizlilik ve Veri Yönetişimi' },
    appliesToRoles: ['any'],
    text: {
      en: 'Is it clear to you what data about you is used by the system?',
      tr: 'Sistem tarafından sizinle ilgili hangi verilerin kullanıldığı açık mı?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', tr: 'Evet' }, answerScore: 1.0 },
      { key: 'partially', label: { en: 'Partially', tr: 'Kısmen' }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', tr: 'Hayır' }, answerScore: 0.0 }
    ],
    required: true,
    order: 7
  },
  // DIVERSITY, NON-DISCRIMINATION & FAIRNESS
  {
    code: 'F1',
    principleKey: 'diversity_fairness',
    principleLabel: { en: 'Diversity, Non-Discrimination & Fairness', tr: 'Çeşitlilik, Ayrımcılık Yasağı ve Adalet' },
    appliesToRoles: ['any'],
    text: {
      en: 'Do you believe the system would treat different people fairly?',
      tr: 'Sistemin farklı kişilere adil davranacağını düşünüyor musunuz?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', tr: 'Evet' }, answerScore: 1.0 },
      { key: 'not_sure', label: { en: 'Not sure', tr: 'Emin değilim' }, answerScore: 0.5 },
      { key: 'probably_not', label: { en: 'Probably not', tr: 'Muhtemelen hayır' }, answerScore: 0.25 },
      { key: 'definitely_not', label: { en: 'Definitely not', tr: 'Kesinlikle hayır' }, answerScore: 0.0 }
    ],
    required: true,
    order: 8
  },
  // SOCIETAL & INTERPERSONAL WELL-BEING
  {
    code: 'W1',
    principleKey: 'societal_wellbeing',
    principleLabel: { en: 'Societal & Interpersonal Well-being', tr: 'Toplumsal ve Kişilerarası Refah' },
    appliesToRoles: ['any'],
    text: {
      en: 'Do you think the use of this AI system could affect trust between people (e.g. patient–doctor, employee–employer)?',
      tr: 'Bu AI sisteminin insanlar arasındaki güveni etkileyebileceğini düşünüyor musunuz?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 9
  },
  {
    code: 'W2',
    principleKey: 'societal_wellbeing',
    principleLabel: { en: 'Societal & Interpersonal Well-being', tr: 'Toplumsal ve Kişilerarası Refah' },
    appliesToRoles: ['any'],
    text: {
      en: 'Should users or affected individuals be informed when this AI system is used?',
      tr: 'Bu AI sistemi kullanıldığında kullanıcıların veya etkilenen kişilerin bilgilendirilmesi gerekir mi?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', tr: 'Evet' }, answerScore: 1.0 },
      { key: 'depends', label: { en: 'Depends', tr: 'Duruma bağlı' }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', tr: 'Hayır' }, answerScore: 0.0 }
    ],
    required: true,
    order: 10
  },
  // ACCOUNTABILITY
  {
    code: 'A1',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', tr: 'Hesap Verebilirlik ve Sorumluluk' },
    appliesToRoles: ['any'],
    text: {
      en: 'Do you know who to contact or what to do if the system causes a problem or harm?',
      tr: 'Sistem bir sorun veya zarar oluşturursa kime başvuracağınızı veya ne yapacağınızı biliyor musunuz?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', tr: 'Evet' }, answerScore: 1.0 },
      { key: 'somewhat', label: { en: 'Somewhat', tr: 'Kısmen' }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', tr: 'Hayır' }, answerScore: 0.0 }
    ],
    required: true,
    order: 11
  },
  {
    code: 'A2',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', tr: 'Hesap Verebilirlik ve Sorumluluk' },
    appliesToRoles: ['any'],
    text: {
      en: 'Do you think there are sufficient safeguards to prevent misuse of the system?',
      tr: 'Sistemin yanlış veya amaç dışı kullanımını önlemek için yeterli önlemler olduğunu düşünüyor musunuz?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', tr: 'Evet' }, answerScore: 1.0 },
      { key: 'partially', label: { en: 'Partially', tr: 'Kısmen' }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', tr: 'Hayır' }, answerScore: 0.0 },
      { key: 'not_sure', label: { en: 'Not sure', tr: 'Emin değilim' }, answerScore: 0.25 }
    ],
    required: true,
    order: 12
  }
];

async function seedGeneralQuestions() {
  try {
    console.log('Starting general questions seeding...');

    // Create general-v1 questionnaire if it doesn't exist
    let questionnaire = await Questionnaire.findOne({ key: 'general-v1' });
    if (!questionnaire) {
      questionnaire = await Questionnaire.create({
        key: 'general-v1',
        title: 'General Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      });
      console.log('✅ Created questionnaire: general-v1');
    } else {
      console.log('ℹ️ Questionnaire general-v1 already exists');
    }

    // Create questions
    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const qData of generalQuestions) {
      const existing = await Question.findOne({
        questionnaireKey: 'general-v1',
        code: qData.code
      });

      if (!existing) {
        await Question.create({
          questionnaireKey: 'general-v1',
          ...qData
        });
        created++;
        console.log(`✅ Created question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      } else {
        // Update existing question if it exists
        await Question.findOneAndUpdate(
          { questionnaireKey: 'general-v1', code: qData.code },
          {
            ...qData,
            updatedAt: new Date()
          }
        );
        updated++;
        console.log(`🔄 Updated question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      }
    }

    console.log('\n✅ General questions seeding complete!');
    console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    // Clear cache for general-v1 questions
    console.log('\n🔄 Clearing questions cache...');
    try {
      const http = require('http');
      const options = {
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/evaluations/questions/clear-cache',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };

      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Cache cleared successfully');
        }
      });
      req.on('error', () => {
        // Server might not be running, that's okay
        console.log('ℹ️ Could not clear cache (server might not be running)');
      });
      req.write(JSON.stringify({ questionnaireKey: 'general-v1' }));
      req.end();
    } catch (err) {
      // Ignore cache clearing errors
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedGeneralQuestions();
