const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const ScoreSchema = new mongoose.Schema({}, { strict: false });
const ProjectSchema = new mongoose.Schema({ title: String }, { strict: false });

const Score = mongoose.model('Score', ScoreSchema);
const Project = mongoose.model('Project', ProjectSchema);

async function deleteScores() {
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

        // Delete Scores
        const result = await Score.deleteMany({ projectId: project._id });
        console.log(`✅ Deleted ${result.deletedCount} score documents.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

deleteScores();
