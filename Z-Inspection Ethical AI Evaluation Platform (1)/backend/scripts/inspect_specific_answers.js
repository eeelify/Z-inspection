const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const ProjectSchema = new mongoose.Schema({ title: String }, { strict: false });
const ResponseSchema = new mongoose.Schema({}, { strict: false });
const QuestionSchema = new mongoose.Schema({}, { strict: false });

const Project = mongoose.model('Project', ProjectSchema);
const Response = mongoose.model('Response', ResponseSchema);
const Question = mongoose.model('Question', QuestionSchema);

async function inspectAnswers() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // 1. Find Project
        const project = await Project.findOne({ title: { $regex: /deneme 1/i } });
        if (!project) {
            console.error('Project "deneme 1" not found!');
            return;
        }
        console.log(`Project: ${project.title} (${project._id})`);

        // 2. Find Responses with strictPopulate: false
        const responses = await Response.find({ projectId: project._id }).populate({
            path: 'answers.questionId',
            model: 'Question',
            strictPopulate: false
        });

        console.log(`Found ${responses.length} responses.`);

        responses.forEach((r, rIdx) => {
            console.log(`\nResponse #${rIdx + 1} (User: ${r.userId}, Role: ${r.role})`);

            if (!r.answers || r.answers.length === 0) {
                console.log("  No answers.");
                return;
            }

            r.answers.forEach(a => {
                const q = a.questionId;
                let principle = 'Unknown';
                let qCode = 'Unknown';

                if (q) {
                    principle = q.principle || q.category || 'Unknown';
                    qCode = q.code;
                } else {
                    qCode = a.questionCode;
                }

                // Strict filter for debugging Transparency and Human Agency
                const pUpper = principle ? principle.toUpperCase() : 'UNKNOWN';

                if (!pUpper.includes('TRANSPARENCY') &&
                    !pUpper.includes('HUMAN AGENCY') &&
                    !pUpper.includes('OVERSIGHT') &&
                    !pUpper.includes('SOCIETAL')
                ) {
                    return;
                }

                // Log details
                console.log(`  - [${qCode}] Principle: "${principle}"`);
                console.log(`    Answer: ${JSON.stringify(a.answer)}`);
                console.log(`    Severity: ${a.answerSeverity}`);
            });
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectAnswers();
