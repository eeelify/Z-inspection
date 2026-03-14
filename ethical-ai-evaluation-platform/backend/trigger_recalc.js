const mongoose = require('mongoose');
const { computeEthicalScores, computeProjectEthicalScores } = require('./services/ethicalScoringService');

// Mock schemas if needed by service? 
// The service imports models using require('../models/...') so accurate pathing is key.
// Since I am running this in backend/, the relative paths in service should work.

async function run() {
    try {
        const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const Project = mongoose.model('Project', new mongoose.Schema({ title: String }, { collection: 'projects', strict: false }));
        // Ensure models are registered for the service
        require('./models/response');
        require('./models/question');
        require('./models/score');
        require('./models/questionnaire');

        const project = await Project.findOne({ title: /Tutor AI/i });
        if (!project) {
            console.log('Project not found');
            process.exit(1);
        }
        console.log(`Recalculating scores for project: ${project.title} (${project._id})`);

        // We need to recompute for each user who has responses.
        // Or find all responses for the project and get unique user/questionnaire pairs.
        const Response = mongoose.model('Response');
        const responses = await Response.find({ projectId: project._id }).select('userId questionnaireKey'); // Distinct pairs

        const uniquePairs = new Set();
        responses.forEach(r => uniquePairs.add(`${r.userId}_${r.questionnaireKey}`));

        console.log(`Found ${uniquePairs.size} unique user/questionnaire pairs to recompute.`);

        for (const pair of uniquePairs) {
            const [userId, questionnaireKey] = pair.split('_');
            console.log(`Computing for User ${userId}, Questionnaire ${questionnaireKey}...`);
            await computeEthicalScores(project._id, userId, questionnaireKey);
        }

        console.log('Computing Project Level Scores...');
        await computeProjectEthicalScores(project._id);

        console.log('Done.');
        await mongoose.disconnect();

    } catch (e) {
        console.error(e);
    }
}

run();
