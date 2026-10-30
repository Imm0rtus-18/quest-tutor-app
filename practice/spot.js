// Spot the mistake: a 5-7 line worked solution built by code, with ONE
// planted error (or, about 20% of the time, none).
//
// A solution is a list of moves applied to a structured linear equation
// ax + b = cx + d. Each move computes its operands from the state it's
// given (e.g. "divide both sides by the x coefficient"), so when an error
// is planted at line k, the later moves are applied to the wrong line and
// the mistake carries through to a wrong final answer.
//
// Every puzzle is verified with the Stage B step checker before it's used:
// transitions before k equivalent, transition k not_equivalent (not
// unknown), transitions after k equivalent. Anything else is rejected and
// regenerated from the next attempt number.

const { Frac } = require('./frac');
const { makeRng, fmt } = require('./generators');
const { checkStep, isolatedValue } = require('./checker');

const F = (v) => Frac.of(v);
const { poly, term, num } = fmt;

const NO_ERROR_RATE = 0.2;
const MAX_ATTEMPTS = 50;

// state: { L: { x, c }, R: { x, c } } with Frac coefficients.
const side = (s) => poly([[s.x, 'x'], [s.c, '']]);
const eqText = (st) => `${side(st.L)} = ${side(st.R)}`;
const st = (lx, lc, rx, rc) => ({ L: { x: F(lx), c: F(lc) }, R: { x: F(rx), c: F(rc) } });
const plusMinus = (v) => (F(v).sign() < 0 ? `+ ${num(F(v).neg())}` : `- ${num(v)}`); // "- 5" / "+ 5" for subtracting v
const wrap = (t) => (/[ ]/.test(t) ? `(${t})` : t);

// ── Moves ───────────────────────────────────────────────────────────────
// Each move: (state) -> { text, state }. `errors` maps a wrong-rule tag to
// (state, rng) -> { text, state } producing the wrong version of the line.

const MOVES = {
  // Written-out "subtract the left constant from both sides": no change in value.
  writeSubtract: {
    run: (s) => ({ text: `${side(s.L)} ${plusMinus(s.L.c)} = ${side(s.R)} ${plusMinus(s.L.c)}`, state: s }),
    applies: (s) => !s.L.c.isZero()
  },
  // Result of moving the left constant across: ax = d - b.
  subtractConst: {
    run: (s) => { const n = st(s.L.x.sub(s.R.x), 0, 0, s.R.c.sub(s.L.c)); return { text: eqText(n), state: n }; },
    applies: (s) => !s.L.c.isZero(),
    errors: {
      'sign-error': (s) => { const n = st(s.L.x.sub(s.R.x), 0, 0, s.R.c.add(s.L.c)); return { text: eqText(n), state: n }; },
      'arithmetic-slip': (s, r) => { const n = st(s.L.x.sub(s.R.x), 0, 0, s.R.c.sub(s.L.c).add(r.pick([-2, -1, 1, 2]))); return { text: eqText(n), state: n }; },
      'dropped-term': (s) => { const n = st(s.L.x.sub(s.R.x), 0, 0, s.R.c); return { text: eqText(n), state: n }; }
    }
  },
  // Written-out divide: ax / a = n / a.
  writeDivide: {
    run: (s) => ({ text: `${wrap(side(s.L))} / ${wrap(num(s.L.x))} = ${wrap(side(s.R))} / ${wrap(num(s.L.x))}`, state: s }),
    applies: (s) => s.L.c.isZero() && s.R.x.isZero() && !s.L.x.isZero() && !s.L.x.eq(1)
  },
  divide: {
    run: (s) => { const n = st(1, 0, 0, s.R.c.div(s.L.x)); return { text: `x = ${num(n.R.c)}`, state: n }; },
    applies: (s) => s.L.c.isZero() && s.R.x.isZero() && !s.L.x.isZero() && !s.L.x.eq(1),
    errors: {
      'divided-one-side': (s) => { const n = st(1, 0, 0, s.R.c); return { text: `x = ${num(n.R.c)}`, state: n }; },
      'arithmetic-slip': (s, r) => { const n = st(1, 0, 0, s.R.c.div(s.L.x).add(r.pick([-1, 1]))); return { text: `x = ${num(n.R.c)}`, state: n }; },
      'sign-error': (s) => { const n = st(1, 0, 0, s.R.c.div(s.L.x).neg()); return { text: `x = ${num(n.R.c)}`, state: n }; }
    }
  },
  // Move the right x term to the left, written unsimplified: ax - cx + b = d.
  moveVar: {
    run: (s) => {
      const n = st(s.L.x.sub(s.R.x), s.L.c, 0, s.R.c);
      return { text: `${poly([[s.L.x, 'x'], [s.R.x.neg(), 'x'], [s.L.c, '']])} = ${side(n.R)}`, state: n };
    },
    applies: (s) => !s.R.x.isZero(),
    errors: {
      'sign-error': (s) => {
        const n = st(s.L.x.add(s.R.x), s.L.c, 0, s.R.c);
        return { text: `${poly([[s.L.x, 'x'], [s.R.x, 'x'], [s.L.c, '']])} = ${side(n.R)}`, state: n };
      },
      'dropped-term': (s) => {
        const n = st(s.L.x.sub(s.R.x), 0, 0, s.R.c);
        return { text: `${poly([[s.L.x, 'x'], [s.R.x.neg(), 'x']])} = ${side(n.R)}`, state: n };
      }
    }
  },
  // Combine like terms (state is already combined; the text just shows it).
  combine: {
    run: (s) => ({ text: eqText(s), state: s }),
    applies: () => true,
    errors: {
      'arithmetic-slip': (s, r) => { const n = st(s.L.x.add(r.pick([-1, 1])), s.L.c, s.R.x, s.R.c); return { text: eqText(n), state: n }; },
      'sign-error': (s) => { const n = st(s.L.x, s.L.c.neg(), s.R.x, s.R.c); return { text: eqText(n), state: n }; }
    }
  }
};

