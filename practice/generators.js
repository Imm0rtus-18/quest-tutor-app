// Infinite-practice problem generators. Code decides what's correct — every
// answer here is computed, never judged by an LLM.
//
// Each generator is (rng) -> { prompt, answer, wrong, worked, check, steps? }
// and generateProblem(conceptId, seed) wraps it into the public shape
// { conceptId, seed, prompt, answer, answerType, options, worked, check }.
// The same (conceptId, seed) always regenerates the identical problem: the
// PRNG is seeded from both, and nothing else (no Math.random, no clock) is
// read. Problems are built backwards from the answer (pick x first, then
// build the equation) so numbers come out clean. Distractors come from
// named wrong rules, each tagged so feedback can say which mistake it was.

const { Frac } = require('./frac');

// ── Seeded PRNG ─────────────────────────────────────────────────────────

function hashString(str) {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(key, seed) {
  const next = mulberry32(hashString(`${key}:${seed}`));
  const rng = {
    next,
    int(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
    nonzero(lo, hi) { let v; do { v = rng.int(lo, hi); } while (v === 0); return v; },
    sign() { return next() < 0.5 ? -1 : 1; },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  };
  return rng;
}

// ── Formatting (plain ASCII math so the step checker can read it back) ──

const F = (v) => Frac.of(v);
const num = (v) => (v instanceof Frac ? v.toString() : String(v === 0 ? 0 : v));
const paren = (v) => (Frac.of(v).sign() < 0 ? `(${num(v)})` : num(v));
const absN = (v) => Math.abs(v);

// coefficient * variable: 1x -> "x", -1x -> "-x"
function term(c, v) {
  const s = num(c);
  if (!v) return s;
  if (s === '1') return v;
  if (s === '-1') return `-${v}`;
  if (s.includes('/')) return `(${s})${v}`;
  return `${s}${v}`;
}

// [[coef, var], ...] -> "3x^2 - 2x + 5"; zero terms skipped.
function poly(terms) {
  const parts = [];
  for (const [c, v] of terms) {
    const fc = Frac.of(c);
    if (fc.isZero()) continue;
    if (!parts.length) { parts.push(term(fc, v)); continue; }
    const mag = fc.sign() < 0 ? fc.neg() : fc;
    parts.push(`${fc.sign() < 0 ? '-' : '+'} ${term(mag, v)}`);
  }
  return parts.length ? parts.join(' ') : '0';
}

// "x - 3" / "x + 3" (for x - (-3))
function minus(name, c) {
  const fc = Frac.of(c);
  if (fc.isZero()) return name;
  return fc.sign() < 0 ? `${name} + ${num(fc.neg())}` : `${name} - ${num(fc)}`;
}

const lin = (a, b, v = 'x') => poly([[a, v], [b, '']]);
const lineEq = (m, b) => `y = ${lin(m, b)}`;
const pt = (x, y) => `(${num(x)}, ${num(y)})`;

// ── Generators ──────────────────────────────────────────────────────────
// Each `wrong` entry is [value, tag] (value a Frac/number for numeric
// answers, a string for choice answers). Keep more candidates than needed —
// the wrapper dedupes and keeps the first 3 distinct ones.

const G = {};

// Chapter 1 — Connections to Algebra

G['order-of-operations-pemdas'] = (r) => {
  const a = r.int(2, 12), b = r.int(2, 6), c = r.int(2, 6), e = r.int(2, 5), k = r.int(1, 6), d = e * k;
  const expr = `${a} + ${b} * ${c} - ${d} / ${e}`;
  const ans = a + b * c - k;
  return {
    prompt: `Evaluate: ${a} + ${b} × ${c} − ${d} ÷ ${e}`,
    answer: F(ans),
    wrong: [
      [F((a + b) * c - k), 'add-before-multiply'],
      [F((a + b) * c - d).div(e), 'left-to-right-ignoring-precedence'],
      [F(a + b * c - d), 'forgot-to-divide'],
      [F(a + b * c + k), 'sign-error']
    ],
    worked: [`${a} + ${b} × ${c} − ${d} ÷ ${e}`, `Multiply and divide first: ${b} × ${c} = ${b * c} and ${d} ÷ ${e} = ${k}`, `${a} + ${b * c} − ${k}`, `Then add and subtract left to right: ${ans}`],
    check: { kind: 'evaluate', expr }
  };
};

G['evaluating-expressions-by-substitution'] = (r) => {
  const a = r.nonzero(-9, 9), b = r.nonzero(-12, 12), v = r.nonzero(-6, 8);
  const ans = a * v + b;
  return {
    prompt: `If x = ${v}, what is the value of ${lin(a, b)}?`,
    answer: F(ans),
    wrong: [
      [F(a + v + b), 'added-instead-of-multiplied'],
      [F(a * v - b), 'sign-error'],
      [F(a * (v + b)), 'order-of-operations'],
      [F(a * v), 'dropped-term']
    ],
    worked: [`Substitute x = ${v}: ${term(a, '')}(${v}) ${b < 0 ? '-' : '+'} ${absN(b)}`, `Multiply: ${a * v} ${b < 0 ? '-' : '+'} ${absN(b)}`, `Add: ${ans}`],
    check: { kind: 'evaluate', expr: lin(a, b), vars: { x: v } }
  };
};

G['order-of-operations-with-exponents'] = (r) => {
  const a = r.int(1, 15), b = r.int(2, 5), c = r.int(2, 5);
  const ans = a + b * c * c;
  return {
    prompt: `Evaluate: ${a} + ${b} × ${c}^2`,
    answer: F(ans),
    wrong: [
      [F(a + (b * c) ** 2), 'multiply-before-exponent'],
      [F((a + b) * c * c), 'add-before-multiply'],
      [F(a + b * c * 2), 'exponent-as-multiply'],
      [F(a + b * c), 'ignored-exponent']
    ],
    worked: [`Exponent first: ${c}^2 = ${c * c}`, `Multiply: ${b} × ${c * c} = ${b * c * c}`, `Add: ${a} + ${b * c * c} = ${ans}`],
    check: { kind: 'evaluate', expr: `${a} + ${b} * ${c}^2` }
  };
};

G['order-of-operations-left-to-right'] = (r) => {
  if (r.chance(0.5)) {
    const b = r.int(2, 6), k = r.int(2, 8), c = r.int(2, 6), a = b * k;
    const ans = k * c;
    return {
      prompt: `Evaluate: ${a} ÷ ${b} × ${c}`,
      answer: F(ans),
      wrong: [[F(a).div(b * c), 'multiply-before-divide'], [F(a * b * c), 'multiplied-instead-of-divided'], [F(k + c), 'added-instead-of-multiplied']],
      worked: [`Division and multiplication go left to right.`, `${a} ÷ ${b} = ${k}`, `${k} × ${c} = ${ans}`],
      check: { kind: 'evaluate', expr: `${a} / ${b} * ${c}` }
    };
  }
  const a = r.int(12, 30), b = r.int(2, 10), c = r.int(2, 10);
  const ans = a - b + c;
  return {
    prompt: `Evaluate: ${a} − ${b} + ${c}`,
    answer: F(ans),
    wrong: [[F(a - (b + c)), 'add-before-subtract'], [F(a + b + c), 'sign-error'], [F(a - b - c), 'subtracted-everything']],
    worked: [`Addition and subtraction go left to right.`, `${a} − ${b} = ${a - b}`, `${a - b} + ${c} = ${ans}`],
    check: { kind: 'evaluate', expr: `${a} - ${b} + ${c}` }
  };
};

G['evaluating-multi-term-expressions'] = (r) => {
  const a = r.int(1, 4), b = r.nonzero(-6, 6), c = r.int(1, 9), v = r.nonzero(-4, 4);
  const expr = poly([[a, 'x^2'], [b, 'x'], [-c, '']]);
  const ans = a * v * v + b * v - c;
  return {
    prompt: `If x = ${v}, what is the value of ${expr}?`,
    answer: F(ans),
    wrong: [
      [F(-a * v * v + b * v - c), 'squared-a-negative-wrong'],
      [F(a * 2 * v + b * v - c), 'exponent-as-multiply'],
      [F((a * v) ** 2 + b * v - c), 'multiply-before-exponent'],
      [F(a * v * v + b * v + c), 'sign-error']
    ],
    worked: [`Substitute x = ${v}: ${a}(${v})^2 + (${b})(${v}) − ${c}`, `Exponent first: (${v})^2 = ${v * v}`, `Multiply: ${a * v * v} + ${b * v === 0 ? 0 : b * v} − ${c}`, `Add and subtract: ${ans}`],
    check: { kind: 'evaluate', expr, vars: { x: v } }
  };
};

G['less-than-phrase-order-reversal'] = (r) => {
  const m = r.int(2, 9), k = r.int(1, 15);
  const words = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  return {
    prompt: `Which expression means "${k} less than ${m === 2 ? 'twice' : words[m - 2] + ' times'} a number n"?`,
    answer: `${m}n - ${k}`,
    wrong: [[`${k} - ${m}n`, 'order-reversal'], [`${m}n + ${k}`, 'wrong-operation'], [`${m}(n - ${k})`, 'grouping-error'], [`${m} - ${k}n`, 'order-reversal']],
    worked: [`"${m === 2 ? 'Twice' : words[m - 2] + ' times'} a number n" is ${m}n.`, `"${k} less than" something means you subtract ${k} from it, so ${k} goes last.`, `${m}n - ${k}`],
    check: { kind: 'expression', variable: 'n', expected: { a: m, b: -k } }
  };
};

G['translating-sum-phrases'] = (r) => {
  const k = r.int(2, 20);
  return {
    prompt: `Which expression means "the sum of a number n and ${k}"?`,
    answer: `n + ${k}`,
    wrong: [[`n - ${k}`, 'wrong-operation'], [`${k}n`, 'multiplied-instead-of-added'], [`${k} - n`, 'wrong-operation']],
    worked: [`"Sum" means add.`, `The number n plus ${k} is n + ${k}.`],
    check: { kind: 'expression', variable: 'n', expected: { a: 1, b: k } }
  };
};

G['translating-product-and-difference-phrases'] = (r) => {
  const k = r.int(2, 9), m = r.int(1, 12);
  return {
    prompt: `Which expression means "the product of ${k} and the difference of a number n and ${m}"?`,
    answer: `${k}(n - ${m})`,
    wrong: [[`${k}n - ${m}`, 'grouping-error'], [`${k}(${m} - n)`, 'order-reversal'], [`${k} + (n - ${m})`, 'wrong-operation'], [`${k}(n + ${m})`, 'wrong-operation']],
    worked: [`"The difference of n and ${m}" is n - ${m}, kept together in parentheses.`, `"The product of ${k} and" that multiplies the whole difference: ${k}(n - ${m}).`],
    check: { kind: 'expression', variable: 'n', expected: { a: k, b: -k * m } }
  };
};

// Chapter 2 — Properties of Real Numbers

G['absolute-value-basics'] = (r) => {
  const a = r.int(-15, -1), b = r.int(1, 15);
  const ans = Math.abs(a) + b;
  return {
    prompt: `Evaluate: |${a}| + |${b}|`,
    answer: F(ans),
    wrong: [[F(a + b), 'kept-negative-sign'], [F(-(Math.abs(a) + b)), 'sign-error'], [F(Math.abs(a) - b), 'subtracted-instead-of-added']],
    worked: [`Absolute value is distance from zero, so it's never negative.`, `|${a}| = ${-a} and |${b}| = ${b}`, `${-a} + ${b} = ${ans}`],
    check: { kind: 'evaluate', expr: `abs(${a}) + abs(${b})` }
  };
};

G['adding-signed-numbers'] = (r) => {
  const a = r.nonzero(-20, 20), b = r.sign() * r.int(1, 20) * (a > 0 ? -1 : 1);
  const ans = a + b;
  return {
    prompt: `Evaluate: ${a} + ${paren(b)}`,
    answer: F(ans),
    wrong: [[F(-(a + b)), 'sign-error'], [F(Math.abs(a) + Math.abs(b)), 'ignored-signs'], [F(a - b), 'subtracted-instead-of-added']],
    worked: [`The signs are different, so subtract the sizes: ${Math.max(absN(a), absN(b))} − ${Math.min(absN(a), absN(b))} = ${absN(ans)}`, `Keep the sign of the number farther from zero: ${ans}`],
    check: { kind: 'evaluate', expr: `${a} + ${paren(b)}` }
  };
};

G['subtracting-negative-numbers'] = (r) => {
  const a = r.nonzero(-15, 15), b = r.int(1, 15);
  const ans = a + b;
  return {
    prompt: `Evaluate: ${a} − (−${b})`,
    answer: F(ans),
    wrong: [[F(a - b), 'sign-error'], [F(-a - b), 'negated-everything'], [F(-(a + b)), 'sign-error-on-result']],
    worked: [`Subtracting a negative is the same as adding its opposite.`, `${a} − (−${b}) = ${a} + ${b}`, `= ${ans}`],
    check: { kind: 'evaluate', expr: `${a} - (-${b})` }
  };
};

G['combining-signed-number-operations'] = (r) => {
  const a = r.nonzero(-12, 12), b = r.nonzero(-12, 12), c = r.int(1, 12);
  const ans = a + b + c;
  return {
    prompt: `Evaluate: ${a} + ${paren(b)} − (−${c})`,
    answer: F(ans),
    wrong: [[F(a + b - c), 'sign-error'], [F(a - b + c), 'sign-error'], [F(Math.abs(a) + Math.abs(b) + c), 'ignored-signs']],
    worked: [`Rewrite subtracting a negative as adding: ${a} + ${paren(b)} + ${c}`, `Left to right: ${a} + ${paren(b)} = ${a + b}`, `${a + b} + ${c} = ${ans}`],
    check: { kind: 'evaluate', expr: `${a} + ${paren(b)} - (-${c})` }
  };
};

G['applying-distributive-property'] = (r) => {
  const k = r.nonzero(-9, 9), m = r.nonzero(-9, 9);
  const k2 = k === 1 || k === -1 ? k * 2 : k;
  return {
    prompt: `Use the distributive property to rewrite ${k2 < 0 ? '(' + k2 + ')' : k2}(${lin(1, m)}).`,
    answer: lin(k2, k2 * m),
    wrong: [[lin(k2, m), 'forgot-to-distribute'], [lin(k2, -k2 * m), 'sign-error'], [lin(k2, k2 + m), 'added-instead-of-multiplied'], [lin(1, k2 * m), 'distributed-to-one-term']],
    worked: [`Multiply ${k2} by each term inside the parentheses.`, `${k2} · x = ${term(k2, 'x')} and ${k2} · ${paren(m)} = ${k2 * m}`, lin(k2, k2 * m)],
    check: { kind: 'expression', variable: 'x', expected: { a: k2, b: k2 * m } },
    steps: { start: `${k2 < 0 ? '(' + k2 + ')' : k2}(${lin(1, m)})`, kind: 'expression' }
  };
};

G['additive-inverse'] = (r) => {
  const a = r.nonzero(-30, 30);
  return {
    prompt: `What is the additive inverse (opposite) of ${a}?`,
    answer: F(-a),
    wrong: [[F(a), 'gave-the-number-itself'], [F(1).div(a), 'gave-reciprocal'], [F(-1).div(a), 'gave-negative-reciprocal'], [F(Math.abs(a)), 'gave-absolute-value']],
    worked: [`The additive inverse is the number that adds to ${a} to make 0.`, `${a} + ${paren(-a)} = 0, so it's ${-a}.`],
    check: { kind: 'evaluate', expr: `0 - ${paren(a)}` }
  };
};

G['multiplicative-inverse'] = (r) => {
  let p = r.int(1, 9), q = r.int(2, 9);
  if (p === q) q += 1;
  const s = r.sign();
  const v = F(s * p).div(q);
  return {
    prompt: `What is the multiplicative inverse (reciprocal) of ${v}?`,
    answer: F(1).div(v),
    wrong: [[v.neg(), 'gave-opposite'], [F(-1).div(v), 'sign-error'], [v, 'gave-the-number-itself']],
    worked: [`The reciprocal is the number that multiplies with ${v} to make 1.`, `Flip the fraction and keep the sign: ${F(1).div(v)}`],
    check: { kind: 'evaluate', expr: `1 / (${v})` }
  };
};

// Chapter 3 — Solving Linear Equations (also used by "Show your work")

function solvedWrong(list) { return list.filter(([v]) => v !== null); }
const safeDiv = (a, b) => (Frac.of(b).isZero() ? null : Frac.of(a).div(b));

G['one-step-equations-addition-subtraction'] = (r) => {
  const x = r.int(-15, 20), a = r.int(1, 15);
  if (r.chance(0.5)) {
    const b = x + a, eq = `x + ${a} = ${b}`;
    return {
      prompt: `Solve for x: ${eq}`, answer: F(x),
      wrong: [[F(b + a), 'sign-error'], [F(b), 'forgot-to-subtract'], [F(a - b), 'subtracted-backwards']],
      worked: [eq, `Subtract ${a} from both sides:`, `x = ${b} - ${paren(a)}`, `x = ${x}`],
      check: { kind: 'solve', equation: eq }, steps: { start: eq, kind: 'equation' }
    };
  }
  const b = x - a, eq = `x - ${a} = ${b}`;
  return {
    prompt: `Solve for x: ${eq}`, answer: F(x),
    wrong: [[F(b - a), 'sign-error'], [F(b), 'forgot-to-add'], [F(a - b), 'subtracted-backwards']],
    worked: [eq, `Add ${a} to both sides:`, `x = ${b} + ${a}`, `x = ${x}`],
    check: { kind: 'solve', equation: eq }, steps: { start: eq, kind: 'equation' }
  };
};

G['one-step-equations-multiplication-division'] = (r) => {
  const x = r.nonzero(-12, 12), a = r.nonzero(-9, 9) || 2;
  const aa = a === 1 || a === -1 ? a * 3 : a;
  if (r.chance(0.6)) {
    const b = aa * x, eq = `${term(aa, 'x')} = ${b}`;
    return {
      prompt: `Solve for x: ${eq}`, answer: F(x),
      wrong: solvedWrong([[F(b * aa), 'multiplied-instead-of-divided'], [F(-x), 'sign-error'], [F(b - aa), 'subtracted-instead-of-divided'], [safeDiv(aa, b), 'divided-backwards']]),
      worked: [eq, `Divide both sides by ${aa}:`, `x = ${b} / ${paren(aa)}`, `x = ${x}`],
      check: { kind: 'solve', equation: eq }, steps: { start: eq, kind: 'equation' }
    };
  }
  const d = Math.abs(aa), b = x, top = x * d, eq = `x / ${d} = ${b}`;
  return {
    prompt: `Solve for x: ${eq}`, answer: F(top),
    wrong: solvedWrong([[safeDiv(b, d), 'divided-instead-of-multiplied'], [F(-top), 'sign-error'], [F(b + d), 'added-instead-of-multiplied']]),
    worked: [eq, `Multiply both sides by ${d}:`, `x = ${b} · ${d}`, `x = ${top}`],
    check: { kind: 'solve', equation: eq }, steps: { start: eq, kind: 'equation' }
  };
};

G['two-step-equations'] = (r) => {
  const x = r.int(-10, 12), a = r.pick([2, 3, 4, 5, 6, 7, -2, -3, -4, -5]), b = r.nonzero(-15, 15);
  const c = a * x + b, eq = `${lin(a, b)} = ${c}`;
  return {
    prompt: `Solve for x: ${eq}`, answer: F(x),
    wrong: solvedWrong([[safeDiv(c + b, a), 'sign-error'], [F(c - b - a), 'subtracted-instead-of-divided'], [F(c).div(a).sub(b), 'divided-before-subtracting'], [F(-x), 'sign-error-on-division']]),
    worked: [eq, `${b > 0 ? 'Subtract ' + b + ' from' : 'Add ' + -b + ' to'} both sides:`, `${term(a, 'x')} = ${c - b}`, `Divide both sides by ${a}:`, `x = ${x}`],
    check: { kind: 'solve', equation: eq }, steps: { start: eq, kind: 'equation' }
  };
};

G['multi-step-equations-with-distribution'] = (r) => {
  const x = r.int(-8, 10), a = r.pick([2, 3, 4, 5, 6, -2, -3, -4]), b = r.nonzero(-9, 9);
  const c = a * (x + b), eq = `${a < 0 ? '(' + a + ')' : a}(${lin(1, b)}) = ${c}`;
  return {
    prompt: `Solve for x: ${eq}`, answer: F(x),
    wrong: solvedWrong([[safeDiv(c - b, a), 'forgot-to-distribute'], [F(c).div(a).add(b), 'sign-error'], [safeDiv(c - a * b, -a), 'sign-error-on-division'], [F(c - a * b - a), 'subtracted-instead-of-divided']]),
    worked: [eq, `Distribute the ${a}:`, `${lin(a, a * b)} = ${c}`, `${a * b > 0 ? 'Subtract ' + a * b + ' from' : 'Add ' + -a * b + ' to'} both sides:`, `${term(a, 'x')} = ${c - a * b}`, `Divide both sides by ${a}:`, `x = ${x}`],
    check: { kind: 'solve', equation: eq }, steps: { start: eq, kind: 'equation' }
  };
};

G['multi-step-equations-distribute-and-both-sides'] = (r) => {
  const x = r.int(-8, 10), a = r.pick([2, 3, 4, 5, -2, -3]), b = r.nonzero(-6, 6);
  let c = r.nonzero(-5, 6);
  if (c === a) c += 1;
  if (c === 0) c = 1;
  const d = a * (x + b) - c * x;
  const eq = `${a < 0 ? '(' + a + ')' : a}(${lin(1, b)}) = ${lin(c, d)}`;
  return {
    prompt: `Solve for x: ${eq}`, answer: F(x),
    wrong: solvedWrong([[safeDiv(d - b, a - c), 'forgot-to-distribute'], [safeDiv(d - a * b, a + c), 'sign-error'], [safeDiv(d + a * b, a - c), 'sign-error'], [F(-x), 'sign-error-on-division']]),
    worked: [eq, `Distribute the ${a}:`, `${lin(a, a * b)} = ${lin(c, d)}`, `${c > 0 ? 'Subtract ' + term(c, 'x') + ' from' : 'Add ' + term(-c, 'x') + ' to'} both sides:`, `${lin(a - c, a * b)} = ${d}`, `${a * b > 0 ? 'Subtract ' + a * b + ' from' : 'Add ' + -a * b + ' to'} both sides:`, `${term(a - c, 'x')} = ${d - a * b}`, `Divide both sides by ${a - c}:`, `x = ${x}`],
    check: { kind: 'solve', equation: eq }, steps: { start: eq, kind: 'equation' }
  };
};

G['equations-variable-terms-both-sides'] = (r) => {
  const x = r.int(-10, 10), a = r.int(2, 9), b = r.nonzero(-12, 12);
  let c = r.int(-6, 8);
  if (c === a || c === 0) c = a - 1 || 1;
  const d = (a - c) * x + b;
  const eq = `${lin(a, b)} = ${lin(c, d)}`;
  return {
    prompt: `Solve for x: ${eq}`, answer: F(x),
    wrong: solvedWrong([[safeDiv(d - b, a + c), 'sign-error'], [safeDiv(d + b, a - c), 'sign-error'], [safeDiv(b - d, a - c), 'moved-wrong-side'], [F(d - b), 'forgot-to-divide']]),
    worked: [eq, `${c > 0 ? 'Subtract ' + term(c, 'x') + ' from' : 'Add ' + term(-c, 'x') + ' to'} both sides:`, `${lin(a - c, b)} = ${d}`, `${b > 0 ? 'Subtract ' + b + ' from' : 'Add ' + -b + ' to'} both sides:`, `${term(a - c, 'x')} = ${d - b}`, `Divide both sides by ${a - c}:`, `x = ${x}`],
    check: { kind: 'solve', equation: eq }, steps: { start: eq, kind: 'equation' }
  };
};

G['equations-with-negative-coefficients'] = (r) => {
  const x = r.nonzero(-10, 10), a = -r.int(2, 9), b = r.nonzero(-12, 12);
  const c = a * x + b, eq = `${lin(a, b)} = ${c}`;
  return {
    prompt: `Solve for x: ${eq}`, answer: F(x),
    wrong: solvedWrong([[F(-x), 'dropped-negative-coefficient'], [safeDiv(c + b, a), 'sign-error'], [safeDiv(c - b, -a), 'dropped-negative-coefficient'], [F(c - b + a), 'added-instead-of-divided']]),
    worked: [eq, `${b > 0 ? 'Subtract ' + b + ' from' : 'Add ' + -b + ' to'} both sides:`, `${term(a, 'x')} = ${c - b}`, `Divide both sides by ${a} (the negative comes too):`, `x = ${x}`],
    check: { kind: 'solve', equation: eq }, steps: { start: eq, kind: 'equation' }
  };
};

G['verifying-solutions-by-substitution'] = (r) => {
  const x = r.int(-8, 10), a = r.pick([2, 3, 4, 5, -2, -3]), b = r.nonzero(-10, 10), c = a * x + b;
  const eq = `${lin(a, b)} = ${c}`;
  return {
    prompt: `Which value of x makes ${eq} true?`, answer: F(x),
    wrong: [[F(x + 1), 'arithmetic-slip'], [F(-x), 'sign-error'], [F(c - b), 'forgot-to-divide'], [F(x - 1), 'arithmetic-slip']],
    worked: [`Substitute each choice and check whether both sides match.`, `With x = ${x}: ${a}(${x}) ${b < 0 ? '-' : '+'} ${absN(b)} = ${c}`, `Both sides equal ${c}, so x = ${x} works.`],
    check: { kind: 'solve', equation: eq }
  };
};

G['addition-property-of-equality'] = (r) => {
  const a = r.int(2, 20), b = r.int(-10, 30);
  if (r.chance(0.5)) {
    return {
      prompt: `To solve x + ${a} = ${b}, what should you do to both sides?`, answer: `Subtract ${a}`,
      wrong: [[`Add ${a}`, 'wrong-inverse-operation'], [`Divide by ${a}`, 'wrong-inverse-operation'], [`Subtract ${b}`, 'used-wrong-number'], [`Multiply by ${a}`, 'wrong-inverse-operation']],
      worked: [`The ${a} is being added to x.`, `Undo addition with subtraction: subtract ${a} from both sides.`],
      check: { kind: 'move', equation: `x + ${a} = ${b}` }
    };
  }
  return {
    prompt: `To solve x - ${a} = ${b}, what should you do to both sides?`, answer: `Add ${a}`,
    wrong: [[`Subtract ${a}`, 'wrong-inverse-operation'], [`Multiply by ${a}`, 'wrong-inverse-operation'], [`Add ${b}`, 'used-wrong-number'], [`Divide by ${a}`, 'wrong-inverse-operation']],
    worked: [`The ${a} is being subtracted from x.`, `Undo subtraction with addition: add ${a} to both sides.`],
    check: { kind: 'move', equation: `x - ${a} = ${b}` }
  };
};

G['multiplication-property-of-equality'] = (r) => {
  const a = r.int(2, 12), x = r.nonzero(-9, 9), b = a * x;
  if (r.chance(0.5)) {
    return {
      prompt: `To solve ${a}x = ${b}, what should you do to both sides?`, answer: `Divide by ${a}`,
      wrong: [[`Multiply by ${a}`, 'wrong-inverse-operation'], [`Subtract ${a}`, 'wrong-inverse-operation'], [`Divide by ${b}`, 'used-wrong-number'], [`Add ${a}`, 'wrong-inverse-operation']],
      worked: [`x is being multiplied by ${a}.`, `Undo multiplication with division: divide both sides by ${a}.`],
      check: { kind: 'move', equation: `${a}x = ${b}` }
    };
  }
  return {
    prompt: `To solve x / ${a} = ${x}, what should you do to both sides?`, answer: `Multiply by ${a}`,
    wrong: [[`Divide by ${a}`, 'wrong-inverse-operation'], [`Add ${a}`, 'wrong-inverse-operation'], [`Multiply by ${x}`, 'used-wrong-number'], [`Subtract ${a}`, 'wrong-inverse-operation']],
    worked: [`x is being divided by ${a}.`, `Undo division with multiplication: multiply both sides by ${a}.`],
    check: { kind: 'move', equation: `x / ${a} = ${x}` }
  };
};

// Chapter 4 — Graphing Linear Equations and Functions

function interceptLine(r) {
  const p = r.nonzero(-8, 8), q = r.nonzero(-8, 8);
  // q·x + p·y = p·q has x-intercept p and y-intercept q; scale out common factors.
  let A = q, B = p, C = p * q;
  const g = [A, B, C].map(Math.abs).reduce((m, v) => { let a = m, b = v; while (b) [a, b] = [b, a % b]; return a; });
  A /= g; B /= g; C /= g;
  if (A < 0) { A = -A; B = -B; C = -C; }
  return { p, q, A, B, C, eq: `${poly([[A, 'x'], [B, 'y']])} = ${C}` };
}

G['finding-x-intercepts'] = (r) => {
  const { p, q, A, B, C, eq } = interceptLine(r);
  return {
    prompt: `What is the x-value where ${eq} crosses the x-axis?`, answer: F(p),
    wrong: solvedWrong([[F(q), 'swapped-intercepts'], [F(-p), 'sign-error'], [safeDiv(A, C), 'divided-backwards'], [F(C), 'forgot-to-divide']]),
    worked: [`On the x-axis, y = 0.`, `${term(A, 'x')} + ${B < 0 ? '(' + B + ')' : B}(0) = ${C}`, `${term(A, 'x')} = ${C}`, `x = ${p}`],
    check: { kind: 'solve', equation: `${A}x + ${paren(B)} * 0 = ${C}` }
  };
};

G['finding-y-intercepts'] = (r) => {
  const { p, q, A, B, C, eq } = interceptLine(r);
  return {
    prompt: `What is the y-value where ${eq} crosses the y-axis?`, answer: F(q),
    wrong: solvedWrong([[F(p), 'swapped-intercepts'], [F(-q), 'sign-error'], [safeDiv(B, C), 'divided-backwards'], [F(C), 'forgot-to-divide']]),
    worked: [`On the y-axis, x = 0.`, `${A}(0) + ${term(B, 'y')} = ${C}`, `${term(B, 'y')} = ${C}`, `y = ${q}`],
    check: { kind: 'solve', equation: `${A} * 0 + ${paren(B)}x = ${C}` }
  };
};

function slopeProblem(r, lo, hi, forceNegative) {
  let x1, y1, x2, y2;
  do {
    x1 = r.int(lo, hi); y1 = r.int(lo, hi); x2 = r.int(lo, hi); y2 = r.int(lo, hi);
  } while (x1 === x2 || y1 === y2 || (forceNegative && x1 >= 0 && y1 >= 0 && x2 >= 0 && y2 >= 0));
  const m = F(y2 - y1).div(x2 - x1);
  return {
    prompt: `What is the slope of the line through ${pt(x1, y1)} and ${pt(x2, y2)}?`, answer: m,
    wrong: [[F(x2 - x1).div(y2 - y1), 'run-over-rise'], [m.neg(), 'sign-error'], [x2 + x1 === 0 ? null : F(y2 + y1).div(x2 + x1), 'added-instead-of-subtracted'], [x2 === 0 ? null : F(y2).div(x2), 'used-one-point-only'], [F(y2 - y1).div(x2 + x1 || 1), 'sign-error']].filter(([v]) => v !== null),
    worked: [`Slope = (change in y) / (change in x)`, `= (${y2} - ${paren(y1)}) / (${x2} - ${paren(x1)})`, `= ${y2 - y1} / ${x2 - x1}`, `= ${m}`],
    check: { kind: 'slope', points: [[x1, y1], [x2, y2]] }
  };
}

G['computing-slope-from-two-points'] = (r) => slopeProblem(r, 0, 10, false);
G['slope-with-negative-values'] = (r) => slopeProblem(r, -9, 9, true);
G['slope-from-two-points-for-writing-equations'] = (r) => slopeProblem(r, -6, 9, false);

G['identifying-slope-from-slope-intercept-form'] = (r) => {
  let m = r.nonzero(-9, 9); const b = r.nonzero(-12, 12);
  if (m === b) m = -m;
  return {
    prompt: `What is the slope of ${lineEq(m, b)}?`, answer: F(m),
    wrong: [[F(b), 'took-the-intercept'], [F(-m), 'sign-error'], [F(1).div(m), 'gave-reciprocal'], [F(-b), 'took-the-intercept']],
    worked: [`In y = mx + b, the slope is m, the number multiplying x.`, `Here that's ${m}.`],
    check: { kind: 'line-coef', which: 'm', line: lineEq(m, b) }
  };
};

G['identifying-y-intercept-from-slope-intercept-form'] = (r) => {
  let m = r.nonzero(-9, 9); const b = r.nonzero(-12, 12);
  if (m === b) m = -m;
  return {
    prompt: `What is the y-intercept of ${lineEq(m, b)}? (Give the y-value.)`, answer: F(b),
    wrong: [[F(m), 'took-the-slope'], [F(-b), 'sign-error'], [F(m + b), 'added-slope-and-intercept'], [F(-m), 'took-the-slope']],
    worked: [`In y = mx + b, the y-intercept is b, where x = 0.`, `y = ${m}(0) ${b < 0 ? '-' : '+'} ${absN(b)} = ${b}`],
    check: { kind: 'line-coef', which: 'b', line: lineEq(m, b) }
  };
};

G['verifying-points-on-a-line'] = (r) => {
  const m = r.nonzero(-5, 5), b = r.nonzero(-8, 8), x = r.nonzero(-5, 5), y = m * x + b;
  const on = (px, py) => py === m * px + b;
  const cands = [[x, m * x - b, 'sign-error'], [y, x, 'swapped-coordinates'], [x, m + x + b, 'added-instead-of-multiplied'], [x, y + 1, 'arithmetic-slip'], [x + 1, y - m, 'arithmetic-slip']]
    .filter(([px, py]) => !on(px, py));
  return {
    prompt: `Which point lies on the line ${lineEq(m, b)}?`, answer: pt(x, y),
    wrong: cands.map(([px, py, tag]) => [pt(px, py), tag]),
    worked: [`Plug each point's x into the equation and see if you get its y.`, `x = ${x}: y = ${m}(${x}) ${b < 0 ? '-' : '+'} ${absN(b)} = ${y}`, `So ${pt(x, y)} is on the line.`],
    check: { kind: 'point-on-line', line: lineEq(m, b) }
  };
};

// Chapter 5 — Writing Linear Equations

function pointSlope(m, x1, y1) { return `${minus('y', y1)} = ${m === 1 ? '' : m === -1 ? '-' : m}(${minus('x', x1)})`; }

function pointSlopeProblem(r, lo, hi) {
  // Not -1: with slope -1, swapping x1 and y1 gives the same line, so that
  // "wrong" option would also be correct.
  // And not through the origin: then the negated point (-x1, -y1) is on
  // the same line too.
  const m = r.pick([-6, -5, -4, -3, -2, 1, 2, 3, 4, 5, 6]), x1 = r.nonzero(lo, hi);
  let y1 = r.nonzero(lo, hi);
  if (y1 === m * x1) y1 = y1 === hi ? y1 - 1 || hi : y1 + 1 || 1;
  const ans = pointSlope(m, x1, y1);
  return {
    prompt: `Which equation is the line with slope ${m} through ${pt(x1, y1)}, in point-slope form?`, answer: ans,
    wrong: [[pointSlope(m, -x1, -y1), 'sign-error'], [pointSlope(m, y1, x1), 'swapped-coordinates'], [pointSlope(-m, x1, y1), 'sign-error-on-slope'], [pointSlope(m, x1, -y1), 'sign-error']],
    worked: [`Point-slope form is y - y1 = m(x - x1).`, `Plug in m = ${m}, x1 = ${x1}, y1 = ${y1}:`, `y - ${paren(y1)} = ${m}(x - ${paren(x1)})`, ans],
    check: { kind: 'line-through', points: [[x1, y1], [x1 + 1, y1 + m]] }
  };
}

G['writing-point-slope-form'] = (r) => pointSlopeProblem(r, -2, 9);
G['point-slope-form-with-negative-values'] = (r) => pointSlopeProblem(r, -9, -1);

G['converting-point-slope-to-slope-intercept'] = (r) => {
  const m = r.nonzero(-6, 6), x1 = r.nonzero(-6, 6), y1 = r.nonzero(-9, 9), b = y1 - m * x1;
  return {
    prompt: `Rewrite ${pointSlope(m, x1, y1)} in slope-intercept form.`, answer: lineEq(m, b),
    wrong: [[lineEq(m, y1 - x1), 'forgot-to-distribute'], [lineEq(m, y1 + m * x1), 'sign-error'], [lineEq(m, -m * x1 - y1), 'moved-term-wrong-sign'], [lineEq(m, m * x1 - y1), 'sign-error'], [lineEq(-m, b), 'sign-error-on-slope'], [lineEq(m, b + 1), 'arithmetic-slip']],
    worked: [pointSlope(m, x1, y1), `Distribute the ${m}: ${minus('y', y1)} = ${lin(m, -m * x1)}`, `${y1 > 0 ? 'Add ' + y1 + ' to' : 'Subtract ' + -y1 + ' from'} both sides:`, lineEq(m, b)],
    check: { kind: 'line-through', points: [[x1, y1], [x1 + 1, y1 + m]] }
  };
};

G['writing-equation-from-two-points'] = (r) => {
  const m = r.nonzero(-5, 5), b = r.int(-9, 9), x1 = r.int(-5, 5);
  let x2 = r.int(-5, 5); if (x2 === x1) x2 = x1 + r.pick([1, 2, 3]);
  const y1 = m * x1 + b, y2 = m * x2 + b;
  const wrongM = m === 1 || m === -1 ? m * 2 : m;
  return {
    prompt: `Which equation is the line through ${pt(x1, y1)} and ${pt(x2, y2)}?`, answer: lineEq(m, b),
    wrong: [[lineEq(-m, y1 + m * x1), 'sign-error-on-slope'], [lineEq(m, y1 + m * x1), 'sign-error-on-intercept'], [`y = ${term(F(1).div(wrongM), 'x')}${b === 0 ? '' : (b < 0 ? ' - ' + -b : ' + ' + b)}`, 'run-over-rise'], [lineEq(m, b + 1), 'arithmetic-slip']],
    worked: [`Slope: (${y2} - ${paren(y1)}) / (${x2} - ${paren(x1)}) = ${m}`, `Use y = mx + b with ${pt(x1, y1)}: ${y1} = ${m}(${x1}) + b`, `b = ${y1} - ${paren(m * x1)} = ${b}`, lineEq(m, b)],
    check: { kind: 'line-through', points: [[x1, y1], [x2, y2]] }
  };
};

G['parallel-lines-same-slope'] = (r) => {
  const m = r.nonzero(-8, 8), b = r.nonzero(-9, 9);
  const mm = m === b ? -m : m;
  return {
    prompt: `What is the slope of any line parallel to ${lineEq(mm, b)}?`, answer: F(mm),
    wrong: solvedWrong([[F(-mm), 'sign-error'], [F(-1).div(mm), 'used-perpendicular-rule'], [F(b), 'took-the-intercept'], [F(1).div(mm), 'gave-reciprocal']]),
    worked: [`Parallel lines never meet, so they rise at the same rate.`, `Parallel lines have equal slopes: ${mm}.`],
    check: { kind: 'slope-rel', rel: 'parallel', line: lineEq(mm, b) }
  };
};

function perpProblem(r, negative) {
  let p = r.int(1, 6), q = r.int(1, 5);
  if (p === q) q = q === 5 ? 4 : q + 1;
  const m = F(negative ? -p : p).div(q);
  const ans = F(-1).div(m);
  return {
    prompt: `A line has slope ${m}. What is the slope of a line perpendicular to it?`, answer: ans,
    wrong: [[F(1).div(m), 'forgot-negative'], [m.neg(), 'forgot-reciprocal'], [m, 'used-parallel-rule']],
    worked: [`Perpendicular slopes are negative reciprocals.`, `Flip ${m} and change its sign.`, `${ans}`],
    check: { kind: 'slope-rel', rel: 'perpendicular', slope: m.toString() }
  };
}
G['perpendicular-lines-negative-reciprocal-slope'] = (r) => perpProblem(r, false);
G['perpendicular-lines-with-negative-slope'] = (r) => perpProblem(r, true);

G['identifying-parallel-slopes'] = (r) => {
  const m = r.nonzero(-6, 6), b = r.nonzero(-9, 9), b2 = b + r.pick([-5, -3, 2, 4, 7]);
  const m2 = m === 1 || m === -1 ? m * 3 : m;
  return {
    prompt: `Which line is parallel to ${lineEq(m2, b)}?`, answer: lineEq(m2, b2),
    wrong: [[lineEq(-m2, b2), 'sign-error'], [`y = ${term(F(-1).div(m2), 'x')} + ${absN(b2) || 1}`, 'used-perpendicular-rule'], [lineEq(b2 === 0 ? m2 + 1 : b2 === m2 ? m2 + 2 : b2, m2), 'swapped-slope-and-intercept']],
    worked: [`Parallel lines have the same slope.`, `The slope of ${lineEq(m2, b)} is ${m2}.`, `Only ${lineEq(m2, b2)} also has slope ${m2}.`],
    check: { kind: 'line-rel', rel: 'parallel', line: lineEq(m2, b) }
  };
};

G['identifying-perpendicular-slopes'] = (r) => {
  const m = r.pick([2, 3, 4, 5, -2, -3, -4, -5]), b = r.nonzero(-9, 9), b2 = r.nonzero(-9, 9);
  const pm = F(-1).div(m);
  return {
    prompt: `Which line is perpendicular to ${lineEq(m, b)}?`, answer: `y = ${term(pm, 'x')}${b2 < 0 ? ' - ' + -b2 : ' + ' + b2}`,
    wrong: [[`y = ${term(F(1).div(m), 'x')}${b2 < 0 ? ' - ' + -b2 : ' + ' + b2}`, 'forgot-negative'], [lineEq(-m, b2), 'forgot-reciprocal'], [lineEq(m, b2), 'used-parallel-rule']],
    worked: [`Perpendicular slopes are negative reciprocals.`, `The slope of ${lineEq(m, b)} is ${m}, so a perpendicular slope is ${pm}.`],
    check: { kind: 'line-rel', rel: 'perpendicular', line: lineEq(m, b) }
  };
};

// Chapter 6 — Inequalities

const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };

G['one-step-inequalities-addition-subtraction'] = (r) => {
  const a = r.int(1, 15), x = r.int(-10, 15), op = r.pick(['<', '>', '≤', '≥']);
  const c = x + a, ineq = `x + ${a} ${op} ${c}`;
  return {
    prompt: `Solve: ${ineq}`, answer: `x ${op} ${x}`,
    wrong: [[`x ${FLIP[op]} ${x}`, 'flipped-sign-unnecessarily'], [`x ${op} ${c + a}`, 'sign-error'], [`x ${FLIP[op]} ${c + a}`, 'sign-error']],
    worked: [ineq, `Subtract ${a} from both sides (no flip — you didn't multiply or divide by a negative):`, `x ${op} ${x}`],
    check: { kind: 'inequality', ineq: ineq.replace(/≤/g, '<=').replace(/≥/g, '>=') }
  };
};

function negIneq(r, withConst) {
  const a = -r.int(2, 6), x = r.int(-8, 8), op = r.pick(['<', '>', '≤', '≥']), b = withConst ? r.nonzero(-10, 10) : 0;
  const c = a * x + b, ineq = `${lin(a, b)} ${op} ${c}`;
  const plain = (s) => s.replace(/≤/g, '<=').replace(/≥/g, '>=');
  return {
    prompt: `Solve: ${ineq}`, answer: `x ${FLIP[op]} ${x}`,
    wrong: [[`x ${op} ${x}`, 'forgot-to-flip'], [`x ${FLIP[op]} ${-x === x ? x + 1 : -x}`, 'sign-error'], [`x ${op} ${-x === x ? x - 1 : -x}`, 'forgot-to-flip']],
    worked: withConst
      ? [ineq, `${b > 0 ? 'Subtract ' + b + ' from' : 'Add ' + -b + ' to'} both sides: ${term(a, 'x')} ${op} ${c - b}`, `Divide both sides by ${a} and flip the sign (dividing by a negative):`, `x ${FLIP[op]} ${x}`]
      : [ineq, `Divide both sides by ${a}. Dividing by a negative flips the sign:`, `x ${FLIP[op]} ${x}`],
    check: { kind: 'inequality', ineq: plain(ineq) }
  };
}
G['flipping-inequality-sign'] = (r) => negIneq(r, false);
G['two-step-inequalities'] = (r) => negIneq(r, true);

// Chapter 7 — Systems

G['solving-systems-by-substitution'] = (r) => {
  const x = r.int(-6, 6), y = r.int(-6, 6), m = r.nonzero(-4, 4), b = y - m * x;
  const a = r.nonzero(-4, 4), c = r.nonzero(-4, 4);
  const cc = a + c * m === 0 ? c + 1 || 2 : c; // keep the system non-degenerate
  const d = a * x + cc * y;
  const e1 = lineEq(m, b), e2 = `${poly([[a, 'x'], [cc, 'y']])} = ${d}`;
  return {
    prompt: `Solve the system: ${e1} and ${e2}. Which ordered pair is the solution?`, answer: pt(x, y),
    wrong: [[pt(y, x), 'swapped-coordinates'], [pt(x, -y), 'sign-error'], [pt(-x, y), 'sign-error'], [pt(x + 1, y + m), 'solved-only-one-equation'], [pt(x + 1, y), 'arithmetic-slip'], [pt(x, y - 1), 'arithmetic-slip']],
    worked: [`Substitute ${lin(m, b)} for y in the second equation:`, `${poly([[a, 'x']])} + ${paren(cc)}(${lin(m, b)}) = ${d}`, `${lin(a + cc * m, cc * b)} = ${d}`, `x = ${x}`, `Then y = ${m}(${x}) ${b < 0 ? '-' : '+'} ${absN(b)} = ${y}`],
    check: { kind: 'system', eqs: [{ a: -m, b: 1, c: b }, { a, b: cc, c: d }] }
  };
};

G['solving-systems-by-elimination'] = (r) => {
  const x = r.int(-6, 6), y = r.int(-6, 6), a = r.nonzero(-4, 4), b = r.int(1, 5);
  let d = r.nonzero(-4, 4); if (d === -a) d = d + 1 || 1;
  const c1 = a * x + b * y, c2 = d * x - b * y;
  return {
    prompt: `Solve by elimination: ${poly([[a, 'x'], [b, 'y']])} = ${c1} and ${poly([[d, 'x'], [-b, 'y']])} = ${c2}. Which ordered pair is the solution?`, answer: pt(x, y),
    wrong: [[pt(y, x), 'swapped-coordinates'], [pt(x, -y), 'sign-error'], [pt(-x, y), 'sign-error'], [pt(x, y + 1), 'arithmetic-slip']],
    worked: [`Add the equations; the y terms cancel:`, `${term(a + d, 'x')} = ${c1 + c2}`, `x = ${x}`, `Substitute back: ${a}(${x}) + ${b}y = ${c1}, so y = ${y}`],
    check: { kind: 'system', eqs: [{ a, b, c: c1 }, { a: d, b: -b, c: c2 }] }
  };
};

// Chapter 8 — Exponents

G['product-rule-of-exponents'] = (r) => {
  const a = r.int(2, 9), b = r.int(2, 9);
  return {
    prompt: `Simplify x^${a} · x^${b} = x^n. What is n?`, answer: F(a + b),
    wrong: [[F(a * b), 'multiplied-exponents'], [F(Math.abs(a - b) || a + b + 1), 'subtracted-exponents'], [F(a + b + 1), 'arithmetic-slip']],
    worked: [`Same base multiplied: add the exponents.`, `${a} + ${b} = ${a + b}`, `x^${a + b}`],
    check: { kind: 'evaluate', expr: `${a} + ${b}` }
  };
};

G['quotient-rule-of-exponents'] = (r) => {
  const b = r.int(2, 6), a = b + r.int(1, 8);
  return {
    prompt: `Simplify x^${a} / x^${b} = x^n. What is n?`, answer: F(a - b),
    wrong: [[F(a).div(b), 'divided-exponents'], [F(a + b), 'added-exponents'], [F(b - a), 'subtracted-backwards']],
    worked: [`Same base divided: subtract the exponents.`, `${a} - ${b} = ${a - b}`, `x^${a - b}`],
    check: { kind: 'evaluate', expr: `${a} - ${b}` }
  };
};

G['power-of-a-power-rule'] = (r) => {
  const a = r.int(2, 6), b = r.int(2, 5);
  return {
    prompt: `Simplify (x^${a})^${b} = x^n. What is n?`, answer: F(a * b),
    wrong: [[F(a + b), 'added-exponents'], [F(a ** b), 'raised-exponent-to-power'], [F(a * b + 1), 'arithmetic-slip']],
    worked: [`A power raised to a power: multiply the exponents.`, `${a} × ${b} = ${a * b}`, `x^${a * b}`],
    check: { kind: 'evaluate', expr: `${a} * ${b}` }
  };
};

G['zero-exponent-rule'] = (r) => {
  const k = r.nonzero(-40, 40) || 3;
  const kk = k === 1 ? 7 : k === -1 ? -7 : k;
  return {
    prompt: `Evaluate: (${kk})^0`, answer: F(1),
    wrong: [[F(0), 'zero-exponent-gives-zero'], [F(kk), 'ignored-exponent'], [F(-1), 'sign-error']],
    worked: [`Any nonzero number to the 0 power is 1.`, `(${kk})^0 = 1`],
    check: { kind: 'evaluate', expr: `(${kk})^0` }
  };
};

G['evaluating-negative-exponents'] = (r) => {
  const a = r.int(2, 5), n = r.int(1, a <= 3 ? 4 : 3);
  const p = a ** n;
  return {
    prompt: `Evaluate: ${a}^(-${n})`, answer: F(1).div(p),
    wrong: [[F(-p), 'negative-exponent-as-negative'], [F(-a * n), 'exponent-as-multiply'], [F(p), 'ignored-negative'], [F(1).div(a * n), 'exponent-as-multiply']],
    worked: [`A negative exponent means "one over" the positive power.`, `${a}^(-${n}) = 1 / ${a}^${n}`, `= 1/${p}`],
    check: { kind: 'evaluate', expr: `${a}^(-${n})` }
  };
};

// Chapter 10 — Polynomials

const quad = (a, b, c) => poly([[a, 'x^2'], [b, 'x'], [c, '']]);

G['adding-polynomials'] = (r) => {
  const a = r.nonzero(-5, 6), b = r.nonzero(-8, 8), c = r.nonzero(-9, 9), d = r.nonzero(-5, 6), e = r.nonzero(-8, 8), f = r.nonzero(-9, 9);
  const start = `(${quad(a, b, c)}) + (${quad(d, e, f)})`;
  return {
    prompt: `Simplify: ${start}`, answer: quad(a + d, b + e, c + f),
    wrong: [[quad(a + d, b - e, c + f), 'sign-error'], [quad(a + d, b + e, c - f), 'sign-error'], [quad(a + d + b + e, 0, c + f), 'combined-unlike-terms'], [quad(a * d, b + e, c + f), 'multiplied-instead-of-added']],
    worked: [`Group like terms: x^2 terms, x terms, then constants.`, `x^2: ${a} + ${paren(d)} = ${a + d}`, `x: ${b} + ${paren(e)} = ${b + e}`, `constants: ${c} + ${paren(f)} = ${c + f}`, quad(a + d, b + e, c + f)],
    check: { kind: 'poly', expr: start },
    steps: { start, kind: 'expression' }
  };
};

G['subtracting-polynomials'] = (r) => {
  const a = r.nonzero(-5, 6), b = r.nonzero(-8, 8), c = r.nonzero(-9, 9), d = r.nonzero(-5, 6), e = r.nonzero(-8, 8), f = r.nonzero(-9, 9);
  const start = `(${quad(a, b, c)}) - (${quad(d, e, f)})`;
  return {
    prompt: `Simplify: ${start}`, answer: quad(a - d, b - e, c - f),
    wrong: [[quad(a - d, b + e, c + f), 'forgot-to-distribute-negative'], [quad(a + d, b + e, c + f), 'added-instead-of-subtracted'], [quad(a - d, b - e, c + f), 'forgot-to-distribute-negative'], [quad(a - d, b + e, c - f), 'sign-error']],
    worked: [`Subtracting means changing the sign of every term in the second polynomial.`, `${quad(a, b, c)} ${poly([[-d, 'x^2'], [-e, 'x'], [-f, '']]).replace(/^-/, '- ').replace(/^(?=[^-])/, '+ ')}`, `Combine like terms:`, quad(a - d, b - e, c - f)],
    check: { kind: 'poly', expr: start },
    steps: { start, kind: 'expression' }
  };
};

G['multiplying-binomials-foil'] = (r) => {
  const a = r.nonzero(-9, 9), b = r.nonzero(-9, 9);
  const start = `(${lin(1, a)})(${lin(1, b)})`;
  return {
    prompt: `Multiply: ${start}`, answer: quad(1, a + b, a * b),
    wrong: [[quad(1, 0, a * b), 'forgot-middle-term'], [quad(1, a + b, -(a * b)), 'sign-error'], [quad(1, a * b, a + b), 'swapped-sum-and-product'], [quad(1, a * b, a * b), 'forgot-middle-term']],
    worked: [`First: x · x = x^2`, `Outer + Inner: ${term(b, 'x')} + ${a < 0 ? '(' + term(a, 'x') + ')' : term(a, 'x')} = ${term(a + b, 'x')}`, `Last: ${a} · ${paren(b)} = ${a * b}`, quad(1, a + b, a * b)],
    check: { kind: 'poly', expr: start },
    steps: { start, kind: 'expression' }
  };
};

G['distributing-a-monomial-over-a-polynomial'] = (r) => {
  const k = r.pick([2, 3, 4, 5, -2, -3, -4]), b = r.nonzero(-6, 6), c = r.nonzero(-9, 9);
  const start = `${term(k, 'x')}(${lin(b, c)})`;
  return {
    prompt: `Multiply: ${start}`, answer: quad(k * b, k * c, 0),
    wrong: [[quad(k * b, c, 0), 'forgot-to-distribute'], [quad(0, k * b, k * c), 'forgot-to-multiply-variable'], [quad(k * b, -k * c, 0), 'sign-error'], [poly([[k * b, 'x^2'], [k * c, '']]), 'distributed-variable-to-one-term']],
    worked: [`Multiply ${term(k, 'x')} by each term.`, `${term(k, 'x')} · ${term(b, 'x')} = ${term(k * b, 'x^2')}`, `${term(k, 'x')} · ${paren(c)} = ${term(k * c, 'x')}`, quad(k * b, k * c, 0)],
    check: { kind: 'poly', expr: start },
    steps: { start, kind: 'expression' }
  };
};

// Chapter 12 — Radicals and geometry

const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13];
G['simplifying-square-roots'] = (r) => {
  const k = r.int(2, 7), m = r.pick(SQUAREFREE), n = k * k * m;
  return {
    prompt: `Simplify: √${n}`, answer: `${k}√${m}`,
    wrong: [[`${k * k}√${m}`, 'forgot-to-take-root'], [`${m}√${k}`, 'swapped-factors'], [`${k}√${m * k}`, 'pulled-out-one-factor'], [`${k + 1}√${m}`, 'arithmetic-slip']],
    worked: [`Find the largest perfect square factor of ${n}: ${n} = ${k * k} × ${m}`, `√${n} = √${k * k} × √${m}`, `= ${k}√${m}`],
    check: { kind: 'radical', n }
  };
};

