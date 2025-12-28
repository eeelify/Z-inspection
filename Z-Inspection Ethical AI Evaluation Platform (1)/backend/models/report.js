const mongoose = require('mongoose');

const ExpertCommentSchema = new mongoose.Schema({
  expertId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expertName: { type: String, default: '' },
  commentText: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const ReportSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  // Alias for "use case" terminology (same underlying entity as projectId in this codebase)
  useCaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  title: {
    type: String,
    default: 'Analysis Report'
  },
  // Legacy single-body content
  content: {
    type: String
  },
  // Expert comments (one per expert)
  expertComments: {
    type: [ExpertCommentSchema],
    default: []
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['draft', 'final', 'archived'],
    default: 'draft',
    index: true
  },
  finalizedAt: {
    type: Date
  },
  metadata: {
    totalScores: Number,
    totalEvaluations: Number,
    totalTensions: Number,
    principlesAnalyzed: [String]
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Index for efficient querying
ReportSchema.index({ projectId: 1, generatedAt: -1 });
ReportSchema.index({ projectId: 1, status: 1 });
ReportSchema.index({ useCaseId: 1, generatedAt: -1 });

module.exports = mongoose.model('Report', ReportSchema);

