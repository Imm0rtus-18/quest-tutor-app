// Table-driven tests for the step checker. No network, no database.
//   node practice/test-checker.js
const { checkStep, isolatedValue, isSimplifiedExpression } = require('./checker');

const E = 'equivalent', N = 'not_equivalent', U = 'unknown';

const CASES = [
  // ── valid steps ──
  ['add to both sides', 'x - 4 = 10', 'x = 14', E],
  ['subtract from both sides', '2x + 5 = 17', '2x = 12', E],
  ['subtract from both sides (written out)', '2x + 5 = 17', '2x + 5 - 5 = 17 - 5', E],
  ['divide both sides', '2x = 12', 'x = 6', E],
  ['divide both sides (fraction answer)', '3x = 7', 'x = 7/3', E],
  ['divide both sides by a negative', '-4x = 20', 'x = -5', E],
  ['distribute', '3(x - 2) = 2x + 4', '3x - 6 = 2x + 4', E],
  ['distribute a negative', '-2(x + 3) = 4', '-2x - 6 = 4', E],
  ['combine like terms', '3x + 2x - 4 = 11', '5x - 4 = 11', E],
  ['combine like terms (expression)', '4x + 3 - x + 2', '3x + 5', E],
  ['move a term', '5x - 7 = 2x + 8', '5x - 2x - 7 = 8', E],
  ['move a variable term', '5x - 7 = 2x + 8', '3x - 7 = 8', E],
  ['multiply both sides by a constant', 'x / 3 = 4', 'x = 12', E],
  ['multiply both sides (fractions)', 'x/2 + 1/3 = 1', '3x + 2 = 6', E],
  ['swap sides', '7 = 2x - 3', '2x - 3 = 7', E],
  ['variable on the right in the answer', '10 = 2x', '5 = x', E],
  ['decimals', '0.5x = 3', 'x = 6', E],
  ['decimal to fraction', 'x = 0.25', 'x = 1/4', E],
  ['unicode minus and times', '3×x − 2 = 10', '3x = 12', E],
  ['division sign', '12 ÷ 4 = x', 'x = 3', E],
  ['superscript squares (expression)', 'x² + 2x + x²', '2x^2 + 2x', E],
  ['FOIL', '(x + 2)(x - 3)', 'x^2 - x - 6', E],
  ['monomial times binomial', '-3x(x - 6)', '-3x^2 + 18x', E],
  ['subtract polynomials', '(4x^2 + 2x - 8) - (-3x^2 - 5x - 3)', '7x^2 + 7x - 5', E],
  ['cube', '(x + 1)^3', 'x^3 + 3x^2 + 3x + 1', E],
  ['implicit multiplication 3(x+1)', '3(x+1) = 9', 'x + 1 = 3', E],
  ['nested parentheses', '2(3(x - 1) + 4) = 14', '6x + 2 = 14', E],
  ['spaces and case', '  2X+5 =17 ', '2X = 12', E],
  ['quadratic equation scaled', 'x^2 - 4 = 0', '2x^2 - 8 = 0', E],
  ['constant arithmetic only', '3 + 4 * 2', '11', E],

  // ── invalid steps ──
  ['sign error moving a constant', '2x + 5 = 17', '2x = 22', N],
  ['sign error moving a variable term', '5x - 7 = 2x + 8', '7x - 7 = 8', N],
  ['forgot to distribute to second term', '3(x - 2) = 2x + 4', '3x - 2 = 2x + 4', N],
  ['forgot to distribute (expression)', '4(x + 3)', '4x + 3', N],
  ['divided only one side', '2x = 12', 'x = 12', N],
  ['subtracted only one side', '2x + 5 = 17', '2x = 17', N],
  ['arithmetic slip', '3x = 21', 'x = 8', N],
  ['arithmetic slip combining', '3x + 2x - 4 = 11', '6x - 4 = 11', N],
  ['dropped a term', '4x + 3 - x + 2', '3x + 3', N],
  ['dropped a term in an equation', '5x - 7 = 2x + 8', '5x = 2x + 8', N],
  ['sign flipped in expression', 'x^2 - x - 6', 'x^2 + x - 6', N],
  ['FOIL missing middle term', '(x + 2)(x - 3)', 'x^2 - 6', N],
  ['equation became an expression', '2x + 5 = 17', '2x + 5', N],
  ['expression became an equation', '4x + 3', '4x + 3 = 0', N],
  ['lost the variable', '2x + 1 = 7', '2 + 1 = 7', N],
  ['contradiction from a slip', 'x + 2 = 5', '2 = 5', N],

  // ── unknown ──
  ['empty next line', '2x + 5 = 17', '', U],
  ['whitespace only', '2x + 5 = 17', '   ', U],
  ['too long', '2x + 5 = 17', '2x + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 = 26', U],
  ['two variables', '2x + 5 = 17', '2x + y = 17', U],
  ['two variables across lines', 'x + 1 = 2', 'y = 1', U],
  ['two equals signs', '2x + 5 = 17', '2x = 12 = 12', U],
  ['unsupported symbol', '2x + 5 = 17', '√x = 3', U],
  ['function name', '2x + 5 = 17', 'sqrt(x) = 3', U],
  ['exponent too high', 'x^4 = 16', 'x^2 = 4', U],
  ['negative exponent', 'x = 2', 'x^-1 = 1/2', U],
  ['divide by the variable', 'x = 2', '1/x = 1/2', U],
  ['divide by zero', 'x = 2', 'x/0 = 1', U],
  ['degenerate 0 = 0', '2x + 5 = 17', '0 = 0', U],
  ['identity equation', 'x + 1 = x + 1', 'x = x', U],
  ['ambiguous x2', '2x = 4', 'x2 = 4', U],
  ['ambiguous 2 3', '2x = 4', '2 3 = x', U],
  ['unbalanced parenthesis', '3(x + 1) = 6', '3(x + 1 = 6', U],
  ['sign after an operator (x + -3)', 'x = 3', 'x + -3 = 0', E],
  ['double negative', 'x = 5', 'x - -2 = 7', E],
  ['nonlinear not proportional (could share roots)', 'x^2 = 4', 'x = 2', U],
  ['malformed number', 'x = 2', 'x = 1.2.3', U],
  ['trailing operator', 'x + 1 = 3', 'x + = 2', U],
  ['non-string input', '2x = 4', null, U]
];

