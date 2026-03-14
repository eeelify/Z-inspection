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
    principleLabel: { en: 'Lawfulness & Compliance', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Does the AI system process personal data in compliance with GDPR',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_compliant', label: { en: 'Fully compliant', }, answerScore: 1.0 },
      { key: 'partially_compliant', label: { en: 'Partially compliant', }, answerScore: 0.5 },
      { key: 'non_compliant', label: { en: 'Non-compliant', }, answerScore: 0.0 },
      { key: 'not_enough_info', label: { en: 'Not enough information', }, answerScore: 0.5 }
    ],
    required: true,
    order: 50
  },
  {
    code: 'L2',
    principleKey: 'lawfulness_compliance',
    principleLabel: { en: 'Lawfulness & Compliance', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is explicit consent or a valid legal basis obtained before processing personal data?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes_explicit_consent', label: { en: 'Yes, explicit consent obtained', }, answerScore: 1.0 },
      { key: 'yes_legal_basis', label: { en: 'Yes, another legal basis applies', }, answerScore: 1.0 },
      { key: 'partially', label: { en: 'Partially', }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 },
      { key: 'unknown', label: { en: 'Unknown', }, answerScore: 0.5 }
    ],
    required: true,
    order: 51
  },
  {
    code: 'L3',
    principleKey: 'lawfulness_compliance',
    principleLabel: { en: 'Lawfulness & Compliance', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'If Sensitive Data is processed, has the explicit and specific legal basis required by GDPR',
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
    principleLabel: { en: 'Risk Management & Harm Prevention', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Due to the high-risk nature of processing sensitive data, has a Data Protection Impact Assessment (DPIA) been timely and fully conducted? If so, how have the identified high risks been mitigated?',
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
    principleLabel: { en: 'Purpose Limitation & Data Minimization', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is personal data collected only for specific, clear, and legitimate purposes?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes_clearly_defined', label: { en: 'Yes, purposes are clearly defined', }, answerScore: 1.0 },
      { key: 'mostly_yes', label: { en: 'Mostly yes', }, answerScore: 0.75 },
      { key: 'partially', label: { en: 'Partially', }, answerScore: 0.5 },
      { key: 'no_unclear', label: { en: 'No, purposes are unclear', }, answerScore: 0.0 }
    ],
    required: true,
    order: 54
  },
  {
    code: 'L6',
    principleKey: 'purpose_limitation_data_minimization',
    principleLabel: { en: 'Purpose Limitation & Data Minimization', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is the principle of data minimization respected? (No excessive data collected)',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_respected', label: { en: 'Fully respected', }, answerScore: 1.0 },
      { key: 'mostly_respected', label: { en: 'Mostly respected', }, answerScore: 0.75 },
      { key: 'partially_respected', label: { en: 'Partially respected', }, answerScore: 0.5 },
      { key: 'not_respected', label: { en: 'Not respected', }, answerScore: 0.0 }
    ],
    required: true,
    order: 55
  },
  {
    code: 'L7',
    principleKey: 'privacy_data_protection',
    principleLabel: { en: 'Privacy & Data Protection', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Are data retention periods defined and legally appropriate?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'clearly_defined_compliant', label: { en: 'Clearly defined and compliant', }, answerScore: 1.0 },
      { key: 'defined_needs_clarification', label: { en: 'Defined but needs clarification', }, answerScore: 0.5 },
      { key: 'partially_defined', label: { en: 'Partially defined', }, answerScore: 0.5 },
      { key: 'not_defined', label: { en: 'Not defined', }, answerScore: 0.0 }
    ],
    required: true,
    order: 56
  },
  {
    code: 'L8',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Are international data transfers handled in compliance with legal requirements?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_compliant', label: { en: 'Fully compliant', }, answerScore: 1.0 },
      { key: 'compliant_safeguards', label: { en: 'Compliant with safeguards', }, answerScore: 0.75 },
      { key: 'potential_risks', label: { en: 'Potential legal risks identified', }, answerScore: 0.5 },
      { key: 'not_compliant', label: { en: 'Not compliant', }, answerScore: 0.0 },
      { key: 'not_applicable', label: { en: 'Not applicable', }, answerScore: 0.75 }
    ],
    required: true,
    order: 57
  },
  {
    code: 'L9',
    principleKey: 'privacy_data_protection',
    principleLabel: { en: 'Privacy & Data Protection', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Are adequate technical and organizational measures in place to protect personal data?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'strong_measures', label: { en: 'Strong measures in place', }, answerScore: 1.0 },
      { key: 'adequate_improvable', label: { en: 'Adequate but improvable', }, answerScore: 0.75 },
      { key: 'weak_measures', label: { en: 'Weak measures', }, answerScore: 0.5 },
      { key: 'no_clear_measures', label: { en: 'No clear measures', }, answerScore: 0.0 }
    ],
    required: true,
    order: 58
  },
  {
    code: 'L10',
    principleKey: 'privacy_data_protection',
    principleLabel: { en: 'Privacy & Data Protection', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is access to personal data restricted to authorized personnel only?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'strictly_restricted', label: { en: 'Strictly restricted', }, answerScore: 1.0 },
      { key: 'mostly_restricted', label: { en: 'Mostly restricted', }, answerScore: 0.75 },
      { key: 'partially_restricted', label: { en: 'Partially restricted', }, answerScore: 0.5 },
      { key: 'not_restricted', label: { en: 'Not restricted', }, answerScore: 0.0 }
    ],
    required: true,
    order: 59
  },
  {
    code: 'L11',
    principleKey: 'risk_management_harm_prevention',
    principleLabel: { en: 'Risk Management & Harm Prevention', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is there a clear procedure for data breach detection and reporting?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes_clearly_defined_tested', label: { en: 'Yes, clearly defined and tested', }, answerScore: 1.0 },
      { key: 'defined_not_tested', label: { en: 'Defined but not tested', }, answerScore: 0.5 },
      { key: 'informal_unclear', label: { en: 'Informal or unclear', }, answerScore: 0.5 },
      { key: 'no_procedure', label: { en: 'No procedure', }, answerScore: 0.0 }
    ],
    required: true,
    order: 60
  },
  {
    code: 'L12',
    principleKey: 'user_rights_autonomy',
    principleLabel: { en: 'User Rights & Autonomy', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Can users exercise their rights (access, delete, rectify, portability) effectively?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_supported', label: { en: 'Fully supported', }, answerScore: 1.0 },
      { key: 'partially_supported', label: { en: 'Partially supported', }, answerScore: 0.5 },
      { key: 'difficult_practice', label: { en: 'Difficult in practice', }, answerScore: 0.5 },
      { key: 'not_supported', label: { en: 'Not supported', }, answerScore: 0.0 }
    ],
    required: true,
    order: 61
  },
  {
    code: 'L13',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is the responsibility in case of incorrect or harmful AI decisions clearly defined?',
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
    principleLabel: { en: 'Accountability & Responsibility', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Has a formal Quality Management System (QMS) been legally defined and implemented to oversee and maintain the High-Risk system\'s compliance with the AI Act throughout its entire lifecycle (design, testing, placing on the market, use)?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'defined_binding', label: { en: 'Defined and binding', }, answerScore: 1.0 },
      { key: 'defined_weak_binding', label: { en: 'Defined but weak binding', }, answerScore: 0.5 },
      { key: 'informal_insufficient', label: { en: 'Informal or insufficient', }, answerScore: 0.5 },
      { key: 'not_defined', label: { en: 'Not defined', }, answerScore: 0.0 }
    ],
    required: true,
    order: 63
  },
  {
    code: 'L15',
    principleKey: 'risk_management_harm_prevention',
    principleLabel: { en: 'Risk Management & Harm Prevention', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is the AI system correctly classified under the risk categories defined by the EU AI Act (unacceptable, high-risk, limited-risk, minimal-risk)?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'correctly_classified', label: { en: 'Correctly classified', }, answerScore: 1.0 },
      { key: 'mostly_correct', label: { en: 'Mostly correct, minor issues', }, answerScore: 0.75 },
      { key: 'partially_correct', label: { en: 'Partially correct', }, answerScore: 0.5 },
      { key: 'incorrectly_classified', label: { en: 'Incorrectly classified', }, answerScore: 0.0 },
      { key: 'not_enough_info', label: { en: 'Not enough information', }, answerScore: 0.5 }
    ],
    required: true,
    order: 64
  },
  {
    code: 'L16',
    principleKey: 'lawfulness_compliance',
    principleLabel: { en: 'Lawfulness & Compliance', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Does the AI system involve any prohibited practices under Article 5 of the EU AI Act, such as manipulation, exploitation of vulnerabilities, social scoring, or unlawful biometric identification?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'no_prohibited', label: { en: 'No prohibited practices identified', }, answerScore: 1.0 },
      { key: 'potential_risk', label: { en: 'Potential risk identified', }, answerScore: 0.5 },
      { key: 'partially_overlaps', label: { en: 'Partially overlaps with prohibited practices', }, answerScore: 0.5 },
      { key: 'clearly_violates', label: { en: 'Clearly violates prohibited practices', }, answerScore: 0.0 },
      { key: 'not_sure', label: { en: 'Not sure', }, answerScore: 0.5 }
    ],
    required: true,
    order: 65
  },
  {
    code: 'L17',
    principleKey: 'lawfulness_compliance',
    principleLabel: { en: 'Lawfulness & Compliance', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'If the AI system is classified as high-risk, does it demonstrate overall legal compliance with the mandatory obligations set out in the EU AI Act?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_compliant', label: { en: 'Fully compliant', }, answerScore: 1.0 },
      { key: 'mostly_compliant', label: { en: 'Mostly compliant', }, answerScore: 0.75 },
      { key: 'partially_compliant', label: { en: 'Partially compliant', }, answerScore: 0.5 },
      { key: 'non_compliant', label: { en: 'Non-compliant', }, answerScore: 0.0 },
      { key: 'not_applicable', label: { en: 'Not applicable', }, answerScore: 0.75 }
    ],
    required: true,
    order: 66
  },
  {
    code: 'L18',
    principleKey: 'human_oversight_control',
    principleLabel: { en: 'Human Oversight & Control', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is human oversight over the AI system clearly defined in legally binding documents, including who is responsible, when intervention is required, and what legal consequences apply if oversight is not exercised, as required by the EU AI Act?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'clearly_defined_enforceable', label: { en: 'Clearly defined and enforceable', }, answerScore: 1.0 },
      { key: 'defined_weak_enforcement', label: { en: 'Defined but weak enforcement', }, answerScore: 0.5 },
      { key: 'partially_defined', label: { en: 'Partially defined', }, answerScore: 0.5 },
      { key: 'not_defined', label: { en: 'Not defined', }, answerScore: 0.0 },
      { key: 'not_sure', label: { en: 'Not sure', }, answerScore: 0.5 }
    ],
    required: true,
    order: 67
  },
  {
    code: 'L19',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'Is conformity assessment and required documentation prepared under the EU AI Act?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_prepared', label: { en: 'Fully prepared', }, answerScore: 1.0 },
      { key: 'mostly_prepared', label: { en: 'Mostly prepared', }, answerScore: 0.75 },
      { key: 'partially_prepared', label: { en: 'Partially prepared', }, answerScore: 0.5 },
      { key: 'not_prepared', label: { en: 'Not prepared', }, answerScore: 0.0 },
      { key: 'not_sure', label: { en: 'Not sure', }, answerScore: 0.5 }
    ],
    required: true,
    order: 68
  },
  {
    code: 'L20',
    principleKey: 'risk_management_harm_prevention',
    principleLabel: { en: 'Risk Management & Harm Prevention', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'After the AI system has been placed on the market or put into service, are there clearly defined and legally binding mechanisms to continuously monitor its performance and to detect, document, and report serious incidents to the relevant authorities within the timelines required by the EU AI Act?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'clearly_defined_operational', label: { en: 'Clearly defined and operational', }, answerScore: 1.0 },
      { key: 'defined_limited', label: { en: 'Defined but limited', }, answerScore: 0.5 },
      { key: 'informal_unclear', label: { en: 'Informal or unclear', }, answerScore: 0.5 },
      { key: 'not_defined', label: { en: 'Not defined', }, answerScore: 0.0 }
    ],
    required: true,
    order: 69
  },
  {
    code: 'L21',
    principleKey: 'transparency_explainability',
    principleLabel: { en: 'Transparency & Explainability', },
    appliesToRoles: ['legal-expert'],
    text: {
      en: 'If the AI system is a \'limited-risk\' system (e.g., a chatbot), are legal mechanisms in place to clearly inform users that they are interacting with an AI?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'fully_present_compliant', label: { en: 'Fully Present and Compliant', }, answerScore: 1.0 },
      { key: 'present_weak_legal', label: { en: 'Present but Weak Legal', }, answerScore: 0.5 },
      { key: 'not_defined', label: { en: 'Not Defined', }, answerScore: 0.0 },
      { key: 'not_applicable', label: { en: 'Not Applicable', }, answerScore: 0.75 }
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


