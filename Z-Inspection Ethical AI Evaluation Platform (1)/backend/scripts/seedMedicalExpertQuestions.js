/**
 * Seed medical expert questions into the questions collection
 * These are additional questions for medical-expert role
 * Run with: node backend/scripts/seedMedicalExpertQuestions.js
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

const medicalExpertQuestions = [
  // 1️⃣ TECHNICAL ROBUSTNESS & SAFETY
  {
    code: 'S3',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', tr: 'Teknik Dayanıklılık ve Güvenlik' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Does the system produce clinically reliable, medically acceptable, and consistent outputs?',
      tr: 'Sistem klinik açıdan güvenilir, tıbben kabul edilebilir ve tutarlı çıktılar üretiyor mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes_fully_reliable', label: { en: 'Yes, fully reliable', tr: 'Evet, tamamen güvenilir' }, answerScore: 1.0 },
      { key: 'partially_reliable', label: { en: 'Partially reliable', tr: 'Kısmen güvenilir' }, answerScore: 0.5 },
      { key: 'unreliable', label: { en: 'Unreliable', tr: 'Güvenilir değil' }, answerScore: 0.0 },
      { key: 'not_enough_info', label: { en: 'Not enough information', tr: 'Yeterli bilgi yok' }, answerScore: 0.5 }
    ],
    required: true,
    order: 25
  },
  {
    code: 'S4',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', tr: 'Teknik Dayanıklılık ve Güvenlik' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'How could incorrect or suboptimal outputs impact patient safety (misdiagnosis, delay, harmful recommendation)?',
      tr: 'Hatalı veya yetersiz çıktılar hasta güvenliğini nasıl etkileyebilir (yanlış tanı, gecikme, zararlı öneri)?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 26
  },
  {
    code: 'S5',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', tr: 'Teknik Dayanıklılık ve Güvenlik' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Does the system integrate safely into clinical workflows without interrupting or slowing down medical processes?',
      tr: 'Sistem klinik iş akışına tıbbi süreçleri aksatmadan veya yavaşlatmadan güvenli şekilde entegre oluyor mu?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 27
  },
  {
    code: 'S6',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', tr: 'Teknik Dayanıklılık ve Güvenlik' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Are the system\'s confidence scores clinically calibrated, or could they create false reassurance or undue alarm?',
      tr: 'Sistemin güven skorları klinik olarak kalibre edilmiş mi, yoksa yanlış güven veya gereksiz alarm yaratabilir mi?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 28
  },
  {
    code: 'S7',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', tr: 'Teknik Dayanıklılık ve Güvenlik' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'In which medical scenarios should the system not be used due to safety or reliability concerns?',
      tr: 'Güvenlik veya güvenilirlik endişeleri nedeniyle sistemin kullanılmaması gereken klinik senaryolar hangileridir?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 29
  },
  {
    code: 'S8',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', tr: 'Teknik Dayanıklılık ve Güvenlik' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'What problems or limitations could prevent this AI system from being used safely and effectively in a real hospital?',
      tr: 'Bu AI sisteminin gerçek bir hastanede güvenli ve etkili şekilde kullanılmasını engelleyebilecek sorunlar nelerdir?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 30
  },
  {
    code: 'S9',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', tr: 'Teknik Dayanıklılık ve Güvenlik' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Has the system\'s clinical performance been compared against standard clinical practice or expert clinicians?',
      tr: 'Sistemin klinik performansı, standart klinik uygulamalar veya uzman doktorlarla karşılaştırılmış mı?'
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
      { key: 'unknown', label: { en: 'Unknown', tr: 'Bilinmiyor' }, answerScore: 0.5 }
    ],
    required: true,
    order: 31
  },
  // 2️⃣ HUMAN AGENCY & OVERSIGHT
  {
    code: 'H11',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Does the system appropriately support the clinician\'s decision-making process without misleading or overwhelming them?',
      tr: 'Sistem, klinisyenin karar verme sürecini yanıltmadan veya gereksiz yük oluşturmadan uygun biçimde destekliyor mu?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 32
  },
  {
    code: 'H12',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Could clinicians become over-dependent on the AI system in ways that reduce professional judgment?',
      tr: 'Klinik uzmanlar AI sistemine aşırı bağımlı olup mesleki yargılarının zayıflamasına neden olabilir mi?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 33
  },
  {
    code: 'H13',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Is the intended clinical use, scope, and limitation of the AI system clearly defined and communicated to clinicians?',
      tr: 'AI sisteminin amaçlanan klinik kullanım alanı, kapsamı ve sınırları doktorlara açıkça tanımlanıp iletiliyor mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'very_clearly', label: { en: 'Very clearly defined', tr: 'Çok açık tanımlanmış' }, answerScore: 1.0 },
      { key: 'partially_defined', label: { en: 'Partially Defined', tr: 'Kısmen tanımlanmış' }, answerScore: 0.5 },
      { key: 'poorly_defined', label: { en: 'Poorly defined', tr: 'Zayıf tanımlanmış' }, answerScore: 0.0 },
      { key: 'not_defined', label: { en: 'Not defined', tr: 'Tanımlanmamış' }, answerScore: 0.0 }
    ],
    required: true,
    order: 34
  },
  {
    code: 'H14',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Does the system allow clinicians to override or disregard AI recommendations when clinically justified?',
      tr: 'Sistem, klinik olarak gerekli görüldüğünde doktorların AI önerilerini geçersiz kılmasına olanak tanıyor mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'always', label: { en: 'Always', tr: 'Her zaman' }, answerScore: 1.0 },
      { key: 'in_most_cases', label: { en: 'In most cases', tr: 'Çoğu durumda' }, answerScore: 0.75 },
      { key: 'rarely', label: { en: 'Rarely', tr: 'Nadiren' }, answerScore: 0.0 },
      { key: 'never', label: { en: 'Never', tr: 'Hiçbir zaman' }, answerScore: 0.0 }
    ],
    required: true,
    order: 35
  },
  {
    code: 'H15',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Are clinicians adequately informed that the AI system is a decision-support tool and not a replacement for medical judgment?',
      tr: 'Klinisyenler, AI sisteminin bir karar destek aracı olduğu ve tıbbi yargının yerine geçmediği konusunda yeterince bilgilendiriliyor mu?'
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
      { key: 'unknown', label: { en: 'Unknown', tr: 'Bilinmiyor' }, answerScore: 0.5 }
    ],
    required: true,
    order: 36
  },
  {
    code: 'H16',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Is there a clear process for clinicians to report or correct AI-generated errors or unsafe recommendations?',
      tr: 'AI tarafından üretilen hataların veya güvensiz önerilerin raporlanması ve düzeltilmesi için net bir süreç var mı?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 37
  },
  {
    code: 'H17',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', tr: 'İnsan Özerkliği ve Gözetimi' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Does the system have fail-safe mechanisms to defer decisions to human clinicians in uncertain or high-risk situations?',
      tr: 'Belirsiz veya yüksek riskli durumlarda kararın insana devredilmesini sağlayan fail-safe mekanizmalar var mı?'
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
      { key: 'unknown', label: { en: 'Unknown', tr: 'Bilinmiyor' }, answerScore: 0.5 }
    ],
    required: true,
    order: 38
  },
  // 3️⃣ TRANSPARENCY
  {
    code: 'T10',
    principleKey: 'transparency_explainability',
    principleLabel: { en: 'Transparency & Explainability', tr: 'Şeffaflık ve Açıklanabilirlik' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Could patients or clinicians misinterpret the AI\'s outputs due to unclear confidence levels or ambiguous results?',
      tr: 'Belirsiz sonuçlar veya güven skorlarının anlaşılmaması nedeniyle hastalar veya klinisyenler AI çıktısını yanlış yorumlayabilir mi?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 39
  },
  {
    code: 'T11',
    principleKey: 'transparency_explainability',
    principleLabel: { en: 'Transparency & Explainability', tr: 'Şeffaflık ve Açıklanabilirlik' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Does the AI clearly show why it made a medical decision, so that clinicians can check and confirm the reasoning?',
      tr: 'AI, verdiği tıbbi kararı neden verdiğini doktorların anlayıp doğrulayabileceği kadar açık bir şekilde gösteriyor mu?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 40
  },
  // 4️⃣ DIVERSITY, NON-DISCRIMINATION & FAIRNESS
  {
    code: 'F4',
    principleKey: 'diversity_fairness',
    principleLabel: { en: 'Diversity, Non-Discrimination & Fairness', tr: 'Çeşitlilik, Ayrımcılık Yasağı ve Adalet' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Could the AI system produce unequal or biased outcomes for different patient groups (age, gender, comorbidities)?',
      tr: 'Sistem farklı hasta grupları (yaş, cinsiyet, eşlik eden hastalıklar) için eşitsiz veya önyargılı sonuçlar üretebilir mi?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 41
  },
  {
    code: 'F5',
    principleKey: 'diversity_fairness',
    principleLabel: { en: 'Diversity, Non-Discrimination & Fairness', tr: 'Çeşitlilik, Ayrımcılık Yasağı ve Adalet' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Is the system safe and appropriate for vulnerable or special patient groups (children, elderly, rare diseases)?',
      tr: 'Sistem hassas veya özel hasta grupları (çocuklar, yaşlılar, nadir hastalıklar) için güvenli ve uygun mu?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 42
  },
  // 5️⃣ SOCIETAL & INTERPERSONAL WELL-BEING
  {
    code: 'W9',
    principleKey: 'societal_wellbeing',
    principleLabel: { en: 'Societal & Interpersonal Well-being', tr: 'Toplumsal ve Kişilerarası Refah' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Could the system negatively affect the trust or communication between doctor and patient?',
      tr: 'Sistem doktor–hasta arasında güveni veya iletişimi olumsuz etkileyebilir mi?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 43
  },
  // 6️⃣ PRIVACY & DATA GOVERNANCE
  {
    code: 'P5',
    principleKey: 'privacy_data_governance',
    principleLabel: { en: 'Privacy & Data Governance', tr: 'Gizlilik ve Veri Yönetişimi' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Does the AI system respect patient confidentiality and medical privacy standards in its outputs?',
      tr: 'AI sistemi çıktılarında hasta gizliliğine ve tıbbi mahremiyet standartlarına uygun davranıyor mu?'
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
      { key: 'unknown', label: { en: 'Unknown', tr: 'Bilinmiyor' }, answerScore: 0.5 }
    ],
    required: true,
    order: 44
  },
  {
    code: 'P6',
    principleKey: 'privacy_data_governance',
    principleLabel: { en: 'Privacy & Data Governance', tr: 'Gizlilik ve Veri Yönetişimi' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Do the explanations or visualizations generated by the system risk revealing personal medical details?',
      tr: 'Sistem tarafından üretilen açıklamalar veya görselleştirmeler kişisel tıbbi bilgileri ifşa etme riski taşıyor mu?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 45
  },
  {
    code: 'P7',
    principleKey: 'privacy_data_governance',
    principleLabel: { en: 'Privacy & Data Governance', tr: 'Gizlilik ve Veri Yönetişimi' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Could incorrect outputs unintentionally reveal sensitive patient information or lead to privacy breaches?',
      tr: 'Hatalı çıktılar istemeden hassas hasta bilgilerini açığa çıkarabilir veya gizlilik ihlaline yol açabilir mi?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 46
  },
  // 7️⃣ ACCOUNTABILITY
  {
    code: 'A13',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', tr: 'Hesap Verebilirlik ve Sorumluluk' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Is explicit patient consent needed before the AI system processes or analyzes their medical data?',
      tr: 'AI sisteminin hastanın tıbbi verilerini işlemesi için açık hasta onayı gerekiyor mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', tr: 'Evet' }, answerScore: 1.0 },
      { key: 'no', label: { en: 'No', tr: 'Hayır' }, answerScore: 0.0 },
      { key: 'depends', label: { en: 'Depends', tr: 'Duruma bağlı' }, answerScore: 0.5 },
      { key: 'unknown', label: { en: 'Unknown', tr: 'Bilinmiyor' }, answerScore: 0.5 }
    ],
    required: true,
    order: 47
  },
  {
    code: 'A14',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', tr: 'Hesap Verebilirlik ve Sorumluluk' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Could the system be used beyond its intended clinical scope in ways that introduce safety risks?',
      tr: 'Sistem, amaçlanan klinik kapsamının dışında kullanılarak güvenlik riski yaratabilir mi?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 48
  },
  {
    code: 'A15',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', tr: 'Hesap Verebilirlik ve Sorumluluk' },
    appliesToRoles: ['medical-expert'],
    text: {
      en: 'Is the system aligned with relevant medical device regulations or standards (e.g., FDA SaMD, EU MDR)?',
      tr: 'Sistem FDA SaMD, AB MDR gibi ilgili tıbbi cihaz düzenlemeleriyle uyumlu mu?'
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
      { key: 'unknown', label: { en: 'Unknown', tr: 'Bilinmiyor' }, answerScore: 0.5 }
    ],
    required: true,
    order: 49
  }
];

async function seedMedicalExpertQuestions() {
  try {
    console.log('Starting medical expert questions seeding...');

    // Use medical-v1 questionnaire
    let questionnaire = await Questionnaire.findOne({ key: 'medical-v1' });
    if (!questionnaire) {
      questionnaire = await Questionnaire.create({
        key: 'medical-v1',
        title: 'Medical Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      });
      console.log('✅ Created questionnaire: medical-v1');
    } else {
      console.log('ℹ️ Questionnaire medical-v1 already exists');
    }

    // Create questions
    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const qData of medicalExpertQuestions) {
      const existing = await Question.findOne({
        questionnaireKey: 'medical-v1',
        code: qData.code
      });

      if (!existing) {
        await Question.create({
          questionnaireKey: 'medical-v1',
          ...qData
        });
        created++;
        console.log(`✅ Created question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      } else {
        // Update existing question if it exists
        await Question.findOneAndUpdate(
          { questionnaireKey: 'medical-v1', code: qData.code },
          {
            ...qData,
            updatedAt: new Date()
          }
        );
        updated++;
        console.log(`🔄 Updated question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      }
    }

    console.log('\n✅ Medical expert questions seeding complete!');
    console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    // Clear cache for medical-v1 questions
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
      req.write(JSON.stringify({ questionnaireKey: 'medical-v1' }));
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

seedMedicalExpertQuestions();
