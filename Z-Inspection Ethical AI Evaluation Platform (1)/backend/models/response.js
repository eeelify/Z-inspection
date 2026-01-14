const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  questionCode: {
    type: String,
    required: true
  }, // e.g., "T1", "H2"
  answer: {
    choiceKey: String, // For single_choice
    text: String,      // For open_text
    numeric: Number,   // For numeric
    multiChoiceKeys: [String] // For multi_choice
  },
  score: {
    type: Number,
    min: 0,
    max: 4,
    required: false, // Allow null for unanswered questions
    default: null
  }, // Normalized 0-4 score (null for unanswered questions) - legacy field
  // STRICT ETHICAL SCORING SCHEMA
  // 1. importanceScore (0-4): Expert's prioritization
  importanceScore: {
    type: Number,
    min: 0,
    max: 4,
    required: false,
    default: null
  },
  // 2. answerSeverity (0.0-1.0): Observed risk severity
  // 1.0 = High Risk, 0.0 = No Risk
  answerSeverity: {
    type: Number,
    min: 0,
    max: 1,
    required: false,
    default: null
  },
  // DEPRECATED: Do not use. Preserved for legacy migration only.
  answerScore: {
    type: Number,
    required: false,
    select: false // Hide by default to discourage use
  },
  // ERC Model: answerSeverity (0-1) for free-text questions coverage logic
  // Expert-provided severity: 0 = safe, 0.5 = partial, 1 = risky
  answerSeverity: {
    type: Number,
    min: 0,
    max: 1,
    required: false,
    default: null
  },
  scoreSuggested: Number, // Optional: AI-suggested score for open_text
  scoreFinal: Number,     // Final score after review (for open_text)
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }, // Who reviewed/scored this (for open_text)
  notes: String,
  evidence: [{
    type: String, // URLs or file references
    description: String
  }]
}, { _id: false });

const ResponseSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectAssignment',
    required: true
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
  questionnaireVersion: {
    type: Number,
    required: true
  },
  answers: [AnswerSchema],
  status: {
    type: String,
    enum: ['draft', 'submitted', 'locked'],
    default: 'draft',
    index: true
  },
  submittedAt: Date,
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Unique index: one response per project-user-questionnaire
ResponseSchema.index({ projectId: 1, userId: 1, questionnaireKey: 1 }, { unique: true });
ResponseSchema.index({ projectId: 1, role: 1, questionnaireKey: 1 });
ResponseSchema.index({ 'answers.questionCode': 1 }); // Multikey index for questionCode queries

module.exports = mongoose.model('Response', ResponseSchema);

