const mongoose = require('mongoose');

const QuestionnaireSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  }, // e.g., "general-v1", "medical-v1"
  title: { 
    type: String, 
    required: true 
  },
  language: { 
    type: String, 
    default: 'en-tr' 
  }, // e.g., "en-tr"
  version: { 
    type: Number, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  description: String,
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

// Compound index for active questionnaires
QuestionnaireSchema.index({ isActive: 1, key: 1 });

module.exports = mongoose.model('Questionnaire', QuestionnaireSchema);

