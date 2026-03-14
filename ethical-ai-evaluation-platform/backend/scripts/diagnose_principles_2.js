const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Connect to MongoDB
if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI is missing in .env");
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ Check script connected to DB"))
    .catch(err => { console.error(err); process.exit(1); });

// Schemas
const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema, 'questions');
const ResponseSchema = new mongoose.Schema({}, { strict: false });
const Response = mongoose.model('Response', ResponseSchema, 'responses');
const ScoreSchema = new mongoose.Schema({}, { strict: false });
const Score = mongoose.model('Score', ScoreSchema, 'scores');

async function runDiagnosis() {
    try {
        const projectIdString = "67840134015694a1d82136e0"; // Assuming this is the project ID from context or I will verify
        // Wait, I don't have the project ID from the user explicitly in the prompt text, but I can find the latest project.

        // Find latest active project
        const latestResponse = await Response.findOne({}).sort({ updatedAt: -1 });
        const projectId = latestResponse ? latestResponse.projectId : null;

        if (!projectId) {
            console.log("❌ No recent project found.");
            return;
        }

        console.log(`🔍 Diagnosing Project ID: ${projectId}`);

        // 1. Check Questions in Database
        console.log("\n--- 1. QUESTION DEFINITIONS ---");
        const allQuestions = await Question.find({}); // Fetch key fields
        console.log(`Total Questions in DB: ${allQuestions.length}`);

        const principleCounts = {};
        const missingPrinciple = [];

        allQuestions.forEach(q => {
            const p = q.principleKey || q.principle;
            if (p) {
                principleCounts[p] = (principleCounts[p] || 0) + 1;
            } else {
                missingPrinciple.push(q.code || q._id);
            }
        });

        console.log("Questions per Principle (Raw DB):", principleCounts);
        if (missingPrinciple.length > 0) {
            console.log("⚠️ Questions missing 'principle/principleKey':", missingPrinciple.slice(0, 10));
        }

        // 2. Check Responses for this Project
        console.log("\n--- 2. RESPONSES ---");
        const responses = await Response.find({ projectId: projectId });
        console.log(`Total Response Docs: ${responses.length}`);

        let totalAnswers = 0;
        const answersPerScore = {};

        responses.forEach(r => {
            if (r.answers && Array.isArray(r.answers)) {
                totalAnswers += r.answers.length;
                r.answers.forEach(a => {
                    // check if score exists
                    if (a.answerScore !== undefined && a.answerScore !== null) {
                        const key = `score_${a.answerScore}`;
                        answersPerScore[key] = (answersPerScore[key] || 0) + 1;
                    } else {
                        answersPerScore['missing_score'] = (answersPerScore['missing_score'] || 0) + 1;
                    }
                });
            }
        });
        console.log(`Total Answers Found: ${totalAnswers}`);
        console.log("Answer Score Distribution:", answersPerScore);

        // 3. Check Scores (Generated Report Data)
        console.log("\n--- 3. SCORES (Report Data) ---");
        const scores = await Score.find({ projectId: projectId, role: { $ne: 'project' } });
        console.log(`Score Docs Found: ${scores.length}`);

        scores.forEach((s, idx) => {
            console.log(`\nEvaluator ${idx + 1} (${s.role}):`);
            if (s.byPrinciple) {
                Object.keys(s.byPrinciple).forEach(k => {
                    const val = s.byPrinciple[k];
                    if (val) {
                        console.log(`  - ${k}: n=${val.n}, risk=${val.risk}`);
                    }
                });
            }
        });

    } catch (error) {
        console.error("Diagnosis failed:", error);
    } finally {
        mongoose.connection.close();
    }
}

runDiagnosis();
