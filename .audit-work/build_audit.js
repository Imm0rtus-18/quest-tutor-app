// Builds audit.json (and prints summary stats for CURRICULUM_AUDIT.md)
// from a hand-authored concept->standards mapping. This mapping is the
// judgment-heavy part of the audit: it's been cross-checked against the
// actual lesson text/quiz question for each concept, but per the task,
// it's explicitly a first-pass triage, not a certification.
const { QUIZZES } = require('../quizzes.js');
const { CURRICULUM } = require('../curriculum.js');
const STANDARDS = require('../standards.json').frameworks['CCSS-M'].standards;
const mathResults = require('./math_verification_results.json');

function s(code, confidence, reason) { return { code, confidence, reason }; }

// NONE entries still carry a reason + flag classifying WHY there's no
// mapped standard: 'below-level' (middle-school prerequisite, CCSS
// assumes it's already mastered before HS), 'out-of-domain' (belongs to
// a CCSS domain outside this audit's scope — almost always Geometry),
// or 'above-level' isn't a NONE case (it still maps, just to a '+'
// standard) so it's carried as a separate flag on the mapping itself.
const MAP = {
  // Chapter 1 — Connections to Algebra
  'order-of-operations-pemdas': { standards: [], flag: 'below-level', note: 'Order of operations is middle-school content (6.EE.A.1/A.2); CCSS HS standards assume it, rather than re-stating it.' },
  'evaluating-expressions-by-substitution': { standards: [s('HSF-IF.A.2', 'medium', 'Evaluating an expression at a given input is the mechanical core of evaluating a function, though formal function notation isn’t introduced until later.')] },
  'translating-sum-phrases': { standards: [s('HSA-CED.A.1', 'medium', 'Turning a verbal phrase into symbols is the entry skill behind creating an equation from a situation.')] },
  'less-than-phrase-order-reversal': { standards: [s('HSA-CED.A.1', 'medium', 'Same translation skill as above, with the specific trap CCSS problems in this strand often test.')] },
  'variables-as-unknowns': { standards: [], flag: 'below-level', note: 'What a variable represents is introduced in grade 6 (6.EE.B.6); HS standards presuppose it.' },
  'order-of-operations-with-exponents': { standards: [], flag: 'below-level', note: 'Order of operations with exponents extends 6.EE.A.1/A.2 and 8.EE.A.1 (integer exponents), both middle-school.' },
  'translating-product-and-difference-phrases': { standards: [s('HSA-CED.A.1', 'medium', 'Same translation skill as translating-sum-phrases.')] },
  'order-of-operations-left-to-right': { standards: [], flag: 'below-level', note: 'Same as order-of-operations-pemdas.' },
  'evaluating-multi-term-expressions': { standards: [s('HSF-IF.A.2', 'medium', 'Same reasoning as evaluating-expressions-by-substitution, with more terms.')] },
  'translating-quotient-and-sum-phrases': { standards: [s('HSA-CED.A.1', 'medium', 'Same translation skill as translating-sum-phrases.')] },

  // Chapter 2 — Properties of Real Numbers
  'absolute-value-basics': { standards: [], flag: 'below-level', note: 'Absolute value as distance from zero is grade-6 content (6.NS.C.7c).' },
  'adding-signed-numbers': { standards: [], flag: 'below-level', note: 'Signed-number arithmetic is grade-7 content (7.NS.A.1).' },
  'subtracting-negative-numbers': { standards: [], flag: 'below-level', note: 'Same as adding-signed-numbers (7.NS.A.1).' },
  'commutative-property-identification': { standards: [], flag: 'below-level', note: 'The number properties themselves are elementary/middle-school content; HS standards use them without re-naming them as a standard in their own right.' },
  'associative-property-identification': { standards: [], flag: 'below-level', note: 'Same as commutative-property-identification.' },
  'applying-distributive-property': { standards: [s('HSA-SSE.A.2', 'medium', 'Distributing is a basic case of using an expression’s structure to rewrite it.')] },
  'additive-inverse': { standards: [], flag: 'below-level', note: 'Elementary number property, not separately named at HS.' },
  'multiplicative-inverse': { standards: [], flag: 'below-level', note: 'Elementary number property, not separately named at HS.' },
  'combining-signed-number-operations': { standards: [], flag: 'below-level', note: 'Same as adding-signed-numbers (7.NS.A.1).' },
  'identity-property-of-multiplication': { standards: [], flag: 'below-level', note: 'Elementary number property, not separately named at HS.' },

  // Chapter 3 — Solving Linear Equations
  'one-step-equations-addition-subtraction': { standards: [s('HSA-REI.B.3', 'medium', 'A simple case of solving a one-variable linear equation; the skill itself starts in grade 6/7 (6.EE.B.7), but REI.B.3 is where HS continues it toward literal coefficients.')] },
  'one-step-equations-multiplication-division': { standards: [s('HSA-REI.B.3', 'medium', 'Same reasoning as one-step-equations-addition-subtraction.')] },
  'two-step-equations': { standards: [s('HSA-REI.B.3', 'high', 'Directly within "solve linear equations... in one variable."')] },
  'multi-step-equations-with-distribution': { standards: [s('HSA-REI.B.3', 'high', 'Directly within REI.B.3.')] },
  'multi-step-equations-distribute-and-both-sides': { standards: [s('HSA-REI.B.3', 'high', 'Directly within REI.B.3.')] },
  'equations-variable-terms-both-sides': { standards: [s('HSA-REI.B.3', 'high', 'Directly within REI.B.3.')] },
  'addition-property-of-equality': { standards: [s('HSA-REI.A.1', 'high', 'This is exactly "explain each step... as following from the equality... at the previous step."')] },
  'multiplication-property-of-equality': { standards: [s('HSA-REI.A.1', 'high', 'Same as addition-property-of-equality.')] },
  'equations-with-negative-coefficients': { standards: [s('HSA-REI.B.3', 'high', 'Directly within REI.B.3.')] },
  'verifying-solutions-by-substitution': { standards: [s('HSA-REI.B.3', 'medium', 'Verifying a solution is part of the solve-and-check process REI.B.3 implies, though not named as its own clause.')] },

  // Chapter 4 — Graphing Linear Equations and Functions
  'reading-ordered-pairs': { standards: [], flag: 'below-level', note: 'Plotting/reading points in the coordinate plane is grade 5-6 content (5.G.A.1-2, 6.NS.C.6).' },
  'finding-x-intercepts': { standards: [s('HSF-IF.B.4', 'high', 'Intercepts are explicitly named as a "key feature" of a function’s graph.')] },
  'finding-y-intercepts': { standards: [s('HSF-IF.B.4', 'high', 'Same as finding-x-intercepts.')] },
  'computing-slope-from-two-points': { standards: [s('HSF-IF.B.6', 'high', 'Slope between two points on a line is exactly the average rate of change of a linear function.')] },
  'slope-with-negative-values': { standards: [s('HSF-IF.B.6', 'high', 'Same as computing-slope-from-two-points.')] },
  'identifying-slope-from-slope-intercept-form': { standards: [s('HSF-LE.B.5', 'high', 'Reading the slope out of y = mx + b is literally interpreting that parameter in context.')] },
  'identifying-y-intercept-from-slope-intercept-form': { standards: [s('HSF-LE.B.5', 'high', 'Same as identifying-slope-from-slope-intercept-form.')] },
  'interpreting-zero-slope': { standards: [s('HSF-IF.B.4', 'medium', 'A horizontal-line graph is a key feature a student should be able to read off a function.')] },
  'interpreting-slope-sign-from-graph-direction': { standards: [s('HSF-IF.B.4', 'medium', 'Same reasoning as interpreting-zero-slope.'), s('HSF-IF.B.6', 'medium', 'Sign of slope is sign of average rate of change.')] },
  'verifying-points-on-a-line': { standards: [s('HSA-REI.D.10', 'high', 'A point is "on the line" exactly when it’s a solution of the equation — this is REI.D.10’s definition.')] },

  // Chapter 5 — Writing Linear Equations
  'writing-point-slope-form': { standards: [s('HSA-CED.A.2', 'high', 'Creating a two-variable equation to represent a line through a known point and slope.')] },
  'converting-point-slope-to-slope-intercept': { standards: [s('HSA-SSE.B.3', 'medium', 'Rewriting an equation into an equivalent, more revealing form.')] },
  'slope-from-two-points-for-writing-equations': { standards: [s('HSF-IF.B.6', 'high', 'Same slope-as-rate-of-change skill as computing-slope-from-two-points.')] },
  'writing-equation-from-two-points': { standards: [s('HSA-CED.A.2', 'high', 'Same as writing-point-slope-form.')] },
  'parallel-lines-same-slope': { standards: [], flag: 'out-of-domain', note: 'The slope criterion for parallel lines is a Geometry standard (G-GPE.B.5), outside the Algebra/Functions/Number-Quantity/Statistics domains this audit covers.' },
  'perpendicular-lines-negative-reciprocal-slope': { standards: [], flag: 'out-of-domain', note: 'Same as parallel-lines-same-slope — G-GPE.B.5 (Geometry).' },
  'perpendicular-lines-with-negative-slope': { standards: [], flag: 'out-of-domain', note: 'Same as parallel-lines-same-slope — G-GPE.B.5 (Geometry).' },
  'identifying-parallel-slopes': { standards: [], flag: 'out-of-domain', note: 'Same as parallel-lines-same-slope — G-GPE.B.5 (Geometry).' },
  'identifying-perpendicular-slopes': { standards: [], flag: 'out-of-domain', note: 'Same as parallel-lines-same-slope — G-GPE.B.5 (Geometry).' },
  'point-slope-form-with-negative-values': { standards: [s('HSA-CED.A.2', 'high', 'Same as writing-point-slope-form.')] },

  // Chapter 6 — Solving and Graphing Linear Inequalities
  'one-step-inequalities-addition-subtraction': { standards: [s('HSA-REI.B.3', 'medium', 'REI.B.3 explicitly covers linear inequalities in one variable.')] },
  'flipping-inequality-sign': { standards: [s('HSA-REI.B.3', 'high', 'Central to correctly solving a one-variable linear inequality.')] },
  'flipping-inequality-with-negative-one': { standards: [s('HSA-REI.B.3', 'high', 'Same as flipping-inequality-sign.')] },
  'two-step-inequalities': { standards: [s('HSA-REI.B.3', 'high', 'Directly within REI.B.3.')] },
  'open-vs-closed-circle-notation': { standards: [], flag: 'below-level', note: 'Representing a one-variable inequality’s solution on a number line is explicitly middle-school (6.EE.B.8).' },
  'closed-circle-identification': { standards: [], flag: 'below-level', note: 'Same as open-vs-closed-circle-notation (6.EE.B.8).' },
  'dashed-vs-solid-boundary-lines': { standards: [s('HSA-REI.D.12', 'high', 'This is specifically the two-variable/half-plane case REI.D.12 names.')] },
  'shading-inequality-regions': { standards: [s('HSA-REI.D.12', 'high', 'Same as dashed-vs-solid-boundary-lines.')] },
  'graphing-solved-inequalities': { standards: [], flag: 'below-level', note: 'A number-line graph of a solved one-variable inequality is the same middle-school skill as open-vs-closed-circle-notation (6.EE.B.8).' },
  'testing-solutions-to-inequalities': { standards: [s('HSA-REI.B.3', 'medium', 'Checking a candidate value is part of the solve process REI.B.3 implies.')] },

  // Chapter 7 — Systems of Linear Equations and Inequalities
  'graphical-meaning-of-system-solution': { standards: [s('HSA-REI.C.6', 'high', 'Solving a linear system "exactly and approximately (e.g. with graphs)."'), s('HSA-REI.D.11', 'medium', 'The intersection-as-solution idea REI.D.11 states for a single equation extends directly to a system.')] },
  'systems-with-no-solution': { standards: [s('HSA-REI.C.6', 'high', 'Part of understanding what solving a linear system can produce.')] },
  'systems-with-infinite-solutions': { standards: [s('HSA-REI.C.6', 'high', 'Same as systems-with-no-solution.')] },
  'solving-systems-by-substitution': { standards: [s('HSA-REI.C.6', 'high', 'Directly within REI.C.6.')] },
  'substitution-with-coefficients': { standards: [s('HSA-REI.C.6', 'high', 'Directly within REI.C.6.')] },
  'solving-systems-by-elimination': { standards: [s('HSA-REI.C.6', 'high', 'Directly within REI.C.6.'), s('HSA-REI.C.5', 'medium', 'The "replace an equation with a combination of the two" theorem is exactly why elimination is valid.')] },
  'elimination-with-matching-coefficients': { standards: [s('HSA-REI.C.6', 'high', 'Directly within REI.C.6.'), s('HSA-REI.C.5', 'medium', 'Same as solving-systems-by-elimination.')] },
  'preparing-equations-for-elimination': { standards: [s('HSA-REI.C.5', 'high', 'This is precisely the "multiply one equation, then add" move REI.C.5 justifies.')] },
  'solution-region-for-systems-of-inequalities': { standards: [s('HSA-REI.D.12', 'high', 'REI.D.12 explicitly covers "the solution set to a system of linear inequalities."')] },
  'choosing-substitution-vs-elimination': { standards: [s('HSA-REI.C.6', 'low', 'A strategic/procedural judgment call that REI.C.6’s "solve... exactly" doesn’t speak to directly.')] },

  // Chapter 8 — Exponents and Exponential Functions
  'product-rule-of-exponents': { standards: [], flag: 'below-level', note: 'Integer-exponent laws are grade-8 content (8.EE.A.1); HSN-RN.A.1 only extends them to rational exponents, presupposing this.' },
  'quotient-rule-of-exponents': { standards: [], flag: 'below-level', note: 'Same as product-rule-of-exponents (8.EE.A.1).' },
  'power-of-a-power-rule': { standards: [], flag: 'below-level', note: 'Same as product-rule-of-exponents (8.EE.A.1).' },
  'zero-exponent-rule': { standards: [], flag: 'below-level', note: 'Same as product-rule-of-exponents (8.EE.A.1, extended to zero/negative exponents).' },
  'negative-exponent-rule': { standards: [s('HSN-RN.A.2', 'low', 'Touches the exponent laws HSN-RN.A.2 uses, though that standard’s real focus is rational exponents, not the negative-exponent rule itself (8.EE.A.1).')] },
  'evaluating-negative-exponents': { standards: [s('HSN-RN.A.2', 'low', 'Same as negative-exponent-rule.')] },
  'identifying-growth-vs-decay': { standards: [s('HSF-LE.A.1', 'high', 'Distinguishing growth (b > 1) from decay (0 < b < 1) is part of distinguishing exponential behavior.')] },
  'interpreting-exponential-function-parameters': { standards: [s('HSF-LE.B.5', 'high', 'Exactly "interpret the parameters in... an exponential function in terms of a context."')] },
  'applying-exponential-growth-models': { standards: [s('HSF-LE.A.2', 'high', 'Constructing/using an exponential function from given information.')] },
  'recognizing-exponential-decay-equations': { standards: [s('HSF-LE.A.1', 'high', 'Same as identifying-growth-vs-decay.')] },

  // Chapter 9 — Quadratic Equations and Functions
  'parabola-direction-from-leading-coefficient': { standards: [s('HSF-IF.C.7', 'medium', 'Direction of opening is a key graphed feature of a quadratic function.')] },
  'graphical-meaning-of-quadratic-roots': { standards: [s('HSA-REI.D.11', 'high', 'x-intercepts as the solutions of f(x) = 0 is exactly REI.D.11’s idea, specialized to g(x) = 0.')] },
  'solving-quadratics-by-factoring': { standards: [s('HSA-REI.B.4', 'high', 'Directly "solve quadratic equations in one variable."')] },
  'factoring-with-negative-constant-term': { standards: [s('HSA-REI.B.4', 'high', 'Same as solving-quadratics-by-factoring.')] },
  'identifying-the-discriminant-formula': { standards: [s('HSA-REI.B.4', 'low', 'The discriminant is a tool for REI.B.4’s "appropriate method," not a formula CCSS names on its own.')] },
  'using-discriminant-to-count-solutions': { standards: [s('HSA-REI.B.4', 'medium', 'Part of solving/understanding a quadratic’s solution count.')] },
  'applying-the-quadratic-formula': { standards: [s('HSA-REI.B.4', 'high', 'Directly within REI.B.4.')] },
  'quadratic-formula-with-non-integer-solutions': { standards: [s('HSA-REI.B.4', 'high', 'Directly within REI.B.4.')] },
  'negative-discriminant-meaning': { standards: [s('HSA-REI.B.4', 'medium', 'Part of solving/understanding a quadratic’s solution count.'), s('HSN-CN.C.7', 'medium', 'A negative discriminant is exactly where complex solutions arise, though this app’s lesson stops at "no real solution" rather than introducing i.')] },
  'identifying-standard-form-of-a-quadratic': { standards: [s('HSA-REI.B.4', 'low', 'Implicit in REI.B.4; "standard form" itself isn’t named as a standard.')] },

  // Chapter 10 — Polynomials and Factoring
  'adding-polynomials': { standards: [s('HSA-APR.A.1', 'high', 'Directly "add, subtract, and multiply polynomials."')] },
  'subtracting-polynomials': { standards: [s('HSA-APR.A.1', 'high', 'Same as adding-polynomials.')] },
  'multiplying-binomials-foil': { standards: [s('HSA-APR.A.1', 'high', 'Same as adding-polynomials.')] },
  'foil-with-mixed-signs': { standards: [s('HSA-APR.A.1', 'high', 'Same as adding-polynomials.')] },
  'factoring-out-the-gcf': { standards: [s('HSA-SSE.A.2', 'high', 'A direct case of using an expression’s structure to rewrite it.')] },
  'factoring-trinomials-positive-terms': { standards: [s('HSA-SSE.A.2', 'high', 'Same as factoring-out-the-gcf.'), s('HSA-APR.B.3', 'medium', 'Factored form is how zeros get identified.')] },
  'factoring-trinomials-negative-constant': { standards: [s('HSA-SSE.A.2', 'high', 'Same as factoring-trinomials-positive-terms.')] },
  'difference-of-squares-factoring': { standards: [s('HSA-APR.C.4', 'high', 'The difference-of-squares identity is the named example in APR.C.4’s own text.'), s('HSA-SSE.A.2', 'medium', 'Also a structural rewrite.')] },
  'recognizing-difference-of-squares': { standards: [s('HSA-APR.C.4', 'high', 'Same as difference-of-squares-factoring.')] },
  'distributing-a-monomial-over-a-polynomial': { standards: [s('HSA-APR.A.1', 'high', 'A monomial is a one-term polynomial, so this is a case of multiplying polynomials.')] },

  // Chapter 11 — Rational Expressions and Equations
  'simplifying-rational-expressions-by-factoring': { standards: [s('HSA-APR.D.6', 'high', 'Directly "rewrite simple rational expressions in different forms."')] },
  'identifying-domain-restrictions': { standards: [s('HSA-APR.D.6', 'high', 'A prerequisite for correctly working with the rational expressions APR.D.6 covers.')] },
  'domain-restrictions-with-factorable-denominators': { standards: [s('HSA-APR.D.6', 'high', 'Same as identifying-domain-restrictions.')] },
  'multiplying-rational-expressions': { standards: [s('HSA-APR.D.7', 'high', 'Directly within APR.D.7.')], flag: 'above-level', note: 'APR.D.7 is an official CCSS "+" standard — general rational-expression arithmetic is typically Algebra 2 content, not Algebra 1.' },
  'dividing-rational-expressions': { standards: [s('HSA-APR.D.7', 'high', 'Directly within APR.D.7.')], flag: 'above-level', note: 'Same as multiplying-rational-expressions — APR.D.7 is a "+" standard.' },
  'adding-rational-expressions-same-denominator': { standards: [s('HSA-APR.D.7', 'high', 'Directly within APR.D.7.')], flag: 'above-level', note: 'Same-denominator addition is the simplest case of APR.D.7 (a "+" standard), so this one is milder than the others in this chapter but still technically beyond core Algebra 1.' },
  'adding-rational-expressions-different-denominators': { standards: [s('HSA-APR.D.7', 'high', 'Directly within APR.D.7.')], flag: 'above-level', note: 'Same as multiplying-rational-expressions — APR.D.7 is a "+" standard.' },
  'solving-rational-equations-by-cross-multiplying': { standards: [s('HSA-REI.A.2', 'high', 'Directly "solve simple rational... equations in one variable."')] },
  'solving-rational-equations-with-variable-denominators': { standards: [s('HSA-REI.A.2', 'high', 'Same as solving-rational-equations-by-cross-multiplying.')] },
  'checking-solutions-against-domain-restrictions': { standards: [s('HSA-REI.A.2', 'high', 'REI.A.2 explicitly calls out checking for extraneous solutions.')] },

  // Chapter 12 — Radicals and More Connections to Geometry
  'simplifying-square-roots': { standards: [s('HSN-RN.A.2', 'medium', 'Rewriting a radical expression using exponent/radical properties.')] },
  'simplifying-square-roots-larger-numbers': { standards: [s('HSN-RN.A.2', 'medium', 'Same as simplifying-square-roots.')] },
  'combining-like-radicals': { standards: [s('HSN-RN.A.2', 'medium', 'A natural extension of working with radical expressions, though "like radicals" isn’t named explicitly.')] },
  'combining-unlike-radicals-after-simplifying': { standards: [s('HSN-RN.A.2', 'medium', 'Same as combining-like-radicals.')] },
  'multiplying-radicals': { standards: [s('HSN-RN.A.2', 'medium', 'Same as combining-like-radicals.')] },
  'pythagorean-theorem-finding-hypotenuse': { standards: [], flag: 'out-of-domain', note: 'The Pythagorean theorem is a Geometry standard (8.G.B.7 / G-GPE), outside this audit’s Algebra/Functions/Number-Quantity/Statistics scope.' },
  'pythagorean-theorem-finding-a-leg': { standards: [], flag: 'out-of-domain', note: 'Same as pythagorean-theorem-finding-hypotenuse.' },
  'using-the-distance-formula': { standards: [], flag: 'out-of-domain', note: 'The distance formula is a Geometry standard (G-GPE.B.7), outside this audit’s scope.' },
  'distance-formula-with-negative-coordinates': { standards: [], flag: 'out-of-domain', note: 'Same as using-the-distance-formula.' },
  'identifying-the-pythagorean-theorem-formula': { standards: [], flag: 'out-of-domain', note: 'Same as pythagorean-theorem-finding-hypotenuse.' }
};

