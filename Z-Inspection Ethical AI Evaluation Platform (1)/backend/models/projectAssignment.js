const mongoose = require('mongoose');

const ProjectAssignmentSchema = new mongoose.Schema({
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
    required: true 
  }, // e.g., "medical-expert", "technical-expert"
  questionnaires: [{ 
    type: String 
  }], // Array of questionnaire keys like ["general-v1", "medical-v1"]
  status: { 
    type: String, 
    enum: ['assigned', 'in_progress', 'submitted'],
    default: 'assigned' 
  },
  assignedAt: { 
    type: Date, 
    default: Date.now 
  },
  dueAt: Date,
  completedAt: Date,
  // --- Evolution completion (after all tensions are voted) ---
  evolutionCompletedAt: Date,
  notes: String
}, {
  timestamps: true
});

// Unique index: one assignment per project-user combination
ProjectAssignmentSchema.index({ projectId: 1, userId: 1 }, { unique: true });
ProjectAssignmentSchema.index({ projectId: 1, role: 1 });
ProjectAssignmentSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('ProjectAssignment', ProjectAssignmentSchema);

