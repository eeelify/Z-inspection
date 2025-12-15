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
    principle: 'HUMAN AGENCY & OVERSIGHT',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'Does the AI system carry a risk of influencing users\' autonomy or decision-making processes (e.g., cognitive/behavioral manipulation) in ethically unacceptable ways? What is the potential for this risk to overlap with practices prohibited under EU AI Act Article 5?',
      tr: 'AI sistemi, kullanıcıların özerkliğini veya karar verme süreçlerini (örn. bilişsel/davranışsal manipülasyon) etik olarak kabul edilemez şekillerde etkileme riski taşıyor mu? Bu riskin AB AI Yasası Madde 5 kapsamında yasaklanan uygulamalarla örtüşme potansiyeli nedir?'
    },
    answerType: 'single_choice',
    options: [
      { key: 'high_risk', label: { en: 'High risk / Yüksek risk', tr: 'Yüksek risk' }, score: 1 },
      { key: 'moderate_risk', label: { en: 'Moderate risk / Orta risk', tr: 'Orta risk' }, score: 2 },
      { key: 'low_risk', label: { en: 'Low risk / Düşük risk', tr: 'Düşük risk' }, score: 3 },
      { key: 'no_risk', label: { en: 'No risk / Risk yok', tr: 'Risk yok' }, score: 4 },
      { key: 'not_sure', label: { en: 'Not sure / Emin değilim', tr: 'Emin değilim' }, score: 2 }
    ],
    required: true,
    order: 13
  },
  {
    code: 'H10',
    principle: 'HUMAN AGENCY & OVERSIGHT',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'If it is a High-Risk system, do the human oversight procedures required by the AI Act adequately define the ethical ability and responsibility to override the AI\'s risky decisions?',
      tr: 'Yüksek riskli bir sistem ise, AI Yasası tarafından gerekli kılınan insan gözetim prosedürleri, AI\'ın riskli kararlarını geçersiz kılma konusundaki etik yetenek ve sorumluluğu yeterince tanımlıyor mu?'
    },
    answerType: 'open_text',
    required: true,
    order: 14
  },
  // 2️⃣ TECHNICAL ROBUSTNESS & SAFETY
  {
    code: 'S2',
    principle: 'TECHNICAL ROBUSTNESS & SAFETY',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'How do you assess the potential harm the AI system may cause and its potential to affect fundamental rights? Has a Fundamental Rights Impact Assessment (FRIA) been conducted?',
      tr: 'AI sisteminin neden olabileceği potansiyel zararı ve temel hakları etkileme potansiyelini nasıl değerlendiriyorsunuz? Temel Haklar Etki Değerlendirmesi (FRIA) yapıldı mı?'
    },
    answerType: 'open_text',
    required: true,
    order: 15
  },
  // 3️⃣ PRIVACY & DATA GOVERNANCE
  {
    code: 'P4',
    principle: 'PRIVACY & DATA GOVERNANCE',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'Does the use of Sensitive Data (e.g., health, race, biometric data) ethically raise the risk of bias, societal unfairness, or stigmatization potential to an unacceptable level? What is the ethical justification for using this data?',
      tr: 'Hassas Verilerin (örn. sağlık, ırk, biyometrik veri) kullanımı, etik olarak önyargı, toplumsal adaletsizlik veya damgalanma potansiyeli riskini kabul edilemez bir seviyeye yükseltiyor mu? Bu verilerin kullanımının etik gerekçesi nedir?'
    },
    answerType: 'open_text',
    required: true,
    order: 16
  },
  // 4️⃣ TRANSPARENCY
  {
    code: 'T9',
    principle: 'TRANSPARENCY',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'If the system is a \'limited-risk\' system, is the user\'s ethical right to know that the output is AI-generated provided clearly and comprehensibly?',
      tr: 'Sistem \'sınırlı riskli\' bir sistem ise, kullanıcının çıktının AI tarafından üretildiğini bilme etik hakkı açık ve anlaşılır bir şekilde sağlanıyor mu?'
    },
    answerType: 'open_text',
    required: true,
    order: 17
  },
  // 5️⃣ DIVERSITY, NON-DISCRIMINATION & FAIRNESS
  {
    code: 'F2',
    principle: 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'Could the system produce systematic unfairness or disproportionate impacts on certain groups?',
      tr: 'Sistem belirli gruplar üzerinde sistematik adaletsizlik veya orantısız etkiler üretebilir mi?'
    },
    answerType: 'single_choice',
    options: [
      { key: 'high_risk', label: { en: 'High risk / Yüksek risk', tr: 'Yüksek risk' }, score: 1 },
      { key: 'moderate_risk', label: { en: 'Moderate risk / Orta risk', tr: 'Orta risk' }, score: 2 },
      { key: 'low_risk', label: { en: 'Low risk / Düşük risk', tr: 'Düşük risk' }, score: 3 },
      { key: 'not_sure', label: { en: 'Not sure / Emin değilim', tr: 'Emin değilim' }, score: 2 }
    ],
    required: true,
    order: 18
  },
  {
    code: 'F3',
    principle: 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'Are there identifiable sources of bias in the data, model, or system design? If so, what ethical and technical mitigation strategies have been implemented to address these biases?',
      tr: 'Veri, model veya sistem tasarımında tanımlanabilir önyargı kaynakları var mı? Varsa, bu önyargıları ele almak için hangi etik ve teknik azaltma stratejileri uygulanmıştır?'
    },
    answerType: 'open_text',
    required: true,
    order: 19
  },
  // 6️⃣ SOCIETAL & ENVIRONMENTAL WELL-BEING
  {
    code: 'W7',
    principle: 'SOCIETAL & INTERPERSONAL WELL-BEING',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'Does the AI system respect freedom of expression and access to information? How are potential risks of unintentional restriction or censorship managed?',
      tr: 'AI sistemi ifade özgürlüğüne ve bilgiye erişime saygı gösteriyor mu? İstemeden kısıtlama veya sansür riskleri nasıl yönetiliyor?'
    },
    answerType: 'single_choice',
    options: [
      { key: 'fully_respects', label: { en: 'Fully respects / Tamamen saygı gösteriyor', tr: 'Tamamen saygı gösteriyor' }, score: 4 },
      { key: 'partially_respects', label: { en: 'Partially respects / Kısmen saygı gösteriyor', tr: 'Kısmen saygı gösteriyor' }, score: 3 },
      { key: 'may_unintentionally_restrict', label: { en: 'May unintentionally restrict / İstemeden kısıtlama yaratabilir', tr: 'İstemeden kısıtlama yaratabilir' }, score: 2 },
      { key: 'significantly_restricts', label: { en: 'Significantly restricts / Önemli ölçüde kısıtlayabilir', tr: 'Önemli ölçüde kısıtlayabilir' }, score: 1 },
      { key: 'not_applicable', label: { en: 'Not applicable / Uygulanabilir değil', tr: 'Uygulanabilir değil' }, score: 3 }
    ],
    required: true,
    order: 20
  },
  {
    code: 'W8',
    principle: 'SOCIETAL & INTERPERSONAL WELL-BEING',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'Are there any ethical tensions or value conflicts in the design or use of the system—for example, conflicts between privacy and transparency, fairness and performance, autonomy and efficiency, or security and freedom? If yes, please describe them in detail.',
      tr: 'Sistemin tasarımında veya kullanımında herhangi bir etik gerilim veya değer çatışması var mı—örneğin, gizlilik ve şeffaflık, adalet ve performans, özerklik ve verimlilik veya güvenlik ve özgürlük arasındaki çatışmalar? Varsa, lütfen bunları detaylı olarak açıklayın.'
    },
    answerType: 'open_text',
    required: true,
    order: 21
  },
  // 7️⃣ ACCOUNTABILITY
  {
    code: 'A5',
    principle: 'ACCOUNTABILITY',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'Do you consider the system\'s outcomes and decisions ethically defensible in light of ethical principles?',
      tr: 'Sistemin sonuçlarını ve kararlarını etik ilkeler ışığında etik olarak savunulabilir buluyor musunuz?'
    },
    answerType: 'open_text',
    required: true,
    order: 22
  },
  {
    code: 'A11',
    principle: 'ACCOUNTABILITY',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'How are ethical accountability mechanisms established among the system\'s developers, users, and affected third parties? Are the complaint and appeal processes regarding AI decisions ethically fair?',
      tr: 'Sistemin geliştiricileri, kullanıcıları ve etkilenen üçüncü taraflar arasında etik hesap verebilirlik mekanizmaları nasıl kurulmuştur? AI kararlarına ilişkin şikayet ve itiraz süreçleri etik olarak adil midir?'
    },
    answerType: 'open_text',
    required: true,
    order: 23
  },
  {
    code: 'A12',
    principle: 'ACCOUNTABILITY',
    appliesToRoles: ['ethical-expert'],
    text: { 
      en: 'Which ethical aspects of the system need improvement?',
      tr: 'Sistemin hangi etik yönleri iyileştirilmesi gerekiyor?'
    },
    answerType: 'open_text',
    required: true,
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
          ...qData,
          scoring: {
            scale: '0-4',
            method: qData.answerType === 'open_text' ? 'rubric' : 'mapped'
          }
        });
        created++;
        console.log(`✅ Created question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      } else {
        // Update existing question if it exists
        await Question.findOneAndUpdate(
          { questionnaireKey: 'ethical-v1', code: qData.code },
          {
            ...qData,
            scoring: {
              scale: '0-4',
              method: qData.answerType === 'open_text' ? 'rubric' : 'mapped'
            },
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


