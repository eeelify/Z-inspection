const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
// Load environment variables:
// - Prefer `.env` (common convention)
// - Fallback to `env` (some Windows setups omit dotfiles)
const dotenv = require('dotenv');
const envPathDot = path.resolve(__dirname, '.env');
const envPathNoDot = path.resolve(__dirname, 'env');
const dotResult = dotenv.config({ path: envPathDot });
if (dotResult.error) {
  const noDotResult = dotenv.config({ path: envPathNoDot });
  if (noDotResult.error) {
    // Keep running; platform env vars (Railway/Render) may still be present.
    console.warn(`⚠️  dotenv could not load ${envPathDot} or ${envPathNoDot}:`, noDotResult.error.message);
  }
}

// Helper function for ObjectId validation (compatible with Mongoose v9+)
const isValidObjectId = (id) => {
  if (typeof mongoose.isValidObjectId === 'function') {
    return mongoose.isValidObjectId(id);
  }
  return mongoose.Types.ObjectId.isValid(id);
};

const app = express();
const PORT = process.env.PORT || 5000;

// Enable compression for faster responses
app.use(compression());

// Basic health endpoint (safe: does not expose secrets)
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    mongo: {
      readyState: mongoose.connection.readyState, // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
      connected: mongoose.connection.readyState === 1,
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
    },
  });
});

// --- GÜNCELLEME: Dosya yükleme limiti 300MB yapıldı ---
app.use(express.json({ limit: '300mb' }));
app.use(express.urlencoded({ limit: '300mb', extended: true }));
app.use(cors({
  origin: '*',
  credentials: true
}));

// Set keep-alive timeout
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=5, max=1000');
  next();
});

// --- 1. VERİTABANI BAĞLANTISI ---
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error("❌ MONGO_URI environment variable bulunamadı!");
}

// Optimize MongoDB connection with connection pooling
// Clean connection string (remove appName if it causes issues)
const cleanMongoUri = MONGO_URI.replace(/&appName=[^&]*/i, '');

mongoose
  .connect(cleanMongoUri, {
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 60000, // Keep trying to send operations for 60 seconds (increased)
    socketTimeoutMS: 120000, // Close sockets after 120 seconds of inactivity (increased)
    connectTimeoutMS: 60000, // Give up initial connection after 60 seconds (increased)
    retryWrites: true,
    w: 'majority',
    heartbeatFrequencyMS: 10000, // Check connection every 10 seconds
    family: 4 // Use IPv4, skip trying IPv6
  })
  .then(() => {
    console.log('✅ MongoDB Atlas Bağlantısı Başarılı');
    // Set mongoose options for better performance
    mongoose.set('bufferCommands', false);
    mongoose.set('strictQuery', false);
  })
  .catch((err) => {
    console.error('❌ Bağlantı Hatası:', err.message);
    console.error('💡 İpucu: MongoDB Atlas bağlantısı için:');
    console.error('   1. İnternet bağlantınızı kontrol edin');
    console.error('   2. MongoDB Atlas IP whitelist\'inize IP adresinizi ekleyin (0.0.0.0/0 tüm IP\'ler için)');
    console.error('   3. MongoDB kullanıcı adı ve şifresinin doğru olduğundan emin olun');
  });


// --- 2. ŞEMALAR (MODELS) ---
require('./models/response'); // Ensure Response model is loaded


// User
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  preconditionApproved: { type: Boolean, default: false },
  preconditionApprovedAt: { type: Date },
  profileImage: { type: String }, // Base64 image
  isVerified: { type: Boolean, default: false }
});
// Index for faster login queries
UserSchema.index({ email: 1, password: 1, role: 1 });
const User = mongoose.model('User', UserSchema);

// Project
const ProjectSchema = new mongoose.Schema({
  title: String,
  shortDescription: String,
  fullDescription: String,
  status: { type: String, default: 'ongoing' },
  stage: { type: String, default: 'set-up' },
  targetDate: String,
  progress: { type: Number, default: 0 },
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  useCase: { type: String },
  createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin who created this project
  inspectionContext: {
    requester: String,
    inspectionReason: String,
    relevantFor: String,
    isMandatory: String,
    conditionsToAnalyze: String,
    resultsUsage: String,
    resultsSharing: String,
  },
  createdAt: { type: Date, default: Date.now }
});
const Project = mongoose.model('Project', ProjectSchema);

// UseCaseQuestion - Sorular ayrı collection'da
const UseCaseQuestionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  key: { type: String }, // Stable string identifier (e.g., "S0_Q1")
  questionEn: { type: String, required: true },
  questionTr: { type: String, required: true },
  type: { type: String, required: true }, // 'text' or 'multiple-choice'
  options: { type: [String], default: [] }, // For multiple-choice questions
  order: { type: Number, default: 0 }, // Sıralama için
  tag: { type: String, default: '' }, // AI Act reference (e.g., "AI Act Art. 6")
  placeholder: { type: String, default: '' }, // Placeholder text for input
  helper: { type: String, default: '' }, // Helper text/example
  isActive: { type: Boolean, default: true } // Whether question is active
});
UseCaseQuestionSchema.index({ order: 1 }); // Sıralama için index
UseCaseQuestionSchema.index({ key: 1 }); // Index for key lookups
const UseCaseQuestion = mongoose.model('UseCaseQuestion', UseCaseQuestionSchema);

// UseCase - Sadece cevapları tutar
const UseCaseSchema = new mongoose.Schema({
  title: String,
  description: String,
  aiSystemCategory: String,
  status: { type: String, default: 'assigned' },
  progress: { type: Number, default: 0 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedExperts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  adminNotes: String,
  supportingFiles: [{
    name: String,
    data: String, // Base64
    contentType: String,
    url: String
  }],
  answers: [{ // Sadece cevaplar - questionId ve answer
    questionId: { type: String, required: true }, // Can be _id string or key
    questionKey: { type: String }, // Optional: stable key (e.g., "S0_Q1") for future-proofing
    answer: { type: String, default: '' }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  extendedInfo: { type: Map, of: mongoose.Schema.Types.Mixed },
  feedback: [{ from: String, text: String, timestamp: { type: Date, default: Date.now } }],
  adminReflections: [{ id: String, text: String, visibleToExperts: Boolean, createdAt: { type: Date, default: Date.now } }]
});
UseCaseSchema.index({ ownerId: 1 }); // Owner'a göre arama için index
UseCaseSchema.index({ status: 1 }); // Status'a göre arama için index
const UseCase = mongoose.model('UseCase', UseCaseSchema);

// Evaluation (gelişmiş sürüm)
const EvaluationSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stage: { type: String, required: true },
  answers: { type: Map, of: mongoose.Schema.Types.Mixed },
  questionPriorities: { type: Map, of: String }, // Her soru için önem derecesi (low/medium/high)
  riskLevel: { type: String, default: 'medium' },
  customQuestions: [{ // Kullanıcının bu stage'e eklediği custom sorular (Mongo'ya kaydedilir)
    id: { type: String, required: true },
    text: { type: String, required: true },
    description: { type: String },
    type: { type: String, required: true },
    stage: { type: String, required: true },
    principle: { type: String },
    required: { type: Boolean, default: true },
    options: { type: [String], default: [] },
    min: { type: Number },
    max: { type: Number },
    createdAt: { type: Date, default: Date.now }
  }],
  generalRisks: [{ // Genel riskler - her proje için ayrı ayrı kaydedilir
    id: String,
    title: String,
    description: String,
    severity: { type: String, default: 'medium' }, // low | medium | high | critical
    relatedQuestions: [String]
  }],
  status: { type: String, default: 'draft' },
  updatedAt: { type: Date, default: Date.now }
});
EvaluationSchema.index({ projectId: 1, userId: 1, stage: 1 }, { unique: true });
const Evaluation = mongoose.model('Evaluation', EvaluationSchema);

// GeneralQuestionsAnswers - General questions answers stored separately by role, organized by ethical principles
const GeneralQuestionsAnswersSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userRole: { type: String, required: true }, // Store role separately for filtering
  // Organized by ethical principle
  principles: {
    TRANSPARENCY: {
      answers: { type: mongoose.Schema.Types.Mixed, default: {} }, // questionId -> answer
      risks: { type: mongoose.Schema.Types.Mixed, default: {} }   // questionId -> risk score (0-4)
    },
    'HUMAN AGENCY & OVERSIGHT': {
      answers: { type: mongoose.Schema.Types.Mixed, default: {} },
      risks: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    'TECHNICAL ROBUSTNESS & SAFETY': {
      answers: { type: mongoose.Schema.Types.Mixed, default: {} },
      risks: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    'PRIVACY & DATA GOVERNANCE': {
      answers: { type: mongoose.Schema.Types.Mixed, default: {} },
      risks: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    'DIVERSITY, NON-DISCRIMINATION & FAIRNESS': {
      answers: { type: mongoose.Schema.Types.Mixed, default: {} },
      risks: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    'SOCIETAL & INTERPERSONAL WELL-BEING': {
      answers: { type: mongoose.Schema.Types.Mixed, default: {} },
      risks: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    ACCOUNTABILITY: {
      answers: { type: mongoose.Schema.Types.Mixed, default: {} },
      risks: { type: mongoose.Schema.Types.Mixed, default: {} }
    }
  },
  // Legacy support - keep flat structure for backward compatibility
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  risks: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
});
GeneralQuestionsAnswersSchema.index({ projectId: 1, userId: 1 }, { unique: true });
GeneralQuestionsAnswersSchema.index({ projectId: 1, userRole: 1 }); // Index for role-based queries
const GeneralQuestionsAnswers = mongoose.model('GeneralQuestionsAnswers', GeneralQuestionsAnswersSchema);

// Tension (GÜNCELLENDİ: Evidence Array, Comment ve Dosya Desteği)
const TensionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  principle1: String,
  principle2: String,
  claimStatement: String,
  description: String,
  severity: String,
  status: { type: String, default: 'ongoing' },
  createdBy: String,
  createdAt: { type: Date, default: Date.now },

  votes: [{
    userId: String,
    voteType: { type: String, enum: ['agree', 'disagree'] }
  }],

  comments: [{
    text: String,
    authorId: String,
    authorName: String,
    date: { type: Date, default: Date.now }
  }],

  evidences: [{
    title: String,
    description: String,
    fileName: String,
    fileData: String, // Base64 Data
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now },
    type: { type: String, required: false }, // Evidence type: Policy, Test, User feedback, Log, Incident, Other (optional)
    comments: [{
      userId: String,
      text: String,
      createdAt: { type: Date, default: Date.now }
    }]
  }],

  // Impact & Stakeholders
  impact: {
    areas: [String],
    affectedGroups: [String],
    description: String
  },

  // Mitigation & Resolution
  mitigation: {
    proposed: String,
    tradeoff: {
      decision: String,
      rationale: String
    },
    action: {
      ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      ownerName: String,
      dueDate: Date,
      status: { type: String, default: 'Open' }
    }
  },

  // Evidence Type (optional, backward compatible)
  evidenceType: String
});
const Tension = mongoose.model('Tension', TensionSchema);

// Message
// Message
const Message = require('./models/Message');

// Report - Analysis Reports (expert comment workflow)
const ExpertCommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: { type: String, default: '' },
  text: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const ReportSchema = new mongoose.Schema({
  // Legacy + compatibility: reports are tied to a Project (a.k.a. "use case" in UI)
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  // New alias field requested by product language
  useCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },

  title: { type: String, default: 'Analysis Report' },

  // Legacy single-body content (kept for backward compatibility)
  content: { type: String },

  // Expert comments (one per expert)
  expertComments: { type: [ExpertCommentSchema], default: [] },

  generatedAt: { type: Date, default: Date.now, index: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  status: { type: String, enum: ['draft', 'final', 'archived', 'generating', 'failed'], default: 'draft', index: true },
  finalizedAt: { type: Date },

  metadata: {
    totalScores: Number,
    totalEvaluations: Number,
    totalTensions: Number,
    principlesAnalyzed: [String],
    // New metadata fields for enterprise reporting
    scoringModelVersion: { type: String, default: 'erc_v1' },
    questionsAnswered: { type: Number, default: 0 },
    tensionsCount: { type: Number, default: 0 },
    overallERC: { type: Number, default: null },
    riskLabel: { type: String, default: null },
    evaluatorCount: { type: Number, default: 0 },
    evaluatorRoles: { type: [String], default: [] },
    generationDurationMs: { type: Number, default: null },
    chartsGenerated: { type: Number, default: 0 },
    chartTypes: { type: [String], default: [] },
    hasHTMLReport: { type: Boolean, default: false }
  },
  version: { type: Number, default: 1 },

  // CRITICAL: Latest flag - only ONE report per project can have latest = true
  latest: { type: Boolean, default: false, index: true },

  // File paths for PDF and Word (relative to uploads directory)
  pdfPath: { type: String, default: null },
  wordPath: { type: String, default: null },

  // File sizes (for UI display)
  pdfSize: { type: Number, default: null }, // bytes
  wordSize: { type: Number, default: null }, // bytes

  // HTML content (for PDF/Word generation)
  htmlContent: { type: String, default: null },

  // Computed metrics (for caching)
  computedMetrics: { type: mongoose.Schema.Types.Mixed, default: null },

  // Scoring data (for HTML report generation and display)
  scoring: { type: mongoose.Schema.Types.Mixed, default: null },

  // New workflow: sections-based report editing
  sections: [{
    principle: String,
    aiDraft: String,
    expertEdit: String,
    comments: [ExpertCommentSchema]
  }],

  // Error details (if generation failed)
  errorDetails: {
    message: String,
    stack: String,
    timestamp: Date
  }
}, { timestamps: true, strict: false }); // strict: false allows htmlContent even if it's large

// Index for efficient querying
ReportSchema.index({ projectId: 1, generatedAt: -1 });
ReportSchema.index({ projectId: 1, status: 1 });
ReportSchema.index({ useCaseId: 1, generatedAt: -1 });
ReportSchema.index({ projectId: 1, latest: 1 }); // For "get latest report" queries
ReportSchema.index({ projectId: 1, version: 1 }, { unique: true }); // Version uniqueness per project

// Static method: Get the latest report for a project
ReportSchema.statics.getLatestReport = async function (projectId) {
  return this.findOne({
    projectId,
    latest: true,
    status: { $in: ['final', 'draft'] }
  }).sort({ version: -1 });
};

// Static method: Mark a report as latest (and unmark all others)
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

// Instance method: Validate that both PDF and Word exist
ReportSchema.methods.validateFiles = function () {
  if (!this.pdfPath || !this.wordPath) {
    throw new Error(
      `Report ${this._id} is incomplete: ` +
      `PDF=${!!this.pdfPath}, Word=${!!this.wordPath}`
    );
  }
  return true;
};

const Report = mongoose.model('Report', ReportSchema);

// SharedDiscussion (Shared Area için)
const SharedDiscussionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }, // Opsiyonel: proje ile ilişkilendirilebilir
  isPinned: { type: Boolean, default: false },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'SharedDiscussion' }, // Reply için
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // @mention için
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
SharedDiscussionSchema.index({ createdAt: -1 });
SharedDiscussionSchema.index({ isPinned: -1, createdAt: -1 });
const SharedDiscussion = mongoose.model('SharedDiscussion', SharedDiscussionSchema);

// --- 3. ROUTES (API UÇLARI) ---

// Use Case Questions - Soruları getir (cached for performance)
let questionsCache = null;
let questionsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

