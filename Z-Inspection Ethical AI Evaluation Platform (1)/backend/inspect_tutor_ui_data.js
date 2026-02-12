const mongoose = require('mongoose');

// Use minimal schema to avoid dependency issues
const ScoreSchema = new mongoose.Schema({
    projectId: mongoose.Schema.Types.ObjectId,
    questionnaireKey: String,
    byPrinciple: mongoose.Schema.Types.Mixed,
    totals: mongoose.Schema.Types.Mixed,
    questionBreakdown: Array
}, { collection: 'scores', strict: false });

const ProjectSchema = new mongoose.Schema({
    title: String
}, { collection: 'projects', strict: false });

async function run() {
    try {
        const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(uri);
        console.log('Connected to DB (Production/Atlas)');

        const Project = mongoose.model('Project', ProjectSchema);
        const Score = mongoose.model('Score', ScoreSchema);

        const project = await Project.findOne({ title: /Tutor AI/i });
        if (!project) {
            console.log('Project not found');
            process.exit(1);
        }
        console.log('Project:', project.title, 'ID:', project._id);

        const scores = await Score.find({ projectId: project._id });
        console.log('Total Scores found:', scores.length);

        const combined = scores.find(s => s.questionnaireKey === '__ALL_COMBINED__');
        if (combined) {
            const societal = combined.byPrinciple['SOCIETAL & INTERPERSONAL WELL-BEING'];
            if (societal) {
                console.log('--- SOCIETAL PRINCIPLE DATA ---');
                console.log('Questions count (n):', societal.n);
                console.log('Cumulative Risk:', societal.risk);
                console.log('Average ERC:', (societal.risk / societal.n).toFixed(4));
                console.log('Questions Detail:');
                console.log(JSON.stringify(societal.topDrivers, null, 2));
            } else {
                console.log('Societal principle not found in combined score');
            }
        } else {
            console.log('Combined score NOT found for this project.');
        }

        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
}

run();