const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29]];
G['pythagorean-theorem-finding-hypotenuse'] = (r) => {
  const [a, b, c] = r.pick(TRIPLES);
  const s = r.int(1, 3);
  const A = a * s, B = b * s, C = c * s;
  return {
    prompt: `A right triangle has legs ${A} and ${B}. How long is the hypotenuse?`, answer: F(C),
    wrong: [[F(A + B), 'added-the-legs'], [F(A * A + B * B), 'forgot-square-root'], [F(B - A === C ? C + 1 : Math.abs(B - A) || C + 2), 'subtracted-the-legs']],
    worked: [`a^2 + b^2 = c^2`, `${A}^2 + ${B}^2 = ${A * A} + ${B * B} = ${C * C}`, `c = √${C * C} = ${C}`],
    check: { kind: 'evaluate', expr: `(${A}^2 + ${B}^2)^(1/2)` }
  };
};

G['pythagorean-theorem-finding-a-leg'] = (r) => {
  const [a, b, c] = r.pick(TRIPLES);
  const s = r.int(1, 3), A = a * s, B = b * s, C = c * s;
  return {
    prompt: `A right triangle has hypotenuse ${C} and one leg ${A}. How long is the other leg?`, answer: F(B),
    wrong: [[F(C - A), 'subtracted-without-squaring'], [F(C * C - A * A), 'forgot-square-root'], [F(C + A), 'added-instead-of-subtracted']],
    worked: [`a^2 + b^2 = c^2, so b^2 = c^2 - a^2`, `b^2 = ${C * C} - ${A * A} = ${B * B}`, `b = √${B * B} = ${B}`],
    check: { kind: 'evaluate', expr: `(${C}^2 - ${A}^2)^(1/2)` }
  };
};

