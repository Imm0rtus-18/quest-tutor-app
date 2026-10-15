// Standalone test for graph-tools.js — no network, no database. Run with:
//   node scripts/test-graph-tools.js
const assert = require('assert');
const { validatePlotOnGraphArgs } = require('../graph-tools');

// Valid call passes through cleanly.
assert.deepStrictEqual(
  validatePlotOnGraphArgs({ expressions: [{ latex: 'y=x^2', color: 'blue' }], replace: true }),
  { expressions: [{ latex: 'y=x^2', color: 'BLUE' }], bounds: undefined, replace: true }
);
console.log('PASS: valid call with color passes through, color normalized to uppercase');

// More than 6 expressions gets capped at 6.
const many = Array.from({ length: 10 }, (_, i) => ({ latex: `y=${i}x` }));
assert.strictEqual(validatePlotOnGraphArgs({ expressions: many }).expressions.length, 6);
console.log('PASS: expressions capped at 6');

// latex over 200 chars gets truncated.
const long = validatePlotOnGraphArgs({ expressions: [{ latex: 'y='.padEnd(250, '1') }] });
assert.strictEqual(long.expressions[0].latex.length, 200);
console.log('PASS: latex truncated to 200 chars');

// Control characters are stripped.
const withControl = validatePlotOnGraphArgs({ expressions: [{ latex: 'y=x\x00\x1F^2' }] });
assert.strictEqual(withControl.expressions[0].latex, 'y=x^2');
console.log('PASS: control characters stripped from latex');

// Invalid color name is dropped (not passed through as garbage).
const badColor = validatePlotOnGraphArgs({ expressions: [{ latex: 'y=x', color: 'rainbow' }] });
assert.strictEqual(badColor.expressions[0].color, undefined);
console.log('PASS: invalid color name silently dropped');

// Non-string latex items are skipped, not thrown.
const mixed = validatePlotOnGraphArgs({ expressions: [{ latex: 123 }, { latex: 'y=x' }, 'not an object'] });
assert.strictEqual(mixed.expressions.length, 1);
console.log('PASS: non-string/malformed expression items are skipped without throwing');

// No usable expressions at all -> null.
assert.strictEqual(validatePlotOnGraphArgs({ expressions: [] }), null);
assert.strictEqual(validatePlotOnGraphArgs({ expressions: [{ latex: '' }] }), null);
assert.strictEqual(validatePlotOnGraphArgs({}), null);
assert.strictEqual(validatePlotOnGraphArgs(null), null);
console.log('PASS: empty/missing expressions returns null');

// Bounds: valid bounds pass through; inverted/non-numeric/out-of-range
// bounds are dropped (undefined) rather than applied.
const validBounds = validatePlotOnGraphArgs({ expressions: [{ latex: 'y=x' }], bounds: { xmin: -5, xmax: 5, ymin: -5, ymax: 5 } });
assert.deepStrictEqual(validBounds.bounds, { xmin: -5, xmax: 5, ymin: -5, ymax: 5 });
console.log('PASS: valid bounds pass through');

const invertedBounds = validatePlotOnGraphArgs({ expressions: [{ latex: 'y=x' }], bounds: { xmin: 5, xmax: -5, ymin: -5, ymax: 5 } });
assert.strictEqual(invertedBounds.bounds, undefined);
console.log('PASS: inverted bounds (xmin > xmax) dropped');

const nanBounds = validatePlotOnGraphArgs({ expressions: [{ latex: 'y=x' }], bounds: { xmin: 'nope', xmax: 5, ymin: -5, ymax: 5 } });
assert.strictEqual(nanBounds.bounds, undefined);
console.log('PASS: non-numeric bounds dropped');

const clampedBounds = validatePlotOnGraphArgs({ expressions: [{ latex: 'y=x' }], bounds: { xmin: -5000, xmax: 5000, ymin: -5, ymax: 5 } });
assert.deepStrictEqual(clampedBounds.bounds, { xmin: -1000, xmax: 1000, ymin: -5, ymax: 5 });
console.log('PASS: out-of-range bounds clamped to +/-1000');

console.log('\nAll graph-tools.js tests passed.');
