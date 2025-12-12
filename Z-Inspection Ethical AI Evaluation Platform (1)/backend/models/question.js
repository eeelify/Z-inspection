const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  questionnaireKey: { 
    type: String, 
    required: true,
    index: true 
  },
  code: { 
    type: String, 
    required: true 
  }, // e.g., "T1", "H2", "Q10"
  principle: { 
    type: String, 
    required: true,
    enum: [
      'TRANSPARENCY',
      'HUMAN AGENCY & OVERSIGHT',
      'TECHNICAL ROBUSTNESS & SAFETY',
      'PRIVACY & DATA GOVERNANCE',
      'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
      'SOCIETAL & INTERPERSONAL WELL-BEING',
      'ACCOUNTABILITY'
    ]
  },
  appliesToRoles: { 
    type: [String], 
    default: ['any'] 
  }, // e.g., ["any"] or ["medical-expert", "technical-expert"]
  text: {
    en: { type: String, required: true },
    tr: { type: String, required: true }
  },
  answerType: { 
    type: String, 
    required: true,
    enum: ['single_choice', 'multi_choice', 'open_text', 'numeric']
  },
  options: [{
    key: String, // e.g., "very_clear", "mostly_clear"
    label: {
      en: String,
      tr: String
    },
    score: { 
      type: Number, 
      min: 0, 
      max: 4 
    } // Direct mapping score for this option
  }],
  scoring: {
    scale: { 
      type: String, 
      default: '0-4' 
    },
    method: { 
      type: String, 
      enum: ['mapped', 'rubric'], 
      default: 'mapped' 
    }
  },
  required: { 
    type: Boolean, 
    default: true 
  },
  order: { 
    type: Number, 
    required: true 
  },
  tags: [String],
  description: {
    en: String,
    tr: String
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
QuestionSchema.index({ questionnaireKey: 1, order: 1 });
QuestionSchema.index({ questionnaireKey: 1, code: 1 }, { unique: true });
QuestionSchema.index({ principle: 1 });

module.exports = mongoose.model('Question', QuestionSchema);

