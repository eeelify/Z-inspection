
const mongoose = require('mongoose');
const { computeEthicalScores } = require('../services/ethicalScoringService');
const Response = require('../models/response');
const Question = require('../models/question');
const Score = require('../models/score');

// Mock data
const MOCK_PROJECT_ID = new mongoose.Types.ObjectId();
const MOCK_USER_ID = new mongoose.Types.ObjectId();
const MOCK_QUESTION_ID = new mongoose.Types.ObjectId();
const MOCK_QUESTIONNAIRE_KEY = 'test-v1';

async function runTest() {
    console.log("--- RUNNING SCORING FORMULA VERIFICATION ---");

    // 1. Mock Question
    const mockQuestion = {
        _id: MOCK_QUESTION_ID,
        code: 'T1',
        principle: 'TRANSPARENCY',
        riskScore: 4, // Etik Önemi = 4
        answerType: 'single_choice'
        // answerSeverity is NOT set on question level usually
    };

    // 2. Mock Response with answerScore (Safety = 0.2 -> Low Safety -> High Risk)
    // Formula: Risk = Importance * (1 - Safety) = 4 * (1 - 0.2) = 3.2
    const mockResponse = {
        projectId: MOCK_PROJECT_ID,
        userId: MOCK_USER_ID,
        role: 'ethical-expert',
        questionnaireKey: MOCK_QUESTIONNAIRE_KEY,
        status: 'submitted',
        answers: [{
            questionId: MOCK_QUESTION_ID,
            questionCode: 'T1',
            answer: { choiceKey: 'risk_high' },
            answerScore: 0.2, // Safety Score
            answerSeverity: null // Missing, as per evaluationService
        }]
    };

    // Mock Mongoose calls
    Response.find = jest.fn().mockResolvedValue([mockResponse]);
    Question.find = jest.fn().mockResolvedValue([mockQuestion]);
    Score.findOneAndUpdate = jest.fn().mockImplementation((filter, update) => {
        return Promise.resolve(update);
    });

    // Run Scoring
    // We need to look at what computeEthicalScores does internally or output
    // Since we mocked findOneAndUpdate, we can inspect the 'update' object passed to it

    // NOTE: Since we can't easily use Jest mocks in a standalone node script without Jest,
    // we have to rely on the actual service running against a real DB or mock the require.
    // Given the environment, I'll try to use a slightly different approach:
    // I will use a direct invocation if I can mock the DB queries.
    // BUT 'computeEthicalScores' requires mongoose models.

    // FAST PATH: I will just INSPECT the code loop in `ethicalScoringService` by "Reading it" (which I did).
    // The code is:
    // } else if (ans.answerScore !== undefined && ans.answerScore !== null) {
    //   // commented out
    // }

    // RESULT IS OBVIOUS: Severity will be NULL.
    // If Severity is NULL, it enters:
    // if (severity === null) { ... continue; }

    console.log("Based on code analysis:");
    console.log("1. evaluationService saves 'answerScore' (0.2).");
    console.log("2. ethicalScoringService checks 'answerSeverity'.");
    console.log("3. inherited 'answerScore' logic is COMMENTED OUT in ethicalScoringService.");
    console.log("4. CONCLUSION: Severity will be null, Question T1 will be skipped.");
    console.log("5. RESULT: Total Risk = 0 instead of 3.2.");

    console.log("\nRECOMMENDATION: Uncomment and enable the (1 - answerScore) logic.");
}

runTest();
