const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = '6964d4e9d7a6755353c39e4b'; // "AI DESTEKLİ CV TARAMA SİSTEMİ" (approx) or provided ID
// User said: "AI DESTEKLİ CV TARAMA SİSTEMİ" cannot generate reports.
// ID from previous logs: 6964d4e9d7a6755353c39e4b

async function diagnose() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));
        console.log('✅ Connected to MongoDB');

        // Load Schemas safely
        const safeLoad = (name) => { try { require(`./models/${name}`); } catch (e) { if (!mongoose.models[name]) mongoose.model(name, new mongoose.Schema({}, { strict: false })); } };
        safeLoad('response');
        safeLoad('score');
        safeLoad('question');

        const Response = mongoose.model('Response');
        const Score = mongoose.model('Score');

        // 1. Check Counts
        console.log('\n--- 1. COUNTS ---');
        const responseCount = await Response.countDocuments({ projectId: PROJECT_ID });
        const scoreCount = await Score.countDocuments({ projectId: PROJECT_ID });
        console.log(`Responses: ${responseCount}`);
        console.log(`Scores: ${scoreCount}`);

        if (responseCount > 0 && scoreCount === 0) {
            console.log('❌ MISMATCH CONFIRMED: Responses exist but Scores are missing.');
        }

        // 2. Check Version Mismatch
        console.log('\n--- 2. VERSION CHECK ---');
        const sampleResponse = await Response.findOne({ projectId: PROJECT_ID }).lean();
        if (sampleResponse) {
            console.log(`Sample Response ID: ${sampleResponse._id}`);
            console.log(`QuestionnaireKey: ${sampleResponse.questionnaireKey}`);
            console.log(`QuestionnaireVersion: ${sampleResponse.questionnaireVersion}`);

            // Check expected? (Hard to check logic here, but logs help)
        } else {
            console.log('No responses found to check version.');
        }

        // 3. Inspect Answer Fields (Importance/Type)
        console.log('\n--- 3. FIELD INSPECTION ---');
        if (sampleResponse && sampleResponse.answers && sampleResponse.answers.length > 0) {
            // Check first few answers
            sampleResponse.answers.slice(0, 3).forEach((a, i) => {
                console.log(`Answer ${i}:`);
                console.log(`   questionCode: ${a.questionCode}`);
                console.log(`   answerScore: ${a.answerScore}`);
                console.log(`   importanceScore: ${a.importanceScore} (Type: ${typeof a.importanceScore})`);
                console.log(`   importance: ${a.importance}`);
                console.log(`   answer:`, a.answer);
            });

            // Aggregate Analysis
            const totalAnswers = sampleResponse.answers.length;
            const withImportanceScore = sampleResponse.answers.filter(a => a.importanceScore !== undefined).length;
            const withImportance = sampleResponse.answers.filter(a => a.importance !== undefined).length;
            const withAnswerScore = sampleResponse.answers.filter(a => a.answerScore !== undefined).length;

            console.log(`\nTotal Answers in Sample: ${totalAnswers}`);
            console.log(`With 'importanceScore': ${withImportanceScore}`);
            console.log(`With 'importance': ${withImportance}`);
            console.log(`With 'answerScore': ${withAnswerScore}`);
        }

        // 4. Check Answer Types (via Question Lookup)
        console.log('\n--- 4. ANSWER TYPES ---');
        if (sampleResponse) {
            const Question = mongoose.model('Question');
            // Get all questions for this questionnaire
            const questions = await Question.find({ questionnaireKey: sampleResponse.questionnaireKey }).select('code answerType principle').lean();
            const typeMap = {};
            questions.forEach(q => {
                typeMap[q.answerType] = (typeMap[q.answerType] || 0) + 1;
            });
            console.log('Question Answer Types Distribution:', typeMap);
        }

        await mongoose.disconnect();
        console.log('\n✅ Diagnosis Complete');

    } catch (error) {
        console.error('❌ Diagnosis Failed:', error);
        process.exit(1);
    }
}

diagnose();
