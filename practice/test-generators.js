// Runs every practice generator over 200 seeds and checks each problem
// independently of the generator's own arithmetic. No network, no database.
//   node practice/test-generators.js
//
// The independent check re-reads the generator's problem text (an
// expression, equation, line or inequality string) with a separate
// floating-point evaluator written here, never the generator's or the
// step checker's code, and confirms the stated answer by substitution.

const { generateProblem, listConcepts, CONCEPT_CHAPTER } = require('./generators');

const SEEDS = 200;
const EPS = 1e-9;

// ── Tiny independent evaluator (floats; test-only) ─────────────────────
function tokenize(src) {
  const s = src.replace(/[−]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; out.push({ t: 'num', v: parseFloat(s.slice(i, j)) }); i = j; continue; }
    if (/[a-z]/i.test(ch)) { let j = i; while (j < s.length && /[a-z]/i.test(s[j])) j++; const w = s.slice(i, j); if (w === 'abs') out.push({ t: 'fn', v: w }); else for (const c of w) out.push({ t: 'var', v: c }); i = j; continue; }
    if ('+-*/^()'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
    throw new Error('bad char ' + ch + ' in ' + src);
  }
  // implicit multiplication
  const res = [];
  for (let k = 0; k < out.length; k++) {
    const a = res[res.length - 1], b = out[k];
    const aEnds = a && (a.t === 'num' || a.t === 'var' || (a.t === 'op' && a.v === ')'));
    const bStarts = b.t === 'num' || b.t === 'var' || b.t === 'fn' || (b.t === 'op' && b.v === '(');
    if (aEnds && bStarts) res.push({ t: 'op', v: '*' });
    res.push(b);
  }
  return res;
}

function evaluate(src, vars = {}) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v) => { if (!toks[p] || toks[p].v !== v) throw new Error('expected ' + v + ' in ' + src); p++; };
  function expr() { let v = termP(); while (peek() && (peek().v === '+' || peek().v === '-')) { const o = toks[p++].v; const r = termP(); v = o === '+' ? v + r : v - r; } return v; }
  function termP() { let v = unary(); while (peek() && (peek().v === '*' || peek().v === '/')) { const o = toks[p++].v; const r = unary(); v = o === '*' ? v * r : v / r; } return v; }
  function unary() { if (peek() && peek().v === '-') { p++; return -unary(); } if (peek() && peek().v === '+') { p++; return unary(); } return power(); }
  function power() { const b = atom(); if (peek() && peek().v === '^') { p++; const e = unary(); return Math.pow(b, e); } return b; }
  function atom() {
    const t = toks[p++];
    if (!t) throw new Error('unexpected end in ' + src);
    if (t.t === 'num') return t.v;
    if (t.t === 'var') { if (!(t.v in vars)) throw new Error('unbound ' + t.v + ' in ' + src); return vars[t.v]; }
    if (t.t === 'fn') { eat('('); const v = expr(); eat(')'); return Math.abs(v); }
    if (t.v === '(') { const v = expr(); eat(')'); return v; }
    throw new Error('unexpected ' + t.v + ' in ' + src);
  }
  const v = expr();
  if (p !== toks.length) throw new Error('trailing tokens in ' + src);
  return v;
}

const close = (a, b) => Math.abs(a - b) < EPS * Math.max(1, Math.abs(a), Math.abs(b));
function numOf(text) { const m = String(text).match(/^(-?\d+)(?:\/(\d+))?$/); if (!m) return NaN; return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]); }
function sides(eq) { const parts = eq.split('='); if (parts.length !== 2) throw new Error('not an equation: ' + eq); return parts; }
function eqHolds(eq, vars) { const [l, r] = sides(eq); return close(evaluate(l, vars), evaluate(r, vars)); }
function lineFn(line) { const [, rhs] = sides(line); return (x) => evaluate(rhs, { x }); }
function parsePoint(text) { const m = String(text).match(/^\((-?\d+), (-?\d+)\)$/); return m ? [Number(m[1]), Number(m[2])] : null; }
function ineqHolds(lhs, op, rhs) { return op === '<' ? lhs < rhs - EPS : op === '>' ? lhs > rhs + EPS : op === '<=' ? lhs <= rhs + EPS : lhs >= rhs - EPS; }
function splitIneq(s) { const m = s.match(/^(.*?)(<=|>=|<|>|≤|≥)(.*)$/); if (!m) return null; return [m[1], ({ '≤': '<=', '≥': '>=' })[m[2]] || m[2], m[3]]; }

