const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const ProjectAssignment = mongoose.models.ProjectAssignment || require('./models/projectAssignment');
const User = mongoose.models.User || require('./models/User');
const ProjectSchema = new mongoose.Schema({ title: String, name: String }, { strict: false });
const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const project = await Project.findOne({ $or: [{ title: /Tutor AI/i }, { name: /Tutor AI/i }] });
    if (!project) {
        console.log('Project not found');
        process.exit(0);
    }

    const assignments = await ProjectAssignment.find({ projectId: project._id }).lean();
    console.log(`Found ${assignments.length} assignments for project ${project.title || project.name}`);

    for (const a of assignments) {
        const u = await User.findById(a.userId).lean();
        console.log(`User: ${u?.name || 'N/A'} (${a.userId}) | Role: ${a.role} | Status: ${a.status}`);
    }

    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