// Combine-like-terms needs to know the original pieces to plant a dropped
// term, so it's a per-template move built below.

// ── Templates ───────────────────────────────────────────────────────────
// Each returns { start: text, state, steps: [moveName | moveObject] }.

const TEMPLATES = {
  'two-step': {
    label: 'Two-step equation',
    build(r) {
      const x = r.int(-9, 9), a = r.pick([2, 3, 4, 5, 6, 7, -2, -3, -4, -5]), b = r.nonzero(-12, 12);
      const s0 = st(a, b, 0, a * x + b);
      return { start: eqText(s0), state: s0, steps: ['writeSubtract', 'subtractConst', 'writeDivide', 'divide'] };
    }
  },
  'distribute-then-solve': {
    label: 'Distribute, then solve',
    build(r) {
      const x = r.int(-8, 9), a = r.pick([2, 3, 4, 5, 6, -2, -3, -4]), b = r.nonzero(-9, 9);
      const c = a * (x + b);
      const sDist = st(a, a * b, 0, c);
      const distribute = {
        run: () => ({ text: eqText(sDist), state: sDist }),
        applies: () => true,
        errors: {
          'forgot-to-distribute': () => { const n = st(a, b, 0, c); return { text: eqText(n), state: n }; },
          'sign-error': () => { const n = st(a, -a * b, 0, c); return { text: eqText(n), state: n }; }
        }
      };
      const start = `${a < 0 ? '(' + a + ')' : a}(${poly([[1, 'x'], [b, '']])}) = ${c}`;
      return { start, state: null, steps: [distribute, 'writeSubtract', 'subtractConst', r.chance(0.5) ? 'writeDivide' : null, 'divide'].filter(Boolean) };
    }
  },
  'variables-both-sides': {
    label: 'Variables on both sides',
    build(r) {
      const x = r.int(-9, 9), a = r.int(2, 9), b = r.nonzero(-12, 12);
      let c = r.nonzero(-6, 8);
      if (a - c === 0 || a - c === 1) c = a - 2 === 0 ? -1 : a - 2; // keep a - c >= 2 or negative so there's a divide step
      const d = (a - c) * x + b;
      const s0 = st(a, b, c, d);
      return { start: eqText(s0), state: s0, steps: ['moveVar', 'combine', 'subtractConst', r.chance(0.5) ? 'writeDivide' : null, 'divide'].filter(Boolean) };
    }
  },
  'combine-like-terms': {
    label: 'Combine like terms, then solve',
    build(r) {
      const x = r.int(-9, 9), a = r.int(2, 7), c = r.nonzero(-5, 5), b = r.nonzero(-9, 9), d = r.nonzero(-9, 9);
      // Keep the combined x coefficient at 2+ (or negative) so there's a divide step.
      const cc = a + c === 0 || a + c === 1 ? c + 2 : c;
      const e = (a + cc) * x + b + d;
      const combined = st(a + cc, b + d, 0, e);
      const combine = {
        run: () => ({ text: eqText(combined), state: combined }),
        applies: () => true,
        errors: {
          'arithmetic-slip': (s, rr) => { const n = st(a + cc + rr.pick([-1, 1]), b + d, 0, e); return { text: eqText(n), state: n }; },
          'dropped-term': () => { const n = st(a + cc, b, 0, e); return { text: eqText(n), state: n }; },
          'sign-error': () => { const n = st(a + cc, b - d, 0, e); return { text: eqText(n), state: n }; }
        }
      };
      const start = `${poly([[a, 'x'], [b, ''], [cc, 'x'], [d, '']])} = ${e}`;
      return { start, state: null, steps: [combine, 'writeSubtract', 'subtractConst', r.chance(0.5) ? 'writeDivide' : null, 'divide'].filter(Boolean) };
    }
  }
};

