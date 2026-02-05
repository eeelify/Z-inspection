const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const ProjectSchema = new mongoose.Schema({}, { strict: false });
const Project = mongoose.model('Project', ProjectSchema);

async function inspectProject() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Search for "deneme1" or "deneme 1"
        // Use loose regex
        const projects = await Project.find({
            title: { $regex: /deneme/i }
        });

        console.log(`Found ${projects.length} projects.`);
        projects.forEach(p => {
            console.log('--------------------------------------------------');
            console.log(`ID: ${p._id}`);
            console.log(`Title: ${p.title}`);
            console.log(`Assigned Users (Raw):`, p.assignedUsers);
            console.log(`Stage:`, p.stage);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectProject();