G['using-the-distance-formula'] = (r) => {
  const [a, b, c] = r.pick(TRIPLES.slice(0, 5));
  const x1 = r.int(-6, 6), y1 = r.int(-6, 6), sx = r.sign(), sy = r.sign();
  const swap = r.chance(0.5);
  const dx = (swap ? b : a) * sx, dy = (swap ? a : b) * sy;
  const x2 = x1 + dx, y2 = y1 + dy;
  return {
    prompt: `What is the distance between ${pt(x1, y1)} and ${pt(x2, y2)}?`, answer: F(c),
    wrong: [[F(a + b), 'added-without-squaring'], [F(c * c), 'forgot-square-root'], [F(Math.abs(dx + dy) || c + 1), 'combined-differences-first']],
    worked: [`d = √((x2 - x1)^2 + (y2 - y1)^2)`, `= √(${dx}^2 + ${dy}^2) = √(${dx * dx} + ${dy * dy})`, `= √${c * c} = ${c}`],
    check: { kind: 'evaluate', expr: `((${x2} - ${paren(x1)})^2 + (${y2} - ${paren(y1)})^2)^(1/2)` }
  };
};

// ── Catalog ─────────────────────────────────────────────────────────────

const CHAPTER_OF = {
  'algebra1-01': ['order-of-operations-pemdas', 'evaluating-expressions-by-substitution', 'order-of-operations-with-exponents', 'order-of-operations-left-to-right', 'evaluating-multi-term-expressions', 'less-than-phrase-order-reversal', 'translating-sum-phrases', 'translating-product-and-difference-phrases'],
  'algebra1-02': ['absolute-value-basics', 'adding-signed-numbers', 'subtracting-negative-numbers', 'combining-signed-number-operations', 'applying-distributive-property', 'additive-inverse', 'multiplicative-inverse'],
  'algebra1-03': ['one-step-equations-addition-subtraction', 'one-step-equations-multiplication-division', 'two-step-equations', 'multi-step-equations-with-distribution', 'multi-step-equations-distribute-and-both-sides', 'equations-variable-terms-both-sides', 'equations-with-negative-coefficients', 'verifying-solutions-by-substitution', 'addition-property-of-equality', 'multiplication-property-of-equality'],
  'algebra1-04': ['finding-x-intercepts', 'finding-y-intercepts', 'computing-slope-from-two-points', 'slope-with-negative-values', 'identifying-slope-from-slope-intercept-form', 'identifying-y-intercept-from-slope-intercept-form', 'verifying-points-on-a-line'],
  'algebra1-05': ['writing-point-slope-form', 'converting-point-slope-to-slope-intercept', 'slope-from-two-points-for-writing-equations', 'writing-equation-from-two-points', 'parallel-lines-same-slope', 'perpendicular-lines-negative-reciprocal-slope', 'perpendicular-lines-with-negative-slope', 'identifying-parallel-slopes', 'identifying-perpendicular-slopes', 'point-slope-form-with-negative-values'],
  'algebra1-06': ['one-step-inequalities-addition-subtraction', 'flipping-inequality-sign', 'two-step-inequalities'],
  'algebra1-07': ['solving-systems-by-substitution', 'solving-systems-by-elimination'],
  'algebra1-08': ['product-rule-of-exponents', 'quotient-rule-of-exponents', 'power-of-a-power-rule', 'zero-exponent-rule', 'evaluating-negative-exponents'],
  'algebra1-10': ['adding-polynomials', 'subtracting-polynomials', 'multiplying-binomials-foil', 'distributing-a-monomial-over-a-polynomial'],
  'algebra1-12': ['simplifying-square-roots', 'pythagorean-theorem-finding-hypotenuse', 'pythagorean-theorem-finding-a-leg', 'using-the-distance-formula']
};

