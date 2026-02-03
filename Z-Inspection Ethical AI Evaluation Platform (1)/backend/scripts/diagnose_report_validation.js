const mongoose = require('mongoose');
const { validateProjectForReporting } = require('../services/reportValidationService');
require('dotenv').config({ path: '../.env' });

// We need to register models because services often use them
const ProjectSchema = new mongoose.Schema({}, { strict: false });
const ResponseSchema = new mongoose.Schema({}, { strict: false });
const UserSchema = new mongoose.Schema({}, { strict: false });
const ScoreSchema = new mongoose.Schema({}, { strict: false });
const EvaluationSchema = new mongoose.Schema({}, { strict: false });
const TensionSchema = new mongoose.Schema({}, { strict: false });

// Register only if not already compiled to avoid OverwriteModelError
if (!mongoose.models.Project) mongoose.model('Project', ProjectSchema);
if (!mongoose.models.Response) mongoose.model('Response', ResponseSchema);
if (!mongoose.models.User) mongoose.model('User', UserSchema);
if (!mongoose.models.Score) mongoose.model('Score', ScoreSchema);
if (!mongoose.models.Evaluation) mongoose.model('Evaluation', EvaluationSchema);
if (!mongoose.models.Tension) mongoose.model('Tension', TensionSchema);

async function diagnoseReportValidation() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Find Project "deneme 1"
        const Project = mongoose.model('Project');
        const project = await Project.findOne({ title: { $regex: /deneme 1/i } });

        if (!project) {
            console.error('Project "deneme 1" not found!');
            return;
        }
        console.log(`Found Project: ${project.title} (${project._id})`);

        // Run Validation
        console.log('Running validation...');
        const result = await validateProjectForReporting(project._id);

        console.log('--------------------------------------------------');
        console.log('VALIDATION RESULT:', result.validityStatus);
        console.log('ERRORS:', result.errors);
        console.log('WARNINGS:', result.warnings);
        console.log('METADATA:', result.metadata);
        console.log('--------------------------------------------------');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

diagnoseReportValidation();
