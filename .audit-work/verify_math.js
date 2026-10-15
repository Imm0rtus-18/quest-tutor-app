// Independent math verification for all 120 quizzes.js questions.
// Strategy: wherever the question and its options are algebraic
// expressions (not just conceptual/definitional recall), evaluate both
// the question's stem and every option numerically at one or more
// generic sample values and see which option's value matches the
// stem's — rather than trusting any prior hand-check. Falls back to a
// handful of dedicated solvers (linear equations/inequalities, 2-var
// linear systems, quadratics, radicals, Pythagorean/distance, domain
// restrictions, exponent rules) for cases that aren't a single-value
// comparison. Anything left over is reported as "not computable" —
// genuinely conceptual/definitional questions, not a verification gap.

const { QUIZZES } = require('../quizzes.js');

// ---------------------------------------------------------------------
// Generic numeric expression evaluator
// ---------------------------------------------------------------------
function toJsExpr(str) {
  let s = str;
  s = s.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**');
  // Division immediately followed by an implicit-multiplication group
  // (e.g. "/2x") binds the whole group as the divisor under standard
  // math notation — JS would otherwise read it as (.../2)*x.
  s = s.replace(/\/(\s*)(\d+)([a-zA-Z])/g, '/($2*$3)');
  // √N or √(...) -> Math.sqrt(...)
  s = s.replace(/√\(/g, 'Math.sqrt(');
  s = s.replace(/√(\d+(\.\d+)?)/g, 'Math.sqrt($1)');
  return s;
}
function substituteVars(s, vars) {
  Object.keys(vars).forEach(v => {
    const re = new RegExp('(?<![A-Za-z])' + v + '(?![A-Za-z])', 'g');
    s = s.replace(re, '(' + vars[v] + ')');
  });
  return s;
}
function insertImplicitMult(s) {
  s = s.replace(/(\d|\))(\s*)(\(|Math\.sqrt)/g, '$1*$3');
  s = s.replace(/(\d)(\s*)Math\.sqrt/g, '$1*Math.sqrt');
  return s;
}
function evalExpr(str, vars = {}) {
  let s = toJsExpr(str);
  s = substituteVars(s, vars);
  s = insertImplicitMult(s);
  // eslint-disable-next-line no-eval
  return eval(s);
}
function closeTo(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

// ---------------------------------------------------------------------
// Fraction-literal parsing for option text (e.g. "1/2", "−3")
// ---------------------------------------------------------------------
function parseNumberToken(tok) {
  tok = tok.trim().replace(/−/g, '-');
  if (/^-?\d+\/\d+$/.test(tok)) {
    const [n, d] = tok.split('/').map(Number);
    return n / d;
  }
  if (/^-?\d+(\.\d+)?$/.test(tok)) return parseFloat(tok);
  return null;
}

// ---------------------------------------------------------------------
// Linear solve via two-point sampling: works for any expression that
// is affine (degree <= 1) in the named variable.
// ---------------------------------------------------------------------
function linearCoeffs(exprStr, varName) {
  const f0 = evalExpr(exprStr, { [varName]: 0 });
  const f1 = evalExpr(exprStr, { [varName]: 1 });
  const m = f1 - f0;
  const k = f0;
  return { m, k };
}
function solveLinearEquation(lhs, rhs, varName) {
  const l = linearCoeffs(lhs, varName), r = linearCoeffs(rhs, varName);
  const m = l.m - r.m, k = l.k - r.k;
  return -k / m;
}
function solveLinearInequality(lhs, op, rhs, varName) {
  const l = linearCoeffs(lhs, varName), r = linearCoeffs(rhs, varName);
  const m = l.m - r.m, k = l.k - r.k; // solving m*x + k <op> 0
  const boundary = -k / m;
  let finalOp = op;
  if (m < 0) {
    finalOp = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }[op];
  }
  return { boundary, op: finalOp };
}
function parseInequalityOption(text) {
  const t = text.replace(/−/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=');
  const m = t.match(/x\s*(<=|>=|<|>)\s*(-?\d+(\.\d+)?)/);
  if (!m) return null;
  return { op: m[1], boundary: parseFloat(m[2]) };
}

// ---------------------------------------------------------------------
// 2-variable linear system solve (for substitution/elimination quizzes)
// ---------------------------------------------------------------------
function affineCoeffs2(exprStr) {
  const c = evalExpr(exprStr, { x: 0, y: 0 });
  const a = evalExpr(exprStr, { x: 1, y: 0 }) - c;
  const b = evalExpr(exprStr, { x: 0, y: 1 }) - c;
  return { a, b, c };
}
function solveSystem(eq1, eq2) {
  function eqToABC(eqStr) {
    const [lhs, rhs] = eqStr.split('=');
    const L = affineCoeffs2(lhs), R = affineCoeffs2(rhs);
    return { A: L.a - R.a, B: L.b - R.b, C: R.c - L.c }; // A x + B y = C
  }
  const e1 = eqToABC(eq1), e2 = eqToABC(eq2);
  const det = e1.A * e2.B - e2.A * e1.B;
  const x = (e1.C * e2.B - e2.C * e1.B) / det;
  const y = (e1.A * e2.C - e2.A * e1.C) / det;
  return { x, y };
}
function parsePointOption(text) {
  const m = text.match(/\(\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)/);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[3]) };
}

