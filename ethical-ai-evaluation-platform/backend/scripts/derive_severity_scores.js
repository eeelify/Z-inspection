const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const { analyzeQualitativeSeverity } = require('../services/geminiService');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Failed:', err.message);
        process.exit(1);
    }
};

async function deriveSeverityScores() {
    await connectDB();

    try {
        const Question = require('../models/question');
        const Response = require('../models/response');

        console.log('🔍 Identifying qualitative answers needing severity derivation...');

        // 1. Find all open-text questions first to identify relevant answers
        const qualitativeQuestions = await Question.find({ answerType: 'open_text' }).lean();
        const qualitativeQuestionMap = new Map();
        qualitativeQuestions.forEach(q => qualitativeQuestionMap.set(q.code, q.text));

        console.log(`📝 Found ${qualitativeQuestions.length} qualitative question definitions.`);

        // 2. Find responses containing these questions with NULL answerScore
        // Note: MongoDB matches object field inside array.
        // We iterate efficiently: find documents with at least one matching answer, then filter.
        const responses = await Response.find({
            'answers': {
                $elemMatch: {
                    // Optimized: match any response that might have open text
                    // We will filter in memory to be precise about "open_text" type linkage
                    answerScore: null
                }
            }
        });

        console.log(`📂 Found ${responses.length} response documents to scan.`);

        let batch = [];
        const BATCH_SIZE = 10; // Gemini limit safety
        let totalUpdated = 0;

        for (const doc of responses) {
            let docModified = false;

            // Find specific answers in this doc that are open-text AND null score
            const answersToProcess = doc.answers.filter(a => {
                // Must be in our qualitative map
                const qText = qualitativeQuestionMap.get(a.questionCode);
                // Must have text content
                const hasText = a.answer && a.answer.text && a.answer.text.trim().length > 0;
                // Must be unscored
                const isUnscored = a.answerScore === null || a.answerScore === undefined;

                return qText && hasText && isUnscored;
            });

            if (answersToProcess.length === 0) continue;

            // Prepare batch items for Gemini
            // We use a unique ID "docId::answerIndex" to map back
            const geminiItems = answersToProcess.map(a => ({
                responseId: `${doc._id.toString()}::${doc.answers.indexOf(a)}`, // Encode index to update correctly
                text: a.answer.text,
                questionText: qualitativeQuestionMap.get(a.questionCode)
            }));

            console.log(`🤖 Analyzing ${geminiItems.length} qualitative answers for user ${doc.userId}...`);

            // Call Gemini (Atomic batch per user/doc to avoid huge payload)
            // Ideally we'd batch across docs, but per-doc is safer for updates
            const results = await analyzeQualitativeSeverity(geminiItems);

            if (results && results.length > 0) {
                // Apply updates
                results.forEach(res => {
                    const [docId, idxStr] = res.responseId.split('::');
                    const idx = parseInt(idxStr);

                    if (res.derivedSeverity !== undefined && res.derivedSeverity !== null) {
                        // Update the answer in the specific index
                        doc.answers[idx].answerScore = res.derivedSeverity;
                        doc.answers[idx].scoreSuggested = res.derivedSeverity; // Store as suggested too

                        // Append logic note
                        const note = `[AI Derived Severity: ${res.derivedSeverity}] ${res.justification || ''}`;
                        doc.answers[idx].notes = doc.answers[idx].notes
                            ? `${doc.answers[idx].notes}\n${note}`
                            : note;

                        docModified = true;
                        totalUpdated++;
                    }
                });
            }

            if (docModified) {
                await doc.save();
                console.log(`✅ Updated response ${doc._id}`);
            }
        }

        console.log(`\n🎉 Completed! Derivation applied to ${totalUpdated} answers.`);
        console.log(`\n⚠️ IMPORTANT: You must run 'node scripts/recomputeScoresRPN.js' (or similar) to reflect these new scores in the project totals.`);

    } catch (error) {
        console.error('FATAL ERROR:', error);
    } finally {
        await mongoose.disconnect();
    }
}

deriveSeverityScores();
