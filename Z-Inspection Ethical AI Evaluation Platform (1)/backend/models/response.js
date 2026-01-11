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
  // STRICT ETHICAL SCORING: answerScore (0.0-1.0)
  // 1.0 = No issue / Good
  // 0.0 = High Risk / Bad
  // This must be mapped directly from the Question option definition.
  answerScore: {
    type: Number,
    min: 0,
    max: 1,
    required: false,
    default: null
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

