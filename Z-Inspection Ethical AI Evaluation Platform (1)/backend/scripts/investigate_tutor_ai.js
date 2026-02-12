const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const parts = trimmed.split('=');
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^[\"']|[\"']$/g, '');
            if (key === 'MONGODB_URI' || key === 'MONGO_URI') {
                process.env.MONGODB_URI = val;
            }
        }
    }
}

async function investigateTutorAI() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Define models
        if (!mongoose.models.Project) mongoose.model('Project', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.Response) mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.Question) mongoose.model('Question', new mongoose.Schema({}, { strict: false }));

        const Score = require('../models/score');
        const Project = mongoose.model('Project');
        const Response = mongoose.model('Response');
        const Question = mongoose.model('Question');

        // Find Tutor AI project
        const project = await Project.findOne({
            title: /Tutor AI/i
        }).lean();

        if (!project) {
            throw new Error('Tutor AI project not found');
        }

        console.log(`Found project: ${project.title}`);
        console.log(`Project ID: ${project._id}`);

        // Get all responses for this project
        const responses = await Response.find({
            projectId: project._id
        }).lean();

        console.log(`\nFound ${responses.length} responses`);

        // Get all scores
        const scores = await Score.find({
            projectId: project._id
        }).lean();

        console.log(`Found ${scores.length} scores`);

        // Analyze responses in detail
        const analysis = {
            projectId: project._id.toString(),
            projectTitle: project.title,
            responseCount: responses.length,
            scoreCount: scores.length,
            expertResponses: [],
            scoreDetails: []
        };

        // For each response, analyze the answers
        for (const response of responses) {
            const answerAnalysis = {
                userId: response.userId?.toString(),
                role: response.role,
                status: response.status,
                totalAnswers: response.answers?.length || 0,
                answerDetails: []
            };

            if (response.answers) {
                for (const answer of response.answers) {
                    const question = await Question.findById(answer.questionId).lean();

                    answerAnalysis.answerDetails.push({
                        questionId: answer.questionId?.toString(),
                        questionText: question?.text ? String(question.text).substring(0, 100) : 'N/A',
                        principle: question?.principle || 'N/A',
                        importance: answer.importance,
                        selectedOptionKey: answer.selectedOptionKey,
                        answerScore: answer.answerScore,
                        calculatedERCForThisAnswer: answer.importance && answer.answerScore !== undefined
                            ? answer.importance * (1 - answer.answerScore)
                            : null
                    });
                }
            }

            analysis.expertResponses.push(answerAnalysis);
        }

        // Analyze scores
        for (const score of scores) {
            analysis.scoreDetails.push({
                userId: score.userId?.toString(),
                totalsOverall: score.totalsOverall,
                byPrincipleOverall: Object.keys(score.byPrincipleOverall || {}).map(principle => ({
                    principle,
                    cumulativeRisk: score.byPrincipleOverall[principle]?.cumulativeRisk,
                    answerCount: score.byPrincipleOverall[principle]?.answerCount,
                    avgERC: score.byPrincipleOverall[principle]?.avg
                }))
            });
        }

        fs.writeFileSync('tutor_ai_analysis.json', JSON.stringify(analysis, null, 2));
        console.log('\n✅ Analysis written to tutor_ai_analysis.json');

    } catch (error) {
        console.error('Error:', error);
        fs.writeFileSync('tutor_ai_analysis.json', JSON.stringify({ error: error.message }, null, 2));
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

investigateTutorAI();
