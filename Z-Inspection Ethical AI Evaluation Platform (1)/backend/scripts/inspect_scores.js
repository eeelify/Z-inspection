const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const ScoreSchema = new mongoose.Schema({}, { strict: false });
const ProjectSchema = new mongoose.Schema({ title: String }, { strict: false });

const Score = mongoose.model('Score', ScoreSchema);
const Project = mongoose.model('Project', ProjectSchema);

async function inspectScores() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Find Project
        const project = await Project.findOne({ title: { $regex: /deneme 1/i } });
        if (!project) {
            console.error('Project "deneme 1" not found!');
            return;
        }
        console.log(`Project: ${project.title} (${project._id})`);

        // Find Scores
        const scores = await Score.find({ projectId: project._id });
        console.log(`Found ${scores.length} scores.`);

        scores.forEach((s, idx) => {
            console.log(`\nScore #${idx + 1} (User: ${s.userId}, Role: ${s.role})`);
            console.log(`Model Version: ${s.scoringModelVersion}`);

            if (s.byPrinciple) {
                ['TRANSPARENCY', 'HUMAN AGENCY & OVERSIGHT'].forEach(p => {
                    const data = s.byPrinciple[p];
                    if (data) {
                        console.log(`  ${p}:`);
                        console.log(`    Risk (Sum): ${data.risk}`);
                        console.log(`    Avg Importance: ${data.avgImportance}`);
                        console.log(`    Count (n): ${data.n}`);
                    } else {
                        console.log(`  ${p}: NO DATA`);
                    }
                });
            }
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectScores();