// Concepts from quizzes.js deliberately not generated, and why.
const SKIPPED = {
  'variables-as-unknowns': 'conceptual vocabulary, no computed answer',
  'translating-quotient-and-sum-phrases': 'covered by the other translation generators; wording-heavy',
  'commutative-property-identification': 'naming a property, not computing a value',
  'associative-property-identification': 'naming a property, not computing a value',
  'identity-property-of-multiplication': 'naming a property, not computing a value',
  'reading-ordered-pairs': 'needs a drawn graph',
  'interpreting-zero-slope': 'answer is always 0 / conceptual',
  'interpreting-slope-sign-from-graph-direction': 'needs a drawn graph',
  'flipping-inequality-with-negative-one': 'covered by flipping-inequality-sign',
  'open-vs-closed-circle-notation': 'needs a drawn number line',
  'closed-circle-identification': 'needs a drawn number line',
  'dashed-vs-solid-boundary-lines': 'needs a drawn graph',
  'shading-inequality-regions': 'needs a drawn graph',
  'graphing-solved-inequalities': 'needs a drawn graph',
  'testing-solutions-to-inequalities': 'not built this pass',
  'graphical-meaning-of-system-solution': 'conceptual',
  'systems-with-no-solution': 'not built this pass',
  'systems-with-infinite-solutions': 'not built this pass',
  'substitution-with-coefficients': 'covered by solving-systems-by-substitution',
  'elimination-with-matching-coefficients': 'covered by solving-systems-by-elimination',
  'preparing-equations-for-elimination': 'not built this pass',
  'solution-region-for-systems-of-inequalities': 'needs a drawn graph',
  'choosing-substitution-vs-elimination': 'judgment call, no single computed answer',
  'negative-exponent-rule': 'covered by evaluating-negative-exponents',
  'identifying-growth-vs-decay': 'conceptual',
  'interpreting-exponential-function-parameters': 'conceptual',
  'applying-exponential-growth-models': 'word problems with rounding; not built this pass',
  'recognizing-exponential-decay-equations': 'conceptual',
  'algebra1-09 (all 10 quadratics concepts)': 'not built this pass (Chapters 1-5 prioritized)',
  'factoring-out-the-gcf / factoring-trinomials-* / difference-of-squares-* / recognizing-difference-of-squares / foil-with-mixed-signs': 'factoring answers need a factored-form comparer; not built this pass',
  'algebra1-11 (all 10 rational-expression concepts)': 'rational expressions need a rational-function comparer; not built this pass',
  'simplifying-square-roots-larger-numbers / combining-*-radicals / multiplying-radicals / distance-formula-with-negative-coordinates / identifying-the-pythagorean-theorem-formula': 'not built this pass'
};

