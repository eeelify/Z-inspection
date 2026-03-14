/**
 * Seed education expert questions into the questions collection
 * These are additional questions for education-expert role
 * Run with: node backend/scripts/seedEducationExpertQuestions.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB - Use same connection string as server.js
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI environment variable bulunamadı!');
}

const Questionnaire = require('../models/questionnaire');
const Question = require('../models/question');

const educationExpertQuestions = [
  // 1️⃣ HUMAN AGENCY & OVERSIGHT + FAIRNESS
  {
    code: 'E1',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Are the students\' digital literacy levels sufficient for safe and effective use of the system?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 1.0 },
      { key: 'partially', label: { en: 'Partially', }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 },
      { key: 'not_sure', label: { en: 'Not sure', }, answerScore: 0.5 }
    ],
    required: true,
    order: 100
  },
  // 2️⃣ HUMAN AGENCY & OVERSIGHT + TRANSPARENCY
  {
    code: 'E2',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Are the training materials and onboarding guides clear, sufficient, and pedagogically appropriate?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 1.0 },
      { key: 'partially', label: { en: 'Partially', }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 },
      { key: 'insufficient', label: { en: 'Insufficient', }, answerScore: 0.0 }
    ],
    required: true,
    order: 101
  },
  // 3️⃣ HUMAN AGENCY & OVERSIGHT + SOCIETAL WELL-BEING (Risk Scale)
  {
    code: 'E3',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Is there a risk that the system\'s outputs may contradict teacher instructions or deviate from the national curriculum?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'risk_1', label: { en: '1 - Low risk', }, answerScore: 1.0 },
      { key: 'risk_2', label: { en: '2', }, answerScore: 0.75 },
      { key: 'risk_3', label: { en: '3', }, answerScore: 0.5 },
      { key: 'risk_4', label: { en: '4', }, answerScore: 0.0 }, // Assuming 4 is high risk/problematic here based on original score 1
      { key: 'risk_5', label: { en: '5 - High risk', }, answerScore: 0.0 }
    ],
    required: true,
    order: 102
  },
  // 4️⃣ SOCIETAL & ENVIRONMENTAL WELL-BEING
  {
    code: 'E4',
    principleKey: 'societal_wellbeing',
    principleLabel: { en: 'Societal & Interpersonal Well-being', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Does the system oversimplify complex topics in ways that may hinder deep learning?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 103
  },
  // 5️⃣ HUMAN AGENCY & OVERSIGHT
  {
    code: 'E5',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Does the system encourage interactive (Socratic) learning, or does it push students toward passive consumption?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'active_learning', label: { en: 'Active learning', }, answerScore: 1.0 },
      { key: 'neutral', label: { en: 'Neutral', }, answerScore: 0.5 },
      { key: 'passive_use', label: { en: 'Passive use', }, answerScore: 0.0 }
    ],
    required: true,
    order: 104
  },
  // 6️⃣ HUMAN AGENCY & OVERSIGHT
  {
    code: 'E6',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Do you see a need for additional training or onboarding for users?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 105
  },
  // 7️⃣ HUMAN AGENCY & OVERSIGHT + TECHNICAL ROBUSTNESS
  {
    code: 'E7',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Are students capable of recognizing incorrect or low-quality AI responses and is there a risk of "automation bias" (over-trusting the AI)?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 1.0 },
      { key: 'partially', label: { en: 'Partially', }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 },
      { key: 'not_sure', label: { en: 'Not sure', }, answerScore: 0.5 }
    ],
    required: true,
    order: 106
  },
  // 8️⃣ SOCIETAL & ENVIRONMENTAL WELL-BEING
  {
    code: 'E8',
    principleKey: 'societal_wellbeing',
    principleLabel: { en: 'Societal & Interpersonal Well-being', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Could long-term use of the system cause digital fatigue, attention loss, or cognitive overload in students?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 107
  },
  // 9️⃣ FAIRNESS & NON-DISCRIMINATION
  {
    code: 'E9',
    principleKey: 'diversity_fairness',
    principleLabel: { en: 'Diversity, Non-Discrimination & Fairness', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Could students with lower digital skills have more difficulty understanding system outputs?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 0.0 },
      { key: 'partially', label: { en: 'Partially', }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', }, answerScore: 1.0 },
      { key: 'depends', label: { en: 'Depends', }, answerScore: 0.5 }
    ],
    required: true,
    order: 108
  },
  // 🔟 DIVERSITY, NON-DISCRIMINATION & FAIRNESS
  {
    code: 'E10',
    principleKey: 'diversity_fairness',
    principleLabel: { en: 'Diversity, Non-Discrimination & Fairness', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Does the system provide accessible and inclusive features for disadvantaged or special-needs students?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 1.0 },
      { key: 'partially', label: { en: 'Partially', }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 }
    ],
    required: true,
    order: 109
  },
  // 1️⃣1️⃣ PRIVACY & DATA GOVERNANCE
  {
    code: 'E11',
    principleKey: 'privacy_data_governance',
    principleLabel: { en: 'Privacy & Data Governance', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Does the system process and store student data in compliance with GDPR',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 1.0 },
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 },
      { key: 'uncertain', label: { en: 'Uncertain', }, answerScore: 0.5 }
    ],
    required: true,
    order: 110
  },
  // 1️⃣2️⃣ ACCOUNTABILITY
  {
    code: 'E12',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Has the teacher completed the Ethical Declaration Form and obtained the required administrative permissions?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 1.0 },
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 }
    ],
    required: true,
    order: 111
  },
  // 1️⃣3️⃣ ACCOUNTABILITY
  {
    code: 'E13',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Is there an AI Ethics Committee or an official mechanism for appeals, complaints, or oversight?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 1.0 },
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 }
    ],
    required: true,
    order: 112
  },
  // 1️⃣4️⃣ TECHNICAL ROBUSTNESS & SAFETY (Risk Scale)
  {
    code: 'E14',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'What is the risk of the system generating inaccurate, fabricated (hallucinated), or pedagogically harmful information?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'risk_1', label: { en: '1 - Low risk', }, answerScore: 1.0 },
      { key: 'risk_2', label: { en: '2', }, answerScore: 0.75 },
      { key: 'risk_3', label: { en: '3', }, answerScore: 0.5 },
      { key: 'risk_4', label: { en: '4', }, answerScore: 0.0 },
      { key: 'risk_5', label: { en: '5 - High risk', }, answerScore: 0.0 }
    ],
    required: true,
    order: 113
  },
  // 1️⃣5️⃣ SOCIETAL & ENVIRONMENTAL WELL-BEING + ACCOUNTABILITY
  {
    code: 'E15',
    principleKey: 'societal_wellbeing',
    principleLabel: { en: 'Societal & Interpersonal Well-being', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Does the system make it easier for students to cheat, plagiarize, or bypass learning tasks?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 114
  },
  // 1️⃣6️⃣ TRANSPARENCY + TECHNICAL ROBUSTNESS
  {
    code: 'E16',
    principleKey: 'transparency_explainability',
    principleLabel: { en: 'Transparency & Explainability', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Are the information sources used by the system reliable, updated, and academically valid?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 115
  },
  // 1️⃣7️⃣ TRANSPARENCY
  {
    code: 'E17',
    principleKey: 'transparency_explainability',
    principleLabel: { en: 'Transparency & Explainability', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Does the system provide sufficient explainability and transparency for students to verify or understand its outputs?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 116
  },
  // 1️⃣8️⃣ HUMAN AGENCY & OVERSIGHT + TRANSPARENCY
  {
    code: 'E18',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Could students trust the AI too much and accept information without verifying it?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 117
  },
  // 1️⃣9️⃣ TECHNICAL ROBUSTNESS & SAFETY + TRANSPARENCY
  {
    code: 'E19',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Can the system produce ambiguous or misleading outputs that may confuse students?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 118
  },
  // 2️⃣0️⃣ ACCOUNTABILITY
  {
    code: 'E20',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Is there a risk of students misusing the system in harmful, unethical, or unintended ways?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 119
  },
  // 2️⃣1️⃣ HUMAN AGENCY & OVERSIGHT
  {
    code: 'E21',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Are teacher supervision and human-in-the-loop mechanisms adequate during system use?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 120
  },
  // 2️⃣2️⃣ ACCOUNTABILITY
  {
    code: 'E22',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'What additional precautions, classroom rules, or usage boundaries would you recommend?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 121
  },
  // 2️⃣3️⃣ SOCIETAL & ENVIRONMENTAL WELL-BEING
  {
    code: 'E23',
    principleKey: 'societal_wellbeing',
    principleLabel: { en: 'Societal & Interpersonal Well-being', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'What improvements would you suggest to make the system more supportive for student learning?',
      },
    answerType: 'open_text',
    riskScore: 4,
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 122
  },
  // 2️⃣4️⃣ ACCOUNTABILITY
  {
    code: 'E24',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Does the AI system qualify as a "high-risk educational AI system" under the EU AI Act (e.g., systems used for assessing students, determining access, or evaluating performance)?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 0.0 }, // High risk -> low score
      { key: 'no', label: { en: 'No', }, answerScore: 1.0 }, // No risk -> high score
      { key: 'under_evaluation', label: { en: 'Under Evaluation', }, answerScore: 0.5 }
    ],
    required: true,
    order: 123
  },
  // 2️⃣5️⃣ HUMAN AGENCY & OVERSIGHT
  {
    code: 'E25',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Are human oversight measures (intervention ability, stopping the system, reviewing outputs) clearly defined as required by the AI Act?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 1.0 },
      { key: 'partially', label: { en: 'Partially', }, answerScore: 0.5 },
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 }
    ],
    required: true,
    order: 124
  },
  // 2️⃣6️⃣ HUMAN AGENCY + FAIRNESS
  {
    code: 'E26',
    principleKey: 'human_agency_oversight',
    principleLabel: { en: 'Human Agency & Oversight', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Are you confident that the system does not employ any prohibited AI practices defined in the AI Act (e.g., manipulative nudging, exploitation of minors)?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 1.0 }, // Yes, I am confident it does NOT employ = good
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 }, // No, I am not confident = risk
      { key: 'need_investigation', label: { en: 'Need Investigation', }, answerScore: 0.0 } // 1 mapped to 0.0
    ],
    required: true,
    order: 125
  },
  // 2️⃣7️⃣ TRANSPARENCY + ACCOUNTABILITY
  {
    code: 'E27',
    principleKey: 'transparency_explainability',
    principleLabel: { en: 'Transparency & Explainability', },
    appliesToRoles: ['education-expert'],
    text: {
      en: 'Does the system automatically log its activities to ensure traceability and auditability of educational decisions?',
      },
    answerType: 'single_choice',
    riskScore: 4,
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes', label: { en: 'Yes', }, answerScore: 1.0 },
      { key: 'no', label: { en: 'No', }, answerScore: 0.0 },
      { key: 'not_sure', label: { en: 'Not sure', }, answerScore: 0.5 }
    ],
    required: true,
    order: 126
  }
];

async function seedEducationExpertQuestions() {
  try {
    // Connect to MongoDB and wait for connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
      console.log('✅ MongoDB bağlantısı başarılı');
    } else if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB zaten bağlı');
    }

    console.log('Starting education expert questions seeding...');

    // Use education-expert-v1 questionnaire
    let questionnaire = await Questionnaire.findOne({ key: 'education-expert-v1' });
    if (!questionnaire) {
      questionnaire = await Questionnaire.create({
        key: 'education-expert-v1',
        title: 'Education Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      });
      console.log('✅ Created questionnaire: education-expert-v1');
    } else {
      console.log('ℹ️ Questionnaire education-expert-v1 already exists');
    }

    // Create questions
    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const qData of educationExpertQuestions) {
      const existing = await Question.findOne({
        questionnaireKey: 'education-expert-v1',
        code: qData.code
      });

      if (!existing) {
        await Question.create({
          questionnaireKey: 'education-expert-v1',
          ...qData
        });
        created++;
        console.log(`✅ Created question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      } else {
        // Update existing question if it exists
        await Question.findOneAndUpdate(
          { questionnaireKey: 'education-expert-v1', code: qData.code },
          {
            ...qData,
            updatedAt: new Date()
          }
        );
        updated++;
        console.log(`🔄 Updated question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      }
    }

    console.log('\n✅ Education expert questions seeding complete!');
    console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    // Clear cache for education-expert-v1 questions
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
      req.write(JSON.stringify({ questionnaireKey: 'education-expert-v1' }));
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

seedEducationExpertQuestions();
