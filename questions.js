// Each option carries a stable id tied to its content, not its position — so
// options can be shuffled for display without ever breaking scoring, which
// matches against correctOptionId, not array index.
const QUESTIONS = [
  // Algebra 1
  { id: 1, level: 'algebra1', question: 'Solve for x: 2x + 5 = 17', options: [
      { id: '1-0', text: '6' }, { id: '1-1', text: '11' }, { id: '1-2', text: '5' }, { id: '1-3', text: '8' }
    ], correctOptionId: '1-0' },
  { id: 2, level: 'algebra1', question: 'What is the slope of the line y = 3x + 4?', options: [
      { id: '2-0', text: '3' }, { id: '2-1', text: '4' }, { id: '2-2', text: '-3' }, { id: '2-3', text: '1/3' }
    ], correctOptionId: '2-0' },
  { id: 3, level: 'algebra1', question: 'Factor: x^2 - 9', options: [
      { id: '3-0', text: '(x-3)(x+3)' }, { id: '3-1', text: '(x-9)(x+1)' }, { id: '3-2', text: '(x-3)^2' }, { id: '3-3', text: '(x+9)(x-1)' }
    ], correctOptionId: '3-0' },
  // Geometry
  { id: 4, level: 'geometry', question: 'What is the sum of the interior angles of a triangle?', options: [
      { id: '4-0', text: '180 degrees' }, { id: '4-1', text: '360 degrees' }, { id: '4-2', text: '90 degrees' }, { id: '4-3', text: '270 degrees' }
    ], correctOptionId: '4-0' },
  { id: 5, level: 'geometry', question: 'A right triangle has legs of length 3 and 4. What is the hypotenuse?', options: [
      { id: '5-0', text: '5' }, { id: '5-1', text: '6' }, { id: '5-2', text: '7' }, { id: '5-3', text: '12' }
    ], correctOptionId: '5-0' },
  { id: 6, level: 'geometry', question: 'What is the area of a circle with radius 4? (in terms of pi)', options: [
      { id: '6-0', text: '16 pi' }, { id: '6-1', text: '8 pi' }, { id: '6-2', text: '4 pi' }, { id: '6-3', text: '32 pi' }
    ], correctOptionId: '6-0' },
  // Algebra 2
  { id: 7, level: 'algebra2', question: 'Solve: x^2 - 5x + 6 = 0', options: [
      { id: '7-0', text: 'x = 2 or 3' }, { id: '7-1', text: 'x = 1 or 6' }, { id: '7-2', text: 'x = -2 or -3' }, { id: '7-3', text: 'x = 2 or -3' }
    ], correctOptionId: '7-0' },
  { id: 8, level: 'algebra2', question: 'Simplify: 2^3 times 2^4', options: [
      { id: '8-0', text: '2^7' }, { id: '8-1', text: '2^12' }, { id: '8-2', text: '4^7' }, { id: '8-3', text: '2^1' }
    ], correctOptionId: '8-0' },
  { id: 9, level: 'algebra2', question: 'Solve the system: x + y = 10, x - y = 2. What is x?', options: [
      { id: '9-0', text: '6' }, { id: '9-1', text: '4' }, { id: '9-2', text: '8' }, { id: '9-3', text: '5' }
    ], correctOptionId: '9-0' },
  // Pre-Calculus
  { id: 10, level: 'precalc', question: 'What is log base 2 of 8?', options: [
      { id: '10-0', text: '3' }, { id: '10-1', text: '4' }, { id: '10-2', text: '2' }, { id: '10-3', text: '8' }
    ], correctOptionId: '10-0' },
  { id: 11, level: 'precalc', question: 'What is sin(90 degrees)?', options: [
      { id: '11-0', text: '1' }, { id: '11-1', text: '0' }, { id: '11-2', text: '-1' }, { id: '11-3', text: '1/2' }
    ], correctOptionId: '11-0' },
  { id: 12, level: 'precalc', question: 'What is the next term in the sequence 2, 6, 18, 54?', options: [
      { id: '12-0', text: '162' }, { id: '12-1', text: '108' }, { id: '12-2', text: '216' }, { id: '12-3', text: '72' }
    ], correctOptionId: '12-0' },
];
const LEVEL_ORDER = ['algebra1', 'geometry', 'algebra2', 'precalc'];
module.exports = { QUESTIONS, LEVEL_ORDER };
