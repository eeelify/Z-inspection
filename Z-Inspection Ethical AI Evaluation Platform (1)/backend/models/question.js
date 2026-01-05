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
      'TRANSPARENCY & EXPLAINABILITY',
      'HUMAN AGENCY & OVERSIGHT',
      'HUMAN OVERSIGHT & CONTROL',
      'TECHNICAL ROBUSTNESS & SAFETY',
      'PRIVACY & DATA GOVERNANCE',
      'PRIVACY & DATA PROTECTION',
      'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
      'SOCIETAL & INTERPERSONAL WELL-BEING',
      'ACCOUNTABILITY',
      'ACCOUNTABILITY & RESPONSIBILITY',
      'LAWFULNESS & COMPLIANCE',
      'RISK MANAGEMENT & HARM PREVENTION',
      'PURPOSE LIMITATION & DATA MINIMIZATION',
      'USER RIGHTS & AUTONOMY'
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
    }, // Direct mapping score for this option (risk score, 0-4)
    answerQuality: {
      type: Number,
      min: 0,
      max: 1
    } // Answer quality score (AQ) for this option, 0-1 scale
  }],
  // Option scores mapping for select-based questions (alternative to answerQuality in options)
  // Stored as plain object: { optionKey: AQ_score_0_to_1 }
  optionScores: {
    type: mongoose.Schema.Types.Mixed
  },
  // A) RPN Model: optionRiskMap for select questions (legacy, kept for backward compatibility)
  // Maps option key to answerRisk (0-4): { optionKey: 0|1|2|3|4 }
  optionRiskMap: {
    type: mongoose.Schema.Types.Mixed
  },
  // ERC Model: optionSeverityMap for select questions
  // Maps option key to answerSeverity (0-1): { optionKey: 0|0.5|1 }
  // 0 = safe/no risk, 0.5 = partial/somewhat, 1 = risky/critical
  optionSeverityMap: {
    type: mongoose.Schema.Types.Mixed
  },
  // ERC Model: riskScore (Question Risk Importance, 0-4)
  // Represents how critical this ethical question is (NOT the system's current risk)
  riskScore: {
    type: Number,
    min: 0,
    max: 4,
    default: 2 // Default to medium importance
  },
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

