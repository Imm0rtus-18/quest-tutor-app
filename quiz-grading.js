// Pure quiz-grading logic — the one source of truth for comparing an
// answer to a question's correctIndex, shared by POST /api/quiz/answer
// (battle mode, one question at a time) and POST /api/quiz/submit
// (classic mode, full-array and battle's final step alike). Pulled out
// of server.js (which can't be require()'d standalone — it connects to
// Postgres and calls app.listen() at import time) so it's unit-testable
// with no network or database involved.

function isCorrectAnswer(question, selectedIndex) {
  return selectedIndex === question.correctIndex;
}

// questions: the session's served questions (each has correctIndex —
// never sent to the client). answers: [{questionId, selectedIndex}],
// in any order, one entry per answered question (unanswered questions
// just have no entry and grade as incorrect/null).
function gradeQuizAnswers(questions, answers) {
  const answerByQid = new Map((answers || []).map(a => [a.questionId, a.selectedIndex]));
  let correctCount = 0;
  const gradedAnswers = questions.map(q => {
    const selectedIndex = answerByQid.has(q.id) ? answerByQid.get(q.id) : null;
    const correct = isCorrectAnswer(q, selectedIndex);
    if (correct) correctCount++;
    return { questionId: q.id, selectedIndex, correct, concept: q.concept };
  });
  const total = questions.length;
  const passed = correctCount >= Math.ceil(total * 0.9); // 90%+ (9/10) = pass
  return { gradedAnswers, correctCount, total, passed };
}

// Has this exact question already been answered in the raw (ungraded)
// answers array battle mode builds up incrementally via /api/quiz/answer?
function hasAnsweredQuestion(existingAnswers, questionId) {
  return Array.isArray(existingAnswers) && existingAnswers.some(a => a.questionId === questionId);
}

module.exports = { isCorrectAnswer, gradeQuizAnswers, hasAnsweredQuestion };