// ---------------------------------------------------------------------
// Assemble per-concept records (lesson/question context + mapping +
// math verification result) and the standards coverage table.
// ---------------------------------------------------------------------
const mathById = {};
mathResults.forEach(r => { mathById[r.id] = r; });

const concepts = [];
Object.keys(QUIZZES).forEach(chapterId => {
  QUIZZES[chapterId].forEach(q => {
    const mapping = MAP[q.concept];
    if (!mapping) throw new Error('UNMAPPED CONCEPT: ' + q.concept + ' (' + q.id + ')');
    concepts.push({
      concept: q.concept,
      quizId: q.id,
      chapterId,
      question: q.question,
      correctIndex: q.correctIndex,
      standards: mapping.standards,
      flag: mapping.flag || null,
      flagNote: mapping.note || null,
      mathVerification: mathById[q.id] ? mathById[q.id].status : 'UNKNOWN'
    });
  });
});

if (concepts.length !== 120) throw new Error('Expected 120 concepts, got ' + concepts.length);

// Coverage per standard code actually used
const usedByCode = {};
concepts.forEach(c => c.standards.forEach(st => {
  (usedByCode[st.code] = usedByCode[st.code] || []).push({ concept: c.concept, confidence: st.confidence });
}));

const algebra1RelevantPrefixes = ['HSA-', 'HSF-IF', 'HSF-BF', 'HSF-LE', 'HSN-RN', 'HSN-Q', 'HSN-CN.C.7'];
const nonPlusAlgebra1Relevant = STANDARDS.filter(st => !st.plus && algebra1RelevantPrefixes.some(p => st.code.startsWith(p)));
const gaps = nonPlusAlgebra1Relevant.filter(st => !usedByCode[st.code]).map(st => st.code);
const statsGapNote = 'Every Statistics & Probability standard (HSS-ID/IC/CP/MD) has zero mapped Algebra 1 concepts — this course currently has no statistics content at all.';

