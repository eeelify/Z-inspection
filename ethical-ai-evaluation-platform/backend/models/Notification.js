const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  entityType: { type: String, enum: ['tension', 'evaluation', 'response', 'report'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: {
    type: String,
    enum: [
      'tension_created',
      'tension_commented',
      'tension_evidence_added',
      'tension_voted',
      'evaluation_started',
      'evaluation_submitted',
      'project_assigned',
      'evaluation_completed',
      'project_all_completed',
      'report_commented'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorRole: { type: String },
  metadata: {
    tensionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tension' },
    tensionTitle: String,
    voteType: { type: String, enum: ['agree', 'disagree'] },
    evidenceType: String,
    questionId: String,
    questionnaireKey: String,
    questionnaireVersion: Number,
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectAssignment' },
    role: String,
    projectTitle: String,
    submittedAt: Date,
    assignedCount: Number,
    submittedCount: Number,
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
    commentPreview: String
  },
  dedupeKey: { type: String, index: true }, // For better deduplication
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  readAt: { type: Date },
  isRead: { type: Boolean, default: false, index: true }
});

// Indexes for performance
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ projectId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, type: 1, entityId: 1, 'metadata.voteType': 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, dedupeKey: 1 }, { unique: true, sparse: true }); // Unique dedupe key per recipient

module.exports = mongoose.model('Notification', NotificationSchema);

