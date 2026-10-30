// Step checker for "Show your work": is one line of algebra equivalent to
// the line before it?  checkStep(prevLine, nextLine) ->
//   { result: 'equivalent' | 'not_equivalent' | 'unknown', reason }
//
// Hand-written tokenizer and recursive-descent parser. Nothing is ever
// evaluated as code (no eval, no Function). Arithmetic is exact: BigInt
// fractions, and every expression is expanded to a polynomial in the one
// variable.
//
// Rules:
//  - expressions: equivalent iff the expanded polynomials are identical
//  - equations: with f = left - right, equivalent iff f2 = c * f1 for a
//    nonzero rational c
//  - equation vs expression: not_equivalent
//  - anything out of scope, unparseable, degenerate (0 = 0) or
//    non-polynomial: unknown. When the checker isn't sure, it says
//    unknown, never not_equivalent. In particular, two equations that
//    aren't proportional only get not_equivalent when both are linear
//    (or constant); a non-linear pair could still have the same solutions,
//    so it gets unknown.

const { Frac } = require('./frac');

const MAX_LEN = 60;
const MAX_EXP = 3;
const MAX_DEGREE = 12;

class OutOfScope extends Error {}

// ── Normalization ───────────────────────────────────────────────────────

const SUPERSCRIPTS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

function normalize(raw) {
  let s = String(raw);
  // Superscripts first: NFKC would turn x² into x2.
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + [...m].map((c) => SUPERSCRIPTS[c]).join(''));
  s = s.normalize('NFKC');
  s = s.replace(/[−‒–—﹣－]/g, '-')
    .replace(/[×✕✖·∙⋅]/g, '*')
    .replace(/[÷∕⁄]/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

// ── Tokenizer ───────────────────────────────────────────────────────────

function tokenize(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ') { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const text = s.slice(i, j);
      if (!/^(\d+(\.\d*)?|\.\d+)$/.test(text)) throw new OutOfScope(`"${text}" isn't a number I can read.`);
      toks.push({ t: 'num', text, pos: i });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) { toks.push({ t: 'var', text: ch, pos: i }); i++; continue; }
    if ('+-*/^()='.includes(ch)) { toks.push({ t: ch, text: ch, pos: i }); i++; continue; }
    throw new OutOfScope(`I can't read the symbol "${ch}".`);
  }
  return toks;
}

function numberToFrac(text) {
  const [ip, fp = ''] = text.split('.');
  return new Frac(BigInt((ip || '0') + fp), 10n ** BigInt(fp.length));
}

// ── Polynomials: arrays of Frac indexed by degree ──────────────────────

const P = {
  trim(a) { const r = a.slice(); while (r.length && r[r.length - 1].isZero()) r.pop(); return r; },
  const(f) { return P.trim([Frac.of(f)]); },
  x() { return [Frac.of(0), Frac.of(1)]; },
  add(a, b) { const n = Math.max(a.length, b.length); const r = []; for (let i = 0; i < n; i++) r.push((a[i] || Frac.of(0)).add(b[i] || Frac.of(0))); return P.trim(r); },
  neg(a) { return a.map((c) => c.neg()); },
  sub(a, b) { return P.add(a, P.neg(b)); },
  mul(a, b) {
    if (!a.length || !b.length) return [];
    if (a.length + b.length - 2 > MAX_DEGREE) throw new OutOfScope('That power is too high for me to check.');
    const r = Array.from({ length: a.length + b.length - 1 }, () => Frac.of(0));
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) r[i + j] = r[i + j].add(a[i].mul(b[j]));
    return P.trim(r);
  },
  scale(a, f) { return P.trim(a.map((c) => c.mul(f))); },
  degree(a) { return a.length - 1; }, // -1 for the zero polynomial
  eq(a, b) { return a.length === b.length && a.every((c, i) => c.eq(b[i])); }
};

// ── Parser ──────────────────────────────────────────────────────────────
// Each side returns { poly, terms, parens, vars } where terms is the list
// of top-level additive terms (for the "simplified form" check).

