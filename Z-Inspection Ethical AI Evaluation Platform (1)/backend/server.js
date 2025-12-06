const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// --- VERİTABANI BAĞLANTISI (BULUT/ATLAS) ---

const MONGO_URI = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas (Bulut) Bağlantısı Başarılı'))
  .catch(err => {
    console.error('❌ Bağlantı Hatası:', err);
    console.log('İPUCU: Şifrenizi Atlas panelinden "Sifre123" (İngilizce karakter) olarak güncellediğinizden emin olun.');
  });

// --- ŞEMALAR ---

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

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
  createdAt: { type: Date, default: Date.now }
});
const Project = mongoose.model('Project', ProjectSchema);

const UseCaseSchema = new mongoose.Schema({
  title: String,
  description: String,
  aiSystemCategory: String,
  status: { type: String, default: 'assigned' },
  progress: { type: Number, default: 0 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedExperts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  adminNotes: String,
  supportingFiles: [String],
  createdAt: { type: Date, default: Date.now },
  // CAE ve detaylı alanlar için genişletilmiş bilgi
  extendedInfo: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  // Uzman geri bildirimleri
  feedback: [{
    from: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  // Admin notları
  adminReflections: [{
    id: String,
    text: String,
    visibleToExperts: Boolean,
    createdAt: { type: Date, default: Date.now }
  }]
});
const UseCase = mongoose.model('UseCase', UseCaseSchema);

const TensionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  principle1: String,
  principle2: String,
  claimStatement: String, 
  description: String,    
  evidenceDescription: String,
  evidenceFileName: String,
  severity: Number,
  createdAt: { type: Date, default: Date.now },
  
  // OYLAMA SİSTEMİ
  votes: [{
    userId: String,
    voteType: { type: String, enum: ['agree', 'disagree'] }
  }],
  
  // YORUMLAR SİSTEMİ
  comments: [{
    id: String,
    text: String,
    author: String,
    date: { type: Date, default: Date.now }
  }]
});
const Tension = mongoose.model('Tension', TensionSchema);

// --- ROUTES ---

// 1. OYLAMA ROUTE'U
app.post('/api/tensions/:id/vote', async (req, res) => {
  try {
    const { userId, voteType } = req.body;
    const tension = await Tension.findById(req.params.id);
    if (!tension) return res.status(404).send('Tension not found');

    if (!tension.votes) tension.votes = [];

    const existingVoteIndex = tension.votes.findIndex(v => v.userId === userId);

    if (existingVoteIndex > -1) {
      if (tension.votes[existingVoteIndex].voteType === voteType) {
        tension.votes.splice(existingVoteIndex, 1);
      } else {
        tension.votes[existingVoteIndex].voteType = voteType;
      }
    } else {
      tension.votes.push({ userId, voteType });
    }

    await tension.save();

    const agreeCount = tension.votes.filter(v => v.voteType === 'agree').length;
    const disagreeCount = tension.votes.filter(v => v.voteType === 'disagree').length;
    const currentUserVote = tension.votes.find(v => v.userId === userId)?.voteType || null;

    res.json({ 
        consensus: { agree: agreeCount, disagree: disagreeCount },
        userVote: currentUserVote 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. TENSION GETİRME
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

app.post('/api/tensions/:id/comment', async (req, res) => {
  try {
    const { text, author } = req.body;
    const tension = await Tension.findById(req.params.id);
    if (!tension) return res.status(404).send('Not found');
    const newComment = { id: Date.now().toString(), text, author, date: new Date() };
    if (!tension.comments) tension.comments = [];
    tension.comments.push(newComment);
    await tension.save();
    res.json(newComment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Standart Route'lar
app.post('/api/register', async (req, res) => {
    try { const newUser = new User(req.body); await newUser.save(); res.json(newUser); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password, role: req.body.role });
    if (user) res.json(user); else res.status(401).json({ message: "Invalid credentials" });
});
app.get('/api/projects', async (req, res) => { const projects = await Project.find(); res.json(projects); });
app.post('/api/projects', async (req, res) => { const project = new Project(req.body); await project.save(); res.json(project); });
app.get('/api/users', async (req, res) => { const users = await User.find({}, '-password'); res.json(users); });
app.get('/api/use-cases', async (req, res) => { const useCases = await UseCase.find(); res.json(useCases); });
app.post('/api/use-cases', async (req, res) => { const useCase = new UseCase(req.body); await useCase.save(); res.json(useCase); });
app.post('/api/tensions', async (req, res) => { const tension = new Tension(req.body); await tension.save(); res.json(tension); });

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));