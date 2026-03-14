const mongoose = require('mongoose');
const fs = require('fs');

function log(msg) {
    console.log(msg);
    fs.appendFileSync('fix_responses.log', msg + '\n');
}

// Schemas
const AnswerSchema = new mongoose.Schema({
    questionCode: String,
    answer: mongoose.Schema.Types.Mixed,
    score: Number,
    answerScore: Number, // Legacy field but we will populate it
    answerSeverity: Number // The field causing issues
}, { _id: false, strict: false });

const ResponseSchema = new mongoose.Schema({
    projectId: mongoose.Schema.Types.ObjectId,
    answers: [AnswerSchema]
}, { collection: 'responses', strict: false });

const QuestionSchema = new mongoose.Schema({
    code: String,
    questionnaireKey: String,
    options: [mongoose.Schema.Types.Mixed],
    answerType: String
}, { collection: 'questions', strict: false });

const ProjectSchema = new mongoose.Schema({
    title: String
}, { collection: 'projects', strict: false });

async function run() {
    fs.writeFileSync('fix_responses.log', '');
    try {
        const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(uri);
        log('Connected to DB');

        const Project = mongoose.model('Project', ProjectSchema);
        const Response = mongoose.model('Response', ResponseSchema);
        const Question = mongoose.model('Question', QuestionSchema);

        const project = await Project.findOne({ title: /Tutor AI/i });
        if (!project) {
            log('Project not found');
            process.exit(1);
        }
        log(`Project: ${project.title} (${project._id})`);

        // Get all questions to build a map
        const allQuestions = await Question.find({});
        const questionMap = new Map(); // Key: questionnaireKey_code
        allQuestions.forEach(q => {
            if (q.questionnaireKey && q.code) {
                questionMap.set(`${q.questionnaireKey}_${q.code}`, q);
            }
        });
        log(`Loaded ${allQuestions.length} questions`);

        // Get all responses for the project
        const responses = await Response.find({ projectId: project._id });
        log(`Found ${responses.length} responses to process`);

        let totalUpdated = 0;

        for (const response of responses) {
            let modified = false;
            log(`Processing Response: ${response._id} (Key: ${response.questionnaireKey})`);

            for (const answer of response.answers) {
                const qKey = `${response.questionnaireKey}_${answer.questionCode}`;
                const question = questionMap.get(qKey);

                if (!question) {
                    log(`  ⚠ Question not found for code: ${answer.questionCode}`);
                    continue;
                }

                // Logic for Single Choice
                if (question.answerType === 'single_choice' && answer.answer && answer.answer.choiceKey) {
                    const option = question.options.find(o => o.key === answer.answer.choiceKey);
                    if (option && option.answerScore !== undefined) {

                        const correctScore = option.answerScore;
                        const correctSeverity = 1 - correctScore;

                        // Check if update is needed
                        // Check if answerScore is missing OR mismatch
                        // Check if answerSeverity is missing OR mismatch
                        // Tolerance for float comparison
                        const scoreDiff = Math.abs((answer.answerScore || 0) - correctScore) > 0.001;
                        const severityDiff = Math.abs((answer.answerSeverity || 0) - correctSeverity) > 0.001;
                        const scoreMissing = answer.answerScore === undefined || answer.answerScore === null;

                        if (scoreMissing || scoreDiff || severityDiff) {
                            log(`  Fixing ${answer.questionCode}: Choice=${answer.answer.choiceKey}`);
                            log(`    Old: Score=${answer.answerScore}, Sev=${answer.answerSeverity}`);
                            log(`    New: Score=${correctScore}, Sev=${correctSeverity}`);

                            answer.answerScore = correctScore;
                            answer.answerSeverity = correctSeverity;
                            modified = true;
                        }
                    } else {
                        log(`  ⚠ Option score not found for ${answer.questionCode} choice ${answer.answer.choiceKey}`);
                    }
                }

                // Logic for Multi Choice
                else if (question.answerType === 'multi_choice' && answer.answer && answer.answer.multiChoiceKeys) {
                    const selected = question.options.filter(o => answer.answer.multiChoiceKeys.includes(o.key));
                    if (selected.length > 0) {
                        const sum = selected.reduce((acc, o) => acc + (o.answerScore || 0), 0);
                        const avg = sum / selected.length;
                        const correctSeverity = 1 - avg;

                        const scoreDiff = Math.abs((answer.answerScore || 0) - avg) > 0.001;
                        const severityDiff = Math.abs((answer.answerSeverity || 0) - correctSeverity) > 0.001;
                        const scoreMissing = answer.answerScore === undefined || answer.answerScore === null;

                        if (scoreMissing || scoreDiff || severityDiff) {
                            log(`  Fixing ${answer.questionCode}: MultiChoice`);
                            log(`    Old: Score=${answer.answerScore}, Sev=${answer.answerSeverity}`);
                            log(`    New: Score=${avg}, Sev=${correctSeverity}`);

                            answer.answerScore = avg;
                            answer.answerSeverity = correctSeverity;
                            modified = true;
                        }
                    }
                }
            }

            if (modified) {
                // Must use markModified because we are modifying Mixed types or subdocuments loosely
                response.markModified('answers');
                await response.save();
                totalUpdated++;
                log(`  ✅ Saved Response ${response._id}`);
            } else {
                log(`  No changes needed for ${response._id}`);
            }
        }

        log(`\nJob Complete. Updated ${totalUpdated} responses.`);

        // Trigger Re-computation (Optional, but good practice script-wise)
        // We can't easily import the service logic here without dependencies, 
        // but saving the response might trigger things if there were hooks (there aren't).
        // The user will need to regenerate the report from UI which might trigger computation or we can call the compute endpoint.

        await mongoose.disconnect();

    } catch (e) {
        log('Error: ' + e.message);
        console.error(e);
    }
}

run();