const ERROR_TEXT = {
  'sign-error': 'A sign got flipped: a term changed sign when it shouldn’t have, or kept its sign when it moved across the = sign.',
  'forgot-to-distribute': 'The number outside the parentheses wasn’t multiplied by every term inside.',
  'divided-one-side': 'Only one side got divided. Whatever you do to one side, you have to do to the other.',
  'arithmetic-slip': 'The plan was right, but one calculation came out wrong.',
  'dropped-term': 'A term disappeared without being moved or cancelled properly.'
};
const ERROR_LABELS = {
  'sign-error': 'Sign error',
  'forgot-to-distribute': 'Forgot to distribute',
  'divided-one-side': 'Divided only one side',
  'arithmetic-slip': 'Arithmetic slip',
  'dropped-term': 'Dropped a term'
};

// Builds one candidate puzzle (unverified).
function buildCandidate(templateId, seed, attempt) {
  const tpl = TEMPLATES[templateId];
  const r = makeRng('spot:' + templateId, `${seed}:${attempt}`);
  const t = tpl.build(r);
  const resolve = (m) => (typeof m === 'string' ? MOVES[m] : m);

  // Correct solution first (needed for correctLine and to know which steps
  // can carry an error).
  let state = t.state;
  const correct = [t.start];
  const correctStates = [state];
  const steps = [];
  for (const m of t.steps.map(resolve)) {
    if (state && !m.applies(state)) continue;
    const out = m.run(state);
    steps.push(m);
    correct.push(out.text);
    correctStates.push(out.state);
    state = out.state;
  }

  const hasError = !r.chance(NO_ERROR_RATE);
  const candidates = [];
  steps.forEach((m, i) => { for (const tag of Object.keys(m.errors || {})) candidates.push({ step: i, tag }); });
  if (!hasError || !candidates.length) {
    return { templateId, lines: correct, errorIndex: null, errorType: null, correctLine: null, correctLines: correct };
  }

  const { step: k, tag } = r.pick(candidates);
  const lines = correct.slice(0, k + 1);
  let s = correctStates[k];
  const wrong = steps[k].errors[tag](s, r);
  lines.push(wrong.text);
  s = wrong.state;
  for (let i = k + 1; i < steps.length; i++) {
    if (!steps[i].applies(s)) return null; // the wrong line doesn't support the same next move
    const out = steps[i].run(s);
    lines.push(out.text);
    s = out.state;
  }
  return { templateId, lines, errorIndex: k + 1, errorType: tag, correctLine: correct[k + 1], correctLines: correct };
}

// Checks a candidate with the step checker. Returns null if valid, else a
// short reason.
function verify(p) {
  if (!p) return 'move not applicable after the error';
  if (p.lines.length < 5 || p.lines.length > 7) return `wrong length ${p.lines.length}`;
  if (new Set(p.lines).size !== p.lines.length) return 'repeated line';
  for (let i = 1; i < p.lines.length; i++) {
    const { result } = checkStep(p.lines[i - 1], p.lines[i]);
    const want = p.errorIndex === i ? 'not_equivalent' : 'equivalent';
    if (result !== want) return `transition ${i} was ${result}, wanted ${want}`;
  }
  const last = isolatedValue(p.lines[p.lines.length - 1]);
  const truth = isolatedValue(p.correctLines[p.correctLines.length - 1]);
  if (!last || !truth) return 'last line is not x = number';
  if (p.errorIndex !== null && last.eq(truth)) return 'error did not change the final answer';
  if (p.errorIndex !== null && p.lines[p.errorIndex] === p.correctLine) return 'error line equals the correct line';
  return null;
}

const stats = { built: 0, rejected: 0, reasons: {} };

// Deterministic: (templateId, seed) always gives the same puzzle, because
// rejected candidates are skipped by attempt number, not by randomness.
function generatePuzzle(templateId, seed) {
  if (!TEMPLATES[templateId]) throw new Error('Unknown spot template: ' + templateId);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const p = buildCandidate(templateId, seed, attempt);
    const problem = verify(p);
    stats.built++;
    if (!problem) return { ...p, seed, attempt };
    stats.rejected++;
    stats.reasons[problem.replace(/\d+/g, 'N')] = (stats.reasons[problem.replace(/\d+/g, 'N')] || 0) + 1;
  }
  throw new Error(`No valid ${templateId} puzzle for seed ${seed}`);
}

function explain(p) {
  if (p.errorIndex === null) return 'Every line follows from the one before it, so there’s no mistake here. The final answer is right.';
  return `Line ${p.errorIndex + 1} should have been "${p.correctLine}". ${ERROR_TEXT[p.errorType]} Every line after it repeats the mistake, so the final answer is wrong too.`;
}

module.exports = { generatePuzzle, explain, verify, TEMPLATES, ERROR_LABELS, ERROR_TEXT, stats };