function parseSide(toks, start, end, ctx) {
  let p = start;
  const peek = () => (p < end ? toks[p] : null);
  const isAtomStart = (t) => t && (t.t === 'num' || t.t === 'var' || t.t === '(');

  function expr(top) {
    const terms = [];
    let sign = 1;
    if (peek() && (peek().t === '+' || peek().t === '-')) { sign = peek().t === '-' ? -1 : 1; p++; }
    let first = term();
    if (sign < 0) first = P.neg(first);
    terms.push(first);
    let acc = first;
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = toks[p++].t;
      let t = term();
      if (op === '-') t = P.neg(t);
      terms.push(t);
      acc = P.add(acc, t);
    }
    if (top) ctx.terms = terms;
    return acc;
  }

  function term() {
    let acc = unary();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.t === '*') { p++; acc = P.mul(acc, unary()); continue; }
      if (t.t === '/') {
        p++;
        const d = unary();
        if (d.length === 0) throw new OutOfScope("That divides by zero, so I can't check it.");
        if (d.length > 1) throw new OutOfScope("Dividing by an expression with the variable isn't something I can check.");
        acc = P.scale(acc, Frac.of(1).div(d[0]));
        continue;
      }
      if (isAtomStart(t)) {
        // Implicit multiplication: 2x, 3(x+1), (x+1)(x-2), x(x+1).
        // Ambiguous adjacencies are out of scope rather than guessed:
        // "2 3", "x2", ")2".
        const prev = toks[p - 1];
        if (t.t === 'num' && prev && (prev.t === 'num' || prev.t === 'var' || prev.t === ')')) {
          throw new OutOfScope(`I'm not sure what "${prev.text}${t.text}" means; use * or ^.`);
        }
        acc = P.mul(acc, power());
        continue;
      }
      break;
    }
    return acc;
  }

  function unary() {
    const t = peek();
    if (t && t.t === '-') { p++; return P.neg(unary()); }
    if (t && t.t === '+') { p++; return unary(); }
    return power();
  }

  function power() {
    const base = atom();
    if (peek() && peek().t === '^') {
      p++;
      let n;
      const t = peek();
      if (t && t.t === 'num' && /^\d+$/.test(t.text)) { n = Number(t.text); p++; }
      else if (t && t.t === '(' && toks[p + 1] && toks[p + 1].t === 'num' && /^\d+$/.test(toks[p + 1].text) && toks[p + 2] && toks[p + 2].t === ')') { n = Number(toks[p + 1].text); p += 3; }
      else throw new OutOfScope('I can only check whole-number exponents from 0 to 3.');
      if (n > MAX_EXP) throw new OutOfScope('I can only check exponents up to 3.');
      if (n === 0 && base.length === 0) throw new OutOfScope("0^0 isn't defined.");
      let r = P.const(1);
      for (let i = 0; i < n; i++) r = P.mul(r, base);
      return r;
    }
    return base;
  }

  function atom() {
    const t = toks[p];
    if (p >= end || !t) throw new OutOfScope('The line ends too early.');
    if (t.t === 'num') { p++; return P.const(numberToFrac(t.text)); }
    if (t.t === 'var') { p++; ctx.vars.add(t.text); return P.x(); }
    if (t.t === '(') {
      p++;
      ctx.parens = true;
      const inner = expr(false);
      if (!peek() || peek().t !== ')') throw new OutOfScope('A parenthesis is missing its partner.');
      p++;
      return inner;
    }
    throw new OutOfScope(`I didn't expect "${t.text}" there.`);
  }

  if (start >= end) throw new OutOfScope('One side of the equation is empty.');
  const poly = expr(true);
  if (p !== end) throw new OutOfScope(`I didn't expect "${toks[p].text}" there.`);
  return poly;
}

// Parses one line into { kind: 'equation'|'expression', sides, f, vars,
// simplified, bareVar }.
function parseLine(raw) {
  if (typeof raw !== 'string') throw new OutOfScope('Type a line of math.');
  const s = normalize(raw);
  if (!s) throw new OutOfScope('The line is empty.');
  if (s.length > MAX_LEN) throw new OutOfScope(`Keep each line under ${MAX_LEN} characters.`);
  const toks = tokenize(s);
  const eqs = toks.map((t, i) => (t.t === '=' ? i : -1)).filter((i) => i >= 0);
  if (eqs.length > 1) throw new OutOfScope('Use at most one = sign per line.');
  const vars = new Set();
  const sides = [];
  const ranges = eqs.length ? [[0, eqs[0]], [eqs[0] + 1, toks.length]] : [[0, toks.length]];
  for (const [a, b] of ranges) {
    const ctx = { vars, parens: false, terms: [] };
    const poly = parseSide(toks, a, b, ctx);
    const bareVar = b - a === 1 && toks[a].t === 'var';
    // Simplified: no parentheses, every top-level term a single power of
    // the variable, and no power repeated (like terms all combined).
    const degs = ctx.terms.map((t) => (t.length === 0 ? null : t.slice(0, -1).every((c) => c.isZero()) ? t.length - 1 : 'mixed'));
    const nonZeroDegs = degs.filter((d) => d !== null);
    const simplified = !ctx.parens && !nonZeroDegs.includes('mixed') && new Set(nonZeroDegs).size === nonZeroDegs.length && nonZeroDegs.length === ctx.terms.length;
    sides.push({ poly, bareVar, simplified, terms: ctx.terms });
  }
  if (vars.size > 1) throw new OutOfScope('I can only check lines with one variable.');
  const kind = sides.length === 2 ? 'equation' : 'expression';
  const f = kind === 'equation' ? P.sub(sides[0].poly, sides[1].poly) : sides[0].poly;
  return { kind, sides, f, vars, text: s };
}