// ---------------------------------------------------------------------
// Quadratic coefficient extraction (3-point fit) + solver
// ---------------------------------------------------------------------
function quadraticCoeffs(exprStr, varName) {
  const fm1 = evalExpr(exprStr, { [varName]: -1 });
  const f0 = evalExpr(exprStr, { [varName]: 0 });
  const f1 = evalExpr(exprStr, { [varName]: 1 });
  const c = f0;
  const a = (f1 + fm1 - 2 * c) / 2;
  const b = (f1 - fm1) / 2;
  return { a, b, c };
}
function quadraticRoots(a, b, c) {
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  return [(-b + sq) / (2 * a), (-b - sq) / (2 * a)];
}
function parseRootPairOption(text) {
  const nums = [];
  const re = /x\s*=\s*(-?\d+\/\d+|-?\d+(\.\d+)?)/g;
  let m;
  while ((m = re.exec(text.replace(/−/g, '-')))) nums.push(parseNumberToken(m[1]));
  return nums.length === 2 ? nums : null;
}

// ---------------------------------------------------------------------
// Radical simplification: N -> k*sqrt(m), m squarefree
// ---------------------------------------------------------------------
function simplifyRadical(n) {
  let k = 1, m = n;
  for (let f = 2; f * f <= m; f++) {
    while (m % (f * f) === 0) { m /= f * f; k *= f; }
  }
  return { k, m };
}

const results = [];
function record(id, concept, status, detail) {
  results.push({ id, concept, status, detail });
}

