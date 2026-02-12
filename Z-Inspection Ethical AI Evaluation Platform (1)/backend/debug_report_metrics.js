const mongoose = require('mongoose');

// Minimal Schemas
const ProjectSchema = new mongoose.Schema({ title: String }, { collection: 'projects', strict: false });
const QuestionSchema = new mongoose.Schema({ code: String, answerType: String, questionnaireKey: String }, { collection: 'questions', strict: false });
const ResponseSchema = new mongoose.Schema({}, { collection: 'responses', strict: false });
const ScoreSchema = new mongoose.Schema({}, { collection: 'scores', strict: false });
const TenantSchema = new mongoose.Schema({}, { collection: 'tenants', strict: false });
const UserSchema = new mongoose.Schema({}, { collection: 'users', strict: false });
const TensionSchema = new mongoose.Schema({}, { collection: 'tensions', strict: false });
const ProjectAssignmentSchema = new mongoose.Schema({}, { collection: 'projectassignments', strict: false });
const UseCaseSchema = new mongoose.Schema({}, { collection: 'usecases', strict: false });

function safeModel(name, schema) {
    if (mongoose.models[name]) return mongoose.model(name);
    return mongoose.model(name, schema);
}

// File-based models - require them so they register themselves (once)
require('./models/score');
require('./models/response');
require('./models/question');
require('./models/projectAssignment');

// Inline models (from server.js) - define safely
safeModel('Project', ProjectSchema);
safeModel('Tenant', TenantSchema);
safeModel('User', UserSchema);
safeModel('Tension', TensionSchema);
safeModel('UseCase', UseCaseSchema);

const { buildReportMetrics } = require('./services/reportMetricsService');

async function run() {
    try {
        const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const Project = mongoose.model('Project');
        const project = await Project.findOne({ title: /Tutor AI/i });
        if (!project) {
            console.log('Project not found');
            process.exit(1);
        }
        console.log(`Debug Project: ${project.title} (${project._id})`);

        console.log('Calling buildReportMetrics...');
        // Pass null for questionnaireKey to get full report metrics (all questionnaires)
        const metrics = await buildReportMetrics(project._id, null);

        const debugOutput = {
            scoringDisclosure: metrics.scoringDisclosure,
            counts: {
                totalQuestions: metrics.scoringDisclosure?.totalQuestions,
                quantitativeQuestions: metrics.scoringDisclosure?.quantitativeQuestions,
                qualitativeQuestions: metrics.scoringDisclosure?.qualitativeQuestions
            }
        };

        const fs = require('fs');
        fs.writeFileSync('debug_metrics.json', JSON.stringify(debugOutput, null, 2));
        console.log('Wrote debug_metrics.json');

        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
}

run();