app.get('/api/use-case-questions', async (req, res) => {
  try {
    // Return cached data if available and fresh
    const now = Date.now();
    if (questionsCache && (now - questionsCacheTime) < CACHE_DURATION) {
      return res.json(questionsCache);
    }

    // Fetch from database - only active questions by default
    const questions = await UseCaseQuestion.find({ isActive: { $ne: false } }).sort({ order: 1 }).lean();
    questionsCache = questions;
    questionsCacheTime = now;
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Use Case Questions - Soruları seed et (ilk kurulum için)
app.post('/api/use-case-questions/seed', async (req, res) => {
  try {
    const questions = [
      { id: 'q1', questionEn: 'What is the name and version of the AI system used in this project?', questionTr: 'Bu projede kullanılan AI sisteminin adı ve versiyonu nedir?', type: 'text', options: [], order: 1 },
      { id: 'q2', questionEn: 'Which organization or team is responsible for developing this AI system?', questionTr: 'Bu AI sistemini geliştiren organizasyon veya ekip kimdir?', type: 'text', options: [], order: 2 },
      { id: 'q3', questionEn: 'Which application domain best describes how the system is used (e.g., healthcare, education, finance)?', questionTr: 'Sistemin kullanıldığı uygulama alanı nedir? (Örn. sağlık, eğitim, finans)', type: 'multiple-choice', options: ['Healthcare', 'Education', 'Finance', 'Transportation', 'Energy', 'Public Sector', 'Other'], order: 3 },
      { id: 'q4', questionEn: 'What specific problem does this AI system aim to solve in your use case?', questionTr: 'Bu AI sistemi kullanım senaryonuzda hangi spesifik problemi çözmeyi amaçlıyor?', type: 'text', options: [], order: 4 },
      { id: 'q5', questionEn: 'In what environment will the system be deployed (e.g., mobile app, hospital system, web app)?', questionTr: 'Sistem hangi ortamda kullanılacak? (Örn. mobil uygulama, hastane sistemi, web)', type: 'multiple-choice', options: ['Mobile App', 'Web App', 'Hospital System', 'Desktop Application', 'Cloud Platform', 'Edge Device', 'Other'], order: 5 },
      { id: 'q6', questionEn: 'At what stage is the system currently (prototype, testing, live deployment)?', questionTr: 'Sistem şu anda hangi aşamada? (Prototip, test, aktif kullanım…)', type: 'multiple-choice', options: ['Prototype', 'Testing', 'Live Deployment', 'Pilot', 'Development'], order: 6 },
      { id: 'q7', questionEn: 'What are the main performance or impact claims made about the system?', questionTr: 'Sistem hakkında yapılan temel performans, etki veya fayda iddiaları nelerdir?', type: 'text', options: [], order: 7 },
      { id: 'q8', questionEn: 'Who are the primary and secondary users of this system?', questionTr: 'Bu sistemin birincil ve ikincil kullanıcıları kimlerdir?', type: 'text', options: [], order: 8 },
      { id: 'q9', questionEn: 'What is the typical technical proficiency level of users interacting with the system?', questionTr: 'Sistemle etkileşime giren kullanıcıların tipik teknik yeterlilik seviyesi nedir?', type: 'text', options: [], order: 9 },
      { id: 'q10', questionEn: 'How do you prevent users from over-relying on AI outputs?', questionTr: 'Kullanıcıların AI çıktısına aşırı güvenmesini nasıl engelliyorsunuz?', type: 'text', options: [], order: 10 },
      { id: 'q11', questionEn: 'Does the system introduce delays or workflow challenges that affect usability?', questionTr: 'Sistem kullanımda gecikmelere veya iş akışında zorluklara neden oluyor mu?', type: 'text', options: [], order: 11 },
      { id: 'q12', questionEn: 'What type of AI model does the system use?', questionTr: 'Sistem hangi tür AI modelini kullanıyor?', type: 'text', options: [], order: 12 },
      { id: 'q13', questionEn: 'What data sources are used to train or run the AI system?', questionTr: 'AI sisteminin eğitimi veya çalışması için hangi veri kaynakları kullanılıyor?', type: 'text', options: [], order: 13 },
      { id: 'q14', questionEn: 'What are the key characteristics (format, diversity, demographic range) of the training data?', questionTr: 'Eğitim verisinin formatı, çeşitliliği ve demografik kapsamı nedir?', type: 'text', options: [], order: 14 },
      { id: 'q15', questionEn: 'Is the dataset size sufficient for reliable model performance?', questionTr: 'Veri seti boyutu güvenilir bir model performansı için yeterli mi?', type: 'text', options: [], order: 15 },
      { id: 'q16', questionEn: 'Is the data relevant, high-quality, and free of major biases?', questionTr: 'Veri ilgili, yüksek kaliteli ve ciddi önyargılardan arındırılmış mı?', type: 'text', options: [], order: 16 },
      { id: 'q17', questionEn: 'Is any federated learning or distributed method used, and how is quality monitored?', questionTr: 'Federated learning veya dağıtık öğrenme kullanılıyor mu? Kalite nasıl denetleniyor?', type: 'text', options: [], order: 17 },
      { id: 'q18', questionEn: 'What ethical risks do you identify in this use case?', questionTr: 'Bu kullanım senaryosunda gördüğünüz etik riskler nelerdir?', type: 'text', options: [], order: 18 },
      { id: 'q19', questionEn: 'Could system performance vary depending on users\' resources or access levels?', questionTr: 'Sistem performansı kullanıcıların kaynak seviyesine veya erişimine göre değişebilir mi?', type: 'text', options: [], order: 19 },
      { id: 'q20', questionEn: 'What negative outcomes could arise from using this system in your use case?', questionTr: 'Bu sistemin kullanımından doğabilecek olumsuz sonuçlar nelerdir?', type: 'text', options: [], order: 20 },
      { id: 'q21', questionEn: 'What explainability methods (SHAP, LIME, etc.) are used to make decisions understandable?', questionTr: 'Kararları anlaşılır kılmak için hangi açıklanabilirlik yöntemleri (SHAP, LIME vb.) kullanılıyor?', type: 'text', options: [], order: 21 },
      { id: 'q22', questionEn: 'What documentation exists for the system (model card, data sheet, architecture notes)?', questionTr: 'Sistem için hangi dokümanlar mevcut? (model card, data sheet vb.)', type: 'text', options: [], order: 22 },
      { id: 'q23', questionEn: 'How is user feedback collected and incorporated into system improvements?', questionTr: 'Kullanıcı geri bildirimleri nasıl toplanıyor ve sistem iyileştirmelerine nasıl dahil ediliyor?', type: 'text', options: [], order: 23 }
    ];

    // Mevcut soruları sil ve yenilerini ekle
    await UseCaseQuestion.deleteMany({});
    const inserted = await UseCaseQuestion.insertMany(questions);
    // Clear cache after seeding
    questionsCache = null;
    questionsCacheTime = 0;
    res.json({ message: 'Questions seeded successfully', count: inserted.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Use Cases - Optimize: don't fetch answers for list view
app.get('/api/use-cases', async (req, res) => {
  try {
    const { ownerId } = req.query;
    let query = UseCase.find();

    // Filter by ownerId if provided (for performance)
    if (ownerId) {
      query = query.where('ownerId').equals(ownerId);
    }

    const useCases = await query
      .select('-answers -extendedInfo -supportingFiles.data') // Don't fetch file data for list
      .lean()
      .limit(1000) // Limit results for performance
      .sort({ createdAt: -1 }); // Sort by newest first
    res.json(useCases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/use-cases/:id', async (req, res) => {
  try {
    const useCase = await UseCase.findById(req.params.id);
    if (!useCase) return res.status(404).json({ error: 'Not found' });
    res.json(useCase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DEBUG route: show findById and attempt findByIdAndDelete but don't delete
app.get('/api/debug/use-cases/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const found = await UseCase.findById(id);
    const foundByQuery = await UseCase.findOne({ _id: id });
    return res.json({ found: !!found, foundByQuery: !!foundByQuery, idType: typeof id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/use-cases', async (req, res) => {
  try {
    const useCase = new UseCase(req.body);
    await useCase.save();
    res.json(useCase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/use-cases/:id', async (req, res) => {
  try {
    const deletedUseCase = await UseCase.findByIdAndDelete(req.params.id);
    if (!deletedUseCase) {
      return res.status(404).json({ error: 'Use case not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/use-cases/:id/assign', async (req, res) => {
  try {
    const { assignedExperts = [], adminNotes = '' } = req.body;
    const useCaseId = req.params.id;

    // Validate and filter assigned experts
    let validAssignedExperts = [];
    if (assignedExperts && Array.isArray(assignedExperts) && assignedExperts.length > 0) {
      validAssignedExperts = assignedExperts
        .map(id => {
          if (!id) return null;
          const idStr = id.toString();
          return isValidObjectId(idStr) ? new mongoose.Types.ObjectId(idStr) : null;
        })
        .filter(Boolean);

      // Verify these are actual expert users (not admins)
      if (validAssignedExperts.length > 0) {
        const experts = await User.find({
          _id: { $in: validAssignedExperts },
          role: { $ne: 'admin' }
        }).select('_id').lean();
        validAssignedExperts = experts.map(e => e._id);
      }
    }

    // Set status based on assignment count
    const newStatus = validAssignedExperts.length > 0 ? 'ASSIGNED' : 'UNASSIGNED';

    // Update the use case
    const updated = await UseCase.findByIdAndUpdate(
      useCaseId,
      { assignedExperts: validAssignedExperts, adminNotes, status: newStatus },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });

    // Update all projects linked to this use case: sync assigned experts with project.assignedUsers
    // Also create/remove ProjectAssignment records so experts can see/hide the projects
    try {
      const ProjectAssignment = require('./models/projectAssignment');
      const { calculateProjectProgress } = require('./services/evaluationService');
      const linkedProjects = await Project.find({ useCase: useCaseId });

      // Prepare the list of users to assign: use case owner + assigned experts
      const usersToAssign = new Set();

      // Add use case owner if exists
      if (updated.ownerId) {
        usersToAssign.add(updated.ownerId.toString());
      }

      // Add all assigned experts
      validAssignedExperts.forEach(expertId => {
        usersToAssign.add(expertId.toString());
      });

      const usersToAssignArray = Array.from(usersToAssign).map(id => new mongoose.Types.ObjectId(id));

      for (const project of linkedProjects) {
        if (!project.assignedUsers) {
          project.assignedUsers = [];
        }

        // Get current assigned user IDs as strings for comparison
        const currentAssigned = project.assignedUsers.map((id) => id.toString());
        const newUserIds = usersToAssignArray.map((id) => id.toString());

        // Find users to add and remove
        const usersToAdd = newUserIds.filter(id => !currentAssigned.includes(id));
        const usersToRemove = currentAssigned.filter(id => !newUserIds.includes(id));

        // Update project.assignedUsers to match the new assignment list exactly (owner + experts)
        project.assignedUsers = usersToAssignArray;
        await project.save();

        // Create or update ProjectAssignment records for newly added experts (not owner)
        for (const expertId of validAssignedExperts) {
          try {
            // Get user to determine role
            const expertUser = await User.findById(expertId).select('role').lean();
            if (!expertUser || expertUser.role === 'admin') continue;

            // Create or update ProjectAssignment
            await ProjectAssignment.findOneAndUpdate(
              { projectId: project._id, userId: expertId },
              {
                projectId: project._id,
                userId: expertId,
                role: expertUser.role, // e.g., "medical-expert", "technical-expert"
                questionnaires: [], // Will be populated when questionnaires are assigned
                status: 'assigned',
                assignedAt: new Date()
              },
              { new: true, upsert: true }
            );
          } catch (assignmentError) {
            console.error(`Error creating ProjectAssignment for expert ${expertId} on project ${project._id}:`, assignmentError);
            // Continue with other experts even if one fails
          }
        }

        // Remove ProjectAssignment records for experts that were removed
        for (const userIdStr of usersToRemove) {
          try {
            // Only remove if it's an expert (not the owner)
            const isOwner = updated.ownerId && updated.ownerId.toString() === userIdStr;
            if (isOwner) continue; // Don't remove owner's assignment

            if (!isValidObjectId(userIdStr)) continue;
            const userIdObj = new mongoose.Types.ObjectId(userIdStr);
            await ProjectAssignment.deleteOne({ projectId: project._id, userId: userIdObj });
          } catch (removalError) {
            console.error(`Error removing ProjectAssignment for user ${userIdStr} on project ${project._id}:`, removalError);
            // Continue with other removals even if one fails
          }
        }

        // Recalculate project progress after assignment changes
        try {
          await calculateProjectProgress(project._id);
        } catch (progressError) {
          console.error(`Error recalculating progress for project ${project._id}:`, progressError);
          // Don't fail the assignment if progress calculation fails
        }
      }
    } catch (projectUpdateError) {
      console.error('Error updating linked projects:', projectUpdateError);
      // Don't fail the assignment if project update fails, but log it
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add supporting files to a use case (files should be sent as base64 data)
app.post('/api/use-cases/:id/supporting-files', async (req, res) => {
  try {
    const useCaseId = req.params.id;
    const { files } = req.body; // expect [{ name, data, contentType, url? }]
    const useCase = await UseCase.findById(useCaseId);
    if (!useCase) return res.status(404).json({ error: 'Use case not found' });

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    if (!useCase.supportingFiles) useCase.supportingFiles = [];
    files.forEach(f => {
      useCase.supportingFiles.push({
        name: f.name,
        data: f.data,
        contentType: f.contentType,
        url: f.url
      });
    });

    await useCase.save();
    res.json(useCase.supportingFiles);
  } catch (err) {
    console.error('Support file upload error', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a supporting file from a use case
// DELETE /api/use-cases/:id/supporting-files?userId=...&name=...&url=...
// body (optional): { name?: string, url?: string }
app.delete('/api/use-cases/:id/supporting-files', async (req, res) => {
  try {
    const useCaseId = req.params.id;
    const requesterUserId = (req.query.userId || req.body?.userId || '').toString();
    const name = (req.query.name || req.body?.name || '').toString() || undefined;
    const url = (req.query.url || req.body?.url || '').toString() || undefined;

    if (!requesterUserId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    if (!isValidObjectId(useCaseId)) {
      return res.status(400).json({ error: 'Invalid use case id' });
    }
    if (!isValidObjectId(requesterUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    if (!name && !url) {
      return res.status(400).json({ error: 'Missing file identifier (name or url)' });
    }

    const useCase = await UseCase.findById(useCaseId);
    if (!useCase) return res.status(404).json({ error: 'Use case not found' });

    // Verify requester role from DB (do not trust client-provided role)
    let isAdmin = false;
    try {
      const user = await User.findById(requesterUserId).select('role');
      isAdmin = user?.role === 'admin';
    } catch {
      // ignore
    }

    const isOwner = useCase.ownerId?.toString() === requesterUserId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Not authorized to delete supporting files' });
    }

    const list = Array.isArray(useCase.supportingFiles) ? useCase.supportingFiles : [];
    if (list.length === 0) {
      return res.status(404).json({ error: 'No supporting files found' });
    }

    // Remove first match by (name + url) if provided, otherwise by name, otherwise by url
    const idx = list.findIndex((f) => {
      if (name && url) return f?.name === name && f?.url === url;
      if (name) return f?.name === name;
      if (url) return f?.url === url;
      return false;
    });

    if (idx === -1) {
      return res.status(404).json({ error: 'Supporting file not found' });
    }

    list.splice(idx, 1);
    useCase.supportingFiles = list;
    useCase.updatedAt = new Date();
    await useCase.save();

    res.json(useCase.supportingFiles);
  } catch (err) {
    console.error('Support file delete error', err);
    res.status(500).json({ error: err.message || 'Failed to delete supporting file' });
  }
});

// Tensions - OLUŞTURMA (İlk evidence ile birlikte)
app.post('/api/tensions', async (req, res) => {
  try {
    const {
      projectId, principle1, principle2, claimStatement, description,
      evidenceDescription, evidenceType, evidenceFileName, evidenceFileData,
      severity, status, createdBy,
      impact, mitigation
    } = req.body;

    const initialEvidences = [];
    // Eğer formdan dosya veya açıklama geldiyse ilk kanıtı oluştur
    if (evidenceDescription || evidenceFileName) {
      initialEvidences.push({
        title: 'Initial Claim Evidence',
        description: evidenceDescription,
        fileName: evidenceFileName,
        fileData: evidenceFileData,
        uploadedBy: createdBy,
        uploadedAt: new Date()
      });
    }

    const tensionData = {
      projectId, principle1, principle2, claimStatement, description,
      severity, status, createdBy,
      evidences: initialEvidences,
      comments: []
    };

    // Add evidenceType if provided (backward compatible)
    if (evidenceType) {
      tensionData.evidenceType = evidenceType;
    }

    // Add impact data if provided
    if (impact) {
      tensionData.impact = {
        areas: impact.areas || [],
        affectedGroups: impact.affectedGroups || [],
        description: impact.description
      };
    }

    // Add mitigation data if provided
    if (mitigation) {
      tensionData.mitigation = {
        proposed: mitigation.proposed,
        tradeoff: {
          decision: mitigation.tradeoff?.decision,
          rationale: mitigation.tradeoff?.rationale
        },
        action: {
          ownerName: mitigation.action?.ownerName,
          dueDate: mitigation.action?.dueDate ? new Date(mitigation.action.dueDate) : undefined,
          status: mitigation.action?.status || 'Open'
        }
      };
    }

    const tension = new Tension(tensionData);

    await tension.save();
    console.log("⚡ Yeni Tension eklendi:", tension._id);
    res.json(tension);
  } catch (err) {
    console.error("❌ Tension Ekleme Hatası:", err);
    res.status(500).json({ error: err.message });
  }
});

// Tension getir (id ile)
app.get('/api/tensions/id/:id', async (req, res) => {
  try {
    const tension = await Tension.findById(req.params.id);
    if (!tension) return res.status(404).json({ error: 'Not found' });
    res.json(tension);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tension güncelle
app.put('/api/tensions/:id', async (req, res) => {
  try {
    const { principle1, principle2, claimStatement, description, severity, status } = req.body;
    const updated = await Tension.findByIdAndUpdate(
      req.params.id,
      { principle1, principle2, claimStatement, description, severity, status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tension sil
app.delete('/api/tensions/:id', async (req, res) => {
  try {
    const requesterUserId = (req.query.userId || req.body?.userId || '').toString();
    if (!requesterUserId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const tension = await Tension.findById(req.params.id);
    if (!tension) return res.status(404).json({ error: 'Not found' });

    // Verify requester role from DB (do not trust client-provided role)
    let isAdmin = false;
    try {
      const user = await User.findById(requesterUserId).select('role');
      isAdmin = user?.role === 'admin';
    } catch {
      // ignore (keep isAdmin=false)
    }

    const isCreator = Boolean(tension.createdBy) && tension.createdBy.toString() === requesterUserId;

    // Backward-compat: if createdBy is missing, only admin can delete
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Not authorized to delete this tension' });
    }

    await Tension.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tensions/:projectId', async (req, res) => {
  try {
    const { userId } = req.query;
    const tensions = await Tension.find({ projectId: req.params.projectId });
    const formattedTensions = tensions.map(t => {
      const agreeCount = t.votes ? t.votes.filter(v => v.voteType === 'agree').length : 0;
      const disagreeCount = t.votes ? t.votes.filter(v => v.voteType === 'disagree').length : 0;
      const myVote = userId && t.votes ? t.votes.find(v => v.userId === userId)?.voteType : null;
      return {
        ...t.toObject(),
        consensus: { agree: agreeCount, disagree: disagreeCount },
        userVote: myVote
      };
    });
    res.json(formattedTensions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tensions/:id/vote', async (req, res) => {
  try {
    const { userId, voteType } = req.body;
    const tension = await Tension.findById(req.params.id);
    if (!tension) return res.status(404).send('Not found');
    if (!tension.votes) tension.votes = [];
    const existingVoteIndex = tension.votes.findIndex(v => v.userId === userId);
    if (existingVoteIndex > -1) {
      if (tension.votes[existingVoteIndex].voteType === voteType) tension.votes.splice(existingVoteIndex, 1);
      else tension.votes[existingVoteIndex].voteType = voteType;
    } else {
      tension.votes.push({ userId, voteType });
    }
    await tension.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// YORUM EKLEME
app.post('/api/tensions/:id/comment', async (req, res) => {
  try {
    const { text, authorId, authorName } = req.body;
    const tension = await Tension.findById(req.params.id);
    if (!tension) return res.status(404).send('Not found');

    if (!tension.comments) tension.comments = [];
    tension.comments.push({ text, authorId, authorName, date: new Date() });

    await tension.save();
    res.json(tension.comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// EVIDENCE EKLEME (Sonradan ekleme)
app.post('/api/tensions/:id/evidence', async (req, res) => {
  try {
    const { title, description, fileName, fileData, uploadedBy, type } = req.body;
    const tension = await Tension.findById(req.params.id);
    if (!tension) return res.status(404).send('Not found');

    if (!tension.evidences) tension.evidences = [];

    // Build evidence object - only include type if it's a non-empty string
    const evidenceObj = {
      title,
      description,
      fileName,
      fileData,
      uploadedBy,
      uploadedAt: new Date(),
      comments: []
    };

    // Only add type if it's a valid string
    if (type && typeof type === 'string' && type.trim().length > 0) {
      evidenceObj.type = type.trim();
    }

    tension.evidences.push(evidenceObj);

    await tension.save();
    res.json(tension.evidences);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// EVIDENCE COMMENT EKLEME
app.post('/api/tensions/:tensionId/evidence/:evidenceId/comments', async (req, res) => {
  try {
    const { tensionId, evidenceId } = req.params;
    const { text, userId } = req.body;

    // Validation
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    if (text.length > 2000) {
      return res.status(400).json({ error: 'Comment text must be 2000 characters or less' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const tension = await Tension.findById(tensionId);
    if (!tension) return res.status(404).json({ error: 'Tension not found' });

    if (!tension.evidences || !Array.isArray(tension.evidences)) {
      return res.status(404).json({ error: 'Evidence array not found' });
    }

    // Find evidence by index (evidenceId is the array index as string)
    const evidenceIndex = parseInt(evidenceId, 10);

    if (isNaN(evidenceIndex) || evidenceIndex < 0 || evidenceIndex >= tension.evidences.length) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    const evidence = tension.evidences[evidenceIndex];

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Initialize comments array if not exists
    if (!evidence.comments) {
      evidence.comments = [];
    }

    // Add comment
    evidence.comments.push({
      userId,
      text: text.trim(),
      createdAt: new Date()
    });

    await tension.save();

    // Return updated evidence
    const updatedEvidence = tension.evidences[evidenceIndex];
    res.json(updatedEvidence);
  } catch (err) {
    console.error('Error adding evidence comment:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Evolution completion (Finish Evolution) ---
// GET /api/project-assignments?userId=
// Returns assignment records for a user (used to power "Commented" tab and Finish Evolution visibility)
app.get('/api/project-assignments', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const ProjectAssignment = require('./models/projectAssignment');
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const assignments = await ProjectAssignment.find({ userId: userIdObj })
      .select('projectId userId role status completedAt evolutionCompletedAt')
      .lean();

    if (!assignments || assignments.length === 0) {
      return res.json([]);
    }

    // OPTIMIZATION: Batch fetch all data at once instead of querying in a loop
    const projectIds = assignments.map(a => a.projectId);

    // 1. Fetch all projects in one query
    const projects = await Project.find({ _id: { $in: projectIds } })
      .select('_id useCase')
      .lean();
    const projectMap = new Map(projects.map(p => [String(p._id), p]));

    // 2. Fetch all use cases in one query
    const useCaseIds = projects.map(p => p.useCase).filter(Boolean);
    const useCases = useCaseIds.length > 0
      ? await mongoose.model('UseCase').find({ _id: { $in: useCaseIds } })
        .select('_id ownerId')
        .lean()
      : [];
    const useCaseMap = new Map(useCases.map(uc => [String(uc._id), uc]));

    // 3. Fetch all expert assignments for all projects in one query
    const allProjectAssignments = await ProjectAssignment.find({
      projectId: { $in: projectIds },
      status: { $in: ['assigned', 'in_progress', 'submitted'] }
    })
      .select('projectId userId evolutionCompletedAt')
      .lean();

    // Group assignments by project
    const assignmentsByProject = new Map();
    for (const assignment of allProjectAssignments) {
      const projId = String(assignment.projectId);
      if (!assignmentsByProject.has(projId)) {
        assignmentsByProject.set(projId, []);
      }
      assignmentsByProject.get(projId).push(assignment);
    }

    // 4. Process each user assignment
    const assignmentsWithStatus = assignments.map(a => {
      let allExpertsCompleted = false;

      try {
        const projectId = String(a.projectId);
        const project = projectMap.get(projectId);
        const projectAssignments = assignmentsByProject.get(projectId) || [];

        // Get expert IDs (excluding admins and use case owner)
        let expertAssignments = projectAssignments.filter(pa => {
          // TODO: Filter out admins if needed (would need user role data)
          return true;
        });

        // Exclude use case owner
        if (project?.useCase) {
          const useCase = useCaseMap.get(String(project.useCase));
          if (useCase?.ownerId) {
            const ownerIdStr = String(useCase.ownerId);
            expertAssignments = expertAssignments.filter(
              pa => String(pa.userId) !== ownerIdStr
            );
          }
        }

        // Check if all experts have completed
        if (expertAssignments.length > 0) {
          allExpertsCompleted = expertAssignments.every(
            pa => pa.evolutionCompletedAt
          );
        }
      } catch (error) {
        console.error(`Error checking allExpertsCompleted for project ${a.projectId}:`, error);
      }

      return {
        ...a,
        id: String(a._id),
        projectId: String(a.projectId),
        userId: String(a.userId),
        allExpertsCompleted
      };
    });

    res.json(assignmentsWithStatus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/finish-evolution
// Server-side check: user must have voted on ALL tensions in the project.
// If ok, marks the user's ProjectAssignment as evolutionCompletedAt and notifies admin via notification message.
app.post('/api/projects/:projectId/finish-evolution', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.body || {};

    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const userIdStr = String(userId);

    const project = await Project.findById(projectIdObj).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const user = await User.findById(userIdObj).select('name role').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if user is the use case owner (owners don't need to vote on tensions)
    let isUseCaseOwner = false;
    if (project.useCase) {
      const UseCase = mongoose.model('UseCase');
      const useCase = await UseCase.findById(project.useCase).select('ownerId').lean();
      if (useCase?.ownerId && String(useCase.ownerId) === userIdStr) {
        isUseCaseOwner = true;
      }
    }

    // Initialize tension voting variables (needed for response)
    let totalTensions = 0;
    let votedTensions = 0;

    // Check tension votes (skip for use case owners - they are not experts)
    if (!isUseCaseOwner) {
      const allTensions = await Tension.find({ projectId: projectIdObj }).select('votes createdBy').lean();

      // Exclude tensions created by the user (they can't vote on their own tensions)
      const tensionsToVoteOn = allTensions.filter((t) => String(t.createdBy) !== userIdStr);
      totalTensions = tensionsToVoteOn.length;

      votedTensions = tensionsToVoteOn.filter((t) => {
        const votes = Array.isArray(t.votes) ? t.votes : [];
        return votes.some((v) => String(v.userId) === userIdStr);
      }).length;

      if (totalTensions > 0 && votedTensions < totalTensions) {
        return res.status(400).json({
          error: 'NOT_ALL_TENSIONS_VOTED',
          totalTensions,
          votedTensions,
          expertNames: user.name || 'you'
        });
      }
    }

    // Check if all questions are answered
    const Response = require('./models/response');
    const Question = require('./models/question');

    // Get assignment (will be created below if missing)
    const ProjectAssignment = require('./models/projectAssignment');
    let assignmentForCheck = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj });
    if (!assignmentForCheck) {
      // Create assignment if missing (should be rare)
      try {
        const { createAssignment } = require('./services/evaluationService');
        const role = user.role || 'unknown';
        const questionnaires = ['general-v1'];
        assignmentForCheck = await createAssignment(projectIdObj, userIdObj, role, questionnaires);
      } catch {
        // fallback: create minimal assignment doc
        assignmentForCheck = await ProjectAssignment.create({
          projectId: projectIdObj,
          userId: userIdObj,
          role: user.role || 'unknown',
          questionnaires: ['general-v1'],
          status: 'assigned',
        });
      }
    }

    // Get all assigned questionnaires
    const assignedQuestionnaireKeys = assignmentForCheck.questionnaires || [];
    if (assignedQuestionnaireKeys.length === 0) {
      // If no questionnaires assigned, try to determine from role
      const role = user.role || 'unknown';
      if (role === 'ethical-expert') assignedQuestionnaireKeys.push('ethical-expert-v1');
      else if (role === 'medical-expert') assignedQuestionnaireKeys.push('medical-expert-v1');
      else if (role === 'technical-expert') assignedQuestionnaireKeys.push('technical-expert-v1');
      else if (role === 'legal-expert') assignedQuestionnaireKeys.push('legal-expert-v1');
      else if (role === 'education-expert') assignedQuestionnaireKeys.push('education-expert-v1');
      // assignedQuestionnaireKeys.push('general-v1'); // REMOVED: Do not force general-v1. Strict assignment only.
      if (assignedQuestionnaireKeys.length === 0) assignedQuestionnaireKeys.push('general-v1'); // Only default to general if NOTHING else matched
    }

    // Check which questionnaires actually have responses in the database
    const existingResponses = await Response.find({
      projectId: projectIdObj,
      userId: userIdObj,
      questionnaireKey: { $in: assignedQuestionnaireKeys }
    }).select('questionnaireKey').lean();

    const existingQuestionnaireKeys = new Set(existingResponses.map(r => r.questionnaireKey));

    let questionnairesToCount = assignedQuestionnaireKeys.slice();
    const hasGeneralResponse = existingQuestionnaireKeys.has('general-v1');
    const hasRoleSpecificResponse = assignedQuestionnaireKeys.some(key =>
      key.includes('-expert-v1') && existingQuestionnaireKeys.has(key)
    );

    // If both general-v1 and role-specific responses exist, count both
    // If only role-specific exists and has 30+ questions, it likely includes general questions
    // Logic removed: We no longer auto-exclude general-v1 based on question count.
    // Strict questionnaire scoping applies.

    // Get all assigned questions
    const allAssignedQuestions = await Question.find({
      questionnaireKey: { $in: questionnairesToCount }
    }).select('code _id required').lean();

    // Get all responses for this user and project across all assigned questionnaires
    // questionnairesToCount is only for question count, but we need to fetch all responses
    const responses = await Response.find({
      projectId: projectIdObj,
      userId: userIdObj,
      questionnaireKey: { $in: assignedQuestionnaireKeys }
    }).select('questionnaireKey answers').lean();

    console.log(`📊 Finish evolution: Fetched ${responses.length} response(s) for questionnaires: ${responses.map(r => r.questionnaireKey).join(', ')}`);

    // Check custom questions from Evaluation
    const evaluation = await Evaluation.findOne({
      projectId: projectIdObj,
      userId: userIdObj
    }).select('customQuestions answers').lean();

    const customQuestions = evaluation?.customQuestions || [];
    const customQuestionIds = customQuestions.map((q) => q.id).filter(Boolean);

    // Helper function to check if answer is answered
    const isAnswerAnswered = (answer) => {
      if (answer === null || answer === undefined) return false;
      if (typeof answer === 'string') return answer.trim().length > 0;
      if (Array.isArray(answer)) return answer.length > 0;
      if (typeof answer === 'object') {
        // Check for answer object structure
        if (answer.choiceKey) return true;
        if (answer.text && answer.text.trim().length > 0) return true;
        if (answer.numeric !== undefined && answer.numeric !== null) return true;
        if (answer.multiChoiceKeys && answer.multiChoiceKeys.length > 0) return true;
        return false;
      }
      return true; // numbers/booleans count as answered
    };

    // Check all assigned questions are answered
    const unansweredQuestions = [];

    for (const question of allAssignedQuestions) {
      const questionCode = question.code;
      const questionId = question._id.toString();

      // Find response for this question
      let isAnswered = false;
      for (const response of responses) {
        if (response.answers && Array.isArray(response.answers)) {
          const answer = response.answers.find((a) =>
            a.questionCode === questionCode ||
            a.questionId?.toString() === questionId ||
            String(a.questionId) === questionId
          );
          if (answer && isAnswerAnswered(answer.answer)) {
            isAnswered = true;
            break;
          }
        }
      }

      // Also check Evaluation answers for custom questions or legacy answers
      if (!isAnswered && evaluation?.answers) {
        const evalAnswer = evaluation.answers[questionId] || evaluation.answers[questionCode];
        if (evalAnswer !== undefined && evalAnswer !== null) {
          if (typeof evalAnswer === 'string' && evalAnswer.trim().length > 0) {
            isAnswered = true;
          } else if (typeof evalAnswer !== 'string') {
            isAnswered = true;
          }
        }
      }

      if (!isAnswered && question.required !== false) {
        unansweredQuestions.push(questionCode || questionId);
      }
    }

    // Check custom questions are answered
    for (const customQuestion of customQuestions) {
      const customQuestionId = customQuestion.id;
      if (!customQuestionId) continue;

      let isAnswered = false;
      if (evaluation?.answers) {
        const customAnswer = evaluation.answers[customQuestionId];
        if (customAnswer !== undefined && customAnswer !== null) {
          if (typeof customAnswer === 'string' && customAnswer.trim().length > 0) {
            isAnswered = true;
          } else if (typeof customAnswer !== 'string') {
            isAnswered = true;
          }
        }
      }

      if (!isAnswered && customQuestion.required !== false) {
        unansweredQuestions.push(`custom_${customQuestionId}`);
      }
    }

    if (unansweredQuestions.length > 0) {
      return res.status(400).json({
        error: 'NOT_ALL_QUESTIONS_ANSWERED',
        unansweredCount: unansweredQuestions.length,
        unansweredQuestions: unansweredQuestions.slice(0, 10), // Limit to first 10 for response size
        totalQuestions: allAssignedQuestions.length + customQuestions.length,
        answeredQuestions: (allAssignedQuestions.length + customQuestions.length) - unansweredQuestions.length,
      });
    }

    // Check if ALL assigned experts have completed their evaluations (progress = 100%)
    const { getAssignedExperts } = require('./services/notificationService');

    let assignedExpertIds = await getAssignedExperts(projectIdObj);

    // Exclude the use case owner from expert progress check (they are not an expert)
    if (project.useCase) {
      const UseCase = mongoose.model('UseCase');
      const useCase = await UseCase.findById(project.useCase).select('ownerId').lean();
      if (useCase?.ownerId) {
        const ownerIdStr = String(useCase.ownerId);
        assignedExpertIds = assignedExpertIds.filter(expertId => String(expertId) !== ownerIdStr);
      }
    }

    if (assignedExpertIds.length > 0) {
      // Check progress for all assigned experts using the same logic as /api/user-progress
      const expertProgresses = [];

      for (const expertId of assignedExpertIds) {
        // Get assignment for this expert
        const expertAssignment = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: expertId });
        if (!expertAssignment) {
          expertProgresses.push({ userId: expertId, progress: 0 });
          continue;
        }

        // Get assigned questionnaires (same logic as /api/user-progress)
        let assignedQuestionnaireKeys = Array.isArray(expertAssignment.questionnaires) ? expertAssignment.questionnaires.slice() : [];
        /**
         * CRITICAL FIX: Do NOT auto-include 'general-v1'.
         * 
         * if (!assignedQuestionnaireKeys.includes('general-v1')) {
         *   assignedQuestionnaireKeys.unshift('general-v1');
         * }
         */

        // If questionnaires are empty, derive from role
        if (assignedQuestionnaireKeys.length === 0) {
          const role = String(expertAssignment.role || '').toLowerCase();
          const roleMap = {
            'ethical-expert': 'ethical-expert-v1',
            'medical-expert': 'medical-expert-v1',
            'technical-expert': 'technical-expert-v1',
            'legal-expert': 'legal-expert-v1',
            'education-expert': 'education-expert-v1',
          };
          const roleKey = roleMap[role] || null;
          assignedQuestionnaireKeys = roleKey ? ['general-v1', roleKey] : ['general-v1'];
        }

        // Check which questionnaires actually have responses in the database
        const existingResponses = await Response.find({
          projectId: projectIdObj,
          userId: expertId,
          questionnaireKey: { $in: assignedQuestionnaireKeys }
        }).select('questionnaireKey').lean();

        const existingQuestionnaireKeys = new Set(existingResponses.map(r => r.questionnaireKey));

        let questionnairesToCount = assignedQuestionnaireKeys.slice();
        const hasGeneralResponse = existingQuestionnaireKeys.has('general-v1');
        const hasRoleSpecificResponse = assignedQuestionnaireKeys.some(key =>
          key.includes('-expert-v1') && existingQuestionnaireKeys.has(key)
        );

        // If both general-v1 and role-specific responses exist, count both
        // If only role-specific exists and has 30+ questions, it likely includes general questions
        // If both general-v1 and role-specific responses exist, count both
        // Logic removed: We no longer auto-exclude general-v1 based on question count.

        // Count total questions (all questionnaires including role-specific)
        const totalQuestions = await Question.countDocuments({
          questionnaireKey: { $in: questionnairesToCount }
        });

        if (totalQuestions === 0) {
          expertProgresses.push({ userId: expertId, progress: 0 });
          continue;
        }

        // Get all responses for this expert across all assigned questionnaires
        // questionnairesToCount is only for question count, but we need to fetch all responses
        const responses = await Response.find({
          projectId: projectIdObj,
          userId: expertId,
          questionnaireKey: { $in: assignedQuestionnaireKeys }
        }).select('questionnaireKey answers').lean();

        console.log(`📊 Expert ${expertId}: Fetched ${responses.length} response(s) for questionnaires: ${responses.map(r => r.questionnaireKey).join(', ')}`);

        // Count answered questions (same logic as /api/user-progress)
        const answeredKeys = new Set();
        for (const r of (responses || [])) {
          const qKey = r.questionnaireKey;
          const arr = Array.isArray(r.answers) ? r.answers : [];
          for (const a of arr) {
            const idKey = a?.questionId ? String(a.questionId) : '';
            const codeKey = a?.questionCode !== undefined && a?.questionCode !== null ? String(a.questionCode).trim() : '';
            const key = idKey.length > 0 ? idKey : (codeKey.length > 0 ? `${qKey}:${codeKey}` : '');
            if (!key || answeredKeys.has(key)) continue;

            let hasAnswer = false;
            if (a?.answer) {
              if (a.answer.choiceKey !== null && a.answer.choiceKey !== undefined && a.answer.choiceKey !== '') hasAnswer = true;
              else if (a.answer.text !== null && a.answer.text !== undefined && String(a.answer.text).trim().length > 0) hasAnswer = true;
              else if (a.answer.numeric !== null && a.answer.numeric !== undefined) hasAnswer = true;
              else if (Array.isArray(a.answer.multiChoiceKeys) && a.answer.multiChoiceKeys.length > 0) hasAnswer = true;
            } else if (a.choiceKey || (a.text && String(a.text).trim().length > 0) || a.numeric !== undefined || (Array.isArray(a.multiChoiceKeys) && a.multiChoiceKeys.length > 0)) {
              hasAnswer = true;
            }

            if (hasAnswer) answeredKeys.add(key);
          }
        }

        // Also check custom questions from Evaluation
        const expertEvaluation = await Evaluation.findOne({
          projectId: projectIdObj,
          userId: expertId
        }).select('customQuestions answers').lean();

        const customQuestions = expertEvaluation?.customQuestions || [];
        let customQuestionsTotal = 0;
        let customQuestionsAnswered = 0;

        for (const customQuestion of customQuestions) {
          if (customQuestion.required !== false) {
            customQuestionsTotal++;
            const customQuestionId = customQuestion.id;
            if (customQuestionId && expertEvaluation?.answers) {
              const customAnswer = expertEvaluation.answers[customQuestionId];
              if (customAnswer !== undefined && customAnswer !== null) {
                if (typeof customAnswer === 'string' && customAnswer.trim().length > 0) {
                  customQuestionsAnswered++;
                } else if (typeof customAnswer !== 'string') {
                  customQuestionsAnswered++;
                }
              }
            }
          }
        }

        // Total = regular questions + custom questions
        const totalWithCustom = totalQuestions + customQuestionsTotal;
        const answeredWithCustom = answeredKeys.size + customQuestionsAnswered;
        const progress = totalWithCustom > 0 ? Math.round((answeredWithCustom / totalWithCustom) * 100) : 0;

        expertProgresses.push({
          userId: expertId,
          progress: Math.max(0, Math.min(100, progress))
        });
      }

      // Check if all experts have 100% progress
      const allExpertsCompleted = expertProgresses.every(ep => ep.progress >= 100);
      if (!allExpertsCompleted) {
        const incompleteExperts = expertProgresses.filter(ep => ep.progress < 100);
        const incompleteCount = incompleteExperts.length;
        const totalExperts = expertProgresses.length;

        // Get expert names for better error message
        const expertUsers = await User.find({ _id: { $in: assignedExpertIds } }).select('name email role').lean();
        const expertNames = expertUsers.map(u => u.name || u.email).join(', ');

        return res.status(400).json({
          error: 'WAITING_FOR_OTHER_EXPERTS',
          message: 'Not all experts have completed their evaluations',
          totalExperts: totalExperts,
          completedExperts: totalExperts - incompleteCount,
          incompleteExperts: incompleteCount,
          expertNames: expertNames,
          expertProgresses: expertProgresses.map(ep => {
            const expertUser = expertUsers.find(u => u._id.toString() === ep.userId.toString());
            return {
              userId: ep.userId.toString(),
              name: expertUser?.name || expertUser?.email || 'Unknown',
              progress: ep.progress
            };
          })
        });
      }
    }

    // Check if all tensions (if any) have been voted on by all assigned experts
    const projectTensions = await Tension.find({ projectId: projectIdObj }).lean();
    if (projectTensions.length > 0) {
      let assignedExpertIds = await getAssignedExperts(projectIdObj);

      // Exclude the use case owner from tension voting check (they are not an expert)
      if (project.useCase) {
        const UseCase = mongoose.model('UseCase');
        const useCase = await UseCase.findById(project.useCase).select('ownerId').lean();
        if (useCase?.ownerId) {
          const ownerIdStr = String(useCase.ownerId);
          assignedExpertIds = assignedExpertIds.filter(expertId => String(expertId) !== ownerIdStr);
        }
      }

      const assignedExpertIdsStr = assignedExpertIds.map(id => id.toString());

      for (const tension of projectTensions) {
        const tensionVotes = tension.votes || [];
        const votedUserIds = tensionVotes.map(v => String(v.userId));
        const tensionCreatorId = String(tension.createdBy);

        // Check if all assigned experts have voted on this tension
        // CRITICAL FIX: Skip the creator of the tension (they cannot/should not vote on their own)
        const missingVotes = assignedExpertIdsStr.filter(expertId =>
          expertId !== tensionCreatorId && !votedUserIds.includes(expertId)
        );

        if (missingVotes.length > 0) {
          const expertUsers = await User.find({ _id: { $in: missingVotes.map(id => new mongoose.Types.ObjectId(id)) } }).select('name email').lean();
          const expertNames = expertUsers.map(u => u.name || u.email).join(', ');

          return res.status(400).json({
            error: 'NOT_ALL_TENSIONS_VOTED',
            message: 'Not all experts have voted on all tensions',
            totalTensions: projectTensions.length,
            tensionsWithMissingVotes: projectTensions.map(t => ({
              tensionId: t._id.toString(),
              claimStatement: t.claimStatement,
              missingVotes: assignedExpertIdsStr.filter(expertId => {
                const votes = t.votes || [];
                const votedUserIds = votes.map(v => String(v.userId));
                return !votedUserIds.includes(expertId);
              })
            })).filter(t => t.missingVotes.length > 0),
            expertNames: expertNames
          });
        }
      }
    }

    // Get assignment for evolution completion (reuse if already fetched)
    let assignment = assignmentForCheck || await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj });

    // Create assignment if missing (should be rare)
    if (!assignment) {
      try {
        const { createAssignment } = require('./services/evaluationService');
        const role = user.role || 'unknown';
        // Preserve existing behavior: ensure general-v1 is included. Role-specific questionnaire is optional here.
        const questionnaires = ['general-v1'];
        assignment = await createAssignment(projectIdObj, userIdObj, role, questionnaires);
      } catch {
        // fallback: create minimal assignment doc
        assignment = await ProjectAssignment.create({
          projectId: projectIdObj,
          userId: userIdObj,
          role: user.role || 'unknown',
          questionnaires: ['general-v1'],
          status: 'assigned',
        });
      }
    }

    if (assignment.evolutionCompletedAt) {
      return res.json({
        success: true,
        alreadyCompleted: true,
        totalTensions,
        votedTensions,
        evolutionCompletedAt: assignment.evolutionCompletedAt,
      });
    }

    assignment.evolutionCompletedAt = new Date();
    await assignment.save();

    // Check if ALL experts have now completed their evolution
    let allExpertsCompleted = false;
    let assignedExpertsForCheck = await getAssignedExperts(projectIdObj);

    // Exclude use case owner from this check too
    if (project.useCase) {
      const UseCase = mongoose.model('UseCase');
      const useCase = await UseCase.findById(project.useCase).select('ownerId').lean();
      if (useCase?.ownerId) {
        const ownerIdStr = String(useCase.ownerId);
        assignedExpertsForCheck = assignedExpertsForCheck.filter(expertId => String(expertId) !== ownerIdStr);
      }
    }

    if (assignedExpertsForCheck.length > 0) {
      const allAssignments = await ProjectAssignment.find({
        projectId: projectIdObj,
        userId: { $in: assignedExpertsForCheck }
      }).select('evolutionCompletedAt').lean();

      allExpertsCompleted = allAssignments.length === assignedExpertsForCheck.length &&
        allAssignments.every(a => a.evolutionCompletedAt);
    }

    // Notify ALL admins (case-insensitive match)
    const adminUsers = await User.find({ role: { $regex: /^admin$/i } }).select('_id').lean();
    if (Array.isArray(adminUsers) && adminUsers.length > 0) {
      const notificationText = allExpertsCompleted
        ? `[NOTIFICATION] ALL EXPERTS completed evolution for project "${project.title}"`
        : `[NOTIFICATION] Evolution completed for project "${project.title}" by ${user.name}`;
      await Promise.all(
        adminUsers
          .filter((a) => a?._id)
          .map((a) =>
            Message.create({
              projectId: projectIdObj,
              fromUserId: userIdObj,
              toUserId: a._id,
              text: notificationText,
              isNotification: true,
              createdAt: new Date(),
              readAt: null,
            })
          )
      );
    }

    res.json({
      success: true,
      alreadyCompleted: false,
      totalTensions,
      votedTensions,
      evolutionCompletedAt: assignment.evolutionCompletedAt,
      allExpertsCompleted: allExpertsCompleted, // Frontend will use this
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Evaluations (Legacy endpoint - also saves to new responses collection)
app.post('/api/evaluations', async (req, res) => {
  try {
    const { projectId, userId, stage, answers, questionPriorities, riskScores, riskLevel, generalRisks, status } = req.body;

    // Convert IDs to ObjectId if needed
    const projectIdObj = isValidObjectId(projectId)
      ? new mongoose.Types.ObjectId(projectId)
      : projectId;
    const userIdObj = isValidObjectId(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    // Save to old Evaluation collection (for backward compatibility)
    // IMPORTANT: Use $set to avoid wiping fields like customQuestions on subsequent saves
    const evaluation = await Evaluation.findOneAndUpdate(
      { projectId: projectIdObj, userId: userIdObj, stage },
      {
        $setOnInsert: {
          projectId: projectIdObj,
          userId: userIdObj,
          stage
        },
        $set: {
          answers: answers || {},
          questionPriorities: questionPriorities || {},
          riskLevel: riskLevel || 'medium',
          generalRisks: generalRisks || [],
          status: status || 'draft',
          updatedAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    // Also try to save to new responses collection (non-blocking)
    console.log(`📥 /api/evaluations called: stage=${stage}, answers keys=${answers ? Object.keys(answers).length : 0}, answers=${JSON.stringify(answers ? Object.keys(answers).slice(0, 5) : [])}`);
    // Save answers regardless of stage - they might be from assess or set-up
    if (answers && Object.keys(answers).length > 0) {
      console.log(`✅ Answers exist (${Object.keys(answers).length} keys), proceeding to save...`);
      try {
        const Response = require('./models/response');
        const ProjectAssignment = require('./models/projectAssignment');
        const Question = require('./models/question');
        const Questionnaire = require('./models/questionnaire');

        // Get user role
        const user = await User.findById(userIdObj);
        const role = user?.role || 'unknown';

        // Determine role-specific questionnaire key
        let roleQuestionnaireKey = 'general-v1';
        if (role === 'ethical-expert') roleQuestionnaireKey = 'ethical-expert-v1';
        else if (role === 'medical-expert') roleQuestionnaireKey = 'medical-expert-v1';
        else if (role === 'technical-expert') roleQuestionnaireKey = 'technical-expert-v1';
        else if (role === 'legal-expert') roleQuestionnaireKey = 'legal-expert-v1';
        else if (role === 'education-expert') roleQuestionnaireKey = 'education-expert-v1';

        // Create or get assignment
        let assignment = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj });
        if (!assignment) {
          const { createAssignment } = require('./services/evaluationService');
          const questionnaires = role !== 'any' && roleQuestionnaireKey !== 'general-v1'
            ? ['general-v1', roleQuestionnaireKey]
            : ['general-v1'];
          assignment = await createAssignment(projectIdObj, userIdObj, role, questionnaires);
        }

        // Get all questions to determine which questionnaire they belong to
        const allGeneralQuestions = await Question.find({ questionnaireKey: 'general-v1' }).select('code _id').lean();
        const generalCodes = new Set(allGeneralQuestions.map(q => q.code).filter(Boolean));
        const generalIds = new Set(allGeneralQuestions.map(q => q._id.toString()));
        // Create a map from any possible key format to question
        const generalQuestionMap = new Map();
        allGeneralQuestions.forEach(q => {
          if (q.code) generalQuestionMap.set(q.code, q);
          generalQuestionMap.set(q._id.toString(), q);
          if (q._id) generalQuestionMap.set(String(q._id), q);
        });

        const allRoleQuestions = roleQuestionnaireKey !== 'general-v1'
          ? await Question.find({ questionnaireKey: roleQuestionnaireKey }).select('code _id').lean()
          : [];
        const roleCodes = new Set(allRoleQuestions.map(q => q.code).filter(Boolean));
        const roleIds = new Set(allRoleQuestions.map(q => q._id.toString()));
        // Create a map from any possible key format to question
        const roleQuestionMap = new Map();
        allRoleQuestions.forEach(q => {
          if (q.code) roleQuestionMap.set(q.code, q);
          roleQuestionMap.set(q._id.toString(), q);
          if (q._id) roleQuestionMap.set(String(q._id), q);
        });

        // Separate answers by questionnaire
        // Use Maps to track processed questions by code to avoid duplicates
        const generalAnswersMap = {};
        const roleSpecificAnswersMap = {};
        const processedQuestionCodes = new Set(); // Track processed questions to avoid duplicates

        console.log(`📝 Processing ${Object.keys(answers).length} answers for project ${projectId}, user ${userId}, role ${role}`);
        console.log(`📝 Answer keys (first 20): ${Object.keys(answers).slice(0, 20).join(', ')}${Object.keys(answers).length > 20 ? '...' : ''}`);
        console.log(`📝 General codes count: ${generalCodes.size}, Role codes count: ${roleCodes.size}`);
        console.log(`📝 Sample general codes: ${Array.from(generalCodes).slice(0, 5).join(', ')}`);
        console.log(`📝 Sample role codes: ${Array.from(roleCodes).slice(0, 5).join(', ')}`);

        for (const [questionKey, answerValue] of Object.entries(answers)) {
          console.log(`🔍 Processing answer key: "${questionKey}", value: ${typeof answerValue === 'string' ? answerValue.substring(0, 30) : answerValue}`);

          // Try to find question using the map first (faster)
          let question = generalQuestionMap.get(questionKey) || roleQuestionMap.get(questionKey);

          // If not found in map, try database lookup with multiple formats
          if (!question) {
            // Try as ObjectId first
            let query = { $or: [] };
            if (isValidObjectId(questionKey)) {
              query.$or.push({ _id: new mongoose.Types.ObjectId(questionKey) });
            }
            query.$or.push({ _id: questionKey });
            query.$or.push({ code: questionKey });

            question = await Question.findOne(query).lean();

            if (question) {
              console.log(`🔍 Found question via DB lookup: "${questionKey}" -> code: "${question.code}", questionnaire: "${question.questionnaireKey}"`);
            } else {
              console.warn(`⚠️ Question not found in DB for key: "${questionKey}"`);
            }
          }

          if (question) {
            const questionCode = question.code; // Use code as the canonical identifier

            // Skip if we've already processed this question code (avoid duplicates from ObjectId + code keys)
            if (processedQuestionCodes.has(questionCode)) {
              console.log(`⏭️ Skipping duplicate answer for question code "${questionCode}" (already processed)`);
              continue;
            }
            processedQuestionCodes.add(questionCode);

            console.log(`✅ Found question "${questionKey}" -> code: "${questionCode}", questionnaire: "${question.questionnaireKey}", role: ${role}, expected roleQuestionnaireKey: ${roleQuestionnaireKey}`);

            if (question.questionnaireKey === 'general-v1') {
              // Use questionCode as key for consistency
              generalAnswersMap[questionCode] = answerValue;
              console.log(`✅ Added to generalAnswersMap: "${questionCode}" = ${typeof answerValue === 'string' ? answerValue.substring(0, 30) : answerValue}`);
            } else if (question.questionnaireKey === roleQuestionnaireKey) {
              // Use questionCode as key for consistency
              roleSpecificAnswersMap[questionCode] = answerValue;
              console.log(`✅ Added to roleSpecificAnswersMap: "${questionCode}" = ${typeof answerValue === 'string' ? answerValue.substring(0, 30) : answerValue}`);
              console.log(`📊 roleSpecificAnswersMap now has ${Object.keys(roleSpecificAnswersMap).length} answers: ${Object.keys(roleSpecificAnswersMap).slice(0, 10).join(', ')}${Object.keys(roleSpecificAnswersMap).length > 10 ? '...' : ''}`);
            } else {
              console.warn(`⚠️ Question "${questionKey}" (code: "${questionCode}") belongs to "${question.questionnaireKey}", not expected questionnaire (general-v1 or ${roleQuestionnaireKey})`);
              console.warn(`⚠️ This answer will NOT be saved to Response collection!`);
              // Still try to save to the correct questionnaire if it exists
              if (question.questionnaireKey && question.questionnaireKey !== 'general-v1') {
                console.log(`🔄 Attempting to save to correct questionnaire: ${question.questionnaireKey}`);
                // Try to add to roleSpecificAnswersMap anyway if it's a role-specific questionnaire
                if (question.questionnaireKey.includes('-expert-v1')) {
                  console.log(`🔄 Adding to roleSpecificAnswersMap anyway for questionnaire: ${question.questionnaireKey}`);
                  roleSpecificAnswersMap[questionCode] = answerValue;
                }
              }
            }
          } else {
            // Fallback: check if it matches codes directly
            if (generalCodes.has(questionKey)) {
              // Skip if already processed
              if (processedQuestionCodes.has(questionKey)) {
                console.log(`⏭️ Skipping duplicate answer for question code "${questionKey}" (already processed)`);
                continue;
              }
              processedQuestionCodes.add(questionKey);
              console.log(`📌 Question "${questionKey}" matched general codes directly, adding to generalAnswersMap`);
              generalAnswersMap[questionKey] = answerValue;
            } else if (roleCodes.has(questionKey)) {
              // Skip if already processed
              if (processedQuestionCodes.has(questionKey)) {
                console.log(`⏭️ Skipping duplicate answer for question code "${questionKey}" (already processed)`);
                continue;
              }
              processedQuestionCodes.add(questionKey);
              console.log(`📌 Question "${questionKey}" matched role codes directly, adding to roleSpecificAnswersMap`);
              roleSpecificAnswersMap[questionKey] = answerValue;
            } else {
              console.warn(`⚠️ Question "${questionKey}" not found in DB and doesn't match any questionnaire codes`);
              console.warn(`⚠️ Available general codes (first 10): ${Array.from(generalCodes).slice(0, 10).join(', ')}`);
              console.warn(`⚠️ Available role codes (first 10): ${Array.from(roleCodes).slice(0, 10).join(', ')}`);
              console.warn(`⚠️ This answer will NOT be saved to Response collection!`);
            }
          }
        }

        console.log(`📊 Separated answers: ${Object.keys(generalAnswersMap).length} general, ${Object.keys(roleSpecificAnswersMap).length} role-specific`);
        console.log(`📊 General answer codes: ${Object.keys(generalAnswersMap).slice(0, 10).join(', ')}${Object.keys(generalAnswersMap).length > 10 ? '...' : ''}`);
        console.log(`📊 Role-specific answer codes: ${Object.keys(roleSpecificAnswersMap).slice(0, 10).join(', ')}${Object.keys(roleSpecificAnswersMap).length > 10 ? '...' : ''}`);
        console.log(`📊 Role: ${role}, roleQuestionnaireKey: ${roleQuestionnaireKey}`);

        // Prepare response saving tasks (parallel execution)
        const saveTasks = [];
        const { ensureAllQuestionsPresent, validateSubmission } = require('./services/evaluationService');

        // Save general-v1 responses
        if (Object.keys(generalAnswersMap).length > 0 || Object.keys(answers).length > 0) {
          saveTasks.push(async () => {
            try {
              const generalQuestionnaire = await Questionnaire.findOne({ key: 'general-v1', isActive: true });
              if (!generalQuestionnaire) {
                console.warn('⚠️ general-v1 questionnaire not found');
                return;
              }

              console.log(`🔄 Ensuring all questions present for general-v1...`);
              await ensureAllQuestionsPresent(projectIdObj, userIdObj, 'general-v1');
              console.log(`✅ All questions ensured for general-v1`);

              const generalResponseAnswers = [];
              const generalQuestions = await Question.find({ questionnaireKey: 'general-v1' })
                .select('_id code answerType options')
                .lean();

              for (const [questionKey, answerValue] of Object.entries(generalAnswersMap)) {
                // questionKey is now questionCode (from the map above)
                let question = generalQuestions.find(q =>
                  q.code === questionKey
                );

                if (!question) {
                  // Try to find by code
                  question = await Question.findOne({
                    $or: [
                      { code: questionKey },
                      { questionnaireKey: 'general-v1', code: questionKey }
                    ]
                  }).lean();
                }

                if (!question) {
                  console.warn(`⚠️ General question with code ${questionKey} not found in database, skipping`);
                  continue;
                }

                const questionCode = question.code; // Use code as canonical identifier
                console.log(`💾 Saving general answer: questionCode=${questionCode}, answerValue=${typeof answerValue === 'string' ? answerValue.substring(0, 50) : answerValue}`);

                // Get risk score from riskScores if available, otherwise use priority
                // Try multiple key formats: questionCode, questionKey, question._id, question.id
                let score = 2; // Default
                if (riskScores) {
                  const riskScore = riskScores[questionCode] ??
                    riskScores[questionKey] ??
                    riskScores[question._id?.toString()] ??
                    riskScores[String(question._id)] ??
                    undefined;
                  if (riskScore !== undefined && (riskScore === 0 || riskScore === 1 || riskScore === 2 || riskScore === 3 || riskScore === 4)) {
                    score = riskScore;
                    console.log(`📊 Using risk score ${score} for question ${questionCode} from riskScores`);
                  }
                }
                if (score === 2 && questionPriorities) {
                  const priority = questionPriorities[questionCode] ??
                    questionPriorities[questionKey] ??
                    questionPriorities[question._id?.toString()] ??
                    questionPriorities[String(question._id)] ??
                    undefined;
                  if (priority) {
                    if (priority === 'low') score = 3;
                    else if (priority === 'medium') score = 2;
                    else if (priority === 'high') score = 1;
                    console.log(`📊 Using priority ${priority} (score ${score}) for question ${questionCode}`);
                  }
                }

                // Normalization for MCQ objects
                let normalizedValue = answerValue;
                if (answerValue && typeof answerValue === 'object' && !Array.isArray(answerValue)) {
                  if (answerValue.choiceKey) normalizedValue = answerValue.choiceKey;
                  else if (answerValue.text) normalizedValue = answerValue.text;
                }

                // Format answer
                let answerFormat = {};
                if (question.answerType === 'single_choice') {
                  const option = question.options?.find(opt =>
                    opt.label?.en === normalizedValue || opt.label?.tr === normalizedValue || opt.key === normalizedValue
                  );
                  answerFormat.choiceKey = option ? option.key : normalizedValue;
                  if (option?.score !== undefined) score = option.score;
                } else if (question.answerType === 'open_text') {
                  answerFormat.text = normalizedValue;
                } else if (question.answerType === 'multi_choice') {
                  const rawArray = Array.isArray(normalizedValue) ? normalizedValue : [normalizedValue];
                  answerFormat.multiChoiceKeys = rawArray.map(v =>
                    (v && typeof v === 'object' && v.choiceKey) ? v.choiceKey : v
                  );
                }

                generalResponseAnswers.push({
                  questionId: question._id,
                  questionCode: questionCode, // Use the canonical code
                  answer: answerFormat,
                  score: score,
                  notes: null,
                  evidence: []
                });
              }

              if (generalResponseAnswers.length > 0) {
                const existingResponse = await Response.findOne({
                  projectId: projectIdObj,
                  userId: userIdObj,
                  questionnaireKey: 'general-v1'
                });

                if (existingResponse) {
                  const answerMap = new Map(generalResponseAnswers.map(a => [a.questionCode, a]));
                  // Get existing codes BEFORE updating answers
                  const existingCodes = new Set(existingResponse.answers.map(a => a.questionCode));

                  // Update existing answers
                  existingResponse.answers = existingResponse.answers.map(existingAnswer => {
                    const updatedAnswer = answerMap.get(existingAnswer.questionCode);
                    return updatedAnswer || existingAnswer;
                  });

                  // Add new answers that don't exist yet
                  generalResponseAnswers.forEach(newAnswer => {
                    if (!existingCodes.has(newAnswer.questionCode)) {
                      existingResponse.answers.push(newAnswer);
                    }
                  });

                  existingResponse.status = status === 'completed' ? 'submitted' : 'draft';
                  existingResponse.submittedAt = status === 'completed' ? new Date() : null;
                  existingResponse.updatedAt = new Date();
                  await existingResponse.save();
                  console.log(`✅ Updated general-v1 response with ${generalResponseAnswers.length} answered questions`);
                } else {
                  await Response.create({
                    projectId: projectIdObj,
                    assignmentId: assignment._id,
                    userId: userIdObj,
                    role: role,
                    questionnaireKey: 'general-v1',
                    questionnaireVersion: generalQuestionnaire.version,
                    answers: generalResponseAnswers,
                    status: status === 'completed' ? 'submitted' : 'draft',
                    submittedAt: status === 'completed' ? new Date() : null,
                    updatedAt: new Date()
                  });
                  console.log(`✅ Created general-v1 response with ${generalResponseAnswers.length} answered questions`);
                }
              } else {
                console.warn(`⚠️ No general answers to save (generalResponseAnswers.length = ${generalResponseAnswers.length})`);
              }
            } catch (error) {
              console.error(`❌ Error saving general-v1 responses:`, error);
              console.error(`❌ Error stack:`, error.stack);
              throw error; // Re-throw to be caught by outer try-catch
            }
          });
        }

        // Save role-specific responses
        console.log(`🔍 Checking role-specific responses: roleQuestionnaireKey=${roleQuestionnaireKey}, roleSpecificAnswersMap.length=${Object.keys(roleSpecificAnswersMap).length}`);
        console.log(`🔍 roleSpecificAnswersMap keys: ${Object.keys(roleSpecificAnswersMap).slice(0, 20).join(', ')}${Object.keys(roleSpecificAnswersMap).length > 20 ? '...' : ''}`);
        if (roleQuestionnaireKey !== 'general-v1' && Object.keys(roleSpecificAnswersMap).length > 0) {
          console.log(`✅ Saving ${Object.keys(roleSpecificAnswersMap).length} role-specific responses to ${roleQuestionnaireKey}...`);
          saveTasks.push(async () => {
            try {
              const roleQuestionnaire = await Questionnaire.findOne({ key: roleQuestionnaireKey, isActive: true });
              if (!roleQuestionnaire) {
                // Create if doesn't exist
                await Questionnaire.create({
                  key: roleQuestionnaireKey,
                  title: `${role} Questions v1`,
                  language: 'en-tr',
                  version: 1,
                  isActive: true
                });
                console.log(`✅ Created questionnaire: ${roleQuestionnaireKey}`);
              }

              console.log(`🔄 Ensuring all questions present for ${roleQuestionnaireKey}...`);
              await ensureAllQuestionsPresent(projectIdObj, userIdObj, roleQuestionnaireKey);
              console.log(`✅ All questions ensured for ${roleQuestionnaireKey}`);

              const roleResponseAnswers = [];
              const roleQuestions = await Question.find({ questionnaireKey: roleQuestionnaireKey })
                .select('_id code answerType options')
                .lean();

              for (const [questionKey, answerValue] of Object.entries(roleSpecificAnswersMap)) {
                // questionKey is now questionCode (from the map above)
                let question = roleQuestions.find(q =>
                  q.code === questionKey
                );

                if (!question) {
                  question = await Question.findOne({
                    $or: [
                      { code: questionKey },
                      { questionnaireKey: roleQuestionnaireKey, code: questionKey }
                    ]
                  }).lean();
                }

                if (!question) {
                  console.warn(`⚠️ Role-specific question with code ${questionKey} not found in database, skipping`);
                  continue;
                }

                const questionCode = question.code; // Use code as canonical identifier
                console.log(`💾 Saving role-specific answer: questionCode=${questionCode}, answerValue=${typeof answerValue === 'string' ? answerValue.substring(0, 50) : answerValue}`);

                // Get risk score from riskScores if available, otherwise use priority
                // Try multiple key formats: questionCode, questionKey, question._id, question.id
                let score = 2; // Default
                if (riskScores) {
                  const riskScore = riskScores[questionCode] ??
                    riskScores[questionKey] ??
                    riskScores[question._id?.toString()] ??
                    riskScores[String(question._id)] ??
                    undefined;
                  if (riskScore !== undefined && (riskScore === 0 || riskScore === 1 || riskScore === 2 || riskScore === 3 || riskScore === 4)) {
                    score = riskScore;
                    console.log(`📊 Using risk score ${score} for question ${questionCode} from riskScores`);
                  }
                }
                if (score === 2 && questionPriorities) {
                  const priority = questionPriorities[questionCode] ??
                    questionPriorities[questionKey] ??
                    questionPriorities[question._id?.toString()] ??
                    questionPriorities[String(question._id)] ??
                    undefined;
                  if (priority) {
                    if (priority === 'low') score = 3;
                    else if (priority === 'medium') score = 2;
                    else if (priority === 'high') score = 1;
                    console.log(`📊 Using priority ${priority} (score ${score}) for question ${questionCode}`);
                  }
                }

                // Normalization for MCQ objects
                let normalizedValue = answerValue;
                if (answerValue && typeof answerValue === 'object' && !Array.isArray(answerValue)) {
                  if (answerValue.choiceKey) normalizedValue = answerValue.choiceKey;
                  else if (answerValue.text) normalizedValue = answerValue.text;
                }

                // Format answer
                let answerFormat = {};
                if (question.answerType === 'single_choice') {
                  const option = question.options?.find(opt =>
                    opt.label?.en === normalizedValue || opt.label?.tr === normalizedValue || opt.key === normalizedValue
                  );
                  answerFormat.choiceKey = option ? option.key : normalizedValue;
                  if (option?.score !== undefined) score = option.score;
                } else if (question.answerType === 'open_text') {
                  answerFormat.text = normalizedValue;
                } else if (question.answerType === 'multi_choice') {
                  const rawArray = Array.isArray(normalizedValue) ? normalizedValue : [normalizedValue];
                  answerFormat.multiChoiceKeys = rawArray.map(v =>
                    (v && typeof v === 'object' && v.choiceKey) ? v.choiceKey : v
                  );
                }

                roleResponseAnswers.push({
                  questionId: question._id,
                  questionCode: question.code,
                  answer: answerFormat,
                  score: score,
                  notes: null,
                  evidence: []
                });
              }

              if (roleResponseAnswers.length > 0) {
                console.log(`💾 Saving ${roleResponseAnswers.length} role-specific answers to ${roleQuestionnaireKey} response...`);
                const existingResponse = await Response.findOne({
                  projectId: projectIdObj,
                  userId: userIdObj,
                  questionnaireKey: roleQuestionnaireKey
                });

                if (existingResponse) {
                  console.log(`📝 Found existing response for ${roleQuestionnaireKey}, updating...`);
                  const answerMap = new Map(roleResponseAnswers.map(a => [a.questionCode, a]));
                  // Get existing codes BEFORE updating answers
                  const existingCodes = new Set(existingResponse.answers.map(a => a.questionCode));
                  console.log(`📝 Existing response has ${existingResponse.answers.length} answers, adding/updating ${roleResponseAnswers.length} answers`);

                  // Update existing answers
                  existingResponse.answers = existingResponse.answers.map(existingAnswer => {
                    const updatedAnswer = answerMap.get(existingAnswer.questionCode);
                    return updatedAnswer || existingAnswer;
                  });

                  // Add new answers that don't exist yet
                  let addedCount = 0;
                  roleResponseAnswers.forEach(newAnswer => {
                    if (!existingCodes.has(newAnswer.questionCode)) {
                      existingResponse.answers.push(newAnswer);
                      addedCount++;
                    }
                  });
                  console.log(`📝 Added ${addedCount} new answers, updated ${roleResponseAnswers.length - addedCount} existing answers`);

                  existingResponse.status = status === 'completed' ? 'submitted' : 'draft';
                  existingResponse.submittedAt = status === 'completed' ? new Date() : null;
                  existingResponse.updatedAt = new Date();
                  await existingResponse.save();
                  console.log(`✅ Updated ${roleQuestionnaireKey} response with ${existingResponse.answers.length} total answered questions (${roleResponseAnswers.length} in this batch)`);
                } else {
                  console.log(`📝 No existing response found for ${roleQuestionnaireKey}, creating new one...`);
                  const finalRoleQuestionnaire = await Questionnaire.findOne({ key: roleQuestionnaireKey, isActive: true });
                  const newResponse = await Response.create({
                    projectId: projectIdObj,
                    assignmentId: assignment._id,
                    userId: userIdObj,
                    role: role,
                    questionnaireKey: roleQuestionnaireKey,
                    questionnaireVersion: finalRoleQuestionnaire?.version || 1,
                    answers: roleResponseAnswers,
                    status: status === 'completed' ? 'submitted' : 'draft',
                    submittedAt: status === 'completed' ? new Date() : null,
                    updatedAt: new Date()
                  });
                  console.log(`✅ Created ${roleQuestionnaireKey} response with ID ${newResponse._id} and ${roleResponseAnswers.length} answered questions`);
                }
              } else {
                console.warn(`⚠️ No role-specific answers to save (roleResponseAnswers.length = ${roleResponseAnswers.length})`);
                console.warn(`⚠️ roleSpecificAnswersMap had ${Object.keys(roleSpecificAnswersMap).length} keys but no answers were processed`);
              }
            } catch (error) {
              console.error(`❌ Error saving ${roleQuestionnaireKey} responses:`, error);
              console.error(`❌ Error stack:`, error.stack);
              throw error; // Re-throw to be caught by outer try-catch
            }
          });
        }

        // Execute all save tasks in parallel
        if (saveTasks.length > 0) {
          console.log(`🚀 Executing ${saveTasks.length} save task(s) to Response collection...`);
          try {
            await Promise.all(saveTasks.map(task => task()));
            console.log(`✅ All responses saved successfully to Response collection`);
          } catch (saveError) {
            console.error(`❌ Error in save tasks:`, saveError);
            console.error(`❌ Save error stack:`, saveError.stack);
            // Re-throw to be caught by outer catch and return error to frontend
            throw saveError;
          }
        } else {
          console.warn(`⚠️ No save tasks to execute! generalAnswersMap: ${Object.keys(generalAnswersMap).length}, roleSpecificAnswersMap: ${Object.keys(roleSpecificAnswersMap).length}, answers: ${Object.keys(answers).length}`);
          console.warn(`⚠️ This means answers were NOT saved to Response collection!`);
          // Check if answers are only custom questions (which are saved to Evaluation collection, not Response)
          const customAnswerKeys = Object.keys(answers).filter(key => String(key).startsWith('custom_'));
          const nonCustomAnswers = Object.keys(answers).filter(key => !String(key).startsWith('custom_'));

          if (nonCustomAnswers.length > 0) {
            // We have non-custom answers but no save tasks - this is a problem
            console.error(`❌ CRITICAL: ${nonCustomAnswers.length} non-custom answer(s) exist but no save tasks were created!`);
            console.error(`❌ Non-custom answer keys (first 10): ${nonCustomAnswers.slice(0, 10).join(', ')}`);
            console.error(`❌ This means answers could not be matched to questions. Check question codes/IDs.`);
            throw new Error(`Failed to save answers: Could not match ${nonCustomAnswers.length} answer(s) to questions. Please check question codes/IDs.`);
          } else if (customAnswerKeys.length > 0) {
            // Only custom questions - these are saved to Evaluation collection, which is fine
            console.log(`ℹ️ Only custom questions found (${customAnswerKeys.length}), these are saved to Evaluation collection`);
          }
        }

        // Validate submissions if completed
        if (status === 'completed') {
          try {
            await validateSubmission(projectIdObj, userIdObj, 'general-v1');
            if (roleQuestionnaireKey !== 'general-v1') {
              await validateSubmission(projectIdObj, userIdObj, roleQuestionnaireKey);
            }
          } catch (validationError) {
            console.error(`❌ Validation failed: ${validationError.message}`);
            // Don't throw - allow save but log warning
          }
        }
      } catch (newSystemError) {
        // CRITICAL: Don't silently fail - return error to frontend
        console.error('❌ CRITICAL: Error saving to new responses collection:', newSystemError);
        console.error('❌ Error stack:', newSystemError.stack);
        // Return error response to frontend so user knows save failed
        return res.status(500).json({
          error: 'Failed to save answers to database',
          details: newSystemError.message,
          savedToEvaluation: true // Old system still saved
        });
      }
    }

    res.json(evaluation);
  } catch (err) {
    console.error('❌ Error in /api/evaluations:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/evaluations', async (req, res) => {
  try {
    const { projectId, userId, stage } = req.query;
    const evaluation = await Evaluation.findOne({ projectId, userId, stage });
    res.json(evaluation || { answers: {}, riskLevel: 'medium', customQuestions: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a custom question to an evaluation stage (persist to MongoDB)
app.post('/api/evaluations/custom-questions', async (req, res) => {
  try {
    const { projectId, userId, stage, question } = req.body || {};
    if (!projectId || !userId || !stage) {
      return res.status(400).json({ error: 'projectId, userId, stage are required' });
    }
    if (!question || !question.text || !question.type) {
      return res.status(400).json({ error: 'question.text and question.type are required' });
    }

    const projectIdObj = isValidObjectId(projectId)
      ? new mongoose.Types.ObjectId(projectId)
      : projectId;
    const userIdObj = isValidObjectId(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const id = question.id && typeof question.id === 'string' ? question.id : `custom_${Date.now()}`;
    const doc = {
      id,
      text: String(question.text),
      description: question.description ? String(question.description) : undefined,
      type: String(question.type),
      stage: String(question.stage || stage),
      principle: question.principle ? String(question.principle) : undefined,
      required: question.required !== false,
      options: Array.isArray(question.options) ? question.options.map((o) => String(o)) : [],
      min: typeof question.min === 'number' ? question.min : undefined,
      max: typeof question.max === 'number' ? question.max : undefined,
      createdAt: new Date()
    };

    await Evaluation.findOneAndUpdate(
      { projectId: projectIdObj, userId: userIdObj, stage: String(stage) },
      {
        $setOnInsert: {
          projectId: projectIdObj,
          userId: userIdObj,
          stage: String(stage),
          answers: {},
          questionPriorities: {},
          riskLevel: 'medium',
          generalRisks: [],
          status: 'draft',
          updatedAt: new Date()
        },
        $push: { customQuestions: doc },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, new: true }
    );

    // Notify admins about the new custom question
    try {
      const { getAllAdmins, createNotifications } = require('./services/notificationService');
      const user = await User.findById(userIdObj).select('name email role').lean();
      const project = await Project.findById(projectIdObj).select('title').lean();

      const admins = await getAllAdmins();
      if (admins.length > 0 && user && project) {
        const userName = user.name || user.email || 'Expert';
        const userRole = user.role || 'expert';
        const projectTitle = project.title || 'Project';
        const questionText = doc.text.length > 100 ? doc.text.substring(0, 100) + '...' : doc.text;

        const dedupeKey = `custom_question_${projectIdObj}_${userIdObj}_${doc.id}_${Date.now()}`;

        const payload = {
          projectId: projectIdObj,
          entityType: 'custom_question',
          entityId: doc.id,
          type: 'custom_question_added',
          title: 'New custom question added',
          message: `${userRole === 'admin' ? 'Admin' : 'Expert'} "${userName}" added a custom question to project "${projectTitle}" (Stage: ${stage}): "${questionText}"`,
          actorId: userIdObj,
          actorRole: userRole,
          metadata: {
            questionId: doc.id,
            questionText: doc.text,
            stage: stage,
            questionType: doc.type,
            principle: doc.principle || null
          },
          url: `/admin/projects/${projectIdObj}/evaluations`,
          dedupeKey
        };

        await createNotifications(admins.map(a => a._id), payload);
        console.log(`📬 Custom question notification sent to ${admins.length} admin(s)`);
      }
    } catch (notificationError) {
      // Don't fail the request if notification fails
      console.error('⚠️ Error sending custom question notification:', notificationError);
    }

    res.json({ success: true, question: doc });
  } catch (err) {
    console.error('❌ Error in /api/evaluations/custom-questions:', err);
    res.status(500).json({ error: err.message });
  }
});

// General Questions Answers - Test endpoint
app.get('/api/general-questions/test', (req, res) => {
  res.json({ message: 'General questions endpoint is working!' });
});

// General Questions Answers
app.post('/api/general-questions', async (req, res) => {
  try {
    const { projectId, userId, userRole, answers, risks, principles } = req.body;

    // Convert string IDs to ObjectId if needed
    const projectIdObj = isValidObjectId(projectId)
      ? new mongoose.Types.ObjectId(projectId)
      : projectId;
    const userIdObj = isValidObjectId(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    // Organize answers and risks by principle if provided
    let principlesData = {};
    let flatAnswers = answers || {};
    let flatRisks = risks || {};

    // If principles are provided, extract flat answers and risks from principles
    if (principles) {
      principlesData = { principles };
      // Also create flat structure for backward compatibility and response saving
      Object.keys(principles).forEach(principle => {
        if (principles[principle].answers) {
          Object.assign(flatAnswers, principles[principle].answers);
        }
        if (principles[principle].risks) {
          Object.assign(flatRisks, principles[principle].risks);
        }
      });
    }

    if (!principles && answers && risks) {
      // Legacy: organize flat answers/risks by principle
      // Get question codes from MongoDB to map them to principles dynamically
      const Question = require('./models/question');
      const allQuestions = await Question.find({ questionnaireKey: 'general-v1' }).select('code principle').lean();

      // Build principle map from database
      const principleMap = {};
      allQuestions.forEach(q => {
        principleMap[q.code] = q.principle;
      });

      // Also include legacy hardcoded mappings for backward compatibility
      const legacyMap = {
        'T1': 'TRANSPARENCY', 'T2': 'TRANSPARENCY', 'T9': 'TRANSPARENCY', 'T10': 'TRANSPARENCY', 'T11': 'TRANSPARENCY',
        'H1': 'HUMAN AGENCY & OVERSIGHT', 'H2': 'HUMAN AGENCY & OVERSIGHT', 'H6': 'HUMAN AGENCY & OVERSIGHT',
        'H10': 'HUMAN AGENCY & OVERSIGHT', 'H11': 'HUMAN AGENCY & OVERSIGHT', 'H12': 'HUMAN AGENCY & OVERSIGHT',
        'H13': 'HUMAN AGENCY & OVERSIGHT', 'H14': 'HUMAN AGENCY & OVERSIGHT', 'H15': 'HUMAN AGENCY & OVERSIGHT',
        'H16': 'HUMAN AGENCY & OVERSIGHT', 'H17': 'HUMAN AGENCY & OVERSIGHT',
        'S1': 'TECHNICAL ROBUSTNESS & SAFETY', 'S2': 'TECHNICAL ROBUSTNESS & SAFETY', 'S3': 'TECHNICAL ROBUSTNESS & SAFETY',
        'S4': 'TECHNICAL ROBUSTNESS & SAFETY', 'S5': 'TECHNICAL ROBUSTNESS & SAFETY', 'S6': 'TECHNICAL ROBUSTNESS & SAFETY',
        'S7': 'TECHNICAL ROBUSTNESS & SAFETY', 'S8': 'TECHNICAL ROBUSTNESS & SAFETY', 'S9': 'TECHNICAL ROBUSTNESS & SAFETY',
        'P1': 'PRIVACY & DATA GOVERNANCE', 'P2': 'PRIVACY & DATA GOVERNANCE', 'P4': 'PRIVACY & DATA GOVERNANCE',
        'P5': 'PRIVACY & DATA GOVERNANCE', 'P6': 'PRIVACY & DATA GOVERNANCE', 'P7': 'PRIVACY & DATA GOVERNANCE',
        'F1': 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS', 'F2': 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
        'F3': 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS', 'F4': 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
        'F5': 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS',
        'W1': 'SOCIETAL & INTERPERSONAL WELL-BEING', 'W2': 'SOCIETAL & INTERPERSONAL WELL-BEING',
        'W7': 'SOCIETAL & INTERPERSONAL WELL-BEING', 'W8': 'SOCIETAL & INTERPERSONAL WELL-BEING',
        'W9': 'SOCIETAL & INTERPERSONAL WELL-BEING',
        'A1': 'ACCOUNTABILITY', 'A2': 'ACCOUNTABILITY', 'A5': 'ACCOUNTABILITY', 'A11': 'ACCOUNTABILITY',
        'A12': 'ACCOUNTABILITY', 'A13': 'ACCOUNTABILITY', 'A14': 'ACCOUNTABILITY', 'A15': 'ACCOUNTABILITY'
      };

      // Merge database map with legacy map (database takes precedence)
      Object.assign(principleMap, legacyMap);

      principlesData = {
        principles: {
          TRANSPARENCY: { answers: {}, risks: {} },
          'HUMAN AGENCY & OVERSIGHT': { answers: {}, risks: {} },
          'TECHNICAL ROBUSTNESS & SAFETY': { answers: {}, risks: {} },
          'PRIVACY & DATA GOVERNANCE': { answers: {}, risks: {} },
          'DIVERSITY, NON-DISCRIMINATION & FAIRNESS': { answers: {}, risks: {} },
          'SOCIETAL & INTERPERSONAL WELL-BEING': { answers: {}, risks: {} },
          ACCOUNTABILITY: { answers: {}, risks: {} }
        }
      };

      // Organize by principle - handle both question codes and question IDs
      Object.keys(answers).forEach(qId => {
        // Try to find principle by code first, then by looking up the question
        let principle = principleMap[qId];

        // If not found in map, try to find question by ID or code
        if (!principle) {
          const question = allQuestions.find(q => q.code === qId || q._id.toString() === qId);
          if (question) {
            principle = question.principle;
            principleMap[qId] = principle; // Cache it
          }
        }

        if (principle && principlesData.principles[principle]) {
          principlesData.principles[principle].answers[qId] = answers[qId];
        } else {
          // If principle not found, log warning but still save to flat structure
          console.warn(`⚠️ Principle not found for question code: ${qId}, saving to flat structure`);
        }
      });

      Object.keys(risks).forEach(qId => {
        let principle = principleMap[qId];

        // If not found in map, try to find question by ID or code
        if (!principle) {
          const question = allQuestions.find(q => q.code === qId || q._id.toString() === qId);
          if (question) {
            principle = question.principle;
            principleMap[qId] = principle; // Cache it
          }
        }

        if (principle && principlesData.principles[principle]) {
          principlesData.principles[principle].risks[qId] = risks[qId];
        }
      });
    }

    const generalAnswers = await GeneralQuestionsAnswers.findOneAndUpdate(
      { projectId: projectIdObj, userId: userIdObj },
      {
        projectId: projectIdObj,
        userId: userIdObj,
        userRole: userRole || 'unknown',
        ...principlesData,
        answers: answers || {}, // Keep for backward compatibility
        risks: risks || {},     // Keep for backward compatibility
        updatedAt: new Date()
      },
      { new: true, upsert: true, runValidators: true }
    );

    // Also save to responses collection (new system)
    try {
      const Response = require('./models/response');
      const ProjectAssignment = require('./models/projectAssignment');
      const Question = require('./models/question');
      const Questionnaire = require('./models/questionnaire');
      const { ensureAllQuestionsPresent } = require('./services/evaluationService');

      // Get or create assignment
      let assignment = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj });
      if (!assignment) {
        const { createAssignment } = require('./services/evaluationService');
        const role = userRole || 'unknown';
        let questionnaireKey = 'general-v1';
        if (role === 'ethical-expert') questionnaireKey = 'ethical-expert-v1';
        else if (role === 'medical-expert') questionnaireKey = 'medical-expert-v1';
        else if (role === 'technical-expert') questionnaireKey = 'technical-expert-v1';
        else if (role === 'legal-expert') questionnaireKey = 'legal-expert-v1';
        else if (role === 'education-expert') questionnaireKey = 'education-expert-v1';

        const questionnaires = role !== 'any' && questionnaireKey !== 'general-v1'
          ? ['general-v1', questionnaireKey]
          : ['general-v1'];
        assignment = await createAssignment(projectIdObj, userIdObj, role, questionnaires);
      }

      // Separate answers by questionnaire
      const generalAnswersMap = {};
      const roleSpecificAnswersMap = {};
      const roleSpecificRisksMap = {};
      const generalRisksMap = {};

      // Determine role-specific questionnaire key
      const role = userRole || 'unknown';
      let roleQuestionnaireKey = 'general-v1';
      if (role === 'ethical-expert') roleQuestionnaireKey = 'ethical-expert-v1';
      else if (role === 'medical-expert') roleQuestionnaireKey = 'medical-expert-v1';
      else if (role === 'technical-expert') roleQuestionnaireKey = 'technical-expert-v1';
      else if (role === 'legal-expert') roleQuestionnaireKey = 'legal-expert-v1';
      else if (role === 'education-expert') roleQuestionnaireKey = 'education-expert-v1';

      // Get all questions to determine which questionnaire they belong to
      const allGeneralQuestions = await Question.find({ questionnaireKey: 'general-v1' }).select('code').lean();
      const generalCodes = new Set(allGeneralQuestions.map(q => q.code));

      const allRoleQuestions = roleQuestionnaireKey !== 'general-v1'
        ? await Question.find({ questionnaireKey: roleQuestionnaireKey }).select('code').lean()
        : [];
      const roleCodes = new Set(allRoleQuestions.map(q => q.code));

      // Separate answers and risks by questionnaire
      if (flatAnswers) {
        Object.keys(flatAnswers).forEach(qId => {
          if (generalCodes.has(qId)) {
            generalAnswersMap[qId] = flatAnswers[qId];
          } else if (roleCodes.has(qId)) {
            roleSpecificAnswersMap[qId] = flatAnswers[qId];
          }
        });
      }

      if (flatRisks) {
        Object.keys(flatRisks).forEach(qId => {
          if (generalCodes.has(qId)) {
            generalRisksMap[qId] = flatRisks[qId];
          } else if (roleCodes.has(qId)) {
            roleSpecificRisksMap[qId] = flatRisks[qId];
          }
        });
      }

      // Prepare response saving tasks (parallel execution)
      const saveTasks = [];

      // Prepare general-v1 response
      if (Object.keys(generalAnswersMap).length > 0 || Object.keys(generalRisksMap).length > 0) {
        saveTasks.push(async () => {
          const generalQuestionnaire = await Questionnaire.findOne({ key: 'general-v1', isActive: true });
          if (generalQuestionnaire) {
            // Fetch all general questions at once (performance optimization)
            const generalQuestions = await Question.find({ questionnaireKey: 'general-v1' })
              .select('_id code answerType options')
              .lean();
            const generalQuestionMap = new Map(generalQuestions.map(q => [q.code, q]));

            const generalResponseAnswers = [];

            for (const [qId, answerValue] of Object.entries(generalAnswersMap)) {
              const question = generalQuestionMap.get(qId);
              if (question) {
                let score = 0;
                let answerFormat = {};

                if (question.answerType === 'single_choice' && typeof answerValue === 'string') {
                  // Try exact match first
                  let option = question.options?.find(o => o.key === answerValue);

                  // If not found, try case-insensitive and normalize spaces/underscores
                  if (!option) {
                    const normalizedAnswerValue = answerValue.toLowerCase().replace(/\s+/g, '_');
                    option = question.options?.find(o => {
                      const normalizedOptKey = o.key.toLowerCase().replace(/\s+/g, '_');
                      return normalizedOptKey === normalizedAnswerValue ||
                        o.label?.en?.toLowerCase() === answerValue.toLowerCase() ||
                        o.label?.tr?.toLowerCase() === answerValue.toLowerCase();
                    });

                    if (option) {
                      console.log(`⚠️ [DEBUG /api/general-questions] Question ${qId}: Found option using normalized matching. Original: "${answerValue}" → Matched: "${option.key}"`);
                    }
                  }

                  // CRITICAL DEBUG: Log option matching
                  if (!option) {
                    console.error(`❌ [ERROR /api/general-questions] Question ${qId}: No matching option found for answerValue="${answerValue}". Available options: ${question.options?.map(o => `${o.key}(${o.label?.en || o.label?.tr || 'no label'})`).join(', ') || 'none'}`);
                  } else {
                    console.log(`✅ [DEBUG /api/general-questions] Question ${qId}: Found option key="${option.key}", score=${option.score}, answerValue="${answerValue}"`);
                  }

                  // For single_choice: Use risk score if provided (user's manual override), otherwise use option's score
                  const riskScore = generalRisksMap[qId];
                  if (riskScore !== undefined && riskScore !== null && typeof riskScore === 'number' && riskScore >= 0 && riskScore <= 4) {
                    score = riskScore;
                    console.log(`📊 [DEBUG /api/general-questions] Question ${qId}: Using manual risk score=${riskScore} (override option score=${option?.score || 0})`);
                  } else {
                    score = option?.score || 0;
                  }
                  // Use the matched option key, not the original answerValue
                  answerFormat = { choiceKey: option?.key || answerValue };
                } else if (question.answerType === 'open_text') {
                  score = generalRisksMap[qId] !== undefined ? generalRisksMap[qId] : 0;
                  answerFormat = { text: answerValue };
                }

                // Calculate answerSeverity from score (0-4 scale → 0-1 scale)
                // score 4=best → severity 0 (safe), score 0=worst → severity 1 (critical)
                const answerSeverity = score !== undefined && score !== null
                  ? (4 - score) / 4
                  : null;

                generalResponseAnswers.push({
                  questionId: question._id,
                  questionCode: question.code,
                  answer: answerFormat,
                  score: score,
                  answerSeverity: answerSeverity,
                  notes: null,
                  evidence: []
                });
              }
            }

            // Ensure all questions are present (merge with existing or create new)
            // ensureAllQuestionsPresent is already required at the top of the try block (line 1378)
            await ensureAllQuestionsPresent(projectIdObj, userIdObj, 'general-v1');

            // Now update with answered questions
            const existingResponse = await Response.findOne({
              projectId: projectIdObj,
              userId: userIdObj,
              questionnaireKey: 'general-v1'
            });

            if (existingResponse) {
              // Merge answered questions with existing response
              const answerMap = new Map(generalResponseAnswers.map(a => [a.questionCode, a]));
              // Get existing codes BEFORE updating answers
              const existingCodes = new Set(existingResponse.answers.map(a => a.questionCode));

              // Update existing answers
              existingResponse.answers = existingResponse.answers.map(existingAnswer => {
                const updatedAnswer = answerMap.get(existingAnswer.questionCode);
                return updatedAnswer || existingAnswer; // Use updated answer if available, otherwise keep existing
              });

              // Add any new answers that weren't in existing response
              generalResponseAnswers.forEach(newAnswer => {
                if (!existingCodes.has(newAnswer.questionCode)) {
                  existingResponse.answers.push(newAnswer);
                }
              });

              existingResponse.status = 'draft';
              existingResponse.updatedAt = new Date();
              await existingResponse.save();
              console.log(`✅ Updated general response with ${generalResponseAnswers.length} answered questions`);
            } else {
              // Create new response (shouldn't happen if ensureAllQuestionsPresent worked)
              await Response.create({
                projectId: projectIdObj,
                assignmentId: assignment._id,
                userId: userIdObj,
                role: role,
                questionnaireKey: 'general-v1',
                questionnaireVersion: generalQuestionnaire.version,
                answers: generalResponseAnswers,
                status: 'draft',
                updatedAt: new Date()
              });
              console.log(`✅ Created general response with ${generalResponseAnswers.length} answered questions`);
            }

            // Compute scores async (non-blocking)
            setImmediate(async () => {
              try {
                const { computeScores } = require('./services/evaluationService');
                await computeScores(projectIdObj, userIdObj, 'general-v1');
                console.log(`✅ Computed scores for general-v1`);
              } catch (scoreError) {
                console.error(`⚠️ Error computing scores for general-v1:`, scoreError.message);
              }
            });
          }
        });
      }

      // Prepare role-specific response
      if (roleQuestionnaireKey !== 'general-v1' && (Object.keys(roleSpecificAnswersMap).length > 0 || Object.keys(roleSpecificRisksMap).length > 0)) {
        saveTasks.push(async () => {
          try {
            // ensureAllQuestionsPresent is already required at the top of the try block (line 1378)
            const roleQuestionnaire = await Questionnaire.findOne({ key: roleQuestionnaireKey, isActive: true });
            if (roleQuestionnaire) {
              // Fetch all role-specific questions at once (performance optimization)
              const roleQuestions = await Question.find({ questionnaireKey: roleQuestionnaireKey })
                .select('_id code answerType options')
                .lean();
              const roleQuestionMap = new Map(roleQuestions.map(q => [q.code, q]));

              const roleResponseAnswers = [];

              for (const [qId, answerValue] of Object.entries(roleSpecificAnswersMap)) {
                const question = roleQuestionMap.get(qId);
                if (question) {
                  let score = 0;
                  let answerFormat = {};

                  if (question.answerType === 'single_choice' && typeof answerValue === 'string') {
                    // Try exact match first
                    let option = question.options?.find(o => o.key === answerValue);

                    // If not found, try case-insensitive and normalize spaces/underscores
                    if (!option) {
                      const normalizedAnswerValue = answerValue.toLowerCase().replace(/\s+/g, '_');
                      option = question.options?.find(o => {
                        const normalizedOptKey = o.key.toLowerCase().replace(/\s+/g, '_');
                        return normalizedOptKey === normalizedAnswerValue ||
                          o.label?.en?.toLowerCase() === answerValue.toLowerCase() ||
                          o.label?.tr?.toLowerCase() === answerValue.toLowerCase();
                      });

                      if (option) {
                        console.log(`⚠️ [DEBUG /api/general-questions] Question ${qId}: Found option using normalized matching. Original: "${answerValue}" → Matched: "${option.key}"`);
                      }
                    }

                    // CRITICAL DEBUG: Log option matching
                    if (!option) {
                      console.error(`❌ [ERROR /api/general-questions] Question ${qId}: No matching option found for answerValue="${answerValue}". Available options: ${question.options?.map(o => `${o.key}(${o.label?.en || o.label?.tr || 'no label'})`).join(', ') || 'none'}`);
                    } else {
                      console.log(`✅ [DEBUG /api/general-questions] Question ${qId}: Found option key="${option.key}", score=${option.score}, answerValue="${answerValue}"`);
                    }

                    // For single_choice: Use risk score if provided (user's manual override), otherwise use option's score
                    const riskScore = roleSpecificRisksMap[qId];
                    if (riskScore !== undefined && riskScore !== null && typeof riskScore === 'number' && riskScore >= 0 && riskScore <= 4) {
                      score = riskScore;
                      console.log(`📊 [DEBUG /api/general-questions] Question ${qId}: Using manual risk score=${riskScore} (override option score=${option?.score || 0})`);
                    } else {
                      score = option?.score || 0;
                    }
                    // Use the matched option key, not the original answerValue
                    answerFormat = { choiceKey: option?.key || answerValue };
                  } else if (question.answerType === 'open_text') {
                    score = roleSpecificRisksMap[qId] !== undefined ? roleSpecificRisksMap[qId] : 0;
                    answerFormat = { text: answerValue };
                  }

                  // Calculate answerSeverity from score (0-4 scale → 0-1 scale)
                  // score 4=best → severity 0 (safe), score 0=worst → severity 1 (critical)
                  const answerSeverity = score !== undefined && score !== null
                    ? (4 - score) / 4
                    : null;

                  roleResponseAnswers.push({
                    questionId: question._id,
                    questionCode: question.code,
                    answer: answerFormat,
                    score: score,
                    answerSeverity: answerSeverity,
                    notes: null,
                    evidence: []
                  });
                }
              }

              // Ensure all questions are present (merge with existing or create new)
              console.log(`🔄 Ensuring all questions present for ${roleQuestionnaireKey}...`);
              await ensureAllQuestionsPresent(projectIdObj, userIdObj, roleQuestionnaireKey);
              console.log(`✅ All questions ensured for ${roleQuestionnaireKey}`);

              // Now update with answered questions
              const existingRoleResponse = await Response.findOne({
                projectId: projectIdObj,
                userId: userIdObj,
                questionnaireKey: roleQuestionnaireKey
              });

              if (existingRoleResponse) {
                // Merge answered questions with existing response
                const roleAnswerMap = new Map(roleResponseAnswers.map(a => [a.questionCode, a]));
                // Get existing codes BEFORE updating answers
                const existingRoleCodes = new Set(existingRoleResponse.answers.map(a => a.questionCode));

                // Update existing answers
                existingRoleResponse.answers = existingRoleResponse.answers.map(existingAnswer => {
                  const updatedAnswer = roleAnswerMap.get(existingAnswer.questionCode);
                  return updatedAnswer || existingAnswer; // Use updated answer if available, otherwise keep existing
                });

                // Add any new answers that weren't in existing response
                roleResponseAnswers.forEach(newAnswer => {
                  if (!existingRoleCodes.has(newAnswer.questionCode)) {
                    existingRoleResponse.answers.push(newAnswer);
                  }
                });

                existingRoleResponse.status = 'draft';
                existingRoleResponse.updatedAt = new Date();
                await existingRoleResponse.save();
                console.log(`✅ Updated ${roleQuestionnaireKey} response with ${roleResponseAnswers.length} answered questions`);
              } else {
                // Create new response (shouldn't happen if ensureAllQuestionsPresent worked)
                await Response.create({
                  projectId: projectIdObj,
                  assignmentId: assignment._id,
                  userId: userIdObj,
                  role: role,
                  questionnaireKey: roleQuestionnaireKey,
                  questionnaireVersion: roleQuestionnaire.version,
                  answers: roleResponseAnswers,
                  status: 'draft',
                  updatedAt: new Date()
                });
                console.log(`✅ Created ${roleQuestionnaireKey} response with ${roleResponseAnswers.length} answered questions`);
              }

              // Compute scores async (non-blocking)
              setImmediate(async () => {
                try {
                  const { computeScores } = require('./services/evaluationService');
                  await computeScores(projectIdObj, userIdObj, roleQuestionnaireKey);
                  console.log(`✅ Computed scores for ${roleQuestionnaireKey}`);
                } catch (scoreError) {
                  console.error(`⚠️ Error computing scores for ${roleQuestionnaireKey}:`, scoreError.message);
                }
              });
            } else {
              console.warn(`⚠️ Role questionnaire ${roleQuestionnaireKey} not found`);
            }
          } catch (error) {
            console.error(`⚠️ Error saving role-specific response for ${roleQuestionnaireKey}:`, error.message);
            console.error(`⚠️ Error stack:`, error.stack);
            // Don't throw - allow other saves to continue
          }
        });
      }

      // Execute all save tasks in parallel
      if (saveTasks.length > 0) {
        await Promise.all(saveTasks.map(task => task()));
      }
    } catch (responseError) {
      // Log error but don't fail the request - old system still works
      console.error('⚠️ Error saving to responses collection (non-critical):', responseError.message);
    }

    res.json(generalAnswers);
  } catch (err) {
    console.error('Error saving general questions:', err);
    res.status(500).json({ error: err.message || 'Failed to save general questions' });
  }
});

app.get('/api/general-questions', async (req, res) => {
  try {
    const { projectId, userId } = req.query;

    // Convert string IDs to ObjectId if needed
    const projectIdObj = isValidObjectId(projectId)
      ? new mongoose.Types.ObjectId(projectId)
      : projectId;
    const userIdObj = isValidObjectId(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    // Get user role to determine which questionnaires to fetch
    const user = await User.findById(userIdObj).select('role').lean();
    const role = user?.role || 'any';

    // Determine role-specific questionnaire key
    let roleQuestionnaireKey = 'general-v1';
    if (role === 'ethical-expert') roleQuestionnaireKey = 'ethical-expert-v1';
    else if (role === 'medical-expert') roleQuestionnaireKey = 'medical-expert-v1';
    else if (role === 'technical-expert') roleQuestionnaireKey = 'technical-expert-v1';
    else if (role === 'legal-expert') roleQuestionnaireKey = 'legal-expert-v1';
    else if (role === 'education-expert') roleQuestionnaireKey = 'education-expert-v1';

    // Get questionnaires to fetch (general-v1 + role-specific if applicable)
    const questionnairesToFetch = role !== 'any' && roleQuestionnaireKey !== 'general-v1'
      ? ['general-v1', roleQuestionnaireKey]
      : ['general-v1'];

    // Fetch from old GeneralQuestionsAnswers collection (for backward compatibility)
    const generalAnswers = await GeneralQuestionsAnswers.findOne({
      projectId: projectIdObj,
      userId: userIdObj
    });

    // Fetch from new Response collection for all relevant questionnaires
    const Response = require('./models/response');
    const Question = require('./models/question');

    // OPTIMIZATION: Don't populate - use questionCode directly from Response (already stored)
    const responses = await Response.find({
      projectId: projectIdObj,
      userId: userIdObj,
      questionnaireKey: { $in: questionnairesToFetch }
    })
      .select('questionnaireKey answers.questionCode answers.answer answers.score')
      .lean();

    // Merge answers from Response collection
    const mergedAnswers = {};
    const mergedRisks = {};
    const mergedPrinciples = {};

    // First, add answers from old collection (for backward compatibility)
    if (generalAnswers) {
      if (generalAnswers.principles) {
        Object.assign(mergedPrinciples, generalAnswers.principles);
      }
      if (generalAnswers.answers) {
        Object.assign(mergedAnswers, generalAnswers.answers);
      }
      if (generalAnswers.risks) {
        Object.assign(mergedRisks, generalAnswers.risks);
      }
    }

    // OPTIMIZATION: Collect question codes to fetch principles in one query (only if needed)
    const questionCodes = new Set();
    const answerEntries = [];

    for (const response of responses) {
      if (!response.answers || !Array.isArray(response.answers)) continue;

      for (const answerEntry of response.answers) {
        if (!answerEntry.questionCode) continue;

        questionCodes.add(answerEntry.questionCode);
        answerEntries.push({ answerEntry, questionnaireKey: response.questionnaireKey });
      }
    }

    // OPTIMIZATION: Fetch questions only for principle organization (if needed)
    const questionsMap = new Map();
    if (questionCodes.size > 0) {
      const questions = await Question.find({
        code: { $in: Array.from(questionCodes) },
        questionnaireKey: { $in: questionnairesToFetch }
      })
        .select('code principle')
        .lean();

      for (const question of questions) {
        questionsMap.set(question.code, question);
      }
    }

    // Then, add/override with answers from Response collection (new architecture)
    for (const { answerEntry, questionnaireKey } of answerEntries) {
      // Use questionCode directly (already stored in Response - no populate needed)
      const questionCode = answerEntry.questionCode;

      if (!questionCode) continue;

      // Extract answer value
      let answerValue = null;
      if (answerEntry.answer) {
        if (answerEntry.answer.text) {
          answerValue = answerEntry.answer.text;
        } else if (answerEntry.answer.choiceKey) {
          answerValue = answerEntry.answer.choiceKey;
        } else if (answerEntry.answer.multiChoiceKeys) {
          answerValue = Array.isArray(answerEntry.answer.multiChoiceKeys)
            ? answerEntry.answer.multiChoiceKeys.join(', ')
            : answerEntry.answer.multiChoiceKeys;
        }
      }

      // Store answer by code
      if (answerValue) {
        mergedAnswers[questionCode] = answerValue;
      }

      // Extract risk score
      if (answerEntry.score !== undefined && answerEntry.score !== null) {
        const riskScore = typeof answerEntry.score === 'number' ? answerEntry.score : parseInt(answerEntry.score);
        if (riskScore >= 0 && riskScore <= 4) {
          mergedRisks[questionCode] = riskScore;
        }
      }

      // Organize by principle if we have question data
      const question = questionsMap.get(questionCode);
      if (question && question.principle) {
        if (!mergedPrinciples[question.principle]) {
          mergedPrinciples[question.principle] = { answers: {}, risks: {} };
        }
        if (answerValue) {
          mergedPrinciples[question.principle].answers[questionCode] = answerValue;
        }
        if (answerEntry.score !== undefined && answerEntry.score !== null) {
          const riskScore = typeof answerEntry.score === 'number' ? answerEntry.score : parseInt(answerEntry.score);
          if (riskScore >= 0 && riskScore <= 4) {
            mergedPrinciples[question.principle].risks[questionCode] = riskScore;
          }
        }
      }
    }

    // Return the merged result
    const result = {
      _id: generalAnswers?._id || null,
      projectId: projectIdObj,
      userId: userIdObj,
      userRole: generalAnswers?.userRole || role,
      principles: mergedPrinciples,
      answers: mergedAnswers, // Keep for backward compatibility
      risks: mergedRisks,     // Keep for backward compatibility
      updatedAt: generalAnswers?.updatedAt || new Date()
    };

    res.json(result);
  } catch (err) {
    console.error('Error loading general questions:', err);
    res.status(500).json({ error: err.message || 'Failed to load general questions' });
  }
});

// Get all general questions answers for a project (grouped by role)
app.get('/api/general-questions/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const allAnswers = await GeneralQuestionsAnswers.find({ projectId }).populate('userId', 'name email role');
    res.json(allAnswers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user progress based on responses collection (FAST path)
// This endpoint is used frequently by the UI and should stay lightweight.
app.get('/api/user-progress', async (req, res) => {
  try {
    const { projectId, userId } = req.query;
    if (!projectId || !userId) {
      return res.status(400).json({ error: 'projectId and userId are required' });
    }

    const Response = require('./models/response');
    const Question = require('./models/question');
    const ProjectAssignment = require('./models/projectAssignment');

    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const assignment = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj }).lean();
    if (!assignment) {
      return res.json({ progress: 0, answered: 0, total: 0, error: 'No assignment found' });
    }

    // Prefer assigned questionnaires from assignment; keep it cheap (no DB probing).
    let assignedQuestionnaireKeys = Array.isArray(assignment.questionnaires) ? assignment.questionnaires.slice() : [];

    /**
     * CRITICAL FIX: Do NOT auto-include 'general-v1' if not assigned.
     * Progress must reflect exactly what is assigned to the user.
     * 
     * if (!assignedQuestionnaireKeys.includes('general-v1')) {
     *   assignedQuestionnaireKeys.unshift('general-v1');
     * }
     */

    // If questionnaires are empty, derive from role (best-effort).
    if (assignedQuestionnaireKeys.length === 0 || (assignedQuestionnaireKeys.length === 1 && assignedQuestionnaireKeys[0] === 'general-v1')) {
      const role = String(assignment.role || '').toLowerCase();
      const roleMap = {
        'ethical-expert': 'ethical-expert-v1',
        'medical-expert': 'medical-expert-v1',
        'technical-expert': 'technical-expert-v1',
        'legal-expert': 'legal-expert-v1',
        'education-expert': 'education-expert-v1',
      };
      const roleKey = roleMap[role] || null;
      if (roleKey && !assignedQuestionnaireKeys.includes(roleKey)) {
        assignedQuestionnaireKeys.push(roleKey);
      }
    }

    // FIX: Fetch keys of ALL questionnaires the user has actually answered
    // This catches "implicit assignments" (e.g. Set-Up answered but not assigned)
    // We only care if there are actual answers in the 'answers' array
    const distinctResponseKeys = await Response.find({
      projectId: projectIdObj,
      userId: userIdObj,
      'answers.0': { $exists: true }
    }).distinct('questionnaireKey');

    // Add 'general-v1' if user has answered it
    if (distinctResponseKeys.includes('general-v1') && !assignedQuestionnaireKeys.includes('general-v1')) {
      assignedQuestionnaireKeys.push('general-v1');
      // console.log('➕ Added implicit general-v1 to assigned questionnaires');
    }

    // Attempt to detect role-specific questionnaire from actual answers
    const userRole = assignment.role || (await User.findById(userIdObj))?.role;
    if (userRole) {
      const roleMap = {
        'ethical-expert': 'ethical-expert-v1',
        'medical-expert': 'medical-expert-v1',
        'technical-expert': 'technical-expert-v1',
        'legal-expert': 'legal-expert-v1',
        'education-expert': 'education-expert-v1',
      };
      const potentialRoleKey = roleMap[String(userRole).toLowerCase()];

      if (potentialRoleKey && distinctResponseKeys.includes(potentialRoleKey) && !assignedQuestionnaireKeys.includes(potentialRoleKey)) {
        assignedQuestionnaireKeys.push(potentialRoleKey);
        // console.log(`➕ Added implicit role questionnaire ${potentialRoleKey} to assigned questionnaires`);
      }
    }

    let questionnairesToCount = assignedQuestionnaireKeys.slice();

    const totalQuestions = await Question.countDocuments({
      questionnaireKey: { $in: questionnairesToCount }
    });

    if (totalQuestions === 0) {
      return res.json({ progress: 0, answered: 0, total: 0, questionnaires: assignedQuestionnaireKeys, responseCount: 0 });
    }

    // Fetch responses for ALL assigned questionnaires (not just questionnairesToCount)
    // questionnairesToCount is only for question count, but we need to fetch all responses
    const responses = await Response.find({
      projectId: projectIdObj,
      userId: userIdObj,
      questionnaireKey: { $in: assignedQuestionnaireKeys }
    }).select('questionnaireKey answers.questionCode answers.questionId answers.answer answers.score').lean();

    const answeredKeys = new Set();

    for (const r of (responses || [])) {
      const qKey = r.questionnaireKey;
      const arr = Array.isArray(r.answers) ? r.answers : [];
      for (const a of arr) {
        const idKey = a?.questionId ? String(a.questionId) : '';
        const codeKey = a?.questionCode !== undefined && a?.questionCode !== null ? String(a.questionCode).trim() : '';
        const key = idKey.length > 0 ? idKey : (codeKey.length > 0 ? `${qKey}:${codeKey}` : '');
        if (!key || answeredKeys.has(key)) continue;

        let hasAnswer = false;
        if (a?.answer) {
          if (a.answer.choiceKey !== null && a.answer.choiceKey !== undefined && a.answer.choiceKey !== '') hasAnswer = true;
          else if (a.answer.text !== null && a.answer.text !== undefined && String(a.answer.text).trim().length > 0) hasAnswer = true;
          else if (a.answer.numeric !== null && a.answer.numeric !== undefined) hasAnswer = true;
          else if (Array.isArray(a.answer.multiChoiceKeys) && a.answer.multiChoiceKeys.length > 0) hasAnswer = true;
        } else if (a.choiceKey || (a.text && String(a.text).trim().length > 0) || a.numeric !== undefined || (Array.isArray(a.multiChoiceKeys) && a.multiChoiceKeys.length > 0)) {
          // Backward compatibility: direct fields
          hasAnswer = true;
        }

        if (hasAnswer) answeredKeys.add(key);
      }
    }

    // Also check custom questions from Evaluation
    const evaluation = await Evaluation.findOne({
      projectId: projectIdObj,
      userId: userIdObj
    }).select('customQuestions answers').lean();

    const customQuestions = evaluation?.customQuestions || [];
    let customQuestionsTotal = 0;
    let customQuestionsAnswered = 0;

    for (const customQuestion of customQuestions) {
      if (customQuestion.required !== false) {
        customQuestionsTotal++;
        const customQuestionId = customQuestion.id;
        if (customQuestionId && evaluation?.answers) {
          const customAnswer = evaluation.answers[customQuestionId];
          if (customAnswer !== undefined && customAnswer !== null) {
            if (typeof customAnswer === 'string' && customAnswer.trim().length > 0) {
              customQuestionsAnswered++;
            } else if (typeof customAnswer !== 'string') {
              customQuestionsAnswered++;
            }
          }
        }
      }
    }

    // Total = regular questions + custom questions
    const totalWithCustom = totalQuestions + customQuestionsTotal;
    const answeredWithCustom = answeredKeys.size + customQuestionsAnswered;
    const progress = totalWithCustom > 0 ? Math.round((answeredWithCustom / totalWithCustom) * 100) : 0;

    return res.json({
      progress: Math.max(0, Math.min(100, progress)),
      answered: answeredWithCustom,
      total: totalWithCustom,
      regularAnswered: answeredKeys.size,
      regularTotal: totalQuestions,
      customAnswered: customQuestionsAnswered,
      customTotal: customQuestionsTotal,
      questionnaires: assignedQuestionnaireKeys,
      responseCount: responses.length
    });
  } catch (err) {
    console.error('Error calculating user progress:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user progress based on responses collection (DEBUG/SYNC path)
// Heavy diagnostics and auto-repair logic lives here by design.
app.get('/api/user-progress/debug', async (req, res) => {
  try {
    const { projectId, userId } = req.query;
    if (!projectId || !userId) {
      return res.status(400).json({ error: 'projectId and userId are required' });
    }

    const Response = require('./models/response');
    const Question = require('./models/question');
    const ProjectAssignment = require('./models/projectAssignment');
    // User model is already defined at the top of the file

    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    console.log(`🔍 Progress request: projectId=${projectId}, userId=${userId}`);

    // Get user's assignment to determine questionnaires
    const assignment = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj });
    if (!assignment) {
      console.warn(`⚠️ No assignment found for projectId=${projectId}, userId=${userId}`);
      return res.json({ progress: 0, answered: 0, total: 0, error: 'No assignment found' });
    }

    console.log(`📋 Assignment found: role=${assignment.role}, questionnaires=${JSON.stringify(assignment.questionnaires || [])}`);

    // Get assigned questionnaire keys from assignment (use what's actually assigned)
    // Also ensure general-v1 is included if not already present
    let assignedQuestionnaireKeys = assignment.questionnaires || [];

    // If no questionnaires assigned, try to determine from role
    if (assignedQuestionnaireKeys.length === 0) {
      const user = await User.findById(userIdObj);
      const role = user?.role || 'unknown';

      // Map role to questionnaire key (support both formats: ethical-v1 and ethical-expert-v1)
      // Try both formats to match what's actually in the database
      let roleQuestionnaireKey = null;
      if (role === 'ethical-expert') {
        // Try both formats
        const ethicalV1 = await Question.findOne({ questionnaireKey: 'ethical-v1' });
        const ethicalExpertV1 = await Question.findOne({ questionnaireKey: 'ethical-expert-v1' });
        roleQuestionnaireKey = ethicalV1 ? 'ethical-v1' : (ethicalExpertV1 ? 'ethical-expert-v1' : 'ethical-v1');
      } else if (role === 'medical-expert') {
        const medicalV1 = await Question.findOne({ questionnaireKey: 'medical-v1' });
        const medicalExpertV1 = await Question.findOne({ questionnaireKey: 'medical-expert-v1' });
        roleQuestionnaireKey = medicalV1 ? 'medical-v1' : (medicalExpertV1 ? 'medical-expert-v1' : 'medical-v1');
      } else if (role === 'technical-expert') {
        const technicalV1 = await Question.findOne({ questionnaireKey: 'technical-v1' });
        const technicalExpertV1 = await Question.findOne({ questionnaireKey: 'technical-expert-v1' });
        roleQuestionnaireKey = technicalV1 ? 'technical-v1' : (technicalExpertV1 ? 'technical-expert-v1' : 'technical-v1');
      } else if (role === 'legal-expert') {
        const legalV1 = await Question.findOne({ questionnaireKey: 'legal-v1' });
        const legalExpertV1 = await Question.findOne({ questionnaireKey: 'legal-expert-v1' });
        roleQuestionnaireKey = legalV1 ? 'legal-v1' : (legalExpertV1 ? 'legal-expert-v1' : 'legal-v1');
      } else if (role === 'education-expert') {
        const educationV1 = await Question.findOne({ questionnaireKey: 'education-v1' });
        const educationExpertV1 = await Question.findOne({ questionnaireKey: 'education-expert-v1' });
        roleQuestionnaireKey = educationV1 ? 'education-v1' : (educationExpertV1 ? 'education-expert-v1' : 'education-expert-v1');
      }

      if (roleQuestionnaireKey) {
        assignedQuestionnaireKeys = ['general-v1', roleQuestionnaireKey];
      } else {
        assignedQuestionnaireKeys = ['general-v1'];
      }
    } else {
      // Ensure general-v1 is always included
      if (!assignedQuestionnaireKeys.includes('general-v1')) {
        assignedQuestionnaireKeys = ['general-v1', ...assignedQuestionnaireKeys];
      }

      // Also check if role-specific questionnaire exists in database and add if missing
      const user = await User.findById(userIdObj);
      const role = user?.role || 'unknown';

      // Check if role-specific questionnaire is in the list, if not try to add it
      const hasRoleQuestionnaire = assignedQuestionnaireKeys.some(key =>
        (role === 'ethical-expert' && (key === 'ethical-v1' || key === 'ethical-expert-v1')) ||
        (role === 'medical-expert' && (key === 'medical-v1' || key === 'medical-expert-v1')) ||
        (role === 'technical-expert' && (key === 'technical-v1' || key === 'technical-expert-v1')) ||
        (role === 'legal-expert' && (key === 'legal-v1' || key === 'legal-expert-v1')) ||
        (role === 'education-expert' && (key === 'education-v1' || key === 'education-expert-v1'))
      );

      if (!hasRoleQuestionnaire && role !== 'use-case-owner' && role !== 'admin') {
        // Try to find which format exists in database
        let roleQuestionnaireKey = null;
        if (role === 'ethical-expert') {
          const ethicalV1 = await Question.findOne({ questionnaireKey: 'ethical-v1' });
          const ethicalExpertV1 = await Question.findOne({ questionnaireKey: 'ethical-expert-v1' });
          roleQuestionnaireKey = ethicalV1 ? 'ethical-v1' : (ethicalExpertV1 ? 'ethical-expert-v1' : null);
        } else if (role === 'medical-expert') {
          const medicalV1 = await Question.findOne({ questionnaireKey: 'medical-v1' });
          const medicalExpertV1 = await Question.findOne({ questionnaireKey: 'medical-expert-v1' });
          roleQuestionnaireKey = medicalV1 ? 'medical-v1' : (medicalExpertV1 ? 'medical-expert-v1' : null);
        } else if (role === 'technical-expert') {
          const technicalV1 = await Question.findOne({ questionnaireKey: 'technical-v1' });
          const technicalExpertV1 = await Question.findOne({ questionnaireKey: 'technical-expert-v1' });
          roleQuestionnaireKey = technicalV1 ? 'technical-v1' : (technicalExpertV1 ? 'technical-expert-v1' : null);
        } else if (role === 'legal-expert') {
          const legalV1 = await Question.findOne({ questionnaireKey: 'legal-v1' });
          const legalExpertV1 = await Question.findOne({ questionnaireKey: 'legal-expert-v1' });
          roleQuestionnaireKey = legalV1 ? 'legal-v1' : (legalExpertV1 ? 'legal-expert-v1' : null);
        } else if (role === 'education-expert') {
          const educationV1 = await Question.findOne({ questionnaireKey: 'education-v1' });
          const educationExpertV1 = await Question.findOne({ questionnaireKey: 'education-expert-v1' });
          roleQuestionnaireKey = educationV1 ? 'education-v1' : (educationExpertV1 ? 'education-expert-v1' : null);
        }

        if (roleQuestionnaireKey && !assignedQuestionnaireKeys.includes(roleQuestionnaireKey)) {
          assignedQuestionnaireKeys.push(roleQuestionnaireKey);
          // Also update the assignment in database to persist this change
          try {
            await ProjectAssignment.findOneAndUpdate(
              { projectId: projectIdObj, userId: userIdObj },
              { $set: { questionnaires: assignedQuestionnaireKeys } },
              { new: true }
            );
            console.log(`✅ Updated assignment with missing questionnaire: ${roleQuestionnaireKey}`);
          } catch (updateError) {
            console.warn(`⚠️ Failed to update assignment with questionnaire ${roleQuestionnaireKey}:`, updateError.message);
          }
        }
      }
    }

    console.log(`📋 Assigned questionnaires: ${assignedQuestionnaireKeys.join(', ')}`);

    // Fetch assigned questions (for total + missing-code reporting + optional sync)
    const assignedQuestions = await Question.find({
      questionnaireKey: { $in: assignedQuestionnaireKeys }
    }).select('_id code questionnaireKey answerType options').lean();

    if (!assignedQuestions || assignedQuestions.length === 0) {
      return res.json({ progress: 0, answered: 0, total: 0 });
    }

    // Total should be based on a stable unique identifier. Use question _id to avoid
    // collisions when questionCode overlaps across questionnaires (e.g., T1/T2).
    const getQuestionKey = (q) => (q?._id ? String(q._id) : '');

    const totalKeysSet = new Set(assignedQuestions.map(getQuestionKey).filter(Boolean));
    const totalQuestions = totalKeysSet.size;

    if (totalQuestions === 0) {
      return res.json({ progress: 0, answered: 0, total: 0 });
    }

    console.log(`📊 Total assigned questions: ${totalQuestions}`);

    const byCode = new Map();
    const byId = new Map();
    assignedQuestions.forEach((q) => {
      const c = q?.code !== undefined && q?.code !== null ? String(q.code).trim() : '';
      if (c.length > 0) byCode.set(c, q);
      if (q?._id) byId.set(String(q._id), q);
    });

    // Get responses for all assigned questionnaires
    let responses = await Response.find({
      projectId: projectIdObj,
      userId: userIdObj,
      questionnaireKey: { $in: assignedQuestionnaireKeys }
    }).select('answers questionnaireKey').lean();

    console.log(`📦 Found ${responses.length} response documents`);

    // Count answered questions using the same logic as /projects/:projectId/progress
    // A question is answered if:
    // - choice: answer.choiceKey exists
    // - text: answer.text exists and trimmed length > 0
    // - numeric: answer.numeric is not null
    // - multiChoice: answer.multiChoiceKeys exists and has length > 0
    // IMPORTANT: score=0 is valid and should be treated as answered

    const countAnsweredFromResponses = (respDocs) => {
      const answered = new Set();

      console.log(`🔍 Analyzing ${respDocs.length} response documents for answered questions...`);

      respDocs.forEach((response, responseIndex) => {
        console.log(`📋 Response ${responseIndex + 1}: questionnaireKey=${response.questionnaireKey}, answers.length=${response.answers?.length || 0}`);

        if (response.answers && Array.isArray(response.answers)) {
          response.answers.forEach((answer, answerIndex) => {
            const idKey = answer?.questionId ? String(answer.questionId) : '';
            const codeKey = answer?.questionCode !== undefined && answer?.questionCode !== null ? String(answer.questionCode).trim() : '';
            // Prefer questionId; fallback to questionnaireKey:code if needed
            const key = idKey.length > 0 ? idKey : (codeKey.length > 0 ? `${response.questionnaireKey}:${codeKey}` : '');

            if (!key) {
              console.log(`⚠️ Answer entry ${answerIndex} missing questionCode and questionId:`, JSON.stringify(answer));
              return; // Skip entries without any identifier
            }

            // Check if already counted (avoid duplicates)
            if (answered.has(key)) {
              console.log(`⚠️ Duplicate answer key detected: ${key}, skipping`);
              return;
            }

            // Debug: log the answer structure
            console.log(`🔍 Checking answer for ${key}:`, {
              hasAnswer: !!answer.answer,
              answerType: typeof answer.answer,
              answerValue: answer.answer,
              score: answer.score,
              fullAnswer: JSON.stringify(answer).substring(0, 200)
            });

            // Check if answer has content
            // Handle case where answer.answer might be null, undefined, or an empty object
            // Also handle case where answer might be stored directly (not nested in answer.answer)
            let hasAnswer = false;

            // First check if answer.answer exists and has content
            if (answer.answer) {
              // Check for choiceKey
              if (answer.answer.choiceKey !== null && answer.answer.choiceKey !== undefined && answer.answer.choiceKey !== '') {
                hasAnswer = true;
                console.log(`  ✅ Found choiceKey: ${answer.answer.choiceKey}`);
              }
              // Check for text
              else if (answer.answer.text !== null && answer.answer.text !== undefined && String(answer.answer.text).trim().length > 0) {
                hasAnswer = true;
                console.log(`  ✅ Found text: ${String(answer.answer.text).substring(0, 50)}...`);
              }
              // Check for numeric
              else if (answer.answer.numeric !== null && answer.answer.numeric !== undefined) {
                hasAnswer = true;
                console.log(`  ✅ Found numeric: ${answer.answer.numeric}`);
              }
              // Check for multiChoiceKeys
              else if (answer.answer.multiChoiceKeys && Array.isArray(answer.answer.multiChoiceKeys) && answer.answer.multiChoiceKeys.length > 0) {
                hasAnswer = true;
                console.log(`  ✅ Found multiChoiceKeys: ${answer.answer.multiChoiceKeys.join(', ')}`);
              } else {
                console.log(`  ❌ No valid answer content found in answer.answer:`, JSON.stringify(answer.answer));
              }
            }
            // Fallback: check if answer fields exist directly on answer object (for backward compatibility)
            else if (answer.choiceKey || (answer.text && String(answer.text).trim().length > 0) || answer.numeric !== undefined || (answer.multiChoiceKeys && Array.isArray(answer.multiChoiceKeys) && answer.multiChoiceKeys.length > 0)) {
              hasAnswer = true;
              console.log(`  ✅ Found answer in direct fields (backward compatibility)`);
            }
            else {
              console.log(`  ❌ answer.answer is null/undefined and no direct answer fields found for ${key}`);
            }

            if (hasAnswer) {
              answered.add(key);
              console.log(`✅ Counted answered question: ${key} (score: ${answer.score})`);
            } else {
              console.log(`⚠️ Question ${key} not counted as answered`);
            }
          });
        } else {
          console.log(`⚠️ Response ${responseIndex + 1} has no answers array`);
        }
      });

      return answered;
    };

    let answeredQuestionCodes = countAnsweredFromResponses(responses);

    const answeredCount = answeredQuestionCodes.size;
    const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

    console.log(`📊 Progress calculation: ${answeredCount}/${totalQuestions} = ${progress}%`);

    /**
     * If progress isn't 100, attempt a lightweight sync from GeneralQuestionsAnswers -> responses.
     * This fixes cases where UI saved general answers under _id keys or only in general-questions collection.
     * We only patch answers where we can confidently map a key to a Question (by code or _id).
     */
    const trySyncGeneralAnswersToResponses = async () => {
      const doc = await GeneralQuestionsAnswers.findOne({
        projectId: projectIdObj,
        userId: userIdObj
      }).lean();

      if (!doc) return { didSync: false, updatedCount: 0 };

      const flatAnswers = doc.answers || {};
      const flatRisks = doc.risks || {};

      const isValidRisk = (v) => v === 0 || v === 1 || v === 2 || v === 3 || v === 4;

      // Build updates grouped by questionnaireKey -> questionCode
      const updatesByQuestionnaire = new Map(); // questionnaireKey -> Map(code -> {questionId, answer, score?})

      const resolveQuestion = (key) => byCode.get(String(key).trim()) || byId.get(String(key)) || null;

      const coerceAnswer = (question, value) => {
        const t = question?.answerType;
        if (t === 'single_choice') {
          const v = String(value ?? '');
          const opt = (question.options || []).find((o) =>
            o?.key === v ||
            o?.label?.en === v ||
            o?.label?.tr === v ||
            o?.label === v
          );
          return { answer: { choiceKey: opt ? opt.key : v }, optionScore: opt?.score };
        }
        if (t === 'open_text') {
          return { answer: { text: String(value ?? '') } };
        }
        if (t === 'multi_choice') {
          const arr = Array.isArray(value) ? value : [value];
          return { answer: { multiChoiceKeys: arr.map((x) => String(x)) } };
        }
        if (t === 'numeric') {
          const n = Number(value);
          return { answer: { numeric: Number.isFinite(n) ? n : undefined } };
        }
        // fallback: store as text
        return { answer: { text: typeof value === 'string' ? value : JSON.stringify(value) } };
      };

      for (const [key, value] of Object.entries(flatAnswers)) {
        const q = resolveQuestion(key);
        if (!q || !q.questionnaireKey) continue;
        if (!assignedQuestionnaireKeys.includes(q.questionnaireKey)) continue;

        const { answer, optionScore } = coerceAnswer(q, value);

        // Determine score (prefer risk 0-4; else option score; else undefined so we don't overwrite)
        const qCodeTrim = q.code !== undefined && q.code !== null ? String(q.code).trim() : '';
        const qKey = String(q._id);

        const riskVal =
          (qCodeTrim.length > 0 ? flatRisks[qCodeTrim] : undefined) ??
          flatRisks[String(q._id)] ??
          flatRisks[key];

        let scoreToSet = undefined;
        if (isValidRisk(riskVal)) scoreToSet = riskVal;
        else if (typeof optionScore === 'number') scoreToSet = optionScore;

        if (!updatesByQuestionnaire.has(q.questionnaireKey)) {
          updatesByQuestionnaire.set(q.questionnaireKey, new Map());
        }
        updatesByQuestionnaire.get(q.questionnaireKey).set(qKey, {
          questionId: q._id,
          questionCode: qKey,
          answer,
          score: scoreToSet
        });
      }

      if (updatesByQuestionnaire.size === 0) return { didSync: false, updatedCount: 0 };

      let updatedCount = 0;

      for (const [questionnaireKey, updatesMap] of updatesByQuestionnaire.entries()) {
        const responseDoc = await Response.findOne({
          projectId: projectIdObj,
          userId: userIdObj,
          questionnaireKey
        });

        if (!responseDoc) continue;

        let changed = false;
        responseDoc.answers = Array.isArray(responseDoc.answers) ? responseDoc.answers : [];

        // Update existing entries
        responseDoc.answers = responseDoc.answers.map((a) => {
          const aKey = a?.questionId ? String(a.questionId) : '';

          if ((!a.questionCode || String(a.questionCode).trim().length === 0) && a?.questionId) {
            // Repair empty questionCode to stable value (use questionId string)
            a.questionCode = String(a.questionId);
          }

          const upd = aKey ? updatesMap.get(aKey) : null;
          if (!upd) return a;

          // Only update if we have meaningful content
          const newAnswer = upd.answer;
          if (newAnswer && typeof newAnswer === 'object') {
            a.answer = newAnswer;
            changed = true;
          }
          if (upd.score !== undefined && isValidRisk(upd.score)) {
            a.score = upd.score;
            changed = true;
          }
          updatedCount++;
          return a;
        });

        // Add missing entries (rare)
        const existingCodes = new Set(
          responseDoc.answers
            .map((a) => {
              return a?.questionId ? String(a.questionId) : '';
            })
            .filter(Boolean)
        );
        for (const [code, upd] of updatesMap.entries()) {
          if (existingCodes.has(code)) continue;
          responseDoc.answers.push({
            questionId: upd.questionId,
            questionCode: upd.questionCode,
            answer: upd.answer,
            score: isValidRisk(upd.score) ? upd.score : 2,
            notes: null,
            evidence: []
          });
          changed = true;
        }

        if (changed) {
          responseDoc.updatedAt = new Date();
          await responseDoc.save();
        }
      }

      return { didSync: true, updatedCount };
    };

    // If not complete, try sync once then recount
    if (progress < 100) {
      try {
        const syncResult = await trySyncGeneralAnswersToResponses();
        if (syncResult.didSync) {
          responses = await Response.find({
            projectId: projectIdObj,
            userId: userIdObj,
            questionnaireKey: { $in: assignedQuestionnaireKeys }
          }).select('answers questionnaireKey').lean();

          answeredQuestionCodes = countAnsweredFromResponses(responses);
        }
      } catch (syncErr) {
        console.warn('⚠️ Progress auto-sync skipped due to error:', syncErr.message);
      }
    }

    const finalAnsweredCount = answeredQuestionCodes.size;
    const finalProgress = totalQuestions > 0 ? Math.round((finalAnsweredCount / totalQuestions) * 100) : 0;

    // Missing codes (debug-friendly)
    const missingQuestionCodes = Array.from(totalKeysSet).filter((k) => !answeredQuestionCodes.has(k));

    // Data integrity check: log warning if assigned questions != saved answers
    const savedQuestionCodes = new Set();
    responses.forEach(response => {
      if (response.answers && Array.isArray(response.answers)) {
        response.answers.forEach(answer => {
          if (answer.questionCode) {
            savedQuestionCodes.add(answer.questionCode);
          }
        });
      }
    });

    if (savedQuestionCodes.size !== totalQuestions) {
      console.warn(`⚠️ DATA INTEGRITY WARNING: Assigned questions (${totalQuestions}) != saved answers (${savedQuestionCodes.size}) for project ${projectId}, user ${userId}`);
      console.warn(`⚠️ Assigned questionnaires: ${assignedQuestionnaireKeys.join(', ')}`);
      console.warn(`⚠️ Found responses for: ${responses.map(r => r.questionnaireKey).join(', ')}`);
    }

    // Log detailed progress info for debugging
    console.log(`📊 Final progress result: ${finalProgress}% (${finalAnsweredCount} answered out of ${totalQuestions} total questions)`);
    console.log(`📊 Answered question codes: ${Array.from(answeredQuestionCodes).slice(0, 10).join(', ')}${answeredQuestionCodes.size > 10 ? '...' : ''}`);

    res.json({
      progress: Math.max(0, Math.min(100, finalProgress)),
      answered: finalAnsweredCount,
      total: totalQuestions,
      questionnaires: assignedQuestionnaireKeys,
      responseCount: responses.length,
      missingCount: missingQuestionCodes.length,
      missingQuestionCodes: missingQuestionCodes.slice(0, 50) // cap for payload safety
    });
  } catch (err) {
    console.error('Error calculating user progress:', err);
    res.status(500).json({ error: err.message });
  }
});

// Initialize responses for a user (ensures all assigned questions are present)
app.post('/api/responses/initialize', async (req, res) => {
  try {
    const { projectId, userId } = req.body;
    if (!projectId || !userId) {
      return res.status(400).json({ error: 'projectId and userId are required' });
    }

    const ProjectAssignment = require('./models/projectAssignment');
    const { initializeResponses } = require('./services/evaluationService');

    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const assignment = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj });
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await initializeResponses(projectIdObj, userIdObj, assignment.role, assignment.questionnaires || []);

    res.json({
      success: true,
      message: `Initialized responses for ${assignment.questionnaires.length} questionnaires`
    });
  } catch (err) {
    console.error('Error initializing responses:', err);
    res.status(500).json({ error: err.message });
  }
});

// Data integrity check endpoint
app.get('/projects/:projectId/integrity', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    if (!projectId || !userId) {
      return res.status(400).json({ error: 'projectId and userId are required' });
    }

    const Response = require('./models/response');
    const Question = require('./models/question');
    const ProjectAssignment = require('./models/projectAssignment');
    const { initializeResponses } = require('./services/evaluationService');

    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    console.log(`🔍 Integrity check: projectId=${projectId}, userId=${userId}`);

    // Step 1: Get project assignment
    const assignment = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj });
    if (!assignment) {
      return res.status(404).json({
        error: 'Assignment not found',
        totalAssigned: 0,
        totalSavedAnswerEntries: 0,
        missingQuestionnaireKeys: [],
        missingQuestionCodes: [],
        isConsistent: false
      });
    }

    // Step 2: Get assigned questionnaire keys
    const assignedQuestionnaireKeys = assignment.questionnaires || [];
    if (assignedQuestionnaireKeys.length === 0) {
      console.warn(`⚠️ No questionnaires assigned for project ${projectId}, user ${userId}`);
      return res.json({
        totalAssigned: 0,
        totalSavedAnswerEntries: 0,
        missingQuestionnaireKeys: [],
        missingQuestionCodes: [],
        isConsistent: true
      });
    }

    console.log(`📋 Assigned questionnaires: ${assignedQuestionnaireKeys.join(', ')}`);

    // Step 3: Count total assigned questions
    const assignedQuestions = await Question.find({
      questionnaireKey: { $in: assignedQuestionnaireKeys }
    }).select('code questionnaireKey').lean();

    const totalAssigned = assignedQuestions.length;
    console.log(`📊 Total assigned questions: ${totalAssigned}`);

    // Step 4: Get all saved responses
    const responses = await Response.find({
      projectId: projectIdObj,
      userId: userIdObj,
      questionnaireKey: { $in: assignedQuestionnaireKeys }
    }).select('questionnaireKey answers').lean();

    console.log(`📦 Found ${responses.length} response documents`);

    // Step 5: Count total saved answer entries
    let totalSavedAnswerEntries = 0;
    const savedQuestionCodesByQuestionnaire = {};
    const foundQuestionnaireKeys = new Set();

    responses.forEach(response => {
      foundQuestionnaireKeys.add(response.questionnaireKey);
      if (response.answers && Array.isArray(response.answers)) {
        totalSavedAnswerEntries += response.answers.length;
        if (!savedQuestionCodesByQuestionnaire[response.questionnaireKey]) {
          savedQuestionCodesByQuestionnaire[response.questionnaireKey] = new Set();
        }
        response.answers.forEach(answer => {
          if (answer.questionCode) {
            savedQuestionCodesByQuestionnaire[response.questionnaireKey].add(answer.questionCode);
          }
        });
      }
    });

    console.log(`💾 Total saved answer entries: ${totalSavedAnswerEntries}`);

    // Step 6: Find missing questionnaire keys
    const missingQuestionnaireKeys = assignedQuestionnaireKeys.filter(
      key => !foundQuestionnaireKeys.has(key)
    );

    // Step 7: Find missing question codes per questionnaire
    const missingQuestionCodes = [];
    const assignedQuestionsByQuestionnaire = {};

    assignedQuestions.forEach(q => {
      if (!assignedQuestionsByQuestionnaire[q.questionnaireKey]) {
        assignedQuestionsByQuestionnaire[q.questionnaireKey] = new Set();
      }
      assignedQuestionsByQuestionnaire[q.questionnaireKey].add(q.code);
    });

    assignedQuestionnaireKeys.forEach(questionnaireKey => {
      const assignedCodes = assignedQuestionsByQuestionnaire[questionnaireKey] || new Set();
      const savedCodes = savedQuestionCodesByQuestionnaire[questionnaireKey] || new Set();

      assignedCodes.forEach(code => {
        if (!savedCodes.has(code)) {
          missingQuestionCodes.push({
            questionnaireKey,
            questionCode: code
          });
        }
      });
    });

    // Step 8: Validate consistency
    const isConsistent =
      missingQuestionnaireKeys.length === 0 &&
      missingQuestionCodes.length === 0 &&
      totalSavedAnswerEntries >= totalAssigned; // >= because there might be extra entries

    // Step 9: Log errors if mismatch
    if (!isConsistent) {
      console.error(`❌ DATA INTEGRITY ERROR for project ${projectId}, user ${userId}:`);
      if (missingQuestionnaireKeys.length > 0) {
        console.error(`   Missing questionnaire keys: ${missingQuestionnaireKeys.join(', ')}`);
      }
      if (missingQuestionCodes.length > 0) {
        console.error(`   Missing question codes: ${missingQuestionCodes.length} total`);
        missingQuestionCodes.slice(0, 10).forEach(m => {
          console.error(`     - ${m.questionnaireKey}:${m.questionCode}`);
        });
        if (missingQuestionCodes.length > 10) {
          console.error(`     ... and ${missingQuestionCodes.length - 10} more`);
        }
      }
      if (totalSavedAnswerEntries < totalAssigned) {
        console.error(`   Answer count mismatch: ${totalSavedAnswerEntries} saved vs ${totalAssigned} assigned`);
      }

      // Optional auto-repair
      const autoRepair = req.query.autoRepair === 'true';
      if (autoRepair) {
        console.log(`🔧 Auto-repair enabled, initializing missing responses...`);
        try {
          await initializeResponses(projectIdObj, userIdObj, assignment.role, assignedQuestionnaireKeys);
          console.log(`✅ Auto-repair completed`);
        } catch (repairError) {
          console.error(`❌ Auto-repair failed: ${repairError.message}`);
        }
      }
    } else {
      console.log(`✅ Data integrity check passed for project ${projectId}, user ${userId}`);
    }

    res.json({
      totalAssigned,
      totalSavedAnswerEntries,
      missingQuestionnaireKeys,
      missingQuestionCodes: missingQuestionCodes.map(m => `${m.questionnaireKey}:${m.questionCode}`),
      isConsistent
    });
  } catch (err) {
    console.error('Error in integrity check:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint to check answer structure
app.get('/projects/:projectId/debug-answers', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    if (!projectId || !userId) {
      return res.status(400).json({ error: 'projectId and userId are required' });
    }

    const Response = require('./models/response');

    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const responses = await Response.find({
      projectId: projectIdObj,
      userId: userIdObj
    }).select('questionnaireKey answers').lean();

    const debugInfo = responses.map(response => ({
      questionnaireKey: response.questionnaireKey,
      totalAnswers: response.answers?.length || 0,
      answers: response.answers?.slice(0, 5).map(answer => ({
        questionCode: answer.questionCode,
        answerStructure: answer.answer,
        answerType: typeof answer.answer,
        hasChoiceKey: answer.answer?.choiceKey !== undefined,
        hasText: answer.answer?.text !== undefined,
        hasNumeric: answer.answer?.numeric !== undefined,
        hasMultiChoice: answer.answer?.multiChoiceKeys !== undefined,
        score: answer.score
      })) || []
    }));

    res.json({ responses: debugInfo });
  } catch (err) {
    console.error('Error in debug endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// Progress endpoint (based on assigned questions and answered count)
app.get('/projects/:projectId/progress', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    if (!projectId || !userId) {
      return res.status(400).json({ error: 'projectId and userId are required' });
    }

    const Response = require('./models/response');
    const Question = require('./models/question');
    const ProjectAssignment = require('./models/projectAssignment');

    const projectIdObj = isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    console.log(`📊 Progress request: projectId=${projectId}, userId=${userId}`);

    // Step 1: Get project assignment
    const assignment = await ProjectAssignment.findOne({ projectId: projectIdObj, userId: userIdObj });
    if (!assignment) {
      return res.json({
        totalAssigned: 0,
        answeredCount: 0,
        progressPercent: 0
      });
    }

    // Step 2: Get assigned questionnaire keys
    const assignedQuestionnaireKeys = assignment.questionnaires || [];
    if (assignedQuestionnaireKeys.length === 0) {
      return res.json({
        totalAssigned: 0,
        answeredCount: 0,
        progressPercent: 0
      });
    }

    // Step 3: Count total assigned questions
    const totalAssigned = await Question.countDocuments({
      questionnaireKey: { $in: assignedQuestionnaireKeys }
    });

    if (totalAssigned === 0) {
      return res.json({
        totalAssigned: 0,
        answeredCount: 0,
        progressPercent: 0
      });
    }

    // Step 4: Get all responses
    const responses = await Response.find({
      projectId: projectIdObj,
      userId: userIdObj,
      questionnaireKey: { $in: assignedQuestionnaireKeys }
    }).select('answers.questionCode answers.questionId answers.answer answers.score').lean();

    // Step 5: Count answered questions
    // A question is answered if:
    // - choice: answer.choiceKey exists
    // - text: answer.text exists and trimmed length > 0
    // - numeric: answer.numeric is not null
    // - multiChoice: answer.multiChoiceKeys exists and has length > 0
    // IMPORTANT: score=0 is valid and should be treated as answered
    let answeredCount = 0;
    const answeredQuestionCodes = new Set();

    console.log(`🔍 Analyzing ${responses.length} response documents for answered questions...`);

    responses.forEach((response, responseIndex) => {
      console.log(`📋 Response ${responseIndex + 1}: questionnaireKey=${response.questionnaireKey}, answers.length=${response.answers?.length || 0}`);

      if (response.answers && Array.isArray(response.answers)) {
        response.answers.forEach((answer, answerIndex) => {
          if (!answer.questionCode) {
            console.log(`⚠️ Answer entry ${answerIndex} missing questionCode:`, JSON.stringify(answer));
            return; // Skip entries without questionCode
          }

          // Check if already counted (avoid duplicates)
          if (answeredQuestionCodes.has(answer.questionCode)) {
            console.log(`⚠️ Duplicate questionCode detected: ${answer.questionCode}, skipping`);
            return;
          }

          // Debug: log the answer structure
          console.log(`🔍 Checking answer for ${answer.questionCode}:`, {
            hasAnswer: !!answer.answer,
            answerType: typeof answer.answer,
            answerValue: answer.answer,
            score: answer.score
          });

          // Check if answer has content
          // Handle case where answer.answer might be null, undefined, or an empty object
          let hasAnswer = false;

          if (answer.answer) {
            // Check for choiceKey
            if (answer.answer.choiceKey !== null && answer.answer.choiceKey !== undefined && answer.answer.choiceKey !== '') {
              hasAnswer = true;
              console.log(`  ✅ Found choiceKey: ${answer.answer.choiceKey}`);
            }
            // Check for text
            else if (answer.answer.text !== null && answer.answer.text !== undefined && String(answer.answer.text).trim().length > 0) {
              hasAnswer = true;
              console.log(`  ✅ Found text: ${String(answer.answer.text).substring(0, 50)}...`);
            }
            // Check for numeric
            else if (answer.answer.numeric !== null && answer.answer.numeric !== undefined) {
              hasAnswer = true;
              console.log(`  ✅ Found numeric: ${answer.answer.numeric}`);
            }
            // Check for multiChoiceKeys
            else if (answer.answer.multiChoiceKeys && Array.isArray(answer.answer.multiChoiceKeys) && answer.answer.multiChoiceKeys.length > 0) {
              hasAnswer = true;
              console.log(`  ✅ Found multiChoiceKeys: ${answer.answer.multiChoiceKeys.join(', ')}`);
            } else {
              console.log(`  ❌ No valid answer content found in answer.answer:`, JSON.stringify(answer.answer));
            }
          } else {
            console.log(`  ❌ answer.answer is null/undefined for ${answer.questionCode}`);
          }

          if (hasAnswer) {
            answeredQuestionCodes.add(answer.questionCode);
            answeredCount++;
            console.log(`✅ Counted answered question: ${answer.questionCode} (score: ${answer.score})`);
          } else {
            console.log(`⚠️ Question ${answer.questionCode} not counted as answered`);
          }
        });
      } else {
        console.log(`⚠️ Response ${responseIndex + 1} has no answers array`);
      }
    });

    // Step 6: Calculate progress
    const progressPercent = totalAssigned > 0
      ? Math.round((answeredCount / totalAssigned) * 100)
      : 0;

    console.log(`📊 Progress: ${answeredCount}/${totalAssigned} = ${progressPercent}%`);

    res.json({
      totalAssigned,
      answeredCount,
      progressPercent: Math.max(0, Math.min(100, progressPercent))
    });
  } catch (err) {
    console.error('Error calculating progress:', err);
    res.status(500).json({ error: err.message });
  }
});

// General Routes

// Email verification code generation helper
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/request-code - User requests code for registration
app.post('/api/auth/request-code', async (req, res) => {
  try {
    const { email } = req.body;

    console.log("[REQUEST CODE] incoming for", email);

    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    // If a user with this email already exists, return error
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email address already exists.' });
    }

    // Delete old verification records for the same email if any
    const EmailVerification = require('./models/EmailVerification');
    await EmailVerification.deleteMany({ email });

    // Generate 6-digit code
    const code = generateCode();

    // Create record in EmailVerification collection
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes validity

    const emailVerification = new EmailVerification({
      email,
      code,
      expiresAt,
      isUsed: false
    });
    await emailVerification.save();

    // Send email to user
    const { sendVerificationEmail } = require('./config/mailer');
    await sendVerificationEmail(email, code);

    return res.status(200).json({ message: "Verification code sent." });
  } catch (err) {
    console.error("[REQUEST CODE] failed:", err);
    return res.status(500).json({ message: "Failed to send verification code." });
  }
});

// POST /api/auth/verify-code-and-register - User verifies code and registers
app.post('/api/auth/verify-code-and-register', async (req, res) => {
  try {
    const { email, code, name, password, role } = req.body;

    if (!email || !code || !name || !password || !role) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const EmailVerification = require('./models/EmailVerification');

    // Find valid record in EmailVerification collection
    const emailVerification = await EmailVerification.findOne({
      email,
      code,
      isUsed: false,
      expiresAt: { $gt: new Date() } // Not expired
    });

    if (!emailVerification) {
      return res.status(400).json({ message: 'Code is invalid or expired.' });
    }

    // Check if a user with this email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // Create new user in User collection (password not hashed, plain text in current system)
    const newUser = new User({
      name,
      email,
      password, // Password is not hashed in current system, stored as plain text
      role,
      isVerified: true
    });
    await newUser.save();

    // Mark EmailVerification record as used
    emailVerification.isUsed = true;
    await emailVerification.save();

    // Send welcome email with role-based PDF attachment (non-blocking, log error if fails but don't fail registration)
    try {
      if (process.env.RESEND_API_KEY) {
        const { sendWelcomeEmail } = require('./services/emailService');
        await sendWelcomeEmail(email, name, role);
      } else {
        console.warn('Welcome email not sent: RESEND_API_KEY not configured');
      }
    } catch (emailError) {
      console.error('Welcome email sending error (non-blocking):', emailError);
      // Don't fail registration if welcome email fails
    }

    // Remove password from response
    const userObj = newUser.toObject();
    delete userObj.password;

    res.json({
      message: 'Registration completed successfully.',
      userId: newUser._id.toString()
    });
  } catch (err) {
    console.error('verify-code-and-register error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const reqId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const safeEmail = typeof req.body?.email === 'string' ? req.body.email : null;
    const safeRole = typeof req.body?.role === 'string' ? req.body.role : null;
    console.log(`[login:${reqId}] start`, { email: safeEmail, role: safeRole });

    // Check MongoDB connection state
    if (mongoose.connection.readyState !== 1) {
      console.warn(`[login:${reqId}] mongo not ready`, { readyState: mongoose.connection.readyState });
      return res.status(503).json({
        error: 'Veritabanı bağlantısı hazır değil. Lütfen birkaç saniye bekleyip tekrar deneyin.'
      });
    }

    // Add timeout to prevent hanging - increased to 15 seconds for better reliability
    const loginPromise = User.findOne({
      email: req.body.email,
      password: req.body.password,
      role: req.body.role
    }).select('-profileImage').lean().maxTimeMS(15000); // Exclude large profileImage, add timeout

    const user = await Promise.race([
      loginPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timeout')), 15000)
      )
    ]);

    if (user) {
      console.log(`[login:${reqId}] success`, { userId: String(user._id || user.id || '') });
      res.json(user);
    } else {
      console.log(`[login:${reqId}] invalid credentials`);
      res.status(401).json({ message: "Geçersiz kullanıcı adı, şifre veya rol." });
    }
  } catch (err) {
    if (err.message === 'Login timeout') {
      res.status(504).json({ error: 'Giriş isteği zaman aşımına uğradı. Lütfen tekrar deneyin.' });
    } else {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.' });
    }
  }
});

// Mark user's precondition as approved (server-side)
app.post('/api/users/:id/precondition-approval', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByIdAndUpdate(
      userId,
      { preconditionApproved: true, preconditionApprovedAt: new Date() },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Do not expose password
    const userObj = user.toObject();
    delete userObj.password;
    res.json(userObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({
        error: 'Database not connected',
        readyState: mongoose.connection.readyState
      });
    }

    const { userId } = req.query;
    console.log('📥 GET /api/projects - userId:', userId);

    // Build query
    const query = {};

    // Check if user is admin - if so, only show projects created by this admin
    if (userId && isValidObjectId(userId)) {
      try {
        const user = await User.findById(userId).select('role').lean();
        if (user && user.role && user.role.toLowerCase().includes('admin')) {
          // Admin users can see all projects
          console.log('🔓 Admin user detected - showing all projects');
          // No creator filter for admins
        }
      } catch (err) {
        console.warn('Could not verify user role:', err.message);
      }

      // Filter out projects hidden for this user (soft delete) if hiddenForUsers field exists
      // Note: hiddenForUsers field may not exist in all projects, so we check if it exists
      if (!query.createdByAdmin) {
        // Only apply hiddenForUsers filter if not already filtering by createdByAdmin
        query.$or = [
          { hiddenForUsers: { $exists: false } },
          { hiddenForUsers: { $nin: [new mongoose.Types.ObjectId(userId)] } }
        ];
      }
    }

    console.log('🔍 Query:', JSON.stringify(query));

    // Check if Project model exists
    if (!Project) {
      console.error('❌ Project model is not defined');
      return res.status(500).json({ error: 'Project model not available' });
    }

    const projects = await Project.find(query)
      .select('-fullDescription') // Exclude large description for list view
      .populate({
        path: 'assignedUsers',
        select: 'name email role _id',
        model: 'User'
      })
      .lean()
      .maxTimeMS(5000)
      .limit(1000);

    console.log(`✅ Found ${projects.length} projects`);

    if (projects.length === 0) {
      return res.json([]);
    }

    // OPTIMIZATION: Use Aggregation instead of N+1 Loop
    const projectIds = projects.map(p => p._id);
    const Response = mongoose.model('Response');
    const Report = mongoose.model('Report');

    // 1. Batch count answered questions per project
    const responseCounts = await Response.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $project: {
          projectId: 1,
          answerCount: {
            $cond: {
              if: { $isArray: "$answers" },
              then: { $size: "$answers" },
              else: 0
            }
          }
        }
      },
      {
        $group: {
          _id: "$projectId",
          totalAnswers: { $sum: "$answerCount" }
        }
      }
    ]);
    // Create map for fast lookup: projectId -> totalAnswers
    const responseCountMap = new Map(responseCounts.map(r => [String(r._id), r.totalAnswers]));

    // 2. Batch count reports per project
    const reportCounts = await Report.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: "$projectId", count: { $sum: 1 } } }
    ]);
    const reportCountMap = new Map(reportCounts.map(r => [String(r._id), r.count]));

    const enrichedProjects = projects.map(project => {
      const projIdStr = String(project._id);
      const answeredQuestions = responseCountMap.get(projIdStr) || 0;
      const reportCount = reportCountMap.get(projIdStr) || 0;

      // Derive status based on exact rules:
      // SETUP: answeredQuestions === 0
      // ASSESS: answeredQuestions > 0 AND reportCount === 0
      // RESOLVE: reportCount >= 1
      let derivedStatus = 'setup';
      if (reportCount >= 1) {
        derivedStatus = 'resolve';
      } else if (answeredQuestions > 0) {
        derivedStatus = 'assess';
      }

      return {
        ...project,
        hasAnyAnswers: answeredQuestions > 0,
        reportGenerated: reportCount > 0,
        answeredQuestions,
        reportCount,
        derivedStatus
      };
    });

    // Debug: Log enrichment summary (limit to first 5 for noise reduction)
    if (process.env.NODE_ENV === 'development') {
      const enrichmentSummary = enrichedProjects.slice(0, 5).map(p => ({
        title: p.title,
        status: p.derivedStatus,
        answers: p.answeredQuestions
      }));
      console.log('📊 Project enrichment summary (first 5):', JSON.stringify(enrichmentSummary));
    }

    res.json(enrichedProjects);
  } catch (err) {
    console.error('❌ Error fetching projects:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({
      error: err.message || 'Failed to fetch projects',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// GET /api/projects/:id/reports/latest - Get latest report for a project
app.get('/api/projects/:projectId/reports/latest', async (req, res) => {
  try {
    const reportController = require('./controllers/reportController');
    await reportController.getLatestReport(req, res);
  } catch (err) {
    console.error('Error in /api/projects/:projectId/reports/latest:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch latest report' });
  }
});

// ============================================================
// NEW ATOMIC REPORT ENDPOINTS
// ============================================================

// Generate report atomically (PDF + Word together)
app.post('/api/reports/generate-atomic', async (req, res) => {
  try {
    const reportController = require('./controllers/reportController');
    await reportController.generateReportAtomic(req, res);
  } catch (err) {
    console.error('Error in /api/reports/generate-atomic:', err);
    res.status(500).json({ error: err.message || 'Failed to generate report atomically' });
  }
});

// Get latest report for a project (Admin + Expert)
app.get('/api/reports/latest/:projectId', async (req, res) => {
  try {
    const reportRetrievalController = require('./controllers/reportRetrievalController');
    await reportRetrievalController.getLatestReport(req, res);
  } catch (err) {
    console.error('Error in /api/reports/latest/:projectId:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch latest report' });
  }
});

// Download PDF file
app.get('/api/reports/:reportId/pdf', async (req, res) => {
  try {
    const reportRetrievalController = require('./controllers/reportRetrievalController');
    await reportRetrievalController.downloadPDF(req, res);
  } catch (err) {
    console.error('Error in /api/reports/:reportId/pdf:', err);
    res.status(500).json({ error: err.message || 'Failed to download PDF' });
  }
});

// Download Word file
app.get('/api/reports/:reportId/word', async (req, res) => {
  try {
    const reportRetrievalController = require('./controllers/reportRetrievalController');
    await reportRetrievalController.downloadWord(req, res);
  } catch (err) {
    console.error('Error in /api/reports/:reportId/word:', err);
    res.status(500).json({ error: err.message || 'Failed to download Word' });
  }
});

// List all reports for a project (Admin - version history)
app.get('/api/reports/list/:projectId', async (req, res) => {
  try {
    const reportRetrievalController = require('./controllers/reportRetrievalController');
    await reportRetrievalController.listProjectReports(req, res);
  } catch (err) {
    console.error('Error in /api/reports/list/:projectId:', err);
    res.status(500).json({ error: err.message || 'Failed to list reports' });
  }
});

// Validate report consistency
app.get('/api/reports/validate/:reportId', async (req, res) => {
  try {
    const reportRetrievalController = require('./controllers/reportRetrievalController');
    await reportRetrievalController.validateReportConsistency(req, res);
  } catch (err) {
    console.error('Error in /api/reports/validate/:reportId:', err);
    res.status(500).json({ error: err.message || 'Failed to validate report' });
  }
});

// ============================================================

// Get scores for a project (or all projects if projectId not provided)
app.get('/api/scores', async (req, res) => {
  try {
    const Score = require('./models/score');
    const { projectId } = req.query;

    const query = {};
    if (projectId) {
      query.projectId = isValidObjectId(projectId)
        ? new mongoose.Types.ObjectId(projectId)
        : projectId;
    }

    const scores = await Score.find(query).lean();
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    // Get userId from request (body, query, or headers)
    const userId = req.body?.userId || req.query?.userId || req.headers?.['x-user-id'] || req.headers?.['x-userid'];

    // If userId is provided and user is admin, set createdByAdmin
    if (userId && isValidObjectId(userId)) {
      try {
        const user = await User.findById(userId).select('role').lean();
        if (user && user.role && user.role.toLowerCase().includes('admin')) {
          req.body.createdByAdmin = userId;
        }
      } catch (err) {
        // If user lookup fails, continue without setting createdByAdmin
        console.warn('Could not verify user role for createdByAdmin:', err.message);
      }
    }

    // If a useCase is linked, ensure its owner is assigned to the project (server-side safety).
    if (req.body?.useCase) {
      try {
        const uc = await UseCase.findById(req.body.useCase).select('ownerId status').lean();
        const ownerId = uc?.ownerId?.toString();
        if (ownerId) {
          const currentAssigned = Array.isArray(req.body.assignedUsers) ? req.body.assignedUsers.map(String) : [];
          req.body.assignedUsers = Array.from(new Set([...currentAssigned, ownerId]));
        }

        // Business rule: once a use case is linked to a project, move it from "assigned" to "in-review"
        // (do not override completed/in-review).
        if (uc?.status === 'assigned') {
          await UseCase.findByIdAndUpdate(req.body.useCase, { status: 'in-review', updatedAt: new Date() });
        }
      } catch {
        // ignore; proceed with provided payload
      }
    }

    const project = new Project(req.body);
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const deletedProject = await Project.findByIdAndDelete(req.params.id);
    if (!deletedProject) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Messages

// GET /api/messages/thread?user1=&user2=
app.get('/api/messages/thread', async (req, res) => {
  try {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) {
      return res.status(400).json({ error: 'Missing required parameters: user1, user2' });
    }

    const messages = await Message.find({
      isNotification: { $ne: true },
      $or: [
        { fromUserId: user1, toUserId: user2 },
        { fromUserId: user2, toUserId: user1 }
      ]
    })
      .sort({ createdAt: 1 })
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email');

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages
app.post('/api/messages', async (req, res) => {
  try {
    const { fromUserId, toUserId, text, isNotification, projectId } = req.body;
    if (!fromUserId || !toUserId || !text) {
      return res.status(400).json({ error: 'Missing required fields: fromUserId, toUserId, text' });
    }

    const message = new Message({
      fromUserId,
      toUserId,
      projectId,
      text,
      isNotification: Boolean(isNotification),
      createdAt: new Date()
    });

    await message.save();
    const populated = await Message.findById(message._id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('projectId', 'title');

    // Send email notification (async, don't wait for it)
    // Send email notification (async, don't wait for it)
    (async () => {
      try {
        const fromUser = await User.findById(fromUserId);
        const toUser = await User.findById(toUserId);

        if (fromUser && toUser && process.env.RESEND_API_KEY) {
          let project = null;
          if (projectId) {
            project = await mongoose.model('Project').findById(projectId);
          }

          const { sendEmail } = require('./services/emailService');
          const subject = project
            ? `New message from ${fromUser.name} - ${project.title}`
            : `New message from ${fromUser.name}`;

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1F2937;">New Message on Z-Inspection Platform</h2>
              <p>You have received a new message from <strong>${fromUser.name}</strong>${project ? ` regarding project <strong>"${project.title}"</strong>` : ''}.</p>
              <div style="background-color: #F3F4F6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; color: #374151;">${text.replace(/\n/g, '<br>')}</p>
              </div>
              <p style="color: #6B7280; font-size: 14px;">Please log in to the platform to respond.</p>
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
              <p style="color: #9CA3AF; font-size: 12px;">This is an automated notification from Z-Inspection Platform.</p>
            </div>
          `;

          await sendEmail(toUser.email, subject, html, `You have received a new message from ${fromUser.name}${project ? ` regarding project "${project.title}"` : ''}:\n\n${text}\n\nPlease log in to the platform to respond.`);
          console.log('📧 Email sent successfully to:', toUser.email);
        } else if (!process.env.RESEND_API_KEY) {
          console.log('📧 Email Notification (RESEND_API_KEY not configured):');
          console.log(`To: ${toUser?.email} (${toUser?.name})`);
          console.log(`From: ${fromUser?.name}`);
          console.log(`Message: ${text.substring(0, 100)}...`);
        }
      } catch (emailErr) {
        console.error('Email notification error:', emailErr);
      }
    })();

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages/send-email (Email notification endpoint)
app.post('/api/messages/send-email', async (req, res) => {
  try {
    const { to, toName, fromName, projectTitle, message, projectId } = req.body;

    // Only send email if credentials are configured
    if (process.env.RESEND_API_KEY) {
      const { sendEmail } = require('./services/emailService');
      await sendEmail(
        to,
        `New message from ${fromName}${projectTitle ? ` - ${projectTitle}` : ''} `,
        `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;" >
            <h2 style="color: #1F2937;">New Message on Z-Inspection Platform</h2>
            <p>You have received a new message from <strong>${fromName}</strong>${projectTitle ? ` regarding project <strong>"${projectTitle}"</strong>` : ''}.</p>
            <div style="background-color: #F3F4F6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #374151;">${message.replace(/\n/g, '<br>')}</p>
            </div>
            <p style="color: #6B7280; font-size: 14px;">Please log in to the platform to respond.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">This is an automated notification from Z-Inspection Platform.</p>
          </div>
          `,
        `You have received a new message from ${fromName}${projectTitle ? ` regarding project "${projectTitle}"` : ''}: \n\n${message} \n\nPlease log in to the platform to respond.`
      );
      console.log('📧 Email sent successfully to:', to);
      return res.json({ success: true, message: 'Email sent successfully' });
    } else {
      // Log email notification if credentials not configured
      console.log('📧 Email Notification (RESEND_API_KEY not configured):');
      console.log(`To: ${to} (${toName})`);
      console.log(`From: ${fromName} `);
      if (projectTitle) console.log(`Project: ${projectTitle} `);
      console.log(`Message: ${message.substring(0, 100)}...`);
      console.log('---');
      console.log('💡 To enable email sending, set RESEND_API_KEY in .env file');
      return res.json({ success: true, message: 'Email notification logged (RESEND_API_KEY not configured)' });
    }
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/messages/mark-read
app.post('/api/messages/mark-read', async (req, res) => {
  try {
    const { messageIds, userId, projectId, otherUserId } = req.body;

    if (messageIds && Array.isArray(messageIds)) {
      // Mark specific messages as read
      if (userId) {
        const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        await Message.updateMany(
          { _id: { $in: messageIds }, toUserId: userIdObj },
          { readAt: new Date() }
        );
      } else {
        await Message.updateMany(
          { _id: { $in: messageIds }, toUserId: userId },
          { readAt: new Date() }
        );
      }
    } else if (userId && otherUserId) {
      // Mark all messages in a thread as read
      const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
      const otherUserIdObj = isValidObjectId(otherUserId) ? new mongoose.Types.ObjectId(otherUserId) : otherUserId;
      await Message.updateMany(
        {
          fromUserId: otherUserIdObj,
          toUserId: userIdObj,
          readAt: null
        },
        { readAt: new Date() }
      );
    } else {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/unread-count?userId=
app.get('/api/messages/unread-count', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    // Get unread messages grouped by project and sender.
    // IMPORTANT: Avoid populate() here because missing/deleted refs (project/user) can break the entire endpoint.

    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const unreadMessages = await Message.find({
      toUserId: userIdObj,
      readAt: null
    })
      .populate({ path: 'projectId', select: 'title', strictPopulate: false })
      .populate('fromUserId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Group by projectId and fromUserId

    const conversations = {};
    unreadMessages.forEach(msg => {
      // Skip messages with missing or null populated fields
      if (!msg || !msg.fromUserId) {
        // Only log in development mode to reduce noise
        if (process.env.NODE_ENV === 'development') {
          console.warn('Skipping message with missing fromUserId:', msg?._id);
        }
        return;
      }
      const projectIdRaw = msg.projectId ? (msg.projectId._id || msg.projectId) : null;
      const fromUserIdRaw = msg.fromUserId._id || msg.fromUserId;

      if (!fromUserIdRaw) {

        // Only log in development mode to reduce noise
        if (process.env.NODE_ENV === 'development') {
          console.warn('Skipping message with invalid fromUserId:', msg?._id);
        }
        return;
      }
      const fromUserId = String(fromUserIdRaw);
      const key = projectIdRaw ? `${String(projectIdRaw)}_${fromUserId}` : fromUserId;

      if (!conversations[key]) {
        conversations[key] = {
          projectId: projectIdRaw ? String(projectIdRaw) : null,
          fromUserId: fromUserId,
          count: 0,
          lastMessage: msg.text || '',
          lastMessageTime: msg.createdAt,
          lastMessageId: String(msg._id),
          isNotification: Boolean(msg.isNotification)
        };
      }

      conversations[key].count++;
      if (msg.createdAt && conversations[key].lastMessageTime &&
        new Date(msg.createdAt) > new Date(conversations[key].lastMessageTime)) {
        conversations[key].lastMessage = msg.text || '';
        conversations[key].lastMessageTime = msg.createdAt;
        conversations[key].lastMessageId = String(msg._id);
        conversations[key].isNotification = Boolean(msg.isNotification);
      }
    });

    const totalCount = unreadMessages.length;
    const conversationList = Object.values(conversations);

    // Hydrate titles/names (best-effort)
    const projectIds = [...new Set(conversationList.map(c => c.projectId).filter(Boolean))]
      .filter((id) => isValidObjectId(id));
    const fromUserIds = [...new Set(conversationList.map(c => c.fromUserId).filter(Boolean))]
      .filter((id) => isValidObjectId(id));

    const [projects, fromUsers] = await Promise.all([
      mongoose.model('Project').find({ _id: { $in: projectIds } }).select('title').lean(),
      User.find({ _id: { $in: fromUserIds } }).select('name email').lean()
    ]);

    const projectTitleById = {};
    (projects || []).forEach(p => { projectTitleById[String(p._id)] = p.title; });
    const userNameById = {};
    (fromUsers || []).forEach(u => { userNameById[String(u._id)] = u.name; });

    for (const c of conversationList) {
      c.projectTitle = projectTitleById[c.projectId] || '(Unknown project)';
      c.fromUserName = userNameById[c.fromUserId] || '(Unknown user)';
    }

    res.json({
      totalCount,
      conversations: conversationList
    });
  } catch (err) {
    console.error('Error in /api/messages/unread-count:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/history?userId=&limit= - Fetch all messages (read + unread) for history
app.get('/api/messages/history', async (req, res) => {
  try {
    const { userId, limit = 100 } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // Get all messages sent TO this user, sorted by date (newest first)
    const messages = await Message.find({
      toUserId: userIdObj
    })
      .populate({ path: 'projectId', select: 'title', strictPopulate: false })
      .populate('fromUserId', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Transform to a consistent format
    const history = messages
      .filter(msg => msg && msg.fromUserId)
      .map(msg => ({
        _id: msg._id,
        title: msg.isNotification ? 'System Notification' : 'Message',
        message: String(msg.text || '').replace(/^\[NOTIFICATION\]\s*/, ''),
        actorId: {
          _id: msg.fromUserId._id || msg.fromUserId,
          name: msg.fromUserId.name || 'Unknown'
        },
        projectId: msg.projectId ? {
          _id: msg.projectId._id || msg.projectId,
          title: msg.projectId.title || 'Unknown Project'
        } : null,
        isRead: !!msg.readAt,
        createdAt: msg.createdAt,
        isNotification: Boolean(msg.isNotification)
      }));

    res.json({ messages: history, totalCount: history.length });
  } catch (err) {
    console.error('Error in /api/messages/history:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/conversations?userId=
app.get('/api/messages/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const userIdObj = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const userIdStr = mongoose.Types.ObjectId.isValid(userId)
      ? userIdObj.toString()
      : String(userId);

    // lean() -> populate edilmiş alanlar plain object olur, daha stabil
    const allMessages = await Message.find({
      isNotification: { $ne: true },
      $or: [{ fromUserId: userIdObj }, { toUserId: userIdObj }]
    })
      .populate('fromUserId', 'name email role')
      .populate('toUserId', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    const conversationsMap = {};

    for (const msg of allMessages) {
      // populate bazen null gelebilir (silinmiş user vs.)
      if (!msg || !msg.fromUserId || !msg.toUserId) continue;

      const fromRaw = msg.fromUserId._id || msg.fromUserId;
      const toRaw = msg.toUserId._id || msg.toUserId;

      if (!fromRaw || !toRaw) continue;

      const fromId = String(fromRaw);
      const toId = String(toRaw);

      const otherUserId = fromId === userIdStr ? toId : fromId;
      const key = otherUserId;

      if (!conversationsMap[key]) {
        const otherUser =
          fromId === userIdStr ? msg.toUserId : msg.fromUserId;

        conversationsMap[key] = {
          otherUserId,
          otherUserName: otherUser?.name || 'Unknown',
          otherUserRole: otherUser?.role || 'unknown',
          lastMessage: msg.text || '',
          lastMessageTime: msg.createdAt || new Date().toISOString(),
          unreadCount: 0,
        };
      }

      // unread count: user receiver ise ve readAt yoksa
      if (toId === userIdStr && !msg.readAt) {
        conversationsMap[key].unreadCount++;
      }

      // last message update
      const prevTime = new Date(conversationsMap[key].lastMessageTime).getTime();
      const curTime = new Date(msg.createdAt).getTime();
      if (curTime > prevTime) {
        conversationsMap[key].lastMessage = msg.text || '';
        conversationsMap[key].lastMessageTime = msg.createdAt;
      }
    }

    const conversations = Object.values(conversationsMap).sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    res.json(conversations);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: err.message });
  }
});


// DELETE /api/messages/delete-conversation
app.delete('/api/messages/delete-conversation', async (req, res) => {
  try {
    const { userId, otherUserId } = req.body;
    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'Missing required parameters: userId, otherUserId' });
    }

    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const otherUserIdObj = isValidObjectId(otherUserId) ? new mongoose.Types.ObjectId(otherUserId) : otherUserId;

    // Delete all messages in this conversation
    const result = await Message.deleteMany({
      $or: [
        { fromUserId: userIdObj, toUserId: otherUserIdObj },
        { fromUserId: otherUserIdObj, toUserId: userIdObj }
      ]
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} messages`
    });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Notification endpoints
const Notification = require('./models/Notification');

// GET /api/notifications?userId=&limit=
app.get('/api/notifications', async (req, res) => {
  try {
    const { userId, limit = 50 } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // Check if user is admin - if so, filter by projects created by this admin
    let projectFilter = {};
    try {
      const user = await User.findById(userIdObj).select('role').lean();
      if (user && user.role && user.role.toLowerCase().includes('admin')) {
        // Admin user - strict project filtering DISABLED to ensure admins see all notifications
        // Original filtering logic removed to fix missing notifications issue
      }
    } catch (err) {
      console.warn('Could not verify admin access for notifications:', err.message);
    }

    const notifications = await Notification.find({
      recipientId: userIdObj,
      ...projectFilter
    })
      .populate('projectId', 'title')
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipientId: userIdObj,
      isRead: false,
      ...projectFilter
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/:id/read
app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const notificationId = isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id;
    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // Get notification and check admin access
    const notification = await Notification.findById(notificationId).lean();
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Verify notification belongs to user
    if (String(notification.recipientId) !== String(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if user is admin and if so, verify the project belongs to this admin
    try {
      const user = await User.findById(userIdObj).select('role').lean();
      if (user && user.role && user.role.toLowerCase().includes('admin')) {
        const project = await Project.findById(notification.projectId).select('createdByAdmin').lean();
        if (project && project.createdByAdmin) {
          const projectAdminId = String(project.createdByAdmin);
          const userIdStr = String(userId);
          if (projectAdminId !== userIdStr) {
            return res.status(403).json({ error: 'Access denied: This project belongs to another admin' });
          }
        }
      }
    } catch (err) {
      console.warn('Could not verify admin access for notification read:', err.message);
    }

    await Notification.findByIdAndUpdate(notificationId, {
      isRead: true,
      readAt: new Date()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all
app.post('/api/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const userIdObj = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // Check if user is admin - if so, filter by projects created by this admin
    let projectFilter = {};
    try {
      const user = await User.findById(userIdObj).select('role').lean();
      if (user && user.role && user.role.toLowerCase().includes('admin')) {
        // Admin user - only mark notifications from projects created by this admin as read
        const userProjects = await Project.find({
          createdByAdmin: userIdObj
        }).select('_id').lean();
        const projectIds = userProjects.map(p => p._id);
        if (projectIds.length === 0) {
          // Admin has no projects, return success
          return res.json({ success: true, updatedCount: 0 });
        }
        projectFilter = { projectId: { $in: projectIds } };
      }
    } catch (err) {
      console.warn('Could not verify admin access for read-all:', err.message);
    }

    const result = await Notification.updateMany(
      {
        recipientId: userIdObj,
        isRead: false,
        ...projectFilter
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({ success: true, updatedCount: result.modifiedCount });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { includeProfileImages } = req.query;
    // By default, exclude profileImage for performance (large base64 strings)
    // But allow including them if explicitly requested
    const selectFields = includeProfileImages === 'true'
      ? '-password'
      : '-password -profileImage';

    const users = await User.find({}, selectFields)
      .lean()
      .maxTimeMS(5000)
      .limit(1000);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile endpoints - SPECIFIC routes must come BEFORE general /:id route
// GET single user's profile image
app.get('/api/users/:id/profile-image', async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Check if User model is available
    if (!User) {
      console.error('❌ User model is not defined');
      return res.status(500).json({ error: 'User model not available' });
    }

    const user = await User.findById(userId).select('profileImage').lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ profileImage: user.profileImage || null });
  } catch (err) {
    console.error('❌ Error fetching profile image:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({
      error: err.message || 'Failed to fetch profile image',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// GET single user with profile image
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('❌ Error fetching user:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch user' });
  }
});

// POST update profile image
app.post('/api/users/:id/profile-image', async (req, res) => {
  console.log('🔍 Route hit: POST /api/users/:id/profile-image');
  console.log('🔍 Request params:', req.params);
  console.log('🔍 Request body keys:', Object.keys(req.body || {}));

  try {
    const { image } = req.body;
    const userId = req.params.id;

    console.log('📸 Profile image update request:', { userId, hasImage: !!image, imageLength: image?.length });

    // Validate userId
    if (!isValidObjectId(userId)) {
      console.log('❌ Invalid user ID:', userId);
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { profileImage: image || null },
      { new: true }
    ).select('-password');

    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ Profile image updated successfully for user:', userId);
    res.json(user);
  } catch (err) {
    console.error('❌ Error updating profile image:', err);
    res.status(500).json({ error: err.message || 'Failed to update profile image' });
  }
});

app.post('/api/users/:id/change-password', async (req, res) => {
  console.log('🔍 Route hit: POST /api/users/:id/change-password');
  console.log('🔍 Request params:', req.params);
  console.log('🔍 Request body keys:', Object.keys(req.body || {}));

  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.params.id;

    console.log('🔐 Password change request:', { userId, hasOldPassword: !!oldPassword, hasNewPassword: !!newPassword });

    if (!isValidObjectId(userId)) {
      console.log('❌ Invalid user ID:', userId);
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.password !== oldPassword) {
      console.log('❌ Old password incorrect');
      return res.status(400).json({ error: 'Old password is incorrect' });
    }

    user.password = newPassword;
    await user.save();
    console.log('✅ Password changed successfully for user:', userId);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error changing password:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id/delete-account', async (req, res) => {
  try {
    const userId = req.params.id;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// General user update (must come AFTER specific routes)
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.params.id;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { name },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shared Discussion (Shared Area) Endpoints
// GET /api/shared-discussions?projectId= (projectId opsiyonel, tüm mesajları getirir)
app.get('/api/shared-discussions', async (req, res) => {
  try {
    const { projectId } = req.query;
    const query = {};
    if (projectId && projectId !== 'all') {
      // Convert to ObjectId if valid
      if (isValidObjectId(projectId)) {
        query.projectId = new mongoose.Types.ObjectId(projectId);
      } else {
        query.projectId = projectId;
      }
    }

    const discussions = await SharedDiscussion.find(query)
      .populate('userId', 'name email role')
      .populate('projectId', 'title')
      .populate('replyTo', 'text userId')
      .populate('mentions', 'name email')
      .sort({ isPinned: -1, createdAt: -1 }); // Pinned mesajlar önce, sonra tarihe göre

    res.json(discussions);
  } catch (err) {
    console.error('Error fetching shared discussions:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shared-discussions
app.post('/api/shared-discussions', async (req, res) => {
  try {
    console.log('📨 Received shared discussion request:', req.body);
    const { userId, text, projectId, replyTo, mentions } = req.body;

    if (!userId || !text) {
      console.error('❌ Missing required fields:', { userId: !!userId, text: !!text });
      return res.status(400).json({ error: 'Missing required fields: userId, text' });
    }

    // Convert userId to ObjectId if valid
    let userIdObj;
    if (isValidObjectId(userId)) {
      userIdObj = new mongoose.Types.ObjectId(userId);
      // Verify user exists
      const userExists = await User.findById(userIdObj);
      if (!userExists) {
        console.error('❌ User not found with id:', userId);
        return res.status(400).json({ error: 'User not found' });
      }
    } else {
      console.error('❌ Invalid userId format:', userId);
      return res.status(400).json({ error: 'Invalid userId format' });
    }

    const projectIdObj = projectId && projectId !== 'all' && isValidObjectId(projectId)
      ? new mongoose.Types.ObjectId(projectId)
      : (projectId && projectId !== 'all' ? projectId : null);
    const replyToObj = replyTo && isValidObjectId(replyTo)
      ? new mongoose.Types.ObjectId(replyTo)
      : (replyTo || null);
    const mentionsObj = mentions && Array.isArray(mentions)
      ? mentions.map(m => isValidObjectId(m) ? new mongoose.Types.ObjectId(m) : m)
      : [];

    console.log('✅ Creating discussion with:', { userIdObj, text: text.substring(0, 50), projectIdObj });

    const discussion = new SharedDiscussion({
      userId: userIdObj,
      text,
      projectId: projectIdObj,
      replyTo: replyToObj,
      mentions: mentionsObj,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await discussion.save();
    console.log('✅ Discussion saved:', discussion._id);

    // Populate ile tam bilgileri getir
    const populated = await SharedDiscussion.findById(discussion._id)
      .populate('userId', 'name email role')
      .populate('projectId', 'title')
      .populate('replyTo', 'text userId')
      .populate('mentions', 'name email');

    console.log('✅ Discussion populated successfully');
    res.json(populated);
  } catch (err) {
    console.error('❌ Error creating shared discussion:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PUT /api/shared-discussions/:id/pin (Admin only - pin/unpin)
app.put('/api/shared-discussions/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    const { isPinned } = req.body;

    const discussion = await SharedDiscussion.findByIdAndUpdate(
      id,
      { isPinned: isPinned === true, updatedAt: new Date() },
      { new: true }
    )
      .populate('userId', 'name email role')
      .populate('projectId', 'title')
      .populate('replyTo', 'text userId')
      .populate('mentions', 'name email');

    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    res.json(discussion);
  } catch (err) {
    console.error('Error pinning/unpinning discussion:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shared-discussions/:id
app.delete('/api/shared-discussions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await SharedDiscussion.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting discussion:', err);
    res.status(500).json({ error: err.message });
  }
});

// New Evaluation API Routes
const evaluationRoutes = require('./routes/evaluationRoutes');
app.use('/api/evaluations', evaluationRoutes);

// Report Generation Routes (Gemini AI)
const reportRoutes = require('./routes/reportRoutes');
app.use('/api/reports', reportRoutes);

// Health check endpoint for deployment platforms
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Check if email credentials are loaded (for debugging)
const emailConfigured = !!(process.env.RESEND_API_KEY);
const isProduction = process.env.NODE_ENV === 'production';
console.log(`📧 Email service: ${emailConfigured ? '✅ Configured (Resend)' : 'ℹ️  Not configured (email features disabled)'}`);
if (emailConfigured) {
  console.log(`📧 Resend API Key: ${process.env.RESEND_API_KEY ? '***' + process.env.RESEND_API_KEY.slice(-4) : 'NOT SET'}`);
  console.log(`📧 Email From: ${process.env.EMAIL_FROM || 'Z-Inspection <no-reply@resend.dev> (default)'}`);
} else {
  // Silent notice - email service is optional
  console.log(`ℹ️  Email service disabled(RESEND_API_KEY not configured).Email notifications will be logged to console only.`);
}

// FIX: 24 unique questions: General stays T1/T2, Technical uses T1_TECH/T2_TECH
// This MUST run AFTER MongoDB connection is established
mongoose.connection.once('open', async () => {
  try {
    const Question = require('./models/question');

    // STEP 1: Ensure General T1, T2 exist and are correct
    // If G1/G2 exist, rename to T1/T2
    await Question.updateMany({ questionnaireKey: 'general-v1', code: 'G1' }, { $set: { code: 'T1', appliesToRoles: ['any'] } });
    await Question.updateMany({ questionnaireKey: 'general-v1', code: 'G2' }, { $set: { code: 'T2', appliesToRoles: ['any'] } });

    // Check if T1 exists, if not create it
    let genT1Exists = await Question.findOne({ questionnaireKey: 'general-v1', code: 'T1' });
    if (!genT1Exists) {
      await Question.create({
        questionnaireKey: 'general-v1',
        code: 'T1',
        principle: 'TRANSPARENCY',
        appliesToRoles: ['any'],
        text: {
          en: 'Is it clear to you what the AI system can and cannot do?',
          tr: 'AI sisteminin ne yapabildiği ve ne yapamadığı sizin için açık mı?'
        },
        answerType: 'single_choice',
        options: [
          { key: 'very_clear', label: { en: 'Very clear', tr: 'Çok net' }, score: 4 },
          { key: 'mostly_clear', label: { en: 'Mostly clear', tr: 'Büyük ölçüde net' }, score: 3 },
          { key: 'somewhat_unclear', label: { en: 'Somewhat unclear', tr: 'Kısmen belirsiz' }, score: 2 },
          { key: 'completely_unclear', label: { en: 'Completely unclear', tr: 'Tamamen belirsiz' }, score: 0 }
        ],
        required: true,
        order: 1,
        scoring: { scale: '0-4', method: 'mapped' }
      });
      console.log('✅ Created missing T1 question for general-v1');
    }

    // Check if T2 exists, if not create it
    let genT2Exists = await Question.findOne({ questionnaireKey: 'general-v1', code: 'T2' });
    if (!genT2Exists) {
      await Question.create({
        questionnaireKey: 'general-v1',
        code: 'T2',
        principle: 'TRANSPARENCY',
        appliesToRoles: ['any'],
        text: {
          en: 'Do you understand that the system may sometimes be wrong or uncertain?',
          tr: 'Sistemin bazen hatalı veya belirsiz olabileceğini anlıyor musunuz?'
        },
        answerType: 'single_choice',
        options: [
          { key: 'yes', label: { en: 'Yes', tr: 'Evet' }, score: 4 },
          { key: 'partially', label: { en: 'Partially', tr: 'Kısmen' }, score: 2 },
          { key: 'no', label: { en: 'No', tr: 'Hayır' }, score: 0 }
        ],
        required: true,
        order: 2,
        scoring: { scale: '0-4', method: 'mapped' }
      });
      console.log('✅ Created missing T2 question for general-v1');
    }

    // Ensure T1, T2 have correct appliesToRoles (fix if they exist but have wrong roles)
    const genT1Result = await Question.updateMany(
      { questionnaireKey: 'general-v1', code: 'T1' },
      { $set: { appliesToRoles: ['any'] } }
    );
    const genT2Result = await Question.updateMany(
      { questionnaireKey: 'general-v1', code: 'T2' },
      { $set: { appliesToRoles: ['any'] } }
    );

    // STEP 2: Technical must be unique: T1_TECH, T2_TECH (CRITICAL: This prevents frontend duplicate detection)
    const techT1Result = await Question.updateMany(
      { questionnaireKey: 'technical-expert-v1', code: 'T1' },
      { $set: { code: 'T1_TECH', appliesToRoles: ['technical-expert'] } }
    );
    const techT2Result = await Question.updateMany(
      { questionnaireKey: 'technical-expert-v1', code: 'T2' },
      { $set: { code: 'T2_TECH', appliesToRoles: ['technical-expert'] } }
    );

    // Verify counts (silent mode - uncomment for debugging)
    // const generalCount = await Question.countDocuments({ questionnaireKey: 'general-v1' });
    // const technicalCount = await Question.countDocuments({ questionnaireKey: 'technical-expert-v1' });

    // console.log(`✅ 24 QUESTION MODE: `);
    // console.log(`   General: Fixed T1(${ genT1Result.modifiedCount }), T2(${ genT2Result.modifiedCount }).Total: ${ generalCount } questions.`);
    // console.log(`   Technical: T1 -> T1_TECH(${ techT1Result.modifiedCount }), T2 -> T2_TECH(${ techT2Result.modifiedCount }).Total: ${ technicalCount } questions.`);
    // console.log(`   Expected: 12 General + 12 Technical = 24 questions.`);

  } catch (error) {
    console.error('⚠️ Could not update question codes on startup:', error.message);
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
