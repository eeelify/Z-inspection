const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const ResponseSchema = new mongoose.Schema({}, { strict: false });
const QuestionSchema = new mongoose.Schema({}, { strict: false });
const ProjectSchema = new mongoose.Schema({ title: String }, { strict: false });

const Response = mongoose.model('Response', ResponseSchema);
const Question = mongoose.model('Question', QuestionSchema);
const Project = mongoose.model('Project', ProjectSchema);

async function inspectContent() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) return;
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const project = await Project.findOne({ title: { $regex: /deneme 1/i } });
        if (!project) return;
        console.log(`Project: ${project.title}`);

        const responses = await Response.find({ projectId: project._id }).populate({
            path: 'answers.questionId',
            model: 'Question',
            strictPopulate: false
        });

        responses.forEach((r, idx) => {
            console.log(`\nResponse #${idx + 1} (Role: ${r.role})`);

            r.answers.forEach(a => {
                const q = a.questionId;
                const principle = q ? (q.principle || q.category) : 'Unknown';

                if (principle && principle.toUpperCase().includes('TRANSPARENCY')) {
                    console.log(`  [${a.questionCode}] Answer Content:`);
                    console.log(`    ChoiceKey: ${a.answer?.choiceKey}`);
                    console.log(`    Text: ${a.answer?.text}`);
                    console.log(`    Stored Severity: ${a.answerSeverity}`);
                    console.log(`    Stored Score (Legacy): ${a.answerScore}`);
                }
            });
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectContent();
