const mongoose = require('mongoose');
require('dotenv').config();
console.log('MongoDB URI length:', process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 'undefined');

// Models
const projectSchema = new mongoose.Schema({
    title: String,
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: Date
}, { strict: false });

const responseSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    answers: Array
}, { strict: false });

const reportSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }
}, { strict: false });

const Project = mongoose.model('Project', projectSchema);
const Response = mongoose.model('Response', responseSchema);
const Report = mongoose.model('Report', reportSchema);

async function checkProjectStatuses() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const projects = await Project.find({});
        console.log(`Found ${projects.length} projects`);

        for (const project of projects) {
            const responses = await Response.find({ projectId: project._id }, { 'answers': 1 });
            let answeredQuestions = 0;
            for (const resp of responses) {
                answeredQuestions += (resp.answers || []).length;
            }

            const reportCount = await Report.countDocuments({ projectId: project._id });

            let derivedStatus = 'setup';
            if (reportCount >= 1) {
                derivedStatus = 'resolve';
            } else if (answeredQuestions > 0) {
                derivedStatus = 'assess';
            }

            console.log(`----------------------------------------`);
            console.log(`Project: ${project.title} (${project._id})`);
            console.log(`  Responses found: ${responses.length}`);
            console.log(`  Total Answered Questions: ${answeredQuestions}`);
            console.log(`  Reports found: ${reportCount}`);
            console.log(`  Calculated Status: ${derivedStatus}`);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkProjectStatuses();
