const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) { console.error("No URI"); process.exit(1); }

mongoose.connect(uri).catch(e => { console.error(e); process.exit(1); });

// -- MODEL DEFINITIONS (Copied/Adapted from server.js) --

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    role: { type: String, required: true }
}, { strict: false });
if (!mongoose.models.User) mongoose.model('User', UserSchema);

const ProjectSchema = new mongoose.Schema({
    title: String,
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { strict: false });
if (!mongoose.models.Project) mongoose.model('Project', ProjectSchema);

const TensionSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    principle1: String,
    principle2: String,
    severity: String,
    votes: Array,
    comments: Array,
    evidences: Array
}, { strict: false });
if (!mongoose.models.Tension) mongoose.model('Tension', TensionSchema);

const EvaluationSchema = new mongoose.Schema({}, { strict: false });
if (!mongoose.models.Evaluation) mongoose.model('Evaluation', EvaluationSchema);

const GeneralQuestionsAnswersSchema = new mongoose.Schema({}, { strict: false });
if (!mongoose.models.GeneralQuestionsAnswers) mongoose.model('GeneralQuestionsAnswers', GeneralQuestionsAnswersSchema);

// Response and Score are in files, try to load them, or mock if missing
try { require('./models/response'); } catch (e) {
    if (!mongoose.models.Response) mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
}
try { require('./models/score'); } catch (e) {
    if (!mongoose.models.Score) mongoose.model('Score', new mongoose.Schema({}, { strict: false }));
}
try { require('./models/question'); } catch (e) {
    if (!mongoose.models.Question) mongoose.model('Question', new mongoose.Schema({}, { strict: false }));
}
try { require('./models/projectAssignment'); } catch (e) {
    if (!mongoose.models.ProjectAssignment) mongoose.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }));
}

const { getProjectAnalytics } = require('./services/analyticsService');

async function run() {
    try {
        const Project = mongoose.model('Project');
        // Find 'test case 3'
        const project = await Project.findOne({ title: { $regex: /test.*3/i } });
        if (!project) { console.log("Project not found"); return; }

        console.log(`Analyzing Project: ${project.title} (${project._id})`);

        // Run analytics
        console.log("Running getProjectAnalytics...");
        const analytics = await getProjectAnalytics(project._id, null);

        console.log("--- Top Risky Questions ---");
        console.log(JSON.stringify(analytics.topRiskyQuestions, null, 2));

        // Debug Fallback Logic Conditions
        const Score = mongoose.model('Score');
        const scores = await Score.find({ projectId: project._id });
        const hasByQuestion = scores.some(s => s.byQuestion && Array.isArray(s.byQuestion));
        console.log(`\nDEBUG: Some scores have byQuestion? ${hasByQuestion}`);
        if (hasByQuestion) {
            scores.forEach((s, i) => {
                if (s.byQuestion && s.byQuestion.length > 0) {
                    console.log(`Score ${i} byQuestion length: ${s.byQuestion.length}`);
                } else {
                    console.log(`Score ${i} byQuestion is empty/missing`);
                }
            });
        }

    } catch (e) {
        console.error("RUNTIME ERROR:", e);
    } finally {
        mongoose.connection.close();
    }
}

run();
