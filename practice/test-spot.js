// Spot-the-mistake tests: 300 seeds per template, every puzzle re-checked
// here with the Stage B step checker. No network, no database.
//   node practice/test-spot.js
const { generatePuzzle, explain, TEMPLATES, stats } = require('./spot');
const { checkStep, isolatedValue } = require('./checker');

const SEEDS = 300;
const rows = [];
let totalFail = 0;

for (const id of Object.keys(TEMPLATES)) {
  let fails = 0, noError = 0;
  const types = {};
  const firstErrors = [];
  for (let seed = 0; seed < SEEDS; seed++) {
    const errs = [];
    try {
      const p = generatePuzzle(id, seed);
      if (JSON.stringify(p) !== JSON.stringify(generatePuzzle(id, seed))) errs.push('not deterministic');
      if (p.lines.length < 5 || p.lines.length > 7) errs.push('length ' + p.lines.length);
      for (let i = 1; i < p.lines.length; i++) {
        const got = checkStep(p.lines[i - 1], p.lines[i]).result;
        const want = p.errorIndex === i ? 'not_equivalent' : 'equivalent';
        if (got !== want) errs.push(`transition ${i}: ${got}, wanted ${want} ("${p.lines[i - 1]}" -> "${p.lines[i]}")`);
      }
      if (p.errorIndex === null) {
        noError++;
        if (p.errorType !== null || p.correctLine !== null) errs.push('no-error puzzle has error fields');
      } else {
        types[p.errorType] = (types[p.errorType] || 0) + 1;
        if (p.errorIndex < 1) errs.push('error on the first line');
        // The correct line really is a valid step from the line before.
        if (checkStep(p.lines[p.errorIndex - 1], p.correctLine).result !== 'equivalent') errs.push('correctLine is not a valid step');
        const final = isolatedValue(p.lines[p.lines.length - 1]);
        const truth = isolatedValue(p.correctLines[p.correctLines.length - 1]);
        if (!final || !truth || final.eq(truth)) errs.push('final answer not wrong');
      }
      const ex = explain(p);
      if (!ex || /undefined|null|NaN/.test(ex)) errs.push('bad explanation: ' + ex);
      if (p.lines.some((l) => /undefined|NaN|-0(?![0-9./])/.test(l))) errs.push('bad text in lines');
    } catch (e) {
      errs.push('threw: ' + e.message);
    }
    if (errs.length) { fails++; if (firstErrors.length < 2) firstErrors.push(`seed ${seed}: ${errs[0]}`); }
  }
  totalFail += fails;
  rows.push({ id, fails, noError, types, note: firstErrors.join(' / ') });
}

const w = Math.max(...rows.map((r) => r.id.length));
console.log(`${'template'.padEnd(w)}  seeds  no-error  error types                                                                   result`);
console.log('-'.repeat(w + 90));
for (const r of rows) {
  const t = Object.entries(r.types).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`${r.id.padEnd(w)}  ${String(SEEDS).padStart(5)}  ${String(r.noError).padStart(8)}  ${t.padEnd(78)}${r.fails ? `FAIL (${r.fails})` : 'pass'}`);
  if (r.note) console.log('    ' + r.note);
}
console.log('-'.repeat(w + 90));
const rate = stats.built ? ((100 * stats.rejected) / stats.built).toFixed(1) : '0';
console.log(`Candidates built ${stats.built}, rejected ${stats.rejected} (${rate}%)`);
for (const [reason, n] of Object.entries(stats.reasons)) console.log(`  rejected: ${reason} x${n}`);
console.log(`${rows.length} templates, ${rows.length * SEEDS} puzzles, ${totalFail} failing`);
process.exit(totalFail ? 1 : 0);
