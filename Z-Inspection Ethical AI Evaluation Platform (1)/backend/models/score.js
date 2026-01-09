const mongoose = require('mongoose');

const PrincipleScoreSchema = new mongoose.Schema({
  avg: { type: Number, required: true },
  n: { type: Number, required: true }, // Number of questions answered
  min: Number,
  max: Number,
  // NEW: Performance Model fields
  performance: { type: Number }, // Performance score (0-4, higher = better)
  score: { type: Number }, // Alias for performance
  // LEGACY: Risk Model fields
  risk: { type: Number }, // Principle risk (0-4 or 0-100 scale) - LEGACY
  maturity: { type: Number }, // Principle maturity (0-1 or 0-100 scale) - LEGACY
  rwSum: { type: Number }, // Sum of risk weights for this principle - LEGACY
  answeredCount: { type: Number }, // Number of answered questions
  missingCount: { type: Number }, // Number of missing questions
  topDrivers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    questionCode: String,
    // ERC Model fields
    riskImportance: Number, // 0-4 (question importance/criticality)
    answerSeverity: Number, // 0-1 (risk severity indicated by answer)
    computedERC: Number, // 0-4 (riskImportance × answerSeverity)
    // Legacy RPN fields (for backward compatibility)
    riskScore: Number, // 0-4 (question importance) - alias for riskImportance
    answerRisk: Number, // 0-4 (risk indicated by answer) - legacy
    rawRpn: Number, // riskScore × answerRisk (0-16) - legacy
    normalizedContribution: Number // rawRpn / 4 (0-4) - legacy
  }]
}, { _id: false });

const QuestionScoreSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  principleKey: { type: String, required: true },
  score: { type: Number, required: true }, // 0-4 scale
  weight: { type: Number, default: 1 }, // Optional question weight
  isNA: { type: Boolean, default: false } // Whether this was marked as N/A
}, { _id: false });

const ScoreSchema = new mongoose.Schema({
  projectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true,
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  role: { 
    type: String, 
    required: true,
    index: true 
  },
  questionnaireKey: { 
    type: String, 
    required: true,
    index: true 
  },
  computedAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  scoringModelVersion: { 
    type: String, 
    default: 'erc_v1' // ERC model version (erc_v1) or legacy (rpn_v1, aq_rw_v1)
  },
  totals: {
    avg: { type: Number, required: true }, // Backward compatibility
    min: Number,
    max: Number,
    n: Number, // Total questions answered
    // NEW: Performance Model fields
    overallPerformance: { type: Number }, // Overall performance score (0-4, higher = better)
    performancePercentage: { type: Number }, // Performance as percentage (0-100%)
    // LEGACY: RPN/Risk Model fields
    overallRisk: { type: Number }, // Overall ethical risk (0-4) = average(principleRisk) - LEGACY
    answeredCount: { type: Number }, // Number of answered questions
    missingCount: { type: Number } // Number of missing questions
  },
  byPrinciple: {
    TRANSPARENCY: PrincipleScoreSchema,
    'HUMAN AGENCY & OVERSIGHT': PrincipleScoreSchema,
    'TECHNICAL ROBUSTNESS & SAFETY': PrincipleScoreSchema,
    'PRIVACY & DATA GOVERNANCE': PrincipleScoreSchema,
    'DIVERSITY, NON-DISCRIMINATION & FAIRNESS': PrincipleScoreSchema,
    'SOCIETAL & INTERPERSONAL WELL-BEING': PrincipleScoreSchema,
    ACCOUNTABILITY: PrincipleScoreSchema
  },
  byQuestion: [QuestionScoreSchema], // Array of per-question scores for top risky questions analysis
  // E) Per-question breakdown for drill-down
  questionBreakdown: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    principle: String,
    // ERC Model fields
    riskImportance: Number, // 0-4 (question importance)
    answerSeverity: Number, // 0-1 (answer severity)
    computedERC: Number, // 0-4 (riskImportance × answerSeverity)
    answerType: String,
    mappingMissing: Boolean,
    source: String, // Source of answerSeverity (expert_provided, optionSeverityMap, label_inference, etc.)
    // Legacy fields (for backward compatibility)
    riskScore: Number, // 0-4 - alias for riskImportance
    answerRisk: Number, // 0-4 - legacy
    normalizedContribution: Number, // 0-4 - legacy
    triggeredRules: [String] // Legacy
  }],
  // Role-aware aggregation (for project-level scores)
  byRole: {
    type: mongoose.Schema.Types.Mixed // Plain object: { roleName: { role, overallRisk, ... } }
  }
}, {
  timestamps: true
});

// Compound indexes for reporting
ScoreSchema.index({ projectId: 1, questionnaireKey: 1 });
ScoreSchema.index({ projectId: 1, role: 1 });
ScoreSchema.index({ projectId: 1, computedAt: -1 });

module.exports = mongoose.model('Score', ScoreSchema);

