// Original in-chapter quiz questions, written fresh for this app — not
// derived from, paraphrasing, or structurally mirroring any specific
// textbook's exercise problems (same rule as curriculum.js's content
// field, and for the same reason: a textbook's problem sets are protected
// separately from the topic list itself, which is fine to use).
//
// chapterId matches curriculum.js's topic ids exactly. Each question has a
// concept tag distinct enough to target remediation at a specific weak
// spot rather than "review the whole chapter." Options are stored here in
// a fixed order (correctIndex points at the right one) — actual shuffling
// happens at serve-time, same as questions.js/onboarding.
//
// All 12 Algebra 1 chapters populated — 120 questions total, 10 per
// chapter, matching curriculum.js's topic ids.
const QUIZZES = {
  'algebra1-01': [
    {
      id: 'algebra1-01-q1',
      chapterId: 'algebra1-01',
      question: 'Evaluate: 8 + 2 × 3 − 4 ÷ 2',
      options: ['13', '10', '12', '14'],
      correctIndex: 2,
      concept: 'order-of-operations-pemdas'
    },
    {
      id: 'algebra1-01-q2',
      chapterId: 'algebra1-01',
      question: 'If x = 4, what is the value of 5x + 3?',
      options: ['23', '35', '12', '17'],
      correctIndex: 0,
      concept: 'evaluating-expressions-by-substitution'
    },
    {
      id: 'algebra1-01-q3',
      chapterId: 'algebra1-01',
      question: "Which expression represents 'the sum of a number n and 9'?",
      options: ['9 − n', 'n − 9', 'n + 9', '9n'],
      correctIndex: 2,
      concept: 'translating-sum-phrases'
    },
    {
      id: 'algebra1-01-q4',
      chapterId: 'algebra1-01',
      question: "Which expression represents 'seven less than a number x'?",
      options: ['7 − x', 'x − 7', '7x', 'x + 7'],
      correctIndex: 1,
      concept: 'less-than-phrase-order-reversal'
    },
    {
      id: 'algebra1-01-q5',
      chapterId: 'algebra1-01',
      question: 'In the expression 3x + 5, what does the variable x represent?',
      options: [
        'A value that always equals 1',
        'The answer to the expression',
        'A fixed value that never changes',
        'A number that can change or is not yet known'
      ],
      correctIndex: 3,
      concept: 'variables-as-unknowns'
    },
    {
      id: 'algebra1-01-q6',
      chapterId: 'algebra1-01',
      question: 'Evaluate: 2 + 3 × 4^2',
      options: ['50', '80', '400', '26'],
      correctIndex: 0,
      concept: 'order-of-operations-with-exponents'
    },
    {
      id: 'algebra1-01-q7',
      chapterId: 'algebra1-01',
      question: "Which expression represents 'the product of 6 and a number y, decreased by 4'?",
      options: ['6(y − 4)', '6y + 4', '6y − 4', '4 − 6y'],
      correctIndex: 2,
      concept: 'translating-product-and-difference-phrases'
    },
    {
      id: 'algebra1-01-q8',
      chapterId: 'algebra1-01',
      question: 'Evaluate: 20 ÷ 4 × 5',
      options: ['1', '25', '10', '20'],
      correctIndex: 1,
      concept: 'order-of-operations-left-to-right'
    },
    {
      id: 'algebra1-01-q9',
      chapterId: 'algebra1-01',
      question: 'If a = 2 and b = 6, what is the value of 4a + b − 3?',
      options: ['29', '20', '17', '11'],
      correctIndex: 3,
      concept: 'evaluating-multi-term-expressions'
    },
    {
      id: 'algebra1-01-q10',
      chapterId: 'algebra1-01',
      question: "Which expression represents 'the quotient of a number n and 4, increased by 3'?",
      options: ['(n + 3) / 4', 'n / 4 + 3', '4 / n + 3', 'n / (4 + 3)'],
      correctIndex: 1,
      concept: 'translating-quotient-and-sum-phrases'
    }
  ],
  'algebra1-02': [
    {
      id: 'algebra1-02-q1',
      chapterId: 'algebra1-02',
      question: '|−12| = ?',
      options: ['−12', '12', '144', '0'],
      correctIndex: 1,
      concept: 'absolute-value-basics'
    },
    {
      id: 'algebra1-02-q2',
      chapterId: 'algebra1-02',
      question: 'Simplify: −8 + 5',
      options: ['3', '−13', '13', '−3'],
      correctIndex: 3,
      concept: 'adding-signed-numbers'
    },
    {
      id: 'algebra1-02-q3',
      chapterId: 'algebra1-02',
      question: 'Simplify: 6 − (−9)',
      options: ['−15', '−3', '3', '15'],
      correctIndex: 3,
      concept: 'subtracting-negative-numbers'
    },
    {
      id: 'algebra1-02-q4',
      chapterId: 'algebra1-02',
      question: 'Which property is shown by: 4 + 7 = 7 + 4?',
      options: ['Commutative property of addition', 'Identity property of addition', 'Associative property of addition', 'Distributive property'],
      correctIndex: 0,
      concept: 'commutative-property-identification'
    },
    {
      id: 'algebra1-02-q5',
      chapterId: 'algebra1-02',
      question: 'Which property is shown by: (2 + 5) + 8 = 2 + (5 + 8)?',
      options: ['Associative property of addition', 'Commutative property of addition', 'Inverse property', 'Distributive property'],
      correctIndex: 0,
      concept: 'associative-property-identification'
    },
    {
      id: 'algebra1-02-q6',
      chapterId: 'algebra1-02',
      question: 'Use the distributive property to expand: 5(x + 6)',
      options: ['5x + 11', '5x + 30', '5x + 6', 'x + 30'],
      correctIndex: 1,
      concept: 'applying-distributive-property'
    },
    {
      id: 'algebra1-02-q7',
      chapterId: 'algebra1-02',
      question: 'What is the additive inverse of −7?',
      options: ['0', '−7', '7', '1/7'],
      correctIndex: 2,
      concept: 'additive-inverse'
    },
    {
      id: 'algebra1-02-q8',
      chapterId: 'algebra1-02',
      question: 'What is the multiplicative inverse (reciprocal) of 4?',
      options: ['0', '−4', '4', '1/4'],
      correctIndex: 3,
      concept: 'multiplicative-inverse'
    },
    {
      id: 'algebra1-02-q9',
      chapterId: 'algebra1-02',
      question: 'Simplify: −5 + 12 − (−3)',
      options: ['20', '4', '10', '−10'],
      correctIndex: 2,
      concept: 'combining-signed-number-operations'
    },
    {
      id: 'algebra1-02-q10',
      chapterId: 'algebra1-02',
      question: 'Which equation demonstrates the identity property of multiplication?',
      options: ['9 × 0 = 0', '9 × 1 = 9', '9 × (1/9) = 1', '9 + 0 = 9'],
      correctIndex: 1,
      concept: 'identity-property-of-multiplication'
    }
  ],
  'algebra1-03': [
    {
      id: 'algebra1-03-q1',
      chapterId: 'algebra1-03',
      question: 'Solve: x + 9 = 17',
      options: ['x = 26', 'x = 8', 'x = 153', 'x = −8'],
      correctIndex: 1,
      concept: 'one-step-equations-addition-subtraction'
    },
    {
      id: 'algebra1-03-q2',
      chapterId: 'algebra1-03',
      question: 'Solve: 4x = 28',
      options: ['x = 32', 'x = 112', 'x = 7', 'x = 24'],
      correctIndex: 2,
      concept: 'one-step-equations-multiplication-division'
    },
    {
      id: 'algebra1-03-q3',
      chapterId: 'algebra1-03',
      question: 'Solve: 3x − 5 = 16',
      options: ['x = 21', 'x = 3', 'x = 7', 'x = 11'],
      correctIndex: 2,
      concept: 'two-step-equations'
    },
    {
      id: 'algebra1-03-q4',
      chapterId: 'algebra1-03',
      question: 'Solve: 4(x − 3) = 2x + 6',
      options: ['x = −3', 'x = 18', 'x = 3', 'x = 9'],
      correctIndex: 3,
      concept: 'multi-step-equations-with-distribution'
    },
    {
      id: 'algebra1-03-q5',
      chapterId: 'algebra1-03',
      question: 'Solve: 2(x + 5) = 3x − 1',
      options: ['x = −11', 'x = 11', 'x = 9', 'x = 3'],
      correctIndex: 1,
      concept: 'multi-step-equations-distribute-and-both-sides'
    },
    {
      id: 'algebra1-03-q6',
      chapterId: 'algebra1-03',
      question: 'Solve: 5x + 2 = 3x + 14',
      options: ['x = 6', 'x = −6', 'x = 3', 'x = 16'],
      correctIndex: 0,
      concept: 'equations-variable-terms-both-sides'
    },
    {
      id: 'algebra1-03-q7',
      chapterId: 'algebra1-03',
      question: 'Which property justifies: if x − 4 = 10, then x − 4 + 4 = 10 + 4?',
      options: ['Multiplication property of equality', 'Addition property of equality', 'Distributive property', 'Subtraction property of equality'],
      correctIndex: 1,
      concept: 'addition-property-of-equality'
    },
    {
      id: 'algebra1-03-q8',
      chapterId: 'algebra1-03',
      question: 'Which property justifies: if x/3 = 9, then (x/3) × 3 = 9 × 3?',
      options: ['Commutative property', 'Addition property of equality', 'Multiplication property of equality', 'Division property of equality'],
      correctIndex: 2,
      concept: 'multiplication-property-of-equality'
    },
    {
      id: 'algebra1-03-q9',
      chapterId: 'algebra1-03',
      question: 'Solve: −2x + 7 = 1',
      options: ['x = −3', 'x = 4', 'x = 13', 'x = 3'],
      correctIndex: 3,
      concept: 'equations-with-negative-coefficients'
    },
    {
      id: 'algebra1-03-q10',
      chapterId: 'algebra1-03',
      question: 'Is x = 5 a solution to 2x − 3 = 7?',
      options: ['Yes, because 2(5) − 3 = 7', 'Yes, because 2(5) − 3 = 10', 'No, because 2(5) − 3 = 13', 'No, because 2(5) − 3 = 2'],
      correctIndex: 0,
      concept: 'verifying-solutions-by-substitution'
    }
  ],
  'algebra1-04': [
    {
      id: 'algebra1-04-q1',
      chapterId: 'algebra1-04',
      question: 'In the ordered pair (3, −5), what is the y-coordinate?',
      options: ['3', '−5', '5', '−3'],
      correctIndex: 1,
      concept: 'reading-ordered-pairs'
    },
    {
      id: 'algebra1-04-q2',
      chapterId: 'algebra1-04',
      question: 'Find the x-intercept of y = 2x − 6',
      options: ['(0, 3)', '(3, 0)', '(−3, 0)', '(0, −6)'],
      correctIndex: 1,
      concept: 'finding-x-intercepts'
    },
    {
      id: 'algebra1-04-q3',
      chapterId: 'algebra1-04',
      question: 'Find the y-intercept of y = −3x + 9',
      options: ['(3, 0)', '(9, 0)', '(0, 9)', '(0, −9)'],
      correctIndex: 2,
      concept: 'finding-y-intercepts'
    },
    {
      id: 'algebra1-04-q4',
      chapterId: 'algebra1-04',
      question: 'Find the slope of the line through (2, 3) and (6, 11)',
      options: ['4', '1/2', '8', '2'],
      correctIndex: 3,
      concept: 'computing-slope-from-two-points'
    },
    {
      id: 'algebra1-04-q5',
      chapterId: 'algebra1-04',
      question: 'Find the slope of the line through (−1, 4) and (3, −4)',
      options: ['2', '8', '−2', '−1/2'],
      correctIndex: 2,
      concept: 'slope-with-negative-values'
    },
    {
      id: 'algebra1-04-q6',
      chapterId: 'algebra1-04',
      question: 'In y = 4x − 7, what is the slope?',
      options: ['−4', '−7', '7', '4'],
      correctIndex: 3,
      concept: 'identifying-slope-from-slope-intercept-form'
    },
    {
      id: 'algebra1-04-q7',
      chapterId: 'algebra1-04',
      question: 'In y = −2x + 5, what is the y-intercept?',
      options: ['(0, 5)', '(−2, 0)', '(0, −2)', '(5, 0)'],
      correctIndex: 0,
      concept: 'identifying-y-intercept-from-slope-intercept-form'
    },
    {
      id: 'algebra1-04-q8',
      chapterId: 'algebra1-04',
      question: 'A line has a slope of 0. What does its graph look like?',
      options: ['A horizontal line', 'A line that rises steeply', 'A line through the origin only', 'A vertical line'],
      correctIndex: 0,
      concept: 'interpreting-zero-slope'
    },
    {
      id: 'algebra1-04-q9',
      chapterId: 'algebra1-04',
      question: 'A line rises from left to right. What can you say about its slope?',
      options: ['The slope is negative', 'The slope is undefined', 'The slope is positive', 'The slope is zero'],
      correctIndex: 2,
      concept: 'interpreting-slope-sign-from-graph-direction'
    },
    {
      id: 'algebra1-04-q10',
      chapterId: 'algebra1-04',
      question: 'Which point lies on the line y = 3x − 2?',
      options: ['(2, 4)', '(0, 2)', '(4, 2)', '(2, 6)'],
      correctIndex: 0,
      concept: 'verifying-points-on-a-line'
    }
  ],
  'algebra1-05': [
    {
      id: 'algebra1-05-q1',
      chapterId: 'algebra1-05',
      question: 'Write the point-slope equation of a line through (4, 1) with slope 3',
      options: ['y − 4 = 3(x − 1)', 'y + 1 = 3(x + 4)', 'y − 1 = 3(x − 4)', 'y − 1 = 3(x + 4)'],
      correctIndex: 2,
      concept: 'writing-point-slope-form'
    },
    {
      id: 'algebra1-05-q2',
      chapterId: 'algebra1-05',
      question: 'Convert y − 2 = 4(x − 5) to slope-intercept form',
      options: ['y = 4x + 18', 'y = 4x − 20', 'y = 4x − 22', 'y = 4x − 18'],
      correctIndex: 3,
      concept: 'converting-point-slope-to-slope-intercept'
    },
    {
      id: 'algebra1-05-q3',
      chapterId: 'algebra1-05',
      question: 'Find the slope of the line through (0, 2) and (5, 17)',
      options: ['3', '1/3', '15', '5'],
      correctIndex: 0,
      concept: 'slope-from-two-points-for-writing-equations'
    },
    {
      id: 'algebra1-05-q4',
      chapterId: 'algebra1-05',
      question: 'Write the equation of the line through (0, 2) and (5, 17) in slope-intercept form',
      options: ['y = 3x − 2', 'y = 3x + 17', 'y = 3x + 2', 'y = 2x + 3'],
      correctIndex: 2,
      concept: 'writing-equation-from-two-points'
    },
    {
      id: 'algebra1-05-q5',
      chapterId: 'algebra1-05',
      question: 'A line is parallel to y = 5x − 1. What is the slope of the parallel line?',
      options: ['1/5', '−1/5', '5', '−5'],
      correctIndex: 2,
      concept: 'parallel-lines-same-slope'
    },
    {
      id: 'algebra1-05-q6',
      chapterId: 'algebra1-05',
      question: 'A line is perpendicular to y = 2x + 3. What is the slope of the perpendicular line?',
      options: ['−1/2', '1/2', '−2', '2'],
      correctIndex: 0,
      concept: 'perpendicular-lines-negative-reciprocal-slope'
    },
    {
      id: 'algebra1-05-q7',
      chapterId: 'algebra1-05',
      question: 'A line is perpendicular to y = −4x + 7. What is the slope of the perpendicular line?',
      options: ['−1/4', '−4', '4', '1/4'],
      correctIndex: 3,
      concept: 'perpendicular-lines-with-negative-slope'
    },
    {
      id: 'algebra1-05-q8',
      chapterId: 'algebra1-05',
      question: 'Which pair of slopes represents parallel lines?',
      options: ['m1 = 2, m2 = −2', 'm1 = 2/3, m2 = 2/3', 'm1 = 2/3, m2 = −3/2', 'm1 = 2/3, m2 = 3/2'],
      correctIndex: 1,
      concept: 'identifying-parallel-slopes'
    },
    {
      id: 'algebra1-05-q9',
      chapterId: 'algebra1-05',
      question: 'Which pair of slopes represents perpendicular lines?',
      options: ['m1 = 4, m2 = 1/4', 'm1 = 4, m2 = −1/4', 'm1 = 4, m2 = 4', 'm1 = 4, m2 = −4'],
      correctIndex: 1,
      concept: 'identifying-perpendicular-slopes'
    },
    {
      id: 'algebra1-05-q10',
      chapterId: 'algebra1-05',
      question: 'Write the point-slope equation of a line through (−2, 6) with slope −3',
      options: ['y − 6 = −3(x − 2)', 'y − 6 = −3(x + 2)', 'y + 6 = −3(x − 2)', 'y − 2 = −3(x + 6)'],
      correctIndex: 1,
      concept: 'point-slope-form-with-negative-values'
    }
  ],
  'algebra1-06': [
    {
      id: 'algebra1-06-q1',
      chapterId: 'algebra1-06',
      question: 'Solve: x + 4 > 10',
      options: ['x > 6', 'x > −6', 'x < 6', 'x > 14'],
      correctIndex: 0,
      concept: 'one-step-inequalities-addition-subtraction'
    },
    {
      id: 'algebra1-06-q2',
      chapterId: 'algebra1-06',
      question: 'Solve: −3x < 12',
      options: ['x > 4', 'x > −4', 'x < 4', 'x < −4'],
      correctIndex: 1,
      concept: 'flipping-inequality-sign'
    },
    {
      id: 'algebra1-06-q3',
      chapterId: 'algebra1-06',
      question: 'Solve: −x ≥ 5',
      options: ['x ≥ 5', 'x ≤ 5', 'x ≥ −5', 'x ≤ −5'],
      correctIndex: 3,
      concept: 'flipping-inequality-with-negative-one'
    },
    {
      id: 'algebra1-06-q4',
      chapterId: 'algebra1-06',
      question: 'Solve: 2x − 3 ≤ 7',
      options: ['x ≥ 5', 'x ≤ 5', 'x ≤ 7', 'x ≤ 2'],
      correctIndex: 1,
      concept: 'two-step-inequalities'
    },
    {
      id: 'algebra1-06-q5',
      chapterId: 'algebra1-06',
      question: 'On a number line, which symbol requires an open circle at the endpoint?',
      options: ['<', '≥', '=', '≤'],
      correctIndex: 0,
      concept: 'open-vs-closed-circle-notation'
    },
    {
      id: 'algebra1-06-q6',
      chapterId: 'algebra1-06',
      question: 'Which inequality is graphed with a filled-in (closed) circle?',
      options: ['x ≥ 3', 'x ≠ 3', 'x < 3', 'x > 3'],
      correctIndex: 0,
      concept: 'closed-circle-identification'
    },
    {
      id: 'algebra1-06-q7',
      chapterId: 'algebra1-06',
      question: 'When graphing y > x + 1, what kind of boundary line should be drawn?',
      options: ['A solid line, because the inequality is strict', 'A dashed line, because y is positive', 'A dashed line, because the inequality is strict', 'A solid line, because the boundary is included'],
      correctIndex: 2,
      concept: 'dashed-vs-solid-boundary-lines'
    },
    {
      id: 'algebra1-06-q8',
      chapterId: 'algebra1-06',
      question: 'When graphing y ≤ 2x − 3, which side of the boundary line should be shaded?',
      options: ['To the right of the line', 'Above the line, where y-values are less than or equal to 2x − 3', 'Below the line, where y-values are greater than 2x − 3', 'Below the line, where y-values are less than or equal to 2x − 3'],
      correctIndex: 3,
      concept: 'shading-inequality-regions'
    },
    {
      id: 'algebra1-06-q9',
      chapterId: 'algebra1-06',
      question: 'Solve and describe the graph: x − 5 < −2',
      options: ['Closed circle at 3, shaded to the right', 'Closed circle at 3, shaded to the left', 'Open circle at 3, shaded to the right', 'Open circle at 3, shaded to the left'],
      correctIndex: 3,
      concept: 'graphing-solved-inequalities'
    },
    {
      id: 'algebra1-06-q10',
      chapterId: 'algebra1-06',
      question: 'Which value of x satisfies −2x + 6 > 0?',
      options: ['x = 4', 'x = 5', 'x = 1', 'x = 3'],
      correctIndex: 2,
      concept: 'testing-solutions-to-inequalities'
    }
  ],
  'algebra1-07': [
    {
      id: 'algebra1-07-q1',
      chapterId: 'algebra1-07',
      question: 'What does the solution to a system of two linear equations represent graphically?',
      options: ['The y-intercept of the first line', 'The midpoint between the two lines', 'The point where the two lines intersect', 'The slope of either line'],
      correctIndex: 2,
      concept: 'graphical-meaning-of-system-solution'
    },
    {
      id: 'algebra1-07-q2',
      chapterId: 'algebra1-07',
      question: 'A system of two linear equations has parallel lines that never meet. How many solutions does it have?',
      options: ['Infinitely many solutions', 'No solution', 'One solution', 'Two solutions'],
      correctIndex: 1,
      concept: 'systems-with-no-solution'
    },
    {
      id: 'algebra1-07-q3',
      chapterId: 'algebra1-07',
      question: 'A system of two equations describes the exact same line. How many solutions does it have?',
      options: ['Infinitely many solutions', 'Exactly two solutions', 'Exactly one solution', 'No solution'],
      correctIndex: 0,
      concept: 'systems-with-infinite-solutions'
    },
    {
      id: 'algebra1-07-q4',
      chapterId: 'algebra1-07',
      question: 'Solve by substitution: y = x + 3 and x + y = 11',
      options: ['(4, 3)', '(7, 4)', '(4, 7)', '(8, 11)'],
      correctIndex: 2,
      concept: 'solving-systems-by-substitution'
    },
    {
      id: 'algebra1-07-q5',
      chapterId: 'algebra1-07',
      question: 'Solve by substitution: y = 2x − 1 and 3x + y = 14',
      options: ['(5, 3)', '(3, −1)', '(15, 5)', '(3, 5)'],
      correctIndex: 3,
      concept: 'substitution-with-coefficients'
    },
    {
      id: 'algebra1-07-q6',
      chapterId: 'algebra1-07',
      question: 'Solve by elimination: x + y = 12 and x − y = 4',
      options: ['(8, 4)', '(4, 8)', '(6, 6)', '(8, −4)'],
      correctIndex: 0,
      concept: 'solving-systems-by-elimination'
    },
    {
      id: 'algebra1-07-q7',
      chapterId: 'algebra1-07',
      question: 'Solve by elimination: 3x + y = 13 and 3x − y = 5',
      options: ['(3, 4)', '(3, −4)', '(18, 4)', '(4, 3)'],
      correctIndex: 0,
      concept: 'elimination-with-matching-coefficients'
    },
    {
      id: 'algebra1-07-q8',
      chapterId: 'algebra1-07',
      question: 'To eliminate y from the system 2x + 3y = 12 and x − y = 1, what could you do first?',
      options: ['Multiply the first equation by −1', 'Multiply the first equation by 3, then add the equations', 'Multiply the second equation by 3, then add the equations', 'Subtract the second equation from the first without changing anything'],
      correctIndex: 2,
      concept: 'preparing-equations-for-elimination'
    },
    {
      id: 'algebra1-07-q9',
      chapterId: 'algebra1-07',
      question: 'A system of two linear inequalities is graphed. What does the solution region represent?',
      options: ['The area where only the first inequality is shaded', 'The line where the two boundaries cross', 'The area outside both shaded regions', 'The area where the shaded regions of both inequalities overlap'],
      correctIndex: 3,
      concept: 'solution-region-for-systems-of-inequalities'
    },
    {
      id: 'algebra1-07-q10',
      chapterId: 'algebra1-07',
      question: 'Which method is generally fastest when one equation is already solved for a variable, like y = 3x + 2?',
      options: ['Graphing only', 'Substitution', 'Elimination', 'Guess and check'],
      correctIndex: 1,
      concept: 'choosing-substitution-vs-elimination'
    }
  ],
  'algebra1-08': [
    {
      id: 'algebra1-08-q1',
      chapterId: 'algebra1-08',
      question: 'Simplify: 3^2 × 3^4',
      options: ['3^6', '3^2', '3^8', '9^6'],
      correctIndex: 0,
      concept: 'product-rule-of-exponents'
    },
    {
      id: 'algebra1-08-q2',
      chapterId: 'algebra1-08',
      question: 'Simplify: x^7 / x^3',
      options: ['x^(7/3)', 'x^(-4)', 'x^4', 'x^10'],
      correctIndex: 2,
      concept: 'quotient-rule-of-exponents'
    },
    {
      id: 'algebra1-08-q3',
      chapterId: 'algebra1-08',
      question: 'Simplify: (x^3)^4',
      options: ['x^81', 'x^7', 'x^12', 'x^(3/4)'],
      correctIndex: 2,
      concept: 'power-of-a-power-rule'
    },
    {
      id: 'algebra1-08-q4',
      chapterId: 'algebra1-08',
      question: 'Evaluate: 7^0',
      options: ['0', '1', '7', 'undefined'],
      correctIndex: 1,
      concept: 'zero-exponent-rule'
    },
    {
      id: 'algebra1-08-q5',
      chapterId: 'algebra1-08',
      question: 'Simplify: x^(-3)',
      options: ['−3x', '1/x^(-3)', '−x^3', '1/x^3'],
      correctIndex: 3,
      concept: 'negative-exponent-rule'
    },
    {
      id: 'algebra1-08-q6',
      chapterId: 'algebra1-08',
      question: 'Simplify: 2^(-2)',
      options: ['4', '−4', '−1/4', '1/4'],
      correctIndex: 3,
      concept: 'evaluating-negative-exponents'
    },
    {
      id: 'algebra1-08-q7',
      chapterId: 'algebra1-08',
      question: 'In the exponential function y = 500(0.8)^x, does this represent growth or decay?',
      options: ['Decay, because the base is between 0 and 1', 'Growth, because the base is between 0 and 1', 'Decay, because 500 is large', 'Growth, because the exponent is x'],
      correctIndex: 0,
      concept: 'identifying-growth-vs-decay'
    },
    {
      id: 'algebra1-08-q8',
      chapterId: 'algebra1-08',
      question: 'In the exponential function y = 200(1.15)^x, what does 200 represent?',
      options: ['The value of x', 'The starting value', 'The final amount after 1 year', 'The growth rate'],
      correctIndex: 1,
      concept: 'interpreting-exponential-function-parameters'
    },
    {
      id: 'algebra1-08-q9',
      chapterId: 'algebra1-08',
      question: 'A population of 800 grows at a rate modeled by P = 800(1.1)^t. What is the population after 2 years?',
      options: ['1760', '1000', '968', '880'],
      correctIndex: 2,
      concept: 'applying-exponential-growth-models'
    },
    {
      id: 'algebra1-08-q10',
      chapterId: 'algebra1-08',
      question: 'Which of these represents exponential decay?',
      options: ['y = 100(0.5)^x', 'y = 100(1.5)^x', 'y = 100 + 0.5x', 'y = 0.5x^2'],
      correctIndex: 0,
      concept: 'recognizing-exponential-decay-equations'
    }
  ],
  'algebra1-09': [
    {
      id: 'algebra1-09-q1',
      chapterId: 'algebra1-09',
      question: 'In the quadratic ax^2 + bx + c = 0, if a is negative, which way does the parabola open?',
      options: ['It doesn\'t form a parabola', 'Upward', 'Downward', 'Sideways left'],
      correctIndex: 2,
      concept: 'parabola-direction-from-leading-coefficient'
    },
    {
      id: 'algebra1-09-q2',
      chapterId: 'algebra1-09',
      question: 'What are the roots (solutions) of a quadratic equation graphically?',
      options: ['The y-value at the vertex', 'The x-values where the parabola crosses the x-axis', 'The x-value of the vertex only', 'Where the parabola crosses the y-axis'],
      correctIndex: 1,
      concept: 'graphical-meaning-of-quadratic-roots'
    },
    {
      id: 'algebra1-09-q3',
      chapterId: 'algebra1-09',
      question: 'Solve by factoring: x^2 − 7x + 12 = 0',
      options: ['x = 3 or x = 4', 'x = 3 or x = −4', 'x = 7 or x = 12', 'x = −3 or x = −4'],
      correctIndex: 0,
      concept: 'solving-quadratics-by-factoring'
    },
    {
      id: 'algebra1-09-q4',
      chapterId: 'algebra1-09',
      question: 'Solve by factoring: x^2 + 2x − 15 = 0',
      options: ['x = −5 or x = 3', 'x = 5 or x = −3', 'x = 2 or x = −15', 'x = −5 or x = −3'],
      correctIndex: 0,
      concept: 'factoring-with-negative-constant-term'
    },
    {
      id: 'algebra1-09-q5',
      chapterId: 'algebra1-09',
      question: 'What is the discriminant of ax^2 + bx + c = 0?',
      options: ['4ac − b^2', '−b/2a', 'b^2 + 4ac', 'b^2 − 4ac'],
      correctIndex: 3,
      concept: 'identifying-the-discriminant-formula'
    },
    {
      id: 'algebra1-09-q6',
      chapterId: 'algebra1-09',
      question: 'For x^2 − 4x + 4 = 0, calculate the discriminant. What does it tell you?',
      options: ['0, meaning there is exactly one real solution', '−16, meaning there are no real solutions', '0, meaning there are no real solutions', '16, meaning there are two real solutions'],
      correctIndex: 0,
      concept: 'using-discriminant-to-count-solutions'
    },
    {
      id: 'algebra1-09-q7',
      chapterId: 'algebra1-09',
      question: 'Use the quadratic formula to solve: x^2 + 6x + 5 = 0',
      options: ['x = 6 or x = 5', 'x = −1 or x = 5', 'x = 1 or x = 5', 'x = −1 or x = −5'],
      correctIndex: 3,
      concept: 'applying-the-quadratic-formula'
    },
    {
      id: 'algebra1-09-q8',
      chapterId: 'algebra1-09',
      question: 'Use the quadratic formula to solve: 2x^2 − 5x − 3 = 0',
      options: ['x = −3 or x = 1/2', 'x = 3 or x = −1/2', 'x = 3 or x = 1/2', 'x = 6 or x = −1'],
      correctIndex: 1,
      concept: 'quadratic-formula-with-non-integer-solutions'
    },
    {
      id: 'algebra1-09-q9',
      chapterId: 'algebra1-09',
      question: 'A quadratic equation has a discriminant of −8. How many real solutions does it have?',
      options: ['One real solution', 'Infinitely many solutions', 'No real solutions', 'Two real solutions'],
      correctIndex: 2,
      concept: 'negative-discriminant-meaning'
    },
    {
      id: 'algebra1-09-q10',
      chapterId: 'algebra1-09',
      question: 'What is the standard form of a quadratic equation?',
      options: ['ax + b = 0', 'ax^2 + bx + c = 0, where a ≠ 0', 'a + bx^2 = c', 'ax^2 + bx + c = 0, where a = 0'],
      correctIndex: 1,
      concept: 'identifying-standard-form-of-a-quadratic'
    }
  ],
  'algebra1-10': [
    {
      id: 'algebra1-10-q1',
      chapterId: 'algebra1-10',
      question: 'Simplify: (3x^2 + 5x − 2) + (x^2 − 3x + 7)',
      options: ['4x^2 + 2x − 5', '4x^2 + 8x + 5', '3x^2 + 2x + 5', '4x^2 + 2x + 5'],
      correctIndex: 3,
      concept: 'adding-polynomials'
    },
    {
      id: 'algebra1-10-q2',
      chapterId: 'algebra1-10',
      question: 'Simplify: (5x^2 − 4x + 6) − (2x^2 + 3x − 1)',
      options: ['3x^2 + 7x + 7', '3x^2 − x + 5', '7x^2 − 7x + 7', '3x^2 − 7x + 7'],
      correctIndex: 3,
      concept: 'subtracting-polynomials'
    },
    {
      id: 'algebra1-10-q3',
      chapterId: 'algebra1-10',
      question: 'Multiply using FOIL: (x + 4)(x + 6)',
      options: ['x^2 + 24x + 10', 'x^2 + 2x + 24', 'x^2 + 10x + 10', 'x^2 + 10x + 24'],
      correctIndex: 3,
      concept: 'multiplying-binomials-foil'
    },
    {
      id: 'algebra1-10-q4',
      chapterId: 'algebra1-10',
      question: 'Multiply using FOIL: (x − 2)(x + 7)',
      options: ['x^2 − 5x − 14', 'x^2 + 9x − 14', 'x^2 + 5x − 14', 'x^2 + 5x + 14'],
      correctIndex: 2,
      concept: 'foil-with-mixed-signs'
    },
    {
      id: 'algebra1-10-q5',
      chapterId: 'algebra1-10',
      question: 'Factor out the GCF: 6x^2 + 9x',
      options: ['3x(2x + 3)', '3x(2x + 9)', '3(2x^2 + 3x)', 'x(6x + 9)'],
      correctIndex: 0,
      concept: 'factoring-out-the-gcf'
    },
    {
      id: 'algebra1-10-q6',
      chapterId: 'algebra1-10',
      question: 'Factor the trinomial: x^2 + 9x + 20',
      options: ['(x + 2)(x + 10)', '(x + 4)(x + 5)', '(x − 4)(x − 5)', '(x + 20)(x + 1)'],
      correctIndex: 1,
      concept: 'factoring-trinomials-positive-terms'
    },
    {
      id: 'algebra1-10-q7',
      chapterId: 'algebra1-10',
      question: 'Factor the trinomial: x^2 − 2x − 24',
      options: ['(x + 6)(x − 4)', '(x − 6)(x + 4)', '(x − 3)(x + 8)', '(x − 8)(x + 3)'],
      correctIndex: 1,
      concept: 'factoring-trinomials-negative-constant'
    },
    {
      id: 'algebra1-10-q8',
      chapterId: 'algebra1-10',
      question: 'Factor using the difference of squares: x^2 − 49',
      options: ['(x − 49)(x + 1)', '(x − 7)(x − 7)', '(x − 7)(x + 7)', '(x + 7)(x + 7)'],
      correctIndex: 2,
      concept: 'difference-of-squares-factoring'
    },
    {
      id: 'algebra1-10-q9',
      chapterId: 'algebra1-10',
      question: 'Which expression is a difference of squares?',
      options: ['x^2 + 16', 'x^2 − 15', 'x^2 − 16', 'x^2 − 4x'],
      correctIndex: 2,
      concept: 'recognizing-difference-of-squares'
    },
    {
      id: 'algebra1-10-q10',
      chapterId: 'algebra1-10',
      question: 'Simplify: 3x(2x^2 − 5x + 4)',
      options: ['6x^3 − 15x^2 + 12x', '6x^3 − 5x + 4', '6x^2 − 15x^2 + 12x', '5x^3 − 15x^2 + 12x'],
      correctIndex: 0,
      concept: 'distributing-a-monomial-over-a-polynomial'
    }
  ],
  'algebra1-11': [
    {
      id: 'algebra1-11-q1',
      chapterId: 'algebra1-11',
      question: 'Simplify: (x^2 − 9)/(x + 3)',
      options: ['x − 9', 'x^2 − 3', 'x + 3', 'x − 3'],
      correctIndex: 3,
      concept: 'simplifying-rational-expressions-by-factoring'
    },
    {
      id: 'algebra1-11-q2',
      chapterId: 'algebra1-11',
      question: 'What value of x must be excluded from the domain of (x + 5)/(x − 2)?',
      options: ['x = −2', 'x = −5', 'x = 2', 'x = 5'],
      correctIndex: 2,
      concept: 'identifying-domain-restrictions'
    },
    {
      id: 'algebra1-11-q3',
      chapterId: 'algebra1-11',
      question: 'What value(s) must be excluded from the domain of 4/(x^2 − 9)?',
      options: ['x = 3 and x = −3', 'x = 3 only', 'x = 9 and x = −9', 'x = 0'],
      correctIndex: 0,
      concept: 'domain-restrictions-with-factorable-denominators'
    },
    {
      id: 'algebra1-11-q4',
      chapterId: 'algebra1-11',
      question: 'Multiply: (2/x) × (x/5)',
      options: ['2/5x', '10/x', '2/5', '2x/5'],
      correctIndex: 2,
      concept: 'multiplying-rational-expressions'
    },
    {
      id: 'algebra1-11-q5',
      chapterId: 'algebra1-11',
      question: 'Divide: (3/x) ÷ (6/x^2)',
      options: ['18/x^3', 'x/2', '2/x', 'x^2/2'],
      correctIndex: 1,
      concept: 'dividing-rational-expressions'
    },
    {
      id: 'algebra1-11-q6',
      chapterId: 'algebra1-11',
      question: 'Add: 2/x + 3/x',
      options: ['5/x', '5/2x', '5/x^2', '6/x'],
      correctIndex: 0,
      concept: 'adding-rational-expressions-same-denominator'
    },
    {
      id: 'algebra1-11-q7',
      chapterId: 'algebra1-11',
      question: 'Add: 1/x + 1/2',
      options: ['1/(2x)', '(x + 2)/2x', '(x + 1)/2x', '2/2x'],
      correctIndex: 1,
      concept: 'adding-rational-expressions-different-denominators'
    },
    {
      id: 'algebra1-11-q8',
      chapterId: 'algebra1-11',
      question: 'Solve: 5/x = 10/(x + 3)',
      options: ['x = 3', 'x = −3', 'x = 15', 'x = 5'],
      correctIndex: 0,
      concept: 'solving-rational-equations-by-cross-multiplying'
    },
    {
      id: 'algebra1-11-q9',
      chapterId: 'algebra1-11',
      question: 'Solve: 2/(x − 1) = 4/(x + 1)',
      options: ['x = 6', 'x = 1', 'x = −1', 'x = 3'],
      correctIndex: 3,
      concept: 'solving-rational-equations-with-variable-denominators'
    },
    {
      id: 'algebra1-11-q10',
      chapterId: 'algebra1-11',
      question: 'After solving a rational equation, you find x = 2 — but the original equation had a denominator of (x − 2). What should you do?',
      options: ['Round x = 2 to the nearest whole number', 'Accept x = 2 as the final answer', 'Reject x = 2, since it makes a denominator zero and isn\'t a valid solution', 'Multiply x = 2 by the denominator to check'],
      correctIndex: 2,
      concept: 'checking-solutions-against-domain-restrictions'
    }
  ],
  'algebra1-12': [
    {
      id: 'algebra1-12-q1',
      chapterId: 'algebra1-12',
      question: 'Simplify: √50',
      options: ['5√2', '25√2', '5√50', '2√5'],
      correctIndex: 0,
      concept: 'simplifying-square-roots'
    },
    {
      id: 'algebra1-12-q2',
      chapterId: 'algebra1-12',
      question: 'Simplify: √98',
      options: ['2√7', '7√98', '49√2', '7√2'],
      correctIndex: 3,
      concept: 'simplifying-square-roots-larger-numbers'
    },
    {
      id: 'algebra1-12-q3',
      chapterId: 'algebra1-12',
      question: 'Simplify: 3√5 + 7√5',
      options: ['21√5', '10√5', '10√10', '10√25'],
      correctIndex: 1,
      concept: 'combining-like-radicals'
    },
    {
      id: 'algebra1-12-q4',
      chapterId: 'algebra1-12',
      question: 'Simplify: √8 + √18',
      options: ['26', '5√10', '5√2', '√26'],
      correctIndex: 2,
      concept: 'combining-unlike-radicals-after-simplifying'
    },
    {
      id: 'algebra1-12-q5',
      chapterId: 'algebra1-12',
      question: 'Multiply: √3 × √12',
      options: ['6', '6√3', '√15', '36'],
      correctIndex: 0,
      concept: 'multiplying-radicals'
    },
    {
      id: 'algebra1-12-q6',
      chapterId: 'algebra1-12',
      question: 'A right triangle has legs of length 5 and 12. Find the hypotenuse.',
      options: ['17', '144', '√37', '13'],
      correctIndex: 3,
      concept: 'pythagorean-theorem-finding-hypotenuse'
    },
    {
      id: 'algebra1-12-q7',
      chapterId: 'algebra1-12',
      question: 'A right triangle has a hypotenuse of 15 and one leg of 9. Find the other leg.',
      options: ['6', '12', '144', '24'],
      correctIndex: 1,
      concept: 'pythagorean-theorem-finding-a-leg'
    },
    {
      id: 'algebra1-12-q8',
      chapterId: 'algebra1-12',
      question: 'Find the distance between the points (1, 2) and (4, 6).',
      options: ['7', '5', '25', '√7'],
      correctIndex: 1,
      concept: 'using-the-distance-formula'
    },
    {
      id: 'algebra1-12-q9',
      chapterId: 'algebra1-12',
      question: 'Find the distance between the points (−2, 0) and (3, 12).',
      options: ['13', '17', '169', '√17'],
      correctIndex: 0,
      concept: 'distance-formula-with-negative-coordinates'
    },
    {
      id: 'algebra1-12-q10',
      chapterId: 'algebra1-12',
      question: 'Which expression correctly sets up the Pythagorean theorem for a right triangle with legs a and b and hypotenuse c?',
      options: ['a^2 + b^2 = c', 'a^2 − b^2 = c^2', 'a^2 + b^2 = c^2', 'a + b = c'],
      correctIndex: 2,
      concept: 'identifying-the-pythagorean-theorem-formula'
    }
  ]};

module.exports = { QUIZZES };