// Is `text` a correct answer for this problem, judged independently?
function isCorrect(check, text) {
  switch (check.kind) {
    case 'evaluate': return close(numOf(text), evaluate(check.expr, check.vars || {}));
    case 'expression': {
      const { a, b } = check.expected; const v = check.variable;
      return [-3, 0, 2, 7].every((t) => close(evaluate(text, { [v]: t }), a * t + b));
    }
    case 'poly': return [-3, -1, 0, 2, 5].every((t) => close(evaluate(text, { x: t }), evaluate(check.expr, { x: t })));
    case 'solve': { const x = numOf(text); return Number.isFinite(x) && eqHolds(check.equation, { x }); }
    case 'move': {
      // Applying the named operation to the left side must leave x alone.
      const m = String(text).match(/^(Add|Subtract|Multiply by|Divide by) (-?\d+)$/); if (!m) return false;
      const n = Number(m[2]);
      const op = { Add: (v) => v + n, Subtract: (v) => v - n, 'Multiply by': (v) => v * n, 'Divide by': (v) => v / n }[m[1]];
      const [lhs] = sides(check.equation);
      return [0, 1, 5, -4].every((t) => close(op(evaluate(lhs, { x: t })), t));
    }
    case 'slope': { const [[x1, y1], [x2, y2]] = check.points; return close(numOf(text), (y2 - y1) / (x2 - x1)); }
    case 'line-coef': { const f = lineFn(check.line); const want = check.which === 'm' ? f(1) - f(0) : f(0); return close(numOf(text), want); }
    case 'point-on-line': { const pnt = parsePoint(text); return !!pnt && close(lineFn(check.line)(pnt[0]), pnt[1]); }
    case 'line-through': {
      const ok = check.points.every(([x, y]) => eqHolds(text, { x, y }));
      const [x0, y0] = check.points[0];
      return ok && !eqHolds(text, { x: x0, y: y0 + 1 }); // a real line, not 0 = 0
    }
    case 'slope-rel': {
      const m = check.line ? (() => { const f = lineFn(check.line); return f(1) - f(0); })() : numOf(check.slope);
      const v = numOf(text);
      return check.rel === 'parallel' ? close(v, m) : close(v * m, -1);
    }
    case 'line-rel': {
      const f = lineFn(check.line), m = f(1) - f(0), b = f(0);
      const g = lineFn(text), m2 = g(1) - g(0), b2 = g(0);
      return check.rel === 'parallel' ? close(m2, m) && !close(b2, b) : close(m2 * m, -1);
    }
    case 'inequality': {
      const [l, op, r] = splitIneq(check.ineq);
      const ans = splitIneq(String(text)); if (!ans) return false;
      for (let t = -30; t <= 30; t += 0.5) {
        if (ineqHolds(evaluate(l, { x: t }), op, evaluate(r, { x: t })) !== ineqHolds(evaluate(ans[0], { x: t }), ans[1], evaluate(ans[2], { x: t }))) return false;
      }
      return true;
    }
    case 'system': { const pnt = parsePoint(text); return !!pnt && check.eqs.every(({ a, b, c }) => close(a * pnt[0] + b * pnt[1], c)); }
    case 'radical': {
      const m = String(text).match(/^(\d+)√(\d+)$/); if (!m) return false;
      const k = Number(m[1]), r = Number(m[2]);
      let squareFree = true; for (let f = 2; f * f <= r; f++) if (r % (f * f) === 0) squareFree = false;
      return squareFree && close(k * Math.sqrt(r), Math.sqrt(check.n));
    }
    default: throw new Error('unknown check kind ' + check.kind);
  }
}

function badValues(obj, path = '') {
  const bad = [];
  const walk = (v, pth) => {
    if (v === undefined) bad.push(pth + ' is undefined');
    else if (typeof v === 'number' && (Number.isNaN(v) || Object.is(v, -0) || !Number.isFinite(v))) bad.push(pth + ' = ' + v);
    else if (typeof v === 'string' && /NaN|undefined|Infinity|(^|[^0-9])-0(?![0-9./])/.test(v)) bad.push(pth + ' contains "' + v + '"');
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${pth}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, pth ? `${pth}.${k}` : k);
  };
  walk(obj, path);
  return bad;
}

// ── Run ─────────────────────────────────────────────────────────────────
const rows = [];
let totalFail = 0;
for (const id of listConcepts()) {
  let fails = 0;
  const firstErrors = [];
  for (let seed = 0; seed < SEEDS; seed++) {
    const errs = [];
    try {
      const p = generateProblem(id, seed);
      const again = generateProblem(id, seed);
      if (JSON.stringify(p) !== JSON.stringify(again)) errs.push('same seed gave a different problem');
      if (!isCorrect(p.check, p.answer)) errs.push(`answer ${p.answer} fails independent check (${p.prompt})`);
      if (p.options.length !== 4) errs.push('options length ' + p.options.length);
      const texts = p.options.map((o) => o.text);
      if (new Set(texts).size !== texts.length) errs.push('duplicate options ' + texts.join(' | '));
      const correctCount = texts.filter((t) => isCorrect(p.check, t)).length;
      if (correctCount !== 1) errs.push(`${correctCount} options judged correct: ${texts.join(' | ')} (${p.prompt})`);
      if (!texts.includes(p.answer)) errs.push('answer not among options');
      if (p.options.filter((o) => o.tag === null).length !== 1) errs.push('untagged option count != 1');
      if (!Array.isArray(p.worked) || !p.worked.length) errs.push('no worked solution');
      errs.push(...badValues({ prompt: p.prompt, answer: p.answer, options: p.options, worked: p.worked, check: p.check }));
    } catch (e) {
      errs.push('threw: ' + e.message);
    }
    if (errs.length) { fails++; if (firstErrors.length < 2) firstErrors.push(`seed ${seed}: ${errs[0]}`); }
  }
  totalFail += fails;
  rows.push({ concept: id, chapter: CONCEPT_CHAPTER[id], seeds: SEEDS, result: fails ? `FAIL (${fails})` : 'pass', note: firstErrors.join(' / ') });
}

const w = Math.max(...rows.map((r) => r.concept.length));
console.log(`${'concept'.padEnd(w)}  chapter      seeds  result`);
console.log('-'.repeat(w + 30));
for (const r of rows) {
  console.log(`${r.concept.padEnd(w)}  ${String(r.chapter).padEnd(11)}  ${String(r.seeds).padStart(5)}  ${r.result}`);
  if (r.note) console.log('    ' + r.note);
}
console.log('-'.repeat(w + 30));
console.log(`${rows.length} generators, ${rows.length * SEEDS} problems, ${totalFail} failing`);
process.exit(totalFail ? 1 : 0);
