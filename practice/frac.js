// Exact rational numbers on BigInt — shared by the practice generators,
// the step checker and spot-the-mistake. No floating point anywhere a
// correctness decision is made.

function bigAbs(a) { return a < 0n ? -a : a; }
function bigGcd(a, b) {
  a = bigAbs(a); b = bigAbs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

class Frac {
  constructor(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d === 0n) throw new Error('Division by zero');
    if (d < 0n) { n = -n; d = -d; }
    const g = bigGcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }
  static of(v) {
    if (v instanceof Frac) return v;
    if (typeof v === 'number') {
      if (!Number.isInteger(v)) throw new Error('Frac.of needs an integer number, got ' + v);
      return new Frac(BigInt(v), 1n);
    }
    return new Frac(v, 1n);
  }
  add(o) { o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Frac.of(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
  div(o) { o = Frac.of(o); return new Frac(this.n * o.d, this.d * o.n); }
  neg() { return new Frac(-this.n, this.d); }
  isZero() { return this.n === 0n; }
  isInt() { return this.d === 1n; }
  eq(o) { o = Frac.of(o); return this.n === o.n && this.d === o.d; }
  sign() { return this.n === 0n ? 0 : (this.n < 0n ? -1 : 1); }
  toNumber() { return Number(this.n) / Number(this.d); }
  // Plain ASCII: "-3/4", "5", "0" (never "-0" — BigInt has no negative zero).
  toString() { return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`; }
}

// Parses a student's typed number: "6", "-6", "−6", "3/4", "-3/4", "0.75",
// ".5", "1 1/2", and tolerates a leading "x =" / "y =". Returns a Frac or
// null when it isn't a plain number.
function parseNumberAnswer(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.normalize('NFKC').replace(/[−–—]/g, '-').replace(/⁄|∕/g, '/').trim();
  s = s.replace(/^[a-z]\s*=\s*/i, '').replace(/\s+/g, ' ').trim();
  if (s.length === 0 || s.length > 30) return null;
  let m = s.match(/^([+-]?)(\d+) (\d+)\/(\d+)$/); // mixed number
  if (m) {
    const whole = BigInt(m[2]), num = BigInt(m[3]), den = BigInt(m[4]);
    if (den === 0n) return null;
    const v = new Frac(whole * den + num, den);
    return m[1] === '-' ? v.neg() : v;
  }
  s = s.replace(/ /g, '');
  m = s.match(/^([+-]?)(\d+)\/([+-]?)(\d+)$/);
  if (m) {
    if (BigInt(m[4]) === 0n) return null;
    const neg = (m[1] === '-') !== (m[3] === '-');
    const v = new Frac(BigInt(m[2]), BigInt(m[4]));
    return neg ? v.neg() : v;
  }
  m = s.match(/^([+-]?)(\d*)(?:\.(\d+))?$/);
  if (m && (m[2] || m[3])) {
    const intPart = m[2] || '0';
    const fracPart = m[3] || '';
    const v = new Frac(BigInt(intPart + fracPart), 10n ** BigInt(fracPart.length));
    return m[1] === '-' ? v.neg() : v;
  }
  return null;
}

module.exports = { Frac, bigGcd, parseNumberAnswer };