const output = {
  _comment: 'Automated curriculum-to-standards triage for Algebra 1 only (120 concepts). Generated by .audit-work/build_audit.js from quizzes.js + curriculum.js + standards.json. This is a first-pass triage, NOT a certification — see CURRICULUM_AUDIT.md.',
  framework: 'CCSS-M',
  auditedSubject: 'algebra1',
  unauditedSubjects: ['geometry', 'algebra2', 'precalc'],
  unauditedNote: 'Geometry, Algebra 2, and Pre-Calculus topic lists in curriculum.js (PLACEHOLDER_TOPICS) are unaudited placeholders from general knowledge, not real lesson content — intentionally excluded from this audit.',
  generatedAt: new Date().toISOString().slice(0, 10),
  concepts,
  standardsCoverage: usedByCode,
  gaps: { algebra1RangeStandardsWithNoConcept: gaps, note: statsGapNote },
  mathVerificationSummary: {
    total: mathResults.length,
    match: mathResults.filter(r => r.status === 'MATCH').length,
    mismatch: mathResults.filter(r => r.status === 'MISMATCH').length,
    notComputable: mathResults.filter(r => r.status === 'NOT_COMPUTABLE').length
  }
};

require('fs').writeFileSync(__dirname + '/../audit.json', JSON.stringify(output, null, 2));

