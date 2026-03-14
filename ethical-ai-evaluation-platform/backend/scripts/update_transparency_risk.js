const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const ResponseSchema = new mongoose.Schema({}, { strict: false });
const Response = mongoose.model('Response', ResponseSchema);
const ProjectSchema = new mongoose.Schema({}, { strict: false });
const Project = mongoose.model('Project', ProjectSchema);
const ScoreSchema = new mongoose.Schema({}, { strict: false });
const Score = mongoose.model('Score', ScoreSchema);

async function forceUpdate() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) return;
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const project = await Project.findOne({ title: { $regex: /deneme 1/i } });
        if (!project) return;

        // Direct updates for specific choice keys
        // completely_unclear (Score 0) -> Severity 1.0
        const r1 = await Response.updateMany(
            { projectId: project._id, "answers.answer.choiceKey": "completely_unclear" },
            { $set: { "answers.$[elem].answerSeverity": 1.0, "answers.$[elem].score": 0 } },
            { arrayFilters: [{ "elem.answer.choiceKey": "completely_unclear" }] }
        );
        console.log(`Updated completely_unclear to Severity 1.0: ${r1.modifiedCount} docs`);

        // somewhat_unclear (Score 2) -> Severity 0.5
        const r2 = await Response.updateMany(
            { projectId: project._id, "answers.answer.choiceKey": "somewhat_unclear" },
            { $set: { "answers.$[elem].answerSeverity": 0.5, "answers.$[elem].score": 2 } },
            { arrayFilters: [{ "elem.answer.choiceKey": "somewhat_unclear" }] }
        );
        console.log(`Updated somewhat_unclear to Severity 0.5: ${r2.modifiedCount} docs`);

        // no (Score 0?) -> Severity 1.0 (Assuming 'no' is bad for Transparency)
        // T2 "Is it transparent?" -> No.
        const r3 = await Response.updateMany(
            { projectId: project._id, "answers.answer.choiceKey": "no", "answers.questionCode": { $in: ["T1", "T2", "T3", "T4", "T5"] } },
            { $set: { "answers.$[elem].answerSeverity": 1.0, "answers.$[elem].score": 0 } },
            { arrayFilters: [{ "elem.answer.choiceKey": "no", "elem.questionCode": { $in: ["T1", "T2", "T3", "T4", "T5"] } }] }
        );
        console.log(`Updated 'no' (Transparency) to Severity 1.0: ${r3.modifiedCount} docs`);

        await Score.deleteMany({ projectId: project._id });
        console.log(`Deleted stale scores.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

forceUpdate();
