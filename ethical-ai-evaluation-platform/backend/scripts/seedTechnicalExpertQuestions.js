/**
 * Seed technical expert questions into the questions collection
 * These are additional questions for technical-expert role
 * Run with: node backend/scripts/seedTechnicalExpertQuestions.js
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

const technicalExpertQuestions = [
  // 1️⃣ TECHNICAL ROBUSTNESS & SAFETY
  {
    code: 'T1',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'Is the model\'s performance sufficient for its intended purpose and operational environment?',
      },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'yes_fully_sufficient', label: { en: 'Yes, fully sufficient', }, answerScore: 1.0 },
      { key: 'partially_sufficient', label: { en: 'Partially sufficient', }, answerScore: 0.5 },
      { key: 'insufficient', label: { en: 'Insufficient', }, answerScore: 0.0 }
    ],
    required: true,
    order: 71
  },
  {
    code: 'T2',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'Under what conditions is the system most likely to fail, degrade, or generate incorrect outputs?',
      },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 72
  },
  {
    code: 'T3',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'Do you observe any technical risks in the data processing pipeline (collection, cleaning, transformation, aggregation, labeling)?',
      },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 73
  },
  {
    code: 'T4',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'Is the dataset sufficiently representative to avoid bias, edge-case failures, or distribution issues?',
      },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 74
  },
  {
    code: 'T5',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'Is the model regularly monitored for model drift, data drift, performance degradation, or distribution changes? Which tools or metrics are used?',
      },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 75
  },
  {
    code: 'T6',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'Does the system behave consistently under missing data, corrupted inputs, network instability, or sensor noise?',
      },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 76
  },
  // 2️⃣ TECHNICAL ROBUSTNESS & SAFETY – SECURITY & RESILIENCE
  {
    code: 'T7',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'Is the system resilient to adversarial attacks, data poisoning attempts, input manipulation, or model exploitation?',
      },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'strong_resilience', label: { en: 'Strong resilience', }, answerScore: 1.0 },
      { key: 'moderate_resilience', label: { en: 'Moderate resilience', }, answerScore: 0.75 },
      { key: 'weak_resilience', label: { en: 'Weak resilience', }, answerScore: 0.5 },
      { key: 'no_resilience', label: { en: 'No resilience', }, answerScore: 0.0 },
      { key: 'unknown', label: { en: 'Unknown', }, answerScore: 0.5 }
    ],
    required: true,
    order: 77
  },
  {
    code: 'T8',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'How exposed is the AI system to cybersecurity threats such as unauthorized access, API exploitation, brute-force attacks, data leaks, or endpoint vulnerabilities?',
      },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'highly_exposed', label: { en: 'Highly exposed', }, answerScore: 0.0 },
      { key: 'moderately_exposed', label: { en: 'Moderately exposed', }, answerScore: 0.5 },
      { key: 'slightly_exposed', label: { en: 'Slightly exposed', }, answerScore: 0.75 },
      { key: 'not_exposed', label: { en: 'Not exposed', }, answerScore: 1.0 },
      { key: 'not_enough_info', label: { en: 'Not enough information', }, answerScore: 0.5 }
    ],
    required: true,
    order: 78
  },
  {
    code: 'T9',
    principleKey: 'technical_robustness_safety',
    principleLabel: { en: 'Technical Robustness & Safety', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'Are API',
      },
    answerType: 'single_choice',
    scoring: {
      answerScoreRange: '0-1',
      importanceHandledSeparately: true,
      method: 'mapped'
    },
    options: [
      { key: 'strong_security', label: { en: 'Strong security', }, answerScore: 1.0 },
      { key: 'moderate_security', label: { en: 'Moderate security', }, answerScore: 0.75 },
      { key: 'weak_security', label: { en: 'Weak security', }, answerScore: 0.5 },
      { key: 'no_security', label: { en: 'No security', }, answerScore: 0.0 },
      { key: 'unknown', label: { en: 'Unknown', }, answerScore: 0.5 }
    ],
    required: true,
    order: 79
  },
  // 3️⃣ TRANSPARENCY
  {
    code: 'T10',
    principleKey: 'transparency_explainability',
    principleLabel: { en: 'Transparency & Explainability', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'Is the system\'s explainability level sufficient for debugging, auditing, and stakeholder understanding? (SHAP, LIME, saliency maps, etc.)',
      },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 80
  },
  // 4️⃣ PRIVACY & DATA GOVERNANCE
  {
    code: 'T11',
    principleKey: 'privacy_data_governance',
    principleLabel: { en: 'Privacy & Data Governance', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'Are personal data protected through encryption, anonymization, or pseudonymization across all processing stages?',
      },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 81
  },
  // 5️⃣ ACCOUNTABILITY
  {
    code: 'T12',
    principleKey: 'accountability_responsibility',
    principleLabel: { en: 'Accountability & Responsibility', },
    appliesToRoles: ['technical-expert'],
    text: {
      en: 'What technical improvements would you recommend to enhance the security, robustness, reliability, or compliance of the system?',
      },
    answerType: 'open_text',
    scoring: {
      method: 'manual_risk_input',
      answerScoreRequired: true,
      autoScoringAllowed: false
    },
    required: true,
    order: 82
  }
];

async function seedTechnicalExpertQuestions() {
  try {
    console.log('Starting technical expert questions seeding...');

    // Use technical-expert-v1 questionnaire
    let questionnaire = await Questionnaire.findOne({ key: 'technical-expert-v1' });
    if (!questionnaire) {
      questionnaire = await Questionnaire.create({
        key: 'technical-expert-v1',
        title: 'Technical Expert Questions v1',
        language: 'en-tr',
        version: 1,
        isActive: true
      });
      console.log('✅ Created questionnaire: technical-expert-v1');
    } else {
      console.log('ℹ️ Questionnaire technical-expert-v1 already exists');
    }

    // Create questions
    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const qData of technicalExpertQuestions) {
      const existing = await Question.findOne({
        questionnaireKey: 'technical-expert-v1',
        code: qData.code
      });

      if (!existing) {
        await Question.create({
          questionnaireKey: 'technical-expert-v1',
          ...qData
        });
        created++;
        console.log(`✅ Created question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      } else {
        // Update existing question if it exists
        await Question.findOneAndUpdate(
          { questionnaireKey: 'technical-expert-v1', code: qData.code },
          {
            ...qData,
            updatedAt: new Date()
          }
        );
        updated++;
        console.log(`🔄 Updated question: ${qData.code} - ${qData.text.en.substring(0, 50)}...`);
      }
    }

    console.log('\n✅ Technical expert questions seeding complete!');
    console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    // Clear cache for technical-expert-v1 questions
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
      req.write(JSON.stringify({ questionnaireKey: 'technical-expert-v1' }));
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

seedTechnicalExpertQuestions();