// ---------------------------------------------------------------------
// Print summary stats for composing CURRICULUM_AUDIT.md
// ---------------------------------------------------------------------
console.log('=== COVERAGE ===');
console.log('Concepts with >=1 standard:', concepts.filter(c => c.standards.length > 0).length, '/ 120');
console.log('Concepts with 0 standards (flag breakdown):');
const flagCounts = {};
concepts.filter(c => c.standards.length === 0).forEach(c => { flagCounts[c.flag] = (flagCounts[c.flag] || 0) + 1; });
console.log(flagCounts);
console.log('Concepts flagged above-level (plus standard):', concepts.filter(c => c.flag === 'above-level').length);
console.log('\n=== CONFIDENCE BREAKDOWN (across all standard links) ===');
const confCounts = { high: 0, medium: 0, low: 0 };
concepts.forEach(c => c.standards.forEach(st => confCounts[st.confidence]++));
console.log(confCounts);
console.log('\n=== GAPS (non-plus Algebra/Functions/relevant-N&Q standards with zero concepts) ===');
console.log(gaps.length, 'gaps:', gaps.join(', '));
console.log('\n=== PER-CHAPTER FLAG COUNTS ===');
const byChapter = {};
concepts.forEach(c => {
  byChapter[c.chapterId] = byChapter[c.chapterId] || { total: 0, belowLevel: 0, outOfDomain: 0, aboveLevel: 0, mapped: 0 };
  byChapter[c.chapterId].total++;
  if (c.flag === 'below-level') byChapter[c.chapterId].belowLevel++;
  if (c.flag === 'out-of-domain') byChapter[c.chapterId].outOfDomain++;
  if (c.flag === 'above-level') byChapter[c.chapterId].aboveLevel++;
  if (c.standards.length > 0) byChapter[c.chapterId].mapped++;
});
console.log(JSON.stringify(byChapter, null, 2));
