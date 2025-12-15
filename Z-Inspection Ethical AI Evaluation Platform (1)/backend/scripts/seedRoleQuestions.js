/**
 * Seed role-specific questions into the questions collection
 * Run with: node backend/scripts/seedRoleQuestions.js
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

// Role-specific questions data
const roleQuestions = {
  'technical-v1': [
    {
      code: 'TECH1',
      principle: 'TECHNICAL ROBUSTNESS & SAFETY',
      appliesToRoles: ['technical-expert'],
      text: { en: 'Is the system resilient to data poisoning attacks?', tr: 'Sistem veri zehirleme saldırılarına karşı dirençli mi?' },
      answerType: 'single_choice',
      options: [
        { key: 'very_resilient', label: { en: 'Very Resilient', tr: 'Çok Dirençli' }, score: 4 },
        { key: 'mostly_resilient', label: { en: 'Mostly Resilient', tr: 'Büyük Ölçüde Dirençli' }, score: 3 },
        { key: 'somewhat_vulnerable', label: { en: 'Somewhat Vulnerable', tr: 'Kısmen Savunmasız' }, score: 2 },
        { key: 'very_vulnerable', label: { en: 'Very Vulnerable', tr: 'Çok Savunmasız' }, score: 1 }
      ],
      required: true,
      order: 1
    },
    {
      code: 'TECH2',
      principle: 'TECHNICAL ROBUSTNESS & SAFETY',
      appliesToRoles: ['technical-expert'],
      text: { en: 'Does the model communicate uncertainty in its decisions?', tr: 'Model kararlarındaki belirsizliği iletiyor mu?' },
      answerType: 'single_choice',
      options: [
        { key: 'yes_with_score', label: { en: 'Yes (Confidence score shown)', tr: 'Evet (Güven skoru gösteriliyor)' }, score: 4 },
        { key: 'no_only_result', label: { en: 'No (Only result shown)', tr: 'Hayır (Sadece sonuç gösteriliyor)' }, score: 1 }
      ],
      required: true,
      order: 2
    }
  ],
  'ethical-v1': [
    {
      code: 'ETH1',
      principle: 'TRANSPARENCY',
      appliesToRoles: ['ethical-expert'],
      text: { en: 'Which legal regulations does the AI system comply with?', tr: 'AI sistemi hangi yasal düzenlemelere uyuyor?' },
      answerType: 'multi_choice',
      options: [
        { key: 'gdpr', label: { en: 'GDPR', tr: 'GDPR' }, score: 4 },
        { key: 'ai_act', label: { en: 'AI Act', tr: 'AI Act' }, score: 4 },
        { key: 'kvkk', label: { en: 'KVKK', tr: 'KVKK' }, score: 4 },
        { key: 'none', label: { en: 'None', tr: 'Hiçbiri' }, score: 0 }
      ],
      required: true,
      order: 1
    },
    {
      code: 'ETH2',
      principle: 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
      appliesToRoles: ['ethical-expert'],
      text: { en: 'Does the system contain bias against specific demographic groups?', tr: 'Sistem belirli demografik gruplara karşı önyargı içeriyor mu?' },
      answerType: 'open_text',
      required: true,
      order: 2
    }
  ]
};

async function seedQuestions() {
  try {
    console.log('Starting question seeding...');

    // Create questionnaires if they don't exist
    for (const [key, questions] of Object.entries(roleQuestions)) {
      let questionnaire = await Questionnaire.findOne({ key });
      if (!questionnaire) {
        questionnaire = await Questionnaire.create({
          key,
          title: `${key} Questionnaire`,
          language: 'en-tr',
          version: 1,
          isActive: true
        });
        console.log(`Created questionnaire: ${key}`);
      }

      // Create questions
      for (const qData of questions) {
        const existing = await Question.findOne({ 
          questionnaireKey: key, 
          code: qData.code 
        });
        
        if (!existing) {
          await Question.create({
            questionnaireKey: key,
            ...qData,
            scoring: {
              scale: '0-4',
              method: 'mapped'
            }
          });
          console.log(`Created question: ${qData.code} in ${key}`);
        } else {
          console.log(`Question ${qData.code} already exists, skipping`);
        }
      }
    }

    console.log('Question seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedQuestions();