// ── The check ───────────────────────────────────────────────────────────

const unknown = (reason) => ({ result: 'unknown', reason });

function proportional(f1, f2) {
  if (f1.length !== f2.length) return false;
  let c = null;
  for (let i = 0; i < f1.length; i++) {
    if (f1[i].isZero() !== f2[i].isZero()) return false;
    if (f1[i].isZero()) continue;
    const r = f2[i].div(f1[i]);
    if (c === null) c = r;
    else if (!c.eq(r)) return false;
  }
  return c !== null;
}

function checkStep(prevLine, nextLine) {
  let a, b;
  try { a = parseLine(prevLine); } catch (e) { if (e instanceof OutOfScope) return unknown(e.message); throw e; }
  try { b = parseLine(nextLine); } catch (e) { if (e instanceof OutOfScope) return unknown(e.message); throw e; }

  const allVars = new Set([...a.vars, ...b.vars]);
  if (allVars.size > 1) return unknown('I can only check lines with one variable.');

  if (a.kind !== b.kind) {
    return {
      result: 'not_equivalent',
      reason: a.kind === 'equation'
        ? 'The line before was an equation, so this line needs an = sign too.'
        : "The line before was an expression, so this line shouldn't have an = sign."
    };
  }

  if (a.kind === 'expression') {
    if (P.eq(a.f, b.f)) return { result: 'equivalent', reason: 'This equals the line before.' };
    return { result: 'not_equivalent', reason: expressionReason(a, b) };
  }

  if (a.f.length === 0 || b.f.length === 0) return unknown("That line is true for every value, so it doesn't tell me anything to check.");
  if (proportional(a.f, b.f)) return { result: 'equivalent', reason: 'This is equivalent to the line before.' };
  const linear = (f) => P.degree(f) <= 1;
  if (!linear(a.f) || !linear(b.f)) return unknown('I can only fully check linear equations, and this one has a higher power.');
  return { result: 'not_equivalent', reason: equationReason(a, b) };
}

function expressionReason(a, b) {
  if (a.sides[0].poly.length === b.sides[0].poly.length && P.eq(a.f.map((c) => c.sign() < 0 ? c.neg() : c), b.f.map((c) => c.sign() < 0 ? c.neg() : c))) {
    return "The sizes match but a sign changed. Check each term's + or −.";
  }
  if (/\(/.test(a.text) && !/\(/.test(b.text)) return 'Check that the number outside the parentheses multiplied every term inside.';
  return "This doesn't equal the line before. Check your arithmetic and like terms.";
}

function equationReason(a, b) {
  const [l1, r1] = a.sides.map((s) => s.poly), [l2, r2] = b.sides.map((s) => s.poly);
  const sameLeft = P.eq(l1, l2), sameRight = P.eq(r1, r2);
  if (/\(/.test(a.text) && !/\(/.test(b.text)) return 'Check that the number outside the parentheses multiplied every term inside.';
  // A term moved across the = without flipping its sign changes f by
  // exactly twice that term.
  const diff = P.sub(b.f, a.f);
  const terms = a.sides.flatMap((s) => s.terms).filter((t) => t.length);
  if (terms.some((t) => P.eq(diff, P.scale(t, 2)) || P.eq(diff, P.scale(t, -2)))) {
    return 'Looks like a sign slip. When a term moves to the other side, its sign flips.';
  }
  if (sameLeft !== sameRight) {
    return `Only the ${sameLeft ? 'right' : 'left'} side changed value. Whatever you do to one side, do to the other.`;
  }
  return "This line isn't equivalent to the one before. Check your arithmetic.";
}

// Is this line "the variable alone = a number"? Returns that number (Frac)
// or null. Works for x = 4 and 4 = x.
function isolatedValue(line) {
  let parsed;
  try { parsed = parseLine(line); } catch (e) { if (e instanceof OutOfScope) return null; throw e; }
  if (parsed.kind !== 'equation') return null;
  const [l, r] = parsed.sides;
  const pick = (v, c) => (v.bareVar && c.poly.length <= 1 ? (c.poly[0] || Frac.of(0)) : null);
  return pick(l, r) || pick(r, l);
}

// Is this expression fully expanded with like terms combined?
function isSimplifiedExpression(line) {
  try {
    const parsed = parseLine(line);
    return parsed.kind === 'expression' && parsed.sides[0].simplified;
  } catch (e) {
    if (e instanceof OutOfScope) return false;
    throw e;
  }
}

module.exports = { checkStep, parseLine, isolatedValue, isSimplifiedExpression, normalize, MAX_LEN, OutOfScope };
