const mongoose = require('mongoose');
const fs = require('fs');

function log(msg) {
    console.log(msg);
    fs.appendFileSync('debug_transparency.txt', msg + '\n');
}

// Minimal Schemas
const ScoreSchema = new mongoose.Schema({
    projectId: mongoose.Schema.Types.ObjectId,
    questionnaireKey: String,
    byPrinciple: mongoose.Schema.Types.Mixed,
    questionBreakdown: [mongoose.Schema.Types.Mixed]
}, { collection: 'scores', strict: false });

const ProjectSchema = new mongoose.Schema({
    title: String
}, { collection: 'projects', strict: false });

async function run() {
    fs.writeFileSync('debug_transparency.txt', '');
    try {
        const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(uri);
        log('Connected to DB');

        const Project = mongoose.model('Project', ProjectSchema);
        const Score = mongoose.model('Score', ScoreSchema);

        const project = await Project.findOne({ title: /Tutor AI/i });
        if (!project) {
            log('Project not found');
            process.exit(1);
        }
        log(`Project: ${project.title}`);

        // Get Responses
        const Response = mongoose.model('Response', new mongoose.Schema({
            projectId: mongoose.Schema.Types.ObjectId,
            answers: [mongoose.Schema.Types.Mixed]
        }, { collection: 'responses', strict: false }));

        const Question = mongoose.model('Question', new mongoose.Schema({
            code: String,
            principle: String,
            answerType: String,
            options: [mongoose.Schema.Types.Mixed]
        }, { collection: 'questions', strict: false }));

        const responses = await Response.find({ projectId: project._id }).select('+answers.answerScore');
        log(`Found ${responses.length} responses`);

        const allAnswers = responses.flatMap(r => r.answers || []);

        // Find Transparency Answers
        // Need to fetch questions first to verify principle
        const transparencyQuestions = await Question.find({
            $or: [
                { principle: /TRANSPARENCY/i },
                { principleKey: /TRANSPARENCY/i }
            ]
        });
        const transparencyQIds = transparencyQuestions.map(q => q._id.toString());
        log(`Found ${transparencyQuestions.length} Transparency Questions definitions`);

        const transparencyAnswers = allAnswers.filter(a => transparencyQIds.includes(a.questionId?.toString()));
        log(`Found ${transparencyAnswers.length} Transparency Answers in Responses`);

        if (transparencyAnswers.length > 0) {
            log('First Answer Structure:');
            log(JSON.stringify(transparencyAnswers[0], null, 2));

            // Find corresponding question definition
            const qDef = transparencyQuestions.find(q => q._id.toString() === transparencyAnswers[0].questionId.toString());
            log('Corresponding Question Definition:');
            log(JSON.stringify(qDef, null, 2));
        }

        /*
        transparencyItems.forEach((item, idx) => {
            log(`\n[${idx + 1}] ID: ${item.questionId}`);
            log(`    Text: ${(item.questionText || '').substring(0, 50)}...`);
            log(`    Answer: ${JSON.stringify(item.answer)}`); // Expecting { text:..., score:... }
            log(`    Importance: ${item.importance}`);
            log(`    Risk Score: ${item.riskScore}`);

            // Check formula manually
            const importance = item.importance || 0;
            const answerScore = item.answer?.score !== undefined ? item.answer.score : (item.answerScore !== undefined ? item.answerScore : -1);

            log(`    -> Debug: Imp(${importance}) * (1 - AnsScore(${answerScore})) = ${importance * (1 - answerScore)}`);
        });
        */

        await mongoose.disconnect();
    } catch (e) {
        log('Error: ' + e.message);
    }
}

run();
