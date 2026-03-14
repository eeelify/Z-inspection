/**
 * FIX: Count questions for scoringDisclosure from questionBreakdown instead of all system questions
 * 
 * The bug is that the current implementation counts ALL questions in the system (159),
 * not just questions for roles assigned to this project (e.g., 120 for Tutor AI).
 * 
 * Solution: Use the questionBreakdown from combinedScore which already contains only
 * the questions that were actually answered by the assigned evaluators.
 */

// BEFORE (line 1747-1755):
// const totalQuestionsCount = questions.length;  // ❌ All system questions (159)
// const qualitativeQuestionsCount = questions.filter(q => q.answerType === 'open_text').length;
// const quantitativeQuestionsCount = totalQuestionsCount - qualitativeQuestionsCount;

// AFTER:
// Use questionBreakdown from combinedScore instead
// This contains only questions from assigned evaluators' questionnaires
let totalQuestionsCount = 0;
let qualitativeQuestionsCount = 0;
let quantitativeQuestionsCount = 0;

if (combinedScore && combinedScore.questionBreakdown) {
    // Get unique question IDs from questionBreakdown
    const uniqueQuestionIds = new Set(
        combinedScore.questionBreakdown.map(q => q.questionId)
    );
    totalQuestionsCount = uniqueQuestionIds.size;

    // Count qualitative questions (those with manual risk input)
    qualitativeQuestionsCount = combinedScore.questionBreakdown.filter(q =>
        q.answerType === 'open_text' ||
        q.scoringMethod === 'manual_risk_input'
    ).length;

    quantitativeQuestionsCount = totalQuestionsCount - qualitativeQuestionsCount;
} else {
    // Fallback: if no combinedScore, try to count from responses
    console.warn('⚠️ No combinedScore available, question counts may be inaccurate');
}

module.exports = { fixedCountLogic: 'Use combinedScore.questionBreakdown instead of questions array' };