const rows = [];
for (const [name, prev, next, want] of CASES) {
  let got, reason;
  try { ({ result: got, reason } = checkStep(prev, next)); } catch (e) { got = 'THREW'; reason = e.message; }
  const ok = got === want && typeof reason === 'string' && reason.length > 0 && reason.length <= 140;
  rows.push({ name, prev, next: String(next), want, got, ok, reason });
}

// Finish detection and simplified-form helpers used by the endpoint.
const extra = [
  ['isolatedValue x = 4', isolatedValue('x = 4') && isolatedValue('x = 4').toString() === '4'],
  ['isolatedValue 4 = x', isolatedValue('4 = x') && isolatedValue('4 = x').toString() === '4'],
  ['isolatedValue x = 12/3', isolatedValue('x = 12/3') && isolatedValue('x = 12/3').toString() === '4'],
  ['isolatedValue 2x = 8 is not isolated', isolatedValue('2x = 8') === null],
  ['isolatedValue x + 0 = 4 is not isolated', isolatedValue('x + 0 = 4') === null],
  ['simplified 9x^2 - x + 10', isSimplifiedExpression('9x^2 - x + 10') === true],
  ['not simplified 3x + 2x', isSimplifiedExpression('3x + 2x') === false],
  ['not simplified 4(x + 3)', isSimplifiedExpression('4(x + 3)') === false]
];

// Cross-check against the generators: for every "Show your work" concept,
// jumping straight from the start line to the generator's answer must be
// equivalent, and must count as finished.
const { generateProblem, listConcepts } = require('./generators');
for (const id of listConcepts()) {
  if (!generateProblem(id, 0).steps) continue;
  let bad = 0;
  for (let seed = 0; seed < 200; seed++) {
    const p = generateProblem(id, seed);
    if (p.steps.kind === 'equation') {
      const v = isolatedValue(`x = ${p.answer}`);
      if (checkStep(p.steps.start, `x = ${p.answer}`).result !== E || !v || v.toString() !== p.answer) bad++;
    } else if (checkStep(p.steps.start, p.answer).result !== E || !isSimplifiedExpression(p.answer)) bad++;
  }
  extra.push([`generator start -> answer: ${id} (200 seeds)`, bad === 0]);
}

const w = Math.max(...rows.map((r) => r.name.length), ...extra.map(([n]) => n.length));
console.log(`${'case'.padEnd(w)}  ${'expected'.padEnd(15)}${'got'.padEnd(15)}result`);
console.log('-'.repeat(w + 40));
for (const r of rows) {
  console.log(`${r.name.padEnd(w)}  ${r.want.padEnd(15)}${r.got.padEnd(15)}${r.ok ? 'pass' : 'FAIL'}`);
  if (!r.ok) console.log(`    "${r.prev}" -> "${r.next}": ${r.reason}`);
}
for (const [n, ok] of extra) console.log(`${n.padEnd(w)}  ${''.padEnd(30)}${ok ? 'pass' : 'FAIL'}`);
const failed = rows.filter((r) => !r.ok).length + extra.filter(([, ok]) => !ok).length;
console.log('-'.repeat(w + 40));
console.log(`${rows.length} step cases + ${extra.length} helper cases, ${failed} failing`);
process.exit(failed ? 1 : 0);
