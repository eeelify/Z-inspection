const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

// Schemas (simplified)
const ProjectSchema = new mongoose.Schema({}, { strict: false });
const UseCaseSchema = new mongoose.Schema({}, { strict: false });
const Project = mongoose.model('Project', ProjectSchema);
const UseCase = mongoose.model('UseCase', UseCaseSchema);

async function syncAssignments() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // 1. Find Project "deneme 1"
        const project = await Project.findOne({ title: { $regex: /deneme 1/i } });
        if (!project) {
            console.error('Project "deneme 1" not found!');
            return;
        }
        console.log(`Found Project: ${project.title} (${project._id})`);
        console.log(`Project Assigned Users: ${project.assignedUsers}`);

        if (!project.assignedUsers || project.assignedUsers.length === 0) {
            console.log('Project has no assigned users. Nothing to sync.');
            return;
        }

        // 2. Find Use Case "deneme 1"
        const useCase = await UseCase.findOne({ title: { $regex: /deneme 1/i } });
        if (!useCase) {
            console.error('Use Case "deneme 1" not found!');
            return;
        }
        console.log(`Found Use Case: ${useCase.title} (${useCase._id})`);
        console.log(`Use Case Assigned Experts (Before): ${useCase.assignedExperts}`);

        // 3. Sync
        // Convert ObjectIds to strings if necessary, but Mongoose handles mixed usually.
        // Ensure we are storing strings if the schema expects strings, or ObjectIds if ObjectIds.
        // The previous debug output showed Project had ObjectIds.
        // UseCase schema usually expects strings in the array based on frontend code `includes(u.id)`.

        // Let's use string versions to be safe for frontend comparison
        const expertIds = project.assignedUsers.map(id => id.toString());

        useCase.assignedExperts = expertIds;
        useCase.status = 'assigned'; // Update status too

        await UseCase.updateOne({ _id: useCase._id }, { $set: { assignedExperts: expertIds, status: 'assigned' } });

        console.log('✅ Updated Use Case assignments.');
        console.log(`Use Case Assigned Experts (After): ${expertIds}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

syncAssignments();
