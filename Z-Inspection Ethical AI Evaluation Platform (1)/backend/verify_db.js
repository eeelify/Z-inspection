const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Try to load env from server location
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, 'env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ethical-ai';

async function verifyDb() {
    console.log('--- DB VERIFICATION START ---');
    console.log('Node version:', process.version);
    console.log('Attempting to connect to:', MONGO_URI.replace(/:([^:@]+)@/, ':****@')); // Hide password if any

    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000
        });
        console.log('✅ Connected to MongoDB');

        const Response = mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
        const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }));
        const Report = mongoose.model('Report', new mongoose.Schema({}, { strict: false }));

        // 1. Projects & Reports Check
        const projectCount = await Project.countDocuments();
        const projects = await Project.find({}).limit(5).select('title createdByAdmin').lean();
        console.log(`Total Projects in DB: ${projectCount}`);
        console.log('Sample Projects:', JSON.stringify(projects, null, 2));

        const reportCount = await Report.countDocuments();
        console.log(`Total Reports in DB: ${reportCount}`);

        // 2. MCQ Corruption Check
        const allResponses = await Response.find({}).lean();
        console.log(`Total Responses in DB: ${allResponses.length}`);

        let corruptedCount = 0;
        let objectChoiceCount = 0;

        allResponses.forEach(res => {
            (res.answers || []).forEach(ans => {
                if (ans.answer) {
                    if (ans.answer.choiceKey === '[object Object]') corruptedCount++;
                    if (ans.answer.choiceKey && typeof ans.answer.choiceKey === 'object') objectChoiceCount++;
                }
            });
        });

        console.log(`MCQ answers with "[object Object]" corruption: ${corruptedCount}`);
        console.log(`MCQ answers preserved as objects (incorrect for DB): ${objectChoiceCount}`);

        // Inspect one healthy response if possible
        const healthy = allResponses.find(r => r.answers && r.answers.length > 0);
        if (healthy) {
            console.log('Sample Healthy Response Answer Schema:', JSON.stringify(healthy.answers[0].answer, null, 2));
        }

        // 3. Question Count Sanity
        const sampleReport = await Report.findOne({ 'scoring': { $exists: true } }).sort({ createdAt: -1 }).lean();
        if (sampleReport && sampleReport.scoring) {
            console.log('Sample Report Scoring Structure (Top-level keys):', Object.keys(sampleReport.scoring));
        }

        console.log('--- DB VERIFICATION END ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Verification Script Failed');
        console.error('Error Name:', err.name);
        console.error('Error Message:', err.message);
        process.exit(1);
    }
}

verifyDb();
