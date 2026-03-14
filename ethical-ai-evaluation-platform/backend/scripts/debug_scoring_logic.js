const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

// Define Schemas
const ResponseSchema = new mongoose.Schema({}, { strict: false });
const QuestionSchema = new mongoose.Schema({}, { strict: false });
const ProjectSchema = new mongoose.Schema({ title: String }, { strict: false });

const Response = mongoose.model('Response', ResponseSchema);
const Question = mongoose.model('Question', QuestionSchema);
const Project = mongoose.model('Project', ProjectSchema);

const CANONICAL_PRINCIPLES = [
    'TRANSPARENCY', 'HUMAN AGENCY & OVERSIGHT', 'TECHNICAL ROBUSTNESS & SAFETY', 'PRIVACY & DATA GOVERNANCE', 'DIVERSITY, NON-DISCRIMINATION & FAIRNESS', 'SOCIETAL & INTERPERSONAL WELL-BEING', 'ACCOUNTABILITY'
];

function normalizePrinciple(principle) {
    if (!principle) return null;
    const upper = principle.toUpperCase();
    const mapping = {
        'TRANSPARENCY & EXPLAINABILITY': 'TRANSPARENCY',
        'HUMAN OVERSIGHT & CONTROL': 'HUMAN AGENCY & OVERSIGHT',
        'PRIVACY & DATA PROTECTION': 'PRIVACY & DATA GOVERNANCE',
        'ACCOUNTABILITY & RESPONSIBILITY': 'ACCOUNTABILITY',
        'LAWFULNESS & COMPLIANCE': 'ACCOUNTABILITY',
        'RISK MANAGEMENT & HARM PREVENTION': 'TECHNICAL ROBUSTNESS & SAFETY',
        'PURPOSE LIMITATION & DATA MINIMIZATION': 'PRIVACY & DATA GOVERNANCE',
        'USER RIGHTS & AUTONOMY': 'HUMAN AGENCY & OVERSIGHT'
    };
    if (CANONICAL_PRINCIPLES.includes(upper)) return upper;
    if (mapping[upper]) return mapping[upper];
    return null;
}

async function debugScoring() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) return;
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const project = await Project.findOne({ title: { $regex: /deneme 1/i } });
        if (!project) return;
        console.log(`Project: ${project.title}`);

        // Fetch Responses
        const responses = await Response.find({ projectId: project._id }).lean();
        console.log(`Found ${responses.length} responses.`);

        // Fetch Questions
        const questionIds = new Set();
        responses.forEach(r => r.answers.forEach(a => {
            if (a.questionId) questionIds.add(a.questionId.toString());
        }));
        const questionsFn = await Question.find({ _id: { $in: Array.from(questionIds) } }).lean();
        const questionMap = new Map(questionsFn.map(q => [q._id.toString(), q]));
        console.log(`Loaded ${questionMap.size} questions.`);

        // DEBUG LOOP
        let totalRisk = 0;

        responses.forEach((res, idx) => {
            console.log(`\nProcessing Response #${idx + 1} (Role: ${res.role})`);

            res.answers.forEach(ans => {
                const question = questionMap.get(ans.questionId?.toString());
                if (!question) return;

                const pKey = normalizePrinciple(question.principleKey || question.principle);

                // Focus on basic info
                const qCode = question.code || ans.questionCode;

                // Debug Transparency primarily
                if (pKey === 'TRANSPARENCY') {
                    console.log(`  [${qCode}] Principle: ${pKey} (Orig: ${question.principle})`);

                    // 1. Importance
                    let importance = 2; // Default
                    let source = "Default";
                    if (ans.importanceScore !== undefined && ans.importanceScore !== null) {
                        importance = ans.importanceScore;
                        source = "Answer Override";
                    } else if (question.riskScore !== undefined && question.riskScore !== null) {
                        importance = question.riskScore;
                        source = "Question.riskScore";
                    } else if (question.importance !== undefined && question.importance !== null) {
                        importance = question.importance;
                        source = "Question.importance";
                    }

                    // 2. Severity
                    let severity = null;
                    if (ans.answerSeverity !== undefined && ans.answerSeverity !== null) {
                        severity = Number(ans.answerSeverity);
                    }

                    // Check if skipped
                    if (severity === null) {
                        console.log(`     SKIPPED: Severity is null.`);
                    } else {
                        const contribution = importance * severity;
                        console.log(`     Calc: Imp(${importance})[${source}] * Sev(${severity}) = ${contribution}`);
                        totalRisk += contribution;
                    }
                }
            });
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

debugScoring();
