const QUESTIONS = [
  // Algebra 1
  { id: 1, level: 'algebra1', question: 'Solve for x: 2x + 5 = 17', options: ['6', '11', '5', '8'], correctIndex: 0 },
  { id: 2, level: 'algebra1', question: 'What is the slope of the line y = 3x + 4?', options: ['3', '4', '-3', '1/3'], correctIndex: 0 },
  { id: 3, level: 'algebra1', question: 'Factor: x^2 - 9', options: ['(x-3)(x+3)', '(x-9)(x+1)', '(x-3)^2', '(x+9)(x-1)'], correctIndex: 0 },
  // Geometry
  { id: 4, level: 'geometry', question: 'What is the sum of the interior angles of a triangle?', options: ['180 degrees', '360 degrees', '90 degrees', '270 degrees'], correctIndex: 0 },
  { id: 5, level: 'geometry', question: 'A right triangle has legs of length 3 and 4. What is the hypotenuse?', options: ['5', '6', '7', '12'], correctIndex: 0 },
  { id: 6, level: 'geometry', question: 'What is the area of a circle with radius 4? (in terms of pi)', options: ['16 pi', '8 pi', '4 pi', '32 pi'], correctIndex: 0 },
  // Algebra 2
  { id: 7, level: 'algebra2', question: 'Solve: x^2 - 5x + 6 = 0', options: ['x = 2 or 3', 'x = 1 or 6', 'x = -2 or -3', 'x = 2 or -3'], correctIndex: 0 },
  { id: 8, level: 'algebra2', question: 'Simplify: 2^3 times 2^4', options: ['2^7', '2^12', '4^7', '2^1'], correctIndex: 0 },
  { id: 9, level: 'algebra2', question: 'Solve the system: x + y = 10, x - y = 2. What is x?', options: ['6', '4', '8', '5'], correctIndex: 0 },
  // Pre-Calculus
  { id: 10, level: 'precalc', question: 'What is log base 2 of 8?', options: ['3', '4', '2', '8'], correctIndex: 0 },
  { id: 11, level: 'precalc', question: 'What is sin(90 degrees)?', options: ['1', '0', '-1', '1/2'], correctIndex: 0 },
  { id: 12, level: 'precalc', question: 'What is the next term in the sequence 2, 6, 18, 54?', options: ['162', '108', '216', '72'], correctIndex: 0 },
];
const LEVEL_ORDER = ['algebra1', 'geometry', 'algebra2', 'precalc'];
module.exports = { QUESTIONS, LEVEL_ORDER };