const CONCEPT_LABELS = {};
for (const id of Object.keys(G)) {
  CONCEPT_LABELS[id] = id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

const CONCEPT_CHAPTER = {};
for (const [ch, ids] of Object.entries(CHAPTER_OF)) for (const id of ids) CONCEPT_CHAPTER[id] = ch;

// ── Wrapper ─────────────────────────────────────────────────────────────

function answerKey(v) { return v instanceof Frac ? 'n:' + v.toString() : 's:' + String(v).replace(/\s+/g, ' ').trim(); }
function answerText(v) { return v instanceof Frac ? v.toString() : String(v); }

// Fallback distractors for numeric answers when the named rules collide
// (e.g. a + b happens to equal a·b). Still tagged with a real wrong rule.
function numericFallbacks(ans) {
  return [[ans.add(1), 'arithmetic-slip'], [ans.sub(1), 'arithmetic-slip'], [ans.neg(), 'sign-error'], [ans.add(2), 'arithmetic-slip'], [ans.sub(2), 'arithmetic-slip'], [ans.add(10), 'arithmetic-slip']];
}

function generateProblem(conceptId, seed) {
  const gen = G[conceptId];
  if (!gen) throw new Error('Unknown concept: ' + conceptId);
  const s = Number(seed) >>> 0;
  const rng = makeRng(conceptId, s);
  const p = gen(rng);
  const isNumber = p.answer instanceof Frac;

  const seen = new Set([answerKey(p.answer)]);
  const distractors = [];
  const candidates = isNumber ? [...p.wrong, ...numericFallbacks(p.answer)] : p.wrong;
  for (const [v, tag] of candidates) {
    if (v === null || v === undefined) continue;
    const k = answerKey(v);
    if (seen.has(k)) continue;
    seen.add(k);
    distractors.push({ text: answerText(v), tag });
    if (distractors.length === 3) break;
  }
  if (distractors.length !== 3) throw new Error(`Concept ${conceptId} seed ${s}: could not build 3 distinct distractors`);

  const options = rng.shuffle([{ text: answerText(p.answer), tag: null }, ...distractors]);
  return {
    conceptId,
    seed: s,
    prompt: p.prompt,
    answer: answerText(p.answer),
    answerType: isNumber ? 'number' : 'choice',
    options,
    worked: p.worked,
    check: p.check,
    steps: p.steps || null
  };
}

function listConcepts() {
  return Object.keys(G);
}

module.exports = {
  generateProblem,
  listConcepts,
  makeRng,
  CHAPTER_OF,
  CONCEPT_CHAPTER,
  CONCEPT_LABELS,
  SKIPPED,
  fmt: { num, paren, term, poly, lin, minus }
};
