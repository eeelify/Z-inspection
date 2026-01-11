/**
 * Seed ethical expert questions into the questions collection
 * These are additional questions for ethical-expert role
 * Run with: node backend/scripts/seedEthicalExpertQuestions.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB - Use same connection string as server.js
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI environment variable bulunamadı!');
}

mongoose.connect(MONGO_URI).catch((err) => {
  console.error('❌ MongoDB bağlantısı başarısız:', err);
  process.exit(1);
});

const Questionnaire = require('../models/questionnaire');
const Question = require('../models/question');

const ethicalExpertQuestions = [
  // 1️⃣ HUMAN AGENCY & OVERSIGHT
  {
    code: 'H6',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'What level of risk does the AI system pose in terms of manipulating user behavior or limiting autonomy?',
      tr: 'Yapay zeka sistemi kullanıcı davranışlarını manipüle etme veya özerkliği sınırlama açısından ne düzeyde risk oluşturmaktadır?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      {
        key: 'high_risk',
        label: { en: 'High risk', tr: 'Yüksek risk' },
        answerScore: 0.0
      },
      {
        key: 'moderate_risk',
        label: { en: 'Moderate risk', tr: 'Orta risk' },
        answerScore: 0.33
      },
      {
        key: 'low_risk',
        label: { en: 'Low risk', tr: 'Düşük risk' },
        answerScore: 0.75
      },
      {
        key: 'no_risk',
        label: { en: 'No risk', tr: 'Risk yok' },
        answerScore: 1.0
      },
      {
        key: 'not_sure',
        label: { en: 'Not sure', tr: 'Emin değilim' },
        answerScore: 0.5
      }
    ],
    required: true,
    order: 13
  },
  {
    code: 'H10',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'Describe any safeguards or mechanisms in place to ensure users can override or challenge AI-driven decisions.',
      tr: 'Kullanıcıların yapay zeka destekli kararları geçersiz kılabilmesi veya sorgulayabilmesi için hangi önlemler veya mekanizmalar bulunmaktadır?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 14
  },

  // 2️⃣ TECHNICAL ROBUSTNESS & SAFETY (Placeholder/No new questions provided, skipping S2 update unless requested)
  // Converting S2 to new format just in case
  {
    code: 'S2',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', tr: 'Teknik Sağlamlık ve Güvenlik' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'How do you assess the potential harm the AI system may cause and its potential to affect fundamental rights? Has a Fundamental Rights Impact Assessment (FRIA) been conducted?',
      tr: 'AI sisteminin neden olabileceği potansiyel zararı ve temel hakları etkileme potansiyelini nasıl değerlendiriyorsunuz? Temel Haklar Etki Değerlendirmesi (FRIA) yapıldı mı?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 15
  },

  // 3️⃣ PRIVACY & DATA GOVERNANCE
  {
    code: 'P4',
    principleKey: 'privacy_data_governance',
    principleLabel: { en: 'Privacy & Data Governance', tr: 'Gizlilik ve Veri Yönetişimi' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'Does the use of Sensitive Data (e.g., health, race, biometric data) ethically raise the risk of bias, societal unfairness, or stigmatization potential to an unacceptable level? What is the ethical justification for using this data?',
      tr: 'Hassas Verilerin (örn. sağlık, ırk, biyometrik veri) kullanımı, etik olarak önyargı, toplumsal adaletsizlik veya damgalanma potansiyeli riskini kabul edilemez bir seviyeye yükseltiyor mu? Bu verilerin kullanımının etik gerekçesi nedir?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 16
  },

  // 4️⃣ TRANSPARENCY
  {
    code: 'T9',
    principleKey: 'transparency',
    principleLabel: { en: 'Transparency', tr: 'Şeffaflık' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'If the system is a \'limited-risk\' system, is the user\'s ethical right to know that the output is AI-generated provided clearly and comprehensibly?',
      tr: 'Sistem \'sınırlı riskli\' bir sistem ise, kullanıcının çıktının AI tarafından üretildiğini bilme etik hakkı açık ve anlaşılır bir şekilde sağlanıyor mu?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 17
  },

  // 5️⃣ DIVERSITY, NON-DISCRIMINATION & FAIRNESS
  {
    code: 'F2',
    principleKey: 'diversity_non_discrimination_fairness',
    principleLabel: { en: 'Diversity, Non-Discrimination & Fairness', tr: 'Çeşitlilik, Ayrımcılık Yasağı ve Hakkaniyet' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'What level of risk does the system pose in terms of bias, discrimination, or unfair treatment of individuals or groups?',
      tr: 'Sistem bireyler veya gruplar açısından önyargı, ayrımcılık veya adaletsiz muamele bakımından ne düzeyde risk oluşturmaktadır?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      {
        key: 'high_risk',
        label: { en: 'High risk', tr: 'Yüksek risk' },
        answerScore: 0.0
      },
      {
        key: 'moderate_risk',
        label: { en: 'Moderate risk', tr: 'Orta risk' },
        answerScore: 0.33
      },
      {
        key: 'low_risk',
        label: { en: 'Low risk', tr: 'Düşük risk' },
        answerScore: 0.75
      },
      {
        key: 'not_sure',
        label: { en: 'Not sure', tr: 'Emin değilim' },
        answerScore: 0.5
      }
    ],
    required: true,
    order: 18
  },
  {
    code: 'F3',
    principleKey: 'diversity_non_discrimination_fairness',
    principleLabel: { en: 'Diversity, Non-Discrimination & Fairness', tr: 'Çeşitlilik, Ayrımcılık Yasağı ve Hakkaniyet' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'Please describe any measures taken to detect, prevent, or mitigate bias or discrimination within the AI system.',
      tr: 'Yapay zeka sistemi içindeki önyargı veya ayrımcılığı tespit etmek, önlemek veya azaltmak için alınan önlemleri açıklayınız.'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 19
  },

  // 6️⃣ SOCIETAL & INTERPERSONAL WELL-BEING
  {
    code: 'W7',
    principleKey: 'societal_interpersonal_well_being',
    principleLabel: { en: 'Societal & Interpersonal Well-Being', tr: 'Toplumsal ve Kişilerarası İyi Oluş' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'How does the AI system impact freedom of expression or access to information?',
      tr: 'Yapay zeka sistemi ifade özgürlüğünü veya bilgiye erişimi nasıl etkilemektedir?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      {
        key: 'fully_respects',
        label: { en: 'Fully respects', tr: 'Tamamen saygı gösteriyor' },
        answerScore: 1.0
      },
      {
        key: 'partially_respects',
        label: { en: 'Partially respects', tr: 'Kısmen saygı gösteriyor' },
        answerScore: 0.75
      },
      {
        key: 'may_unintentionally_restrict',
        label: { en: 'May unintentionally restrict', tr: 'İstemeden kısıtlayabilir' },
        answerScore: 0.5
      },
      {
        key: 'significantly_restricts',
        label: { en: 'Significantly restricts', tr: 'Önemli ölçüde kısıtlayabilir' },
        answerScore: 0.0
      },
      {
        key: 'not_applicable',
        label: { en: 'Not applicable', tr: 'Uygulanabilir değil' },
        answerScore: 0.75
      }
    ],
    required: true,
    order: 20
  },
  {
    code: 'W8',
    principleKey: 'societal_interpersonal_well_being',
    principleLabel: { en: 'Societal & Interpersonal Well-Being', tr: 'Toplumsal ve Kişilerarası İyi Oluş' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'Describe any potential social or interpersonal harms that may arise from the deployment of this AI system.',
      tr: 'Bu yapay zeka sisteminin kullanımından kaynaklanabilecek olası sosyal veya kişilerarası zararları açıklayınız.'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 21
  },

  // 7️⃣ ACCOUNTABILITY
  {
    code: 'A5',
    principleKey: 'accountability',
    principleLabel: { en: 'Accountability', tr: 'Hesap Verebilirlik' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'How are accountability and responsibility for the AI system defined and enforced?',
      tr: 'Yapay zeka sistemi için hesap verebilirlik ve sorumluluk nasıl tanımlanmakta ve uygulanmaktadır?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 22
  },
  {
    code: 'A11',
    principleKey: 'accountability',
    principleLabel: { en: 'Accountability', tr: 'Hesap Verebilirlik' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'Are there clear processes in place for addressing ethical complaints or incidents related to the AI system?',
      tr: 'Yapay zeka sistemiyle ilgili etik şikayetlerin veya olayların ele alınması için net süreçler mevcut mu?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 23
  },
  {
    code: 'A12',
    principleKey: 'accountability',
    principleLabel: { en: 'Accountability', tr: 'Hesap Verebilirlik' },
    appliesToRoles: ['ethical-expert'],
    text: {
      en: 'Please provide any additional information relevant to accountability and governance of the AI system.',
      tr: 'Yapay zeka sisteminin hesap verebilirliği ve yönetişimiyle ilgili ek bilgileri paylaşınız.'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: false,
    order: 24
  }
];

async function seedEthicalExpertQuestions() {
  try {
    console.log('Starting ethical expert questions seeding...');

    // Use ethical-v1 questionnaire
    let questionnaire = await Questionnaire.findOne({ key: 'ethical-v1' });
    if (!questionnaire) {
      questionnaire = await Questionnaire.create({
        key: 'ethical-v1',
        title: 'Ethical Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      });
      console.log('✅ Created questionnaire: ethical-v1');
    } else {
      console.log('ℹ️ Questionnaire ethical-v1 already exists');
    }

    // Create questions
    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const qData of ethicalExpertQuestions) {
      const existing = await Question.findOne({
        questionnaireKey: 'ethical-v1',
        code: qData.code
      });

      if (!existing) {
        await Question.create({
          questionnaireKey: 'ethical-v1',
          ...qData
        });
        created++;
        console.log(`✅ Created question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      } else {
        // Update existing question if it exists
        await Question.findOneAndUpdate(
          { questionnaireKey: 'ethical-v1', code: qData.code },
          {
            ...qData,
            updatedAt: new Date()
          }
        );
        updated++;
        console.log(`🔄 Updated question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      }
    }

    console.log('\n✅ Ethical expert questions seeding complete!');
    console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    // Clear cache for ethical-v1 questions
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
      req.write(JSON.stringify({ questionnaireKey: 'ethical-v1' }));
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

seedEthicalExpertQuestions();


