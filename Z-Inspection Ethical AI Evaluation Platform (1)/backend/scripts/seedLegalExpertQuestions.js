/**
 * Seed legal expert questions into the questions collection
 * These are additional questions for legal-expert role
 * Run with: node backend/scripts/seedLegalExpertQuestions.js
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

const legalExpertQuestions = [
  // 1️⃣ GDPR/KVKK Compliance
  {
    code: 'L1',
    principleKey: 'lawfulness_compliance',
    principleLabel: { en: 'Lawfulness & Compliance', tr: 'Hukuka Uygunluk ve Mevzuat Uyumu' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Does the AI system process personal data in compliance with GDPR/KVKK?',
      tr: 'AI sistemi kişisel verileri GDPR/KVKK ile uyumlu şekilde işliyor mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_compliant', label: { en: 'Fully compliant / Tam uyumlu', tr: 'Tam uyumlu' }, answerScore: 1.0 },
      { key: 'partially_compliant', label: { en: 'Partially compliant / Kısmen uyumlu', tr: 'Kısmen uyumlu' }, answerScore: 0.5 },
      { key: 'non_compliant', label: { en: 'Non-compliant / Uyumlu değil', tr: 'Uyumlu değil' }, answerScore: 0.0 },
      { key: 'not_enough_info', label: { en: 'Not enough information / Yeterli bilgi yok', tr: 'Yeterli bilgi yok' }, answerScore: 0.5 }
    ],
    required: true,
    order: 50
  },
  {
    code: 'L2',
    principleKey: 'lawfulness_compliance',
    principleLabel: { en: 'Lawfulness & Compliance', tr: 'Hukuka Uygunluk ve Mevzuat Uyumu' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is explicit consent or a valid legal basis obtained before processing personal data?',
      tr: 'Kişisel veriler işlenmeden önce açık rıza veya geçerli bir hukuki dayanak sağlanıyor mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes_explicit_consent', label: { en: 'Yes, explicit consent obtained / Evet, açık rıza alınıyor', tr: 'Evet, açık rıza alınıyor' }, answerScore: 1.0 },
      { key: 'yes_legal_basis', label: { en: 'Yes, another legal basis applies / Evet, başka bir hukuki dayanak var', tr: 'Evet, başka bir hukuki dayanak var' }, answerScore: 1.0 },
      { key: 'partially', label: { en: 'Partially / Kısmen', tr: 'Kısmen' }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No / Hayır', tr: 'Hayır' }, answerScore: 0.0 },
      { key: 'unknown', label: { en: 'Unknown / Bilinmiyor', tr: 'Bilinmiyor' }, answerScore: 0.5 }
    ],
    required: true,
    order: 51
  },
  {
    code: 'L3',
    principleKey: 'lawfulness_compliance',
    principleLabel: { en: 'Lawfulness & Compliance', tr: 'Hukuka Uygunluk ve Mevzuat Uyumu' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'If Sensitive Data is processed, has the explicit and specific legal basis required by GDPR/KVKK been secured for its processing? Which types of sensitive data (health, biometric, racial, etc.) are being processed?',
      tr: 'Hassas Veriler işleniyorsa, bu veriler için gerekli açık ve özel hukuki dayanak sağlanmış mıdır? Hangi hassas veri türleri işlenmektedir?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 52
  },
  {
    code: 'L4',
    principleKey: 'risk_management_harm_prevention',
    principleLabel: { en: 'Risk Management & Harm Prevention', tr: 'Risk Yönetimi ve Zararın Önlenmesi' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Due to the high-risk nature of processing sensitive data, has a Data Protection Impact Assessment (DPIA) been timely and fully conducted? If so, how have the identified high risks been mitigated?',
      tr: 'Hassas verilerin yüksek riskli doğası nedeniyle DPIA / KVKK DİA zamanında ve eksiksiz yapılmış mıdır? Yapıldıysa riskler nasıl giderilmiştir?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 53
  },
  {
    code: 'L5',
    principleKey: 'purpose_limitation_data_minimization',
    principleLabel: { en: 'Purpose Limitation & Data Minimization', tr: 'Amaç Sınırlılığı ve Veri Minimizasyonu' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is personal data collected only for specific, clear, and legitimate purposes?',
      tr: 'Kişisel veriler yalnızca belirli, açık ve meşru amaçlar için mi toplanıyor?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes_clearly_defined', label: { en: 'Yes, purposes are clearly defined / Evet, amaçlar net', tr: 'Evet, amaçlar net' }, answerScore: 1.0 },
      { key: 'mostly_yes', label: { en: 'Mostly yes / Büyük ölçüde evet', tr: 'Büyük ölçüde evet' }, answerScore: 0.75 },
      { key: 'partially', label: { en: 'Partially / Kısmen', tr: 'Kısmen' }, answerScore: 0.5 },
      { key: 'no_unclear', label: { en: 'No, purposes are unclear / Hayır, amaçlar belirsiz', tr: 'Hayır, amaçlar belirsiz' }, answerScore: 0.0 }
    ],
    required: true,
    order: 54
  },
  {
    code: 'L6',
    principleKey: 'purpose_limitation_data_minimization',
    principleLabel: { en: 'Purpose Limitation & Data Minimization', tr: 'Amaç Sınırlılığı ve Veri Minimizasyonu' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is the principle of data minimization respected? (No excessive data collected)',
      tr: 'Veri minimizasyonu ilkesine uyuluyor mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_respected', label: { en: 'Fully respected / Tamamen uyuluyor', tr: 'Tamamen uyuluyor' }, answerScore: 1.0 },
      { key: 'mostly_respected', label: { en: 'Mostly respected / Büyük ölçüde uyuluyor', tr: 'Büyük ölçüde uyuluyor' }, answerScore: 0.75 },
      { key: 'partially_respected', label: { en: 'Partially respected / Kısmen uyuluyor', tr: 'Kısmen uyuluyor' }, answerScore: 0.5 },
      { key: 'not_respected', label: { en: 'Not respected / Uyulmuyor', tr: 'Uyulmuyor' }, answerScore: 0.0 }
    ],
    required: true,
    order: 55
  },
  {
    code: 'L7',
    principleKey: 'privacy_data_protection',
    principleLabel: { en: 'Privacy & Data Protection', tr: 'Gizlilik ve Veri Koruma' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Are data retention periods defined and legally appropriate?',
      tr: 'Veri saklama süreleri belirlenmiş ve hukuken uygun mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'clearly_defined_compliant', label: { en: 'Clearly defined and compliant / Net ve hukuka uygun', tr: 'Net ve hukuka uygun' }, answerScore: 1.0 },
      { key: 'defined_needs_clarification', label: { en: 'Defined but needs clarification / Tanımlı ancak net değil', tr: 'Tanımlı ancak net değil' }, answerScore: 0.5 },
      { key: 'partially_defined', label: { en: 'Partially defined / Kısmen tanımlı', tr: 'Kısmen tanımlı' }, answerScore: 0.5 },
      { key: 'not_defined', label: { en: 'Not defined / Tanımlı değil', tr: 'Tanımlı değil' }, answerScore: 0.0 }
    ],
    required: true,
    order: 56
  },
  {
    code: 'L8',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', tr: 'Hesap Verebilirlik ve Sorumluluk' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Are international data transfers handled in compliance with legal requirements?',
      tr: 'Uluslararası veri aktarımları hukuki gerekliliklere uygun mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_compliant', label: { en: 'Fully compliant / Tam uyumlu', tr: 'Tam uyumlu' }, answerScore: 1.0 },
      { key: 'compliant_safeguards', label: { en: 'Compliant with safeguards / Güvencelerle uyumlu', tr: 'Güvencelerle uyumlu' }, answerScore: 0.75 },
      { key: 'potential_risks', label: { en: 'Potential legal risks identified / Hukuki riskler mevcut', tr: 'Hukuki riskler mevcut' }, answerScore: 0.5 },
      { key: 'not_compliant', label: { en: 'Not compliant / Uyumlu değil', tr: 'Uyumlu değil' }, answerScore: 0.0 },
      { key: 'not_applicable', label: { en: 'Not applicable / Uygulanamaz', tr: 'Uygulanamaz' }, answerScore: 0.75 }
    ],
    required: true,
    order: 57
  },
  {
    code: 'L9',
    principleKey: 'privacy_data_protection',
    principleLabel: { en: 'Privacy & Data Protection', tr: 'Gizlilik ve Veri Koruma' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Are adequate technical and organizational measures in place to protect personal data?',
      tr: 'Kişisel verileri korumak için yeterli teknik ve idari önlemler alınmış mı?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'strong_measures', label: { en: 'Strong measures in place / Güçlü önlemler mevcut', tr: 'Güçlü önlemler mevcut' }, answerScore: 1.0 },
      { key: 'adequate_improvable', label: { en: 'Adequate but improvable / Yeterli ancak geliştirilebilir', tr: 'Yeterli ancak geliştirilebilir' }, answerScore: 0.75 },
      { key: 'weak_measures', label: { en: 'Weak measures / Zayıf önlemler', tr: 'Zayıf önlemler' }, answerScore: 0.5 },
      { key: 'no_clear_measures', label: { en: 'No clear measures / Net önlem yok', tr: 'Net önlem yok' }, answerScore: 0.0 }
    ],
    required: true,
    order: 58
  },
  {
    code: 'L10',
    principleKey: 'privacy_data_protection',
    principleLabel: { en: 'Privacy & Data Protection', tr: 'Gizlilik ve Veri Koruma' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is access to personal data restricted to authorized personnel only?',
      tr: 'Kişisel verilere erişim yalnızca yetkili kişilerle mi sınırlı?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'strictly_restricted', label: { en: 'Strictly restricted / Sıkı şekilde sınırlı', tr: 'Sıkı şekilde sınırlı' }, answerScore: 1.0 },
      { key: 'mostly_restricted', label: { en: 'Mostly restricted / Büyük ölçüde sınırlı', tr: 'Büyük ölçüde sınırlı' }, answerScore: 0.75 },
      { key: 'partially_restricted', label: { en: 'Partially restricted / Kısmen sınırlı', tr: 'Kısmen sınırlı' }, answerScore: 0.5 },
      { key: 'not_restricted', label: { en: 'Not restricted / Sınırlı değil', tr: 'Sınırlı değil' }, answerScore: 0.0 }
    ],
    required: true,
    order: 59
  },
  {
    code: 'L11',
    principleKey: 'risk_management_harm_prevention',
    principleLabel: { en: 'Risk Management & Harm Prevention', tr: 'Risk Yönetimi ve Zararın Önlenmesi' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is there a clear procedure for data breach detection and reporting?',
      tr: 'Veri ihlallerinin tespiti ve bildirilmesi için net bir prosedür var mı?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes_clearly_defined_tested', label: { en: 'Yes, clearly defined and tested / Net ve test edilmiş', tr: 'Net ve test edilmiş' }, answerScore: 1.0 },
      { key: 'defined_not_tested', label: { en: 'Defined but not tested / Tanımlı ancak test edilmemiş', tr: 'Tanımlı ancak test edilmemiş' }, answerScore: 0.5 },
      { key: 'informal_unclear', label: { en: 'Informal or unclear / Gayri resmi veya belirsiz', tr: 'Gayri resmi veya belirsiz' }, answerScore: 0.5 },
      { key: 'no_procedure', label: { en: 'No procedure / Prosedür yok', tr: 'Prosedür yok' }, answerScore: 0.0 }
    ],
    required: true,
    order: 60
  },
  {
    code: 'L12',
    principleKey: 'user_rights_autonomy',
    principleLabel: { en: 'User Rights & Autonomy', tr: 'Kullanıcı Hakları ve Özerklik' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Can users exercise their rights (access, delete, rectify, portability) effectively?',
      tr: 'Kullanıcılar veri haklarını etkin şekilde kullanabiliyor mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_supported', label: { en: 'Fully supported / Tam destekleniyor', tr: 'Tam destekleniyor' }, answerScore: 1.0 },
      { key: 'partially_supported', label: { en: 'Partially supported / Kısmen destekleniyor', tr: 'Kısmen destekleniyor' }, answerScore: 0.5 },
      { key: 'difficult_practice', label: { en: 'Difficult in practice / Pratikte zor', tr: 'Pratikte zor' }, answerScore: 0.5 },
      { key: 'not_supported', label: { en: 'Not supported / Desteklenmiyor', tr: 'Desteklenmiyor' }, answerScore: 0.0 }
    ],
    required: true,
    order: 61
  },
  {
    code: 'L13',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', tr: 'Hesap Verebilirlik ve Sorumluluk' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is the responsibility in case of incorrect or harmful AI decisions clearly defined?',
      tr: 'AI sisteminin yanlış veya zararlı kararları durumunda sorumluluk açıkça belirlenmiş mi?'
    },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 62
  },
  {
    code: 'L14',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', tr: 'Hesap Verebilirlik ve Sorumluluk' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Has a formal Quality Management System (QMS) been legally defined and implemented to oversee and maintain the High-Risk system\'s compliance with the AI Act throughout its entire lifecycle (design, testing, placing on the market, use)?',
      tr: 'Yüksek Riskli sistemin tüm yaşam döngüsü boyunca AI Act\'e uyumunu denetleyen ve sürdüren resmi bir Kalite Yönetim Sistemi (QMS) hukuki olarak tanımlanmış ve uygulanmakta mıdır?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'defined_binding', label: { en: 'Defined and binding', tr: 'Tanımlı ve bağlayıcı' }, answerScore: 1.0 },
      { key: 'defined_weak_binding', label: { en: 'Defined but weak binding', tr: 'Tanımlı ancak zayıf bağlayıcılık' }, answerScore: 0.5 },
      { key: 'informal_insufficient', label: { en: 'Informal or insufficient', tr: 'Gayri resmi veya yetersiz' }, answerScore: 0.5 },
      { key: 'not_defined', label: { en: 'Not defined', tr: 'Tanımlı değil' }, answerScore: 0.0 }
    ],
    required: true,
    order: 63
  },
  {
    code: 'L15',
    principleKey: 'risk_management_harm_prevention',
    principleLabel: { en: 'Risk Management & Harm Prevention', tr: 'Risk Yönetimi ve Zararın Önlenmesi' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is the AI system correctly classified under the risk categories defined by the EU AI Act (unacceptable, high-risk, limited-risk, minimal-risk)?',
      tr: 'AI sistemi, AB Yapay Zekâ Tüzüğü\'nde tanımlanan risk kategorilerine göre doğru şekilde sınıflandırılmış mı?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'correctly_classified', label: { en: 'Correctly classified / Doğru sınıflandırılmış', tr: 'Doğru sınıflandırılmış' }, answerScore: 1.0 },
      { key: 'mostly_correct', label: { en: 'Mostly correct, minor issues / Büyük ölçüde doğru', tr: 'Büyük ölçüde doğru' }, answerScore: 0.75 },
      { key: 'partially_correct', label: { en: 'Partially correct / Kısmen doğru', tr: 'Kısmen doğru' }, answerScore: 0.5 },
      { key: 'incorrectly_classified', label: { en: 'Incorrectly classified / Yanlış sınıflandırılmış', tr: 'Yanlış sınıflandırılmış' }, answerScore: 0.0 },
      { key: 'not_enough_info', label: { en: 'Not enough information / Yeterli bilgi yok', tr: 'Yeterli bilgi yok' }, answerScore: 0.5 }
    ],
    required: true,
    order: 64
  },
  {
    code: 'L16',
    principleKey: 'lawfulness_compliance',
    principleLabel: { en: 'Lawfulness & Compliance', tr: 'Hukuka Uygunluk ve Mevzuat Uyumu' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Does the AI system involve any prohibited practices under Article 5 of the EU AI Act, such as manipulation, exploitation of vulnerabilities, social scoring, or unlawful biometric identification?',
      tr: 'AI sistemi, AI Act Madde 5 kapsamında yer alan; manipülasyon, kırılgan grupların istismarı, sosyal puanlama veya hukuka aykırı biyometrik tanımlama gibi yasaklı uygulamalardan herhangi birini içeriyor mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'no_prohibited', label: { en: 'No prohibited practices identified / Yasaklı uygulama yok', tr: 'Yasaklı uygulama yok' }, answerScore: 1.0 },
      { key: 'potential_risk', label: { en: 'Potential risk identified / Olası risk mevcut', tr: 'Olası risk mevcut' }, answerScore: 0.5 },
      { key: 'partially_overlaps', label: { en: 'Partially overlaps with prohibited practices / Kısmen örtüşüyor', tr: 'Kısmen örtüşüyor' }, answerScore: 0.5 },
      { key: 'clearly_violates', label: { en: 'Clearly violates prohibited practices / Açıkça yasaklı uygulama içeriyor', tr: 'Açıkça yasaklı uygulama içeriyor' }, answerScore: 0.0 },
      { key: 'not_sure', label: { en: 'Not sure / Emin değilim', tr: 'Emin değilim' }, answerScore: 0.5 }
    ],
    required: true,
    order: 65
  },
  {
    code: 'L17',
    principleKey: 'lawfulness_compliance',
    principleLabel: { en: 'Lawfulness & Compliance', tr: 'Hukuka Uygunluk ve Mevzuat Uyumu' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'If the AI system is classified as high-risk, does it demonstrate overall legal compliance with the mandatory obligations set out in the EU AI Act?',
      tr: 'AI sistemi yüksek riskli olarak sınıflandırılmışsa, AI Act\'te zorunlu kılınan yükümlülüklere genel olarak hukuki uyum gösteriyor mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_compliant', label: { en: 'Fully compliant / Tam uyumlu', tr: 'Tam uyumlu' }, answerScore: 1.0 },
      { key: 'mostly_compliant', label: { en: 'Mostly compliant / Büyük ölçüde uyumlu', tr: 'Büyük ölçüde uyumlu' }, answerScore: 0.75 },
      { key: 'partially_compliant', label: { en: 'Partially compliant / Kısmen uyumlu', tr: 'Kısmen uyumlu' }, answerScore: 0.5 },
      { key: 'non_compliant', label: { en: 'Non-compliant / Uyumlu değil', tr: 'Uyumlu değil' }, answerScore: 0.0 },
      { key: 'not_applicable', label: { en: 'Not applicable / Uygulanamaz', tr: 'Uygulanamaz' }, answerScore: 0.75 }
    ],
    required: true,
    order: 66
  },
  {
    code: 'L18',
    principleKey: 'human_oversight_control',
    principleLabel: { en: 'Human Oversight & Control', tr: 'İnsan Gözetimi ve Kontrolü' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is human oversight over the AI system clearly defined in legally binding documents, including who is responsible, when intervention is required, and what legal consequences apply if oversight is not exercised, as required by the EU AI Act?',
      tr: 'AI sistemi üzerindeki insan gözetimi; sorumlular, müdahale gerektiren durumlar ve müdahale edilmediğinde doğacak hukuki sonuçlar bağlayıcı belgelerde açıkça tanımlanmış mı?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'clearly_defined_enforceable', label: { en: 'Clearly defined and enforceable / Net ve bağlayıcı', tr: 'Net ve bağlayıcı' }, answerScore: 1.0 },
      { key: 'defined_weak_enforcement', label: { en: 'Defined but weak enforcement / Tanımlı ancak bağlayıcılığı zayıf', tr: 'Tanımlı ancak bağlayıcılığı zayıf' }, answerScore: 0.5 },
      { key: 'partially_defined', label: { en: 'Partially defined / Kısmen tanımlı', tr: 'Kısmen tanımlı' }, answerScore: 0.5 },
      { key: 'not_defined', label: { en: 'Not defined / Tanımlı değil', tr: 'Tanımlı değil' }, answerScore: 0.0 },
      { key: 'not_sure', label: { en: 'Not sure / Emin değilim', tr: 'Emin değilim' }, answerScore: 0.5 }
    ],
    required: true,
    order: 67
  },
  {
    code: 'L19',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', tr: 'Hesap Verebilirlik ve Sorumluluk' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is conformity assessment and required documentation prepared under the EU AI Act?',
      tr: 'AI Act kapsamında zorunlu olan uygunluk değerlendirmesi ve dokümantasyon hazırlanmış mı?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_prepared', label: { en: 'Fully prepared / Tamamen hazırlanmış', tr: 'Tamamen hazırlanmış' }, answerScore: 1.0 },
      { key: 'mostly_prepared', label: { en: 'Mostly prepared / Büyük ölçüde hazırlanmış', tr: 'Büyük ölçüde hazırlanmış' }, answerScore: 0.75 },
      { key: 'partially_prepared', label: { en: 'Partially prepared / Kısmen hazırlanmış', tr: 'Kısmen hazırlanmış' }, answerScore: 0.5 },
      { key: 'not_prepared', label: { en: 'Not prepared / Hazırlanmamış', tr: 'Hazırlanmamış' }, answerScore: 0.0 },
      { key: 'not_sure', label: { en: 'Not sure / Emin değilim', tr: 'Emin değilim' }, answerScore: 0.5 }
    ],
    required: true,
    order: 68
  },
  {
    code: 'L20',
    principleKey: 'risk_management_harm_prevention',
    principleLabel: { en: 'Risk Management & Harm Prevention', tr: 'Risk Yönetimi ve Zararın Önlenmesi' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'After the AI system has been placed on the market or put into service, are there clearly defined and legally binding mechanisms to continuously monitor its performance and to detect, document, and report serious incidents to the relevant authorities within the timelines required by the EU AI Act?',
      tr: 'AI sistemi piyasaya arz edildikten veya kullanıma alındıktan sonra; performans izleme, ciddi olayların tespiti, kayıt altına alınması ve zamanında bildirilmesi için bağlayıcı mekanizmalar mevcut mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'clearly_defined_operational', label: { en: 'Clearly defined and operational / Net ve aktif', tr: 'Net ve aktif' }, answerScore: 1.0 },
      { key: 'defined_limited', label: { en: 'Defined but limited / Tanımlı ancak sınırlı', tr: 'Tanımlı ancak sınırlı' }, answerScore: 0.5 },
      { key: 'informal_unclear', label: { en: 'Informal or unclear / Gayri resmi veya belirsiz', tr: 'Gayri resmi veya belirsiz' }, answerScore: 0.5 },
      { key: 'not_defined', label: { en: 'Not defined / Tanımlı değil', tr: 'Tanımlı değil' }, answerScore: 0.0 }
    ],
    required: true,
    order: 69
  },
  {
    code: 'L21',
    principleKey: 'transparency_explainability',
    principleLabel: { en: 'Transparency & Explainability', tr: 'Şeffaflık ve Açıklanabilirlik' },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'If the AI system is a \'limited-risk\' system (e.g., a chatbot), are legal mechanisms in place to clearly inform users that they are interacting with an AI?',
      tr: 'AI sistemi sınırlı riskli bir sistemse (ör. chatbot), kullanıcılara bir YZ ile etkileşimde olduklarını açıkça bildiren hukuki mekanizmalar mevcut mu?'
    },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_present_compliant', label: { en: 'Fully Present and Compliant / Tamamen mevcut ve uyumlu', tr: 'Tamamen mevcut ve uyumlu' }, answerScore: 1.0 },
      { key: 'present_weak_legal', label: { en: 'Present but Weak Legal / Mevcut ancak hukuki dayanağı zayıf', tr: 'Mevcut ancak hukuki dayanağı zayıf' }, answerScore: 0.5 },
      { key: 'not_defined', label: { en: 'Not Defined / Tanımlı değil', tr: 'Tanımlı değil' }, answerScore: 0.0 },
      { key: 'not_applicable', label: { en: 'Not Applicable / Uygulanamaz', tr: 'Uygulanamaz' }, answerScore: 0.75 }
    ],
    required: true,
    order: 70
  }
];

async function seedLegalExpertQuestions() {
  try {
    console.log('Starting legal expert questions seeding...');

    // Use legal-expert-v1 questionnaire
    let questionnaire = await Questionnaire.findOne({ key: 'legal-expert-v1' });
    if (!questionnaire) {
      questionnaire = await Questionnaire.create({
        key: 'legal-expert-v1',
        title: 'Legal Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      });
      console.log('✅ Created questionnaire: legal-expert-v1');
    } else {
      console.log('ℹ️ Questionnaire legal-expert-v1 already exists');
    }

    // Create questions
    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const qData of legalExpertQuestions) {
      const existing = await Question.findOne({
        questionnaireKey: 'legal-expert-v1',
        code: qData.code
      });

      if (!existing) {
        await Question.create({
          questionnaireKey: 'legal-expert-v1',
          ...qData
        });
        created++;
        console.log(`✅ Created question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      } else {
        // Update existing question if it exists
        await Question.findOneAndUpdate(
          { questionnaireKey: 'legal-expert-v1', code: qData.code },
          {
            ...qData,
            updatedAt: new Date()
          }
        );
        updated++;
        console.log(`🔄 Updated question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      }
    }

    console.log('\n✅ Legal expert questions seeding complete!');
    console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    // Clear cache for legal-expert-v1 questions
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
      req.write(JSON.stringify({ questionnaireKey: 'legal-expert-v1' }));
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

seedLegalExpertQuestions();


