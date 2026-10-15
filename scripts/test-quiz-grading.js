// Standalone test for quiz-grading.js — no network, no database. Run with:
//   node scripts/test-quiz-grading.js
const assert = require('assert');
const { isCorrectAnswer, gradeQuizAnswers, hasAnsweredQuestion } = require('../quiz-grading');

const questions = Array.from({ length: 10 }, (_, i) => ({
  id: 'q' + i, correctIndex: i % 4, concept: 'concept-' + i
}));

// isCorrectAnswer: exact match only.
assert.strictEqual(isCorrectAnswer(questions[0], 0), true);
assert.strictEqual(isCorrectAnswer(questions[0], 1), false);
assert.strictEqual(isCorrectAnswer(questions[0], null), false);
console.log('PASS: isCorrectAnswer compares exactly against correctIndex');

// gradeQuizAnswers: 9/10 correct passes (>=90%).
const nineCorrect = questions.map(q => ({ questionId: q.id, selectedIndex: q.correctIndex }));
nineCorrect[0].selectedIndex = (questions[0].correctIndex + 1) % 4; // wrong on purpose
let result = gradeQuizAnswers(questions, nineCorrect);
assert.strictEqual(result.correctCount, 9);
assert.strictEqual(result.total, 10);
assert.strictEqual(result.passed, true);
console.log('PASS: 9/10 correct passes (90% threshold)');

// 8/10 correct fails.
const eightCorrect = questions.map(q => ({ questionId: q.id, selectedIndex: q.correctIndex }));
eightCorrect[0].selectedIndex = (questions[0].correctIndex + 1) % 4;
eightCorrect[1].selectedIndex = (questions[1].correctIndex + 1) % 4;
result = gradeQuizAnswers(questions, eightCorrect);
assert.strictEqual(result.correctCount, 8);
assert.strictEqual(result.passed, false);
console.log('PASS: 8/10 correct fails (below 90% threshold)');

// Unanswered questions (missing from the answers array) grade as incorrect,
// not as a crash — this is the battle-mode "only some questions answered
// so far" case, and also the classic "left one blank" case.
const partial = questions.slice(0, 5).map(q => ({ questionId: q.id, selectedIndex: q.correctIndex }));
result = gradeQuizAnswers(questions, partial);
assert.strictEqual(result.correctCount, 5);
assert.strictEqual(result.gradedAnswers[9].selectedIndex, null);
assert.strictEqual(result.gradedAnswers[9].correct, false);
console.log('PASS: unanswered questions grade as incorrect with selectedIndex null, no crash');

// gradedAnswers carries concept through for remediation.
assert.strictEqual(result.gradedAnswers[0].concept, 'concept-0');
console.log('PASS: concept is carried through on each graded answer');

// hasAnsweredQuestion: the battle endpoint's "answer each index once" guard.
const existing = [{ questionId: 'q0', selectedIndex: 1 }, { questionId: 'q2', selectedIndex: 3 }];
assert.strictEqual(hasAnsweredQuestion(existing, 'q0'), true);
assert.strictEqual(hasAnsweredQuestion(existing, 'q1'), false);
assert.strictEqual(hasAnsweredQuestion(null, 'q0'), false);
assert.strictEqual(hasAnsweredQuestion(undefined, 'q0'), false);
console.log('PASS: hasAnsweredQuestion detects a duplicate answer and handles no-answers-yet safely');

console.log('\nAll quiz-grading.js tests passed.');
