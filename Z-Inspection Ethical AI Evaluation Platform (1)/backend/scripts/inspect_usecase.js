const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const UseCaseSchema = new mongoose.Schema({}, { strict: false });
const UseCase = mongoose.model('UseCase', UseCaseSchema);

async function inspectUseCase() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Search for "deneme1" or "deneme 1"
        const useCases = await UseCase.find({
            title: { $regex: /deneme/i }
        });

        console.log(`Found ${useCases.length} use cases.`);
        useCases.forEach(uc => {
            console.log('--------------------------------------------------');
            console.log(`ID: ${uc._id}`);
            console.log(`Title: ${uc.title}`);
            console.log(`Status: ${uc.status}`);
            console.log(`Assigned Experts (Raw):`, uc.assignedExperts);
            console.log(`Process Step:`, uc.processStep);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectUseCase();
