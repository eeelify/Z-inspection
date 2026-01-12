/**
 * Report Model
 * 
 * Single source of truth for generated ethical assessment reports.
 * Ensures PDF and Word are always generated together and version-controlled.
 * 
 * CRITICAL RULES:
 * - Only ONE report per project can have latest = true
 * - PDF and Word must always reference the same report version
 * - Reports are immutable once generated (status can change, but files cannot)
 */

const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema(
  {
    // Reference to the project
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },

    // Version number (auto-incremented per project)
    version: {
      type: Number,
      required: true,
      min: 1
    },

    // Report status
    status: {
      type: String,
      enum: ['generating', 'final', 'archived', 'failed'],
      default: 'generating',
      required: true
    },

    // Latest flag - only ONE report per project can be latest = true
    latest: {
      type: Boolean,
      default: false,
      index: true
    },

    // Generation timestamp
    generatedAt: {
      type: Date,
      default: Date.now,
      required: true
    },

    // File paths (relative to uploads directory)
    pdfPath: {
      type: String,
      default: null
    },

    wordPath: {
      type: String,
      default: null
    },

    // File sizes (for UI display)
    pdfSize: {
      type: Number, // bytes
      default: null
    },

    wordSize: {
      type: Number, // bytes
      default: null
    },

    // Snapshot metadata (for traceability)
    metadata: {
      // Scoring model version used
      scoringModelVersion: {
        type: String,
        default: 'erc_v1'
      },

      // Number of questions assessed
      questionsAnswered: {
        type: Number,
        default: 0
      },

      // Number of tensions identified
      tensionsCount: {
        type: Number,
        default: 0
      },

      // Overall ERC score
      overallERC: {
        type: Number,
        default: null
      },

      // Risk label
      riskLabel: {
        type: String,
        default: null
      },

      // Number of evaluators
      evaluatorCount: {
        type: Number,
        default: 0
      },

      // Evaluator roles
      evaluatorRoles: {
        type: [String],
        default: []
      },

      // Generation duration (ms)
      generationDurationMs: {
        type: Number,
        default: null
      }
    },

    // Error details (if generation failed)
    errorDetails: {
      message: String,
      stack: String,
      timestamp: Date
    },

    // Generated summary of the report
    summary: {
      type: String,
      default: null
    },

    // Comments from experts/reviewers
    expertComments: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      userName: { type: String, required: true },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }],

    // User who triggered generation (optional)
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true, // createdAt, updatedAt
    collection: 'reports'
  }
);

// Compound index: projectId + latest (for fast "get latest report" queries)
ReportSchema.index({ projectId: 1, latest: 1 });

// Compound index: projectId + version (for version lookups)
ReportSchema.index({ projectId: 1, version: 1 }, { unique: true });

// Index for status queries
ReportSchema.index({ status: 1 });

/**
 * Static method: Get the latest report for a project
 */
ReportSchema.statics.getLatestReport = async function (projectId) {
  return this.findOne({
    projectId,
    latest: true,
    status: 'final'
  }).sort({ version: -1 });
};

/**
 * Static method: Get next version number for a project
 */
ReportSchema.statics.getNextVersion = async function (projectId) {
  const latestReport = await this.findOne({ projectId })
    .sort({ version: -1 })
    .select('version')
    .lean();

  return latestReport ? latestReport.version + 1 : 1;
};

/**
 * Static method: Mark a report as latest (and unmark all others)
 * CRITICAL: This ensures only ONE report per project has latest = true
 */
ReportSchema.statics.markAsLatest = async function (reportId, projectId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Unmark all existing latest reports for this project
    await this.updateMany(
      { projectId, latest: true },
      { $set: { latest: false } },
      { session }
    );

    // Mark the new report as latest
    await this.updateOne(
      { _id: reportId },
      { $set: { latest: true, status: 'final' } },
      { session }
    );

    await session.commitTransaction();
    return true;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Instance method: Validate that both PDF and Word exist
 */
ReportSchema.methods.validateFiles = function () {
  if (!this.pdfPath || !this.wordPath) {
    throw new Error(
      `Report ${this._id} is incomplete: ` +
      `PDF=${!!this.pdfPath}, Word=${!!this.wordPath}`
    );
  }
  return true;
};

/**
 * Instance method: Get file paths as absolute URLs
 */
ReportSchema.methods.getFileUrls = function (baseUrl = '') {
  return {
    pdf: this.pdfPath ? `${baseUrl}/api/reports/${this._id}/pdf` : null,
    word: this.wordPath ? `${baseUrl}/api/reports/${this._id}/word` : null
  };
};

/**
 * Pre-save validation: Ensure version is set
 */
ReportSchema.pre('save', async function (next) {
  if (this.isNew && !this.version) {
    this.version = await this.constructor.getNextVersion(this.projectId);
  }
  next();
});

/**
 * Virtual: Human-readable version label
 */
ReportSchema.virtual('versionLabel').get(function () {
  return `v${this.version}${this.latest ? ' (Latest)' : ''}`;
});

// Ensure virtuals are included in JSON output
ReportSchema.set('toJSON', { virtuals: true });
ReportSchema.set('toObject', { virtuals: true });

const Report = mongoose.model('Report', ReportSchema);

module.exports = Report;