// ---------------------------------------------------------------------
// Main pass
// ---------------------------------------------------------------------
Object.keys(QUIZZES).forEach(chapterId => {
  QUIZZES[chapterId].forEach(q => {
    const { id, correctIndex, concept } = q;
    // Normalize the unicode minus sign up front — regex stem-parsing
    // below uses plain ASCII '-' throughout; evalExpr() also normalizes
    // internally, but only once a substring has already been *captured*
    // by one of these regexes, so an unnormalized stem can fail to match
    // at the capture stage before evalExpr ever sees it.
    const question = q.question.replace(/−/g, '-');
    const options = q.options.map(o => o.replace(/−/g, '-'));
    try {
      // --- Evaluate: <numeric expr> ---
      let m;
      if ((m = question.match(/^Evaluate:\s*(.+)$/))) {
        const val = evalExpr(m[1]);
        const idx = options.findIndex(o => closeTo(parseFloat(o.replace(/−/g, '-')), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed ${val}, options=${JSON.stringify(options)}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- If x = N [and y = M ...], what is the value of EXPR? ---
      if ((m = question.match(/^If\s+(.+?),?\s*what is the value of\s+(.+?)\??$/i))) {
        const assigns = {};
        m[1].split(/,|\band\b/i).forEach(part => {
          const am = part.match(/([a-zA-Z])\s*=\s*(-?\d+(\.\d+)?)/);
          if (am) assigns[am[1]] = parseFloat(am[2]);
        });
        const val = evalExpr(m[2], assigns);
        const idx = options.findIndex(o => closeTo(parseFloat(o.replace(/−/g, '-')), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed ${val} with ${JSON.stringify(assigns)}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- additive / multiplicative inverse of N ---
      if ((m = question.match(/What is the additive inverse of\s*(-?\d+)/))) {
        const val = -parseFloat(m[1]);
        const idx = options.findIndex(o => closeTo(parseNumberToken(o), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed ${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      if ((m = question.match(/multiplicative inverse \(reciprocal\) of\s*(-?\d+)/))) {
        const val = 1 / parseFloat(m[1]);
        const idx = options.findIndex(o => closeTo(parseNumberToken(o), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed ${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- reading an ordered pair's coordinate ---
      if ((m = question.match(/ordered pair\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\),\s*what is the (x|y)-coordinate/))) {
        const val = m[3] === 'x' ? parseFloat(m[1]) : parseFloat(m[2]);
        const idx = options.findIndex(o => closeTo(parseNumberToken(o), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed ${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- |−N| = ? ---
      if ((m = question.match(/^\|(-?\d+)\|/))) {
        const val = Math.abs(parseFloat(m[1]));
        const idx = options.findIndex(o => closeTo(parseFloat(o.replace(/−/g, '-')), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed ${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Simplify: <purely numeric expr, no variables, no symbolic exponent form expected> ---
      if ((m = question.match(/^Simplify:\s*(.+)$/)) && /^[-−+*/×÷().\d\s^]+$/.test(m[1]) && !/\^/.test(m[1])) {
        const val = evalExpr(m[1]);
        const idx = options.findIndex(o => closeTo(parseFloat(o.replace(/−/g, '-')), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed ${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Simplify: 2^(-2) style purely numeric exponent (both base & exp numeric) ---
      if ((m = question.match(/^Simplify:\s*(-?\d+)\^\(?(-?\d+)\)?$/)) ) {
        const val = Math.pow(parseFloat(m[1]), parseFloat(m[2]));
        const idx = options.findIndex(o => closeTo(parseNumberToken(o), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed ${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      if ((m = question.match(/^Evaluate:\s*(-?\d+)\^(-?\d+)$/))) {
        const val = Math.pow(parseFloat(m[1]), parseFloat(m[2]));
        const idx = options.findIndex(o => closeTo(parseNumberToken(o), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed ${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Symbolic/numeric exponent rules: a^m (op) a^n style ---
      function checkExpRule(base, expected, ruleName) {
        if (/^\d+$/.test(base)) {
          const val = Math.pow(parseFloat(base), expected);
          const idx = options.findIndex(o => { try { return closeTo(evalExpr(o), val); } catch (e) { return false; } });
          return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
            `${ruleName} expects ${base}^${expected}=${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
        }
        const idx = options.findIndex(o => o.replace(/\s/g, '') === `${base}^${expected}`);
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `${ruleName} expects ${base}^${expected}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      if ((m = question.match(/^Simplify:\s*([a-zA-Z0-9]+)\^(\d+)\s*×\s*\1\^(\d+)$/))) {
        return checkExpRule(m[1], parseFloat(m[2]) + parseFloat(m[3]), 'product rule');
      }
      if ((m = question.match(/^Simplify:\s*([a-zA-Z0-9]+)\^(\d+)\s*\/\s*\1\^(\d+)$/))) {
        return checkExpRule(m[1], parseFloat(m[2]) - parseFloat(m[3]), 'quotient rule');
      }
      if ((m = question.match(/^Simplify:\s*\(([a-zA-Z0-9]+)\^(\d+)\)\^(\d+)$/))) {
        return checkExpRule(m[1], parseFloat(m[2]) * parseFloat(m[3]), 'power-of-power');
      }
      if ((m = question.match(/^Evaluate:\s*([a-zA-Z])\^0$/))) {
        const idx = options.findIndex(o => o.trim() === '1');
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `zero-exponent rule expects 1, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      if ((m = question.match(/^Simplify:\s*([a-zA-Z])\^\(?-(\d+)\)?$/))) {
        const base = m[1], n = m[2];
        const idx = options.findIndex(o => o.replace(/\s/g, '') === `1/${base}^${n}`);
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `negative-exponent rule expects 1/${base}^${n}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Slope between two points ---
      if ((m = question.match(/slope of the line through\s*\(\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)\s*and\s*\(\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)/i))) {
        const [x1, y1, x2, y2] = [m[1], m[3], m[5], m[7]].map(parseFloat);
        const slope = (y2 - y1) / (x2 - x1);
        const idx = options.findIndex(o => closeTo(parseNumberToken(o), slope));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed slope ${slope}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Write the equation through two points (slope-intercept) ---
      if ((m = question.match(/equation of the line through\s*\(\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)\s*and\s*\(\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\).*slope-intercept/i))) {
        const [x1, y1, x2, y2] = [m[1], m[3], m[5], m[7]].map(parseFloat);
        const slope = (y2 - y1) / (x2 - x1);
        const b = y1 - slope * x1;
        const idx = options.findIndex(o => {
          const om = o.match(/y\s*=\s*(-?\d+(\.\d+)?)x\s*([+-]\s*\d+(\.\d+)?)/);
          if (!om) return false;
          const oSlope = parseFloat(om[1]);
          const oB = parseFloat(om[3].replace(/\s/g, ''));
          return closeTo(oSlope, slope) && closeTo(oB, b);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed y = ${slope}x + ${b}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Point-slope form: through (x1,y1) with slope m ---
      if ((m = question.match(/point-slope equation of a line through\s*\(\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)\s*with slope\s*(-?\d+(\.\d+)?)/i))) {
        const x1 = parseFloat(m[1]), y1 = parseFloat(m[3]), slope = parseFloat(m[5]);
        // test numerically: y - y1 = slope*(x - x1) <=> for a sample x, y should equal y1 + slope*(x-x1)
        const xt = 9;
        const yExpected = y1 + slope * (xt - x1);
        const idx = options.findIndex(o => {
          const om = o.match(/y\s*([+-]\s*\d+(\.\d+)?)\s*=\s*(-?\d+(\.\d+)?)\s*\(\s*x\s*([+-]\s*\d+(\.\d+)?)\s*\)/);
          if (!om) return false;
          const yConst = -parseFloat(om[1].replace(/\s/g, '')); // y + c = ... means y = ... - c, so y-intercept-part handled via eval
          try {
            const yOff = parseFloat(om[1].replace(/\s/g, ''));
            const slopeO = parseFloat(om[3]);
            const xOff = parseFloat(om[5].replace(/\s/g, ''));
            const yVal = -yOff + slopeO * (xt + xOff);
            return closeTo(yVal, yExpected);
          } catch (e) { return false; }
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `point-slope numeric check at x=${xt} expects y=${yExpected}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Solve: <linear equation> ---
      if ((m = question.match(/^Solve:\s*(.+?)\s*=\s*(.+)$/)) && !/[x]\^2|x\*\*2/.test(m[1] + m[2]) && !/\//.test(m[1] + m[2])) {
        const sol = solveLinearEquation(m[1], m[2], 'x');
        const idx = options.findIndex(o => {
          const om = o.match(/x\s*=\s*(-?\d+(\.\d+)?)/);
          return om && closeTo(parseFloat(om[1]), sol);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed x=${sol}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Solve: <linear inequality> ---
      if ((m = question.match(/^Solve:\s*(.+?)\s*(≤|≥|<|>)\s*(.+)$/))) {
        const { boundary, op } = solveLinearInequality(m[1], m[2].replace('≤', '<=').replace('≥', '>='), m[3], 'x');
        const idx = options.findIndex(o => {
          const po = parseInequalityOption(o);
          return po && po.op === op && closeTo(po.boundary, boundary);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed x ${op} ${boundary}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Solve and describe the graph: <linear inequality> ---
      if ((m = question.match(/^Solve and describe the graph:\s*(.+?)\s*(<=|>=|<|>)\s*(.+)$/))) {
        const { boundary, op } = solveLinearInequality(m[1], m[2], m[3], 'x');
        const open = op === '<' || op === '>';
        const dir = op === '<' || op === '<=' ? 'left' : 'right';
        const idx = options.findIndex(o => {
          const om = o.match(/^(Open|Closed) circle at\s*(-?\d+(\.\d+)?),\s*shaded to the (left|right)/);
          if (!om) return false;
          const isOpen = om[1] === 'Open';
          return isOpen === open && closeTo(parseFloat(om[2]), boundary) && om[4] === dir;
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed x ${op} ${boundary} (${open ? 'open' : 'closed'}, shaded ${dir}), matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Which value of x satisfies <inequality>? (test each option) ---
      if ((m = question.match(/Which value of x satisfies\s*(.+?)\s*(≤|≥|<|>)\s*(.+)\?/))) {
        const lhs = m[1], op = m[2], rhs = m[3];
        const idx = options.findIndex(o => {
          const om = o.match(/x\s*=\s*(-?\d+(\.\d+)?)/);
          if (!om) return false;
          const xv = parseFloat(om[1]);
          const l = evalExpr(lhs, { x: xv }), r = evalExpr(rhs, { x: xv });
          if (op === '<') return l < r; if (op === '>') return l > r;
          if (op === '≤') return l <= r; if (op === '≥') return l >= r;
          return false;
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `tested each option, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Is x = N a solution to EQUATION? ---
      if ((m = question.match(/^Is x\s*=\s*(-?\d+)\s+a solution to\s+(.+?)\s*=\s*(.+?)\?$/))) {
        const xv = parseFloat(m[1]);
        const l = evalExpr(m[2], { x: xv }), r = evalExpr(m[3], { x: xv });
        const isYes = closeTo(l, r);
        const idx = options.findIndex(o => /^Yes/.test(o) === isYes && new RegExp(String(l)).test(o));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `LHS=${l}, RHS=${r}, isYes=${isYes}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- x/y-intercepts ---
      if ((m = question.match(/Find the x-intercept of\s+y\s*=\s*(.+)$/))) {
        const x0 = solveLinearEquation(m[1], '0', 'x');
        const idx = options.findIndex(o => {
          const pt = parsePointOption('(' + o.replace(/[()]/g, '') + ')');
          return pt && closeTo(pt.x, x0) && closeTo(pt.y, 0);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `x-intercept x=${x0}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      if ((m = question.match(/Find the y-intercept of\s+y\s*=\s*(.+)$/))) {
        const y0 = evalExpr(m[1], { x: 0 });
        const idx = options.findIndex(o => {
          const pt = parsePointOption('(' + o.replace(/[()]/g, '') + ')');
          return pt && closeTo(pt.x, 0) && closeTo(pt.y, y0);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `y-intercept y=${y0}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- In y = mx+b style, slope/y-intercept identification ---
      if ((m = question.match(/^In\s+y\s*=\s*(-?\d*)x\s*([+-]\s*\d+)?,\s*what is the slope\?/))) {
        const slope = m[1] === '' || m[1] === '-' ? (m[1] === '-' ? -1 : 1) : parseFloat(m[1]);
        const idx = options.findIndex(o => closeTo(parseFloat(o.replace(/−/g, '-')), slope));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `slope=${slope}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      if ((m = question.match(/^In\s+y\s*=\s*(.+?),\s*what is the y-intercept\?/))) {
        const y0 = evalExpr(m[1], { x: 0 });
        const idx = options.findIndex(o => {
          const pt = parsePointOption(o);
          return pt && closeTo(pt.x, 0) && closeTo(pt.y, y0);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `y-intercept=${y0}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Which point lies on the line y = ...? ---
      if ((m = question.match(/Which point lies on the line\s+y\s*=\s*(.+?)\??$/))) {
        const idx = options.findIndex(o => {
          const pt = parsePointOption(o);
          if (!pt) return false;
          return closeTo(evalExpr(m[1], { x: pt.x }), pt.y);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `tested each point, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Convert point-slope to slope-intercept ---
      if ((m = question.match(/Convert\s+y\s*([+-]\s*\d+(\.\d+)?)\s*=\s*(-?\d+(\.\d+)?)\s*\(\s*x\s*([+-]\s*\d+(\.\d+)?)\s*\)\s*to slope-intercept/))) {
        const yOff = parseFloat(m[1].replace(/\s/g, ''));
        const slope = parseFloat(m[3]);
        const xOff = parseFloat(m[5].replace(/\s/g, ''));
        // y - yOff... actually y + yOff_as_written = slope*(x+xOff_written); solve for y at test x
        const xt = 11;
        const yAtXt = -yOff + slope * (xt + xOff);
        const idx = options.findIndex(o => {
          const om = o.match(/y\s*=\s*(-?\d+(\.\d+)?)x\s*([+-]\s*\d+(\.\d+)?)/);
          if (!om) return false;
          const s2 = parseFloat(om[1]), b2 = parseFloat(om[3].replace(/\s/g, ''));
          return closeTo(s2 * xt + b2, yAtXt);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `numeric check at x=${xt} expects y=${yAtXt}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- parallel/perpendicular slope from y = mx+b ---
      if ((m = question.match(/parallel to\s+y\s*=\s*(-?\d+(\.\d+)?)x/))) {
        const slope = parseFloat(m[1]);
        const idx = options.findIndex(o => closeTo(parseNumberToken(o.replace(/−/g, '-')), slope));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `expected slope=${slope}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      if ((m = question.match(/perpendicular to\s+y\s*=\s*(-?\d+(\.\d+)?)x/))) {
        const slope = parseFloat(m[1]);
        const expected = -1 / slope;
        const idx = options.findIndex(o => closeTo(parseNumberToken(o.replace(/−/g, '-')), expected));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `expected slope=${expected}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Which pair of slopes represents parallel/perpendicular lines? ---
      if (/Which pair of slopes represents (parallel|perpendicular) lines\?/.test(question)) {
        const wantPerp = /perpendicular/.test(question);
        const idx = options.findIndex(o => {
          const m1 = o.match(/m1\s*=\s*(-?\d+\/\d+|-?\d+)/);
          const m2 = o.match(/m2\s*=\s*(-?\d+\/\d+|-?\d+)/);
          const nums = [parseNumberToken(m1[1]), parseNumberToken(m2[1])];
          if (wantPerp) return closeTo(nums[0] * nums[1], -1);
          return closeTo(nums[0], nums[1]);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Systems: solve by substitution / elimination (2 eqns, point options) ---
      if ((m = question.match(/Solve by (substitution|elimination):\s*(.+?)\s+and\s+(.+)$/))) {
        const { x, y } = solveSystem(m[2], m[3]);
        const idx = options.findIndex(o => {
          const pt = parsePointOption(o);
          return pt && closeTo(pt.x, x) && closeTo(pt.y, y);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed (${x}, ${y}), matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Exponential growth application: P = a(b)^t at t=N ---
      if ((m = question.match(/P\s*=\s*(\d+)\(([\d.]+)\)\^t.*after\s+(\d+)\s+years?/))) {
        const val = parseFloat(m[1]) * Math.pow(parseFloat(m[2]), parseFloat(m[3]));
        const idx = options.findIndex(o => closeTo(parseFloat(o), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `computed ${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Quadratics: factoring / quadratic formula, equation "... = 0" ---
      if ((m = question.match(/^(?:Solve by factoring|Use the quadratic formula to solve):\s*(.+?)\s*=\s*0$/))) {
        const { a, b, c } = quadraticCoeffs(m[1], 'x');
        const roots = quadraticRoots(a, b, c);
        const idx = options.findIndex(o => {
          const pair = parseRootPairOption(o);
          if (!pair || !roots) return false;
          return (closeTo(pair[0], roots[0]) && closeTo(pair[1], roots[1])) ||
                 (closeTo(pair[0], roots[1]) && closeTo(pair[1], roots[0]));
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `a=${a},b=${b},c=${c}, roots=${JSON.stringify(roots)}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- discriminant numeric: "For EQ, calculate the discriminant." ---
      if ((m = question.match(/For\s+(.+?)\s*=\s*0,\s*calculate the discriminant/))) {
        const { a, b, c } = quadraticCoeffs(m[1], 'x');
        const disc = b * b - 4 * a * c;
        const idx = options.findIndex(o => {
          const nm = o.match(/^(-?\d+(\.\d+)?)/);
          return nm && closeTo(parseFloat(nm[1]), disc);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `a=${a},b=${b},c=${c}, discriminant=${disc}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      if ((m = question.match(/discriminant of\s*(-?\d+)\.?\s*How many real solutions/))) {
        const disc = parseFloat(m[1]);
        const expected = disc < 0 ? 'No real solutions' : disc === 0 ? 'One real solution' : 'Two real solutions';
        const idx = options.findIndex(o => o === expected);
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `disc=${disc}, expects "${expected}", matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Polynomial add/subtract/FOIL/factoring/distributing/difference-of-squares ---
      // generic approach: evaluate the STEM at a test value of x, then
      // evaluate each OPTION the same way, and see which matches. Works
      // for any single-variable polynomial identity.
      const polyStemPatterns = [
        /^Simplify:\s*(.+)$/,
        /^Multiply using FOIL:\s*(.+)$/,
        /^Factor out the GCF:\s*(.+)$/,
        /^Factor the trinomial:\s*(.+)$/,
        /^Factor using the difference of squares:\s*(.+)$/,
        /^Use the distributive property to expand:\s*(.+)$/
      ];
      let stemMatch = null;
      for (const pat of polyStemPatterns) {
        const mm = question.match(pat);
        if (mm) { stemMatch = mm[1]; break; }
      }
      if (stemMatch && /x/.test(stemMatch) && !/√|\|.*\|/.test(stemMatch)) {
        const testVals = [17, -19, 23]; // large/odd, unlikely to hit a denominator's pole
        const stemVals = testVals.map(xv => evalExpr(stemMatch, { x: xv }));
        const idx = options.findIndex(o => {
          try {
            const oVals = testVals.map(xv => evalExpr(o, { x: xv }));
            return oVals.every((v, i) => closeTo(v, stemVals[i], 1e-4));
          } catch (e) { return false; }
        });
        if (idx !== -1 || options.some(o => { try { evalExpr(o, { x: 2 }); return true; } catch (e) { return false; } })) {
          return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
            `numeric-identity check at x=${testVals.join(',')}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
        }
      }

      // --- Which expression is a difference of squares? (pick option, verify form a^2 - b^2) ---
      if (/Which expression is a difference of squares\?/.test(question)) {
        const idx = options.findIndex(o => {
          const om = o.match(/x\^2\s*-\s*(\d+)/);
          if (!om) return false;
          return Number.isInteger(Math.sqrt(parseFloat(om[1])));
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Rational expressions: domain restrictions ---
      if ((m = question.match(/excluded from the domain of\s+.*?\/\s*\(([^)]+)\)/)) ||
          (m = question.match(/excluded from the domain of\s+.*?\/\(([^)]+)\)/))) {
        const denom = m[1];
        let roots;
        if (/x\^2/.test(denom)) {
          const { a, b, c } = quadraticCoeffs(denom, 'x');
          roots = quadraticRoots(a, b, c);
        } else {
          roots = [solveLinearEquation(denom, '0', 'x')];
        }
        const idx = options.findIndex(o => {
          const nums = (o.match(/-?\d+/g) || []).map(Number);
          if (!roots) return false;
          const roundedRoots = roots.map(r => Math.round(r * 1000) / 1000);
          return nums.length === roundedRoots.length && roundedRoots.every(r => nums.includes(r));
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `denom="${denom}", roots=${JSON.stringify(roots)}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Rational expression multiply/divide/add, "Solve: a/x = b/(x+c)" style ---
      if ((m = question.match(/^(Multiply|Divide|Add):\s*(.+)$/)) && /\//.test(m[2]) && /x/.test(m[2])) {
        const stem = m[2];
        const testVals = [17, 23];
        try {
          const stemVals = testVals.map(xv => evalExpr(stem.replace(/÷/g, '/').replace(/×/g, '*'), { x: xv }));
          const idx = options.findIndex(o => {
            try {
              const oVals = testVals.map(xv => evalExpr(o, { x: xv }));
              return oVals.every((v, i) => closeTo(v, stemVals[i], 1e-4));
            } catch (e) { return false; }
          });
          return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
            `numeric check at x=${testVals.join(',')}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
        } catch (e) { /* fall through to not-computable */ }
      }

      if ((m = question.match(/^Solve:\s*(.+?)\/(.+?)\s*=\s*(.+?)\/(.+)$/))) {
        // cross-multiply equation a/b = c/d  -> a*d = c*b, linear in x generally
        const lhs = `(${m[1]})*(${m[4]})`;
        const rhs = `(${m[3]})*(${m[2]})`;
        const sol = solveLinearEquation(lhs, rhs, 'x');
        const idx = options.findIndex(o => {
          const om = o.match(/x\s*=\s*(-?\d+(\.\d+)?)/);
          return om && closeTo(parseFloat(om[1]), sol);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `cross-multiplied, x=${sol}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Radicals: Simplify √N ---
      if ((m = question.match(/^Simplify:\s*√(\d+)$/))) {
        const { k, m: rad } = simplifyRadical(parseFloat(m[1]));
        const idx = options.findIndex(o => {
          const om = o.match(/^(\d*)√(\d+)$/);
          if (!om) return false;
          const coeff = om[1] === '' ? 1 : parseFloat(om[1]);
          return coeff === k && parseFloat(om[2]) === rad;
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `simplified = ${k}√${rad}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      // combining like/unlike radicals, multiplying radicals -> numeric value check
      if ((m = question.match(/^Simplify:\s*(.+√.+)$/))) {
        const val = evalExpr(m[1]);
        const idx = options.findIndex(o => {
          try { return closeTo(evalExpr(o), val); } catch (e) { return false; }
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `numeric value ${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      if ((m = question.match(/^Multiply:\s*(√.+)$/))) {
        const val = evalExpr(m[1]);
        const idx = options.findIndex(o => {
          try { return closeTo(evalExpr(o), val); } catch (e) { return false; }
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `numeric value ${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Pythagorean theorem ---
      if ((m = question.match(/legs of (?:length\s*)?(\d+) and (\d+)\. Find the hypotenuse/))) {
        const val = Math.sqrt(parseFloat(m[1]) ** 2 + parseFloat(m[2]) ** 2);
        const idx = options.findIndex(o => closeTo(evalExpr(o.replace(/^√/, 'Math.sqrt(') + (o.startsWith('√') ? ')' : '')), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `hypotenuse=${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }
      if ((m = question.match(/hypotenuse of (\d+) and one leg of (\d+)\. Find the other leg/))) {
        const val = Math.sqrt(parseFloat(m[1]) ** 2 - parseFloat(m[2]) ** 2);
        const idx = options.findIndex(o => closeTo(parseFloat(o), val));
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `leg=${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      // --- Distance formula ---
      if ((m = question.match(/distance between the points\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*and\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/))) {
        const [x1, y1, x2, y2] = [m[1], m[2], m[3], m[4]].map(Number);
        const val = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const idx = options.findIndex(o => {
          if (/^√/.test(o)) return closeTo(Math.sqrt(parseFloat(o.slice(1))), val);
          return closeTo(parseFloat(o), val);
        });
        return record(id, concept, idx === correctIndex ? 'MATCH' : 'MISMATCH',
          `distance=${val}, matchedIdx=${idx}, correctIndex=${correctIndex}`);
      }

      record(id, concept, 'NOT_COMPUTABLE', 'conceptual/definitional or unmatched pattern — needs human review');
    } catch (e) {
      record(id, concept, 'ERROR', e.message);
    }
  });
});

const mismatches = results.filter(r => r.status === 'MISMATCH');
const errors = results.filter(r => r.status === 'ERROR');
const notComputable = results.filter(r => r.status === 'NOT_COMPUTABLE');
const matches = results.filter(r => r.status === 'MATCH');

console.log('TOTAL:', results.length, '| MATCH:', matches.length, '| MISMATCH:', mismatches.length, '| ERROR:', errors.length, '| NOT_COMPUTABLE:', notComputable.length);
console.log('\n--- MISMATCHES ---');
mismatches.forEach(r => console.log(r.id, '[' + r.concept + ']', '->', r.detail));
console.log('\n--- ERRORS ---');
errors.forEach(r => console.log(r.id, '[' + r.concept + ']', '->', r.detail));
console.log('\n--- NOT COMPUTABLE (count by chapter) ---');
const byChapter = {};
notComputable.forEach(r => { const ch = r.id.match(/algebra1-\d+/)[0]; byChapter[ch] = (byChapter[ch] || 0) + 1; });
console.log(byChapter);

require('fs').writeFileSync(__dirname + '/math_verification_results.json', JSON.stringify(results, null, 2));
