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
  principleKey: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  }, // e.g. "human_agency_oversight" - Machine stable key
  principleLabel: {
    en: { type: String, required: true }
  }, // Localized principle names
  principle: {
    type: String,
    required: false // Deprecated: keeping for backward compatibility
  },
  appliesToRoles: {
    type: [String],
    default: ['any']
  },
  text: {
    en: { type: String, required: true }
  },
  answerType: {
    type: String,
    required: true,
    enum: ['single_choice', 'multi_choice', 'open_text', 'numeric']
  },
  options: [{
    key: String,
    label: {
      en: String
    },
    answerScore: { // NEW: 0.0-1.0 (1=Safe, 0=Risky)
      type: Number,
      min: 0,
      max: 1
    },
    // Legacy fields mapped/kept for compatibility during migration
    answerQuality: { type: Number, min: 0, max: 1 },
    score: { type: Number, min: 0, max: 4 }
  }],
  // Option scores mapping (answerScore map)
  optionScores: {
    type: mongoose.Schema.Types.Mixed
  },
  // Legacy maps
  optionRiskMap: { type: mongoose.Schema.Types.Mixed },
  optionSeverityMap: { type: mongoose.Schema.Types.Mixed },

  riskScore: {
    type: Number,
    min: 0,
    max: 4,
    default: 2
  },
  scoring: {
    answerScoreRange: { type: String, default: '0-1' }, // NEW
    importanceHandledSeparately: { type: Boolean, default: true }, // NEW
    method: {
      type: String,
      enum: ['mapped', 'rubric', 'manual_risk_input'],
      default: 'mapped'
    },
    answerScoreRequired: { type: Boolean, default: false }, // NEW
    autoScoringAllowed: { type: Boolean, default: true }, // NEW
    // Legacy
    scale: { type: String }
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
    en: String
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

