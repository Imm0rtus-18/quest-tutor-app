# Algebra 1 Curriculum Audit

**This is an automated triage, not a certification.** It was produced by
scripts and one pass of standards-mapping judgment over the existing
120 Algebra 1 quiz concepts — it has not been reviewed by a math
teacher. Before anything here drives a curriculum change, a math
teacher needs to check the standards mappings (especially anything
marked "low" confidence below) and the handful of findings flagged for
judgment at the end of this document.

Geometry, Algebra 2, and Pre-Calculus are **not** covered by this
audit — their topic lists in `curriculum.js` (`PLACEHOLDER_TOPICS`) are
unaudited placeholders written from general knowledge, not real lesson
content, and auditing them wasn't in scope.

Full machine-readable detail (all 120 concept-level mappings, every
quiz-math verification result) is in `audit.json`. This document is the
readable summary.

## Standards source

Framework: **Common Core State Standards for Mathematics**, High School
Number & Quantity, Algebra, Functions, and Statistics & Probability
domains (113 standards total, fetched from `thecorestandards.org`, not
from memory — see `standards.json`).

License terms (`thecorestandards.org/public-license/`), quoted:

> "copy, publish, distribute, and display the Common Core State
> Standards for purposes that support the Common Core State Standards
> Initiative"

with the required attribution:

> "© Copyright 2010. National Governors Association Center for Best
> Practices and Council of Chief State School Officers. All rights
> reserved."

Because the terms permit reuse with attribution, `standards.json` stores
each standard's code plus an **original one-line paraphrase** (not the
verbatim standard text) alongside that attribution notice. This is more
conservative than the license strictly requires.

## Coverage summary

| | Count | / 120 |
|---|---|---|
| Concepts mapped to ≥1 standard | 89 | 74% |
| Concepts mapped to 0 standards | 31 | 26% |
| — of which: below Algebra 1 level (middle-school prerequisite) | 21 | |
| — of which: out of this audit's domain scope (Geometry) | 10 | |
| Concepts whose mapped standard is an official "+" (above-core) standard | 4 | |

Confidence across all 94 concept→standard links (some concepts map to
more than one standard): **61 high, 30 medium, 5 low**.

27 of the 113 fetched standards have at least one Algebra 1 concept
mapped to them. The other 86 are either explicitly "+" (reserved for
Algebra 2/Precalc/STEM pathways — expected to be uncovered by an
Algebra 1 course), genuinely out of an Algebra 1 course's scope (most
of Number & Quantity's complex numbers and vectors/matrices;
Trigonometric Functions), **or** real gaps — see below.

## Standards → concepts table

Only standards with ≥1 mapped concept are listed. Full per-concept
reasons are in `audit.json`.

| Standard | Domain | Concepts | Confidence (H/M/L) |
|---|---|---|---|
| HSA-REI.B.3 | Reasoning w/ Equations & Inequalities | 13 (one/two/multi-step equations & inequalities, sign-flipping, verifying/testing solutions) | 8/5/0 |
| HSA-REI.B.4 | Reasoning w/ Equations & Inequalities | 8 (factoring, quadratic formula, discriminant, standard form) | 4/2/2 |
| HSA-REI.C.6 | Reasoning w/ Equations & Inequalities | 8 (systems: substitution, elimination, solution types, method choice) | 7/0/1 |
| HSN-RN.A.2 | The Real Number System | 7 (negative exponents, radical simplifying/combining/multiplying) | 0/5/2 |
| HSA-APR.A.1 | Arithmetic w/ Polynomials & Rational Expr. | 5 (adding/subtracting/multiplying polynomials, FOIL, distributing a monomial) | 5/0/0 |
| HSA-SSE.A.2 | Seeing Structure in Expressions | 5 (distributive property, GCF/trinomial/diff-of-squares factoring) | 3/2/0 |
| HSA-APR.D.7 (+) | Arithmetic w/ Polynomials & Rational Expr. | 4 (multiplying/dividing/adding rational expressions) | 4/0/0 |
| HSA-CED.A.1 | Creating Equations | 4 (word-phrase → expression translation) | 0/4/0 |
| HSF-IF.B.4 | Interpreting Functions | 4 (x/y-intercepts, zero slope, slope sign) | 2/2/0 |
| HSF-IF.B.6 | Interpreting Functions | 4 (slope between two points, as average rate of change) | 3/1/0 |
| HSA-APR.D.6 | Arithmetic w/ Polynomials & Rational Expr. | 3 (simplifying rational expressions, domain restrictions) | 3/0/0 |
| HSA-CED.A.2 | Creating Equations | 3 (point-slope / two-point equation writing) | 3/0/0 |
| HSA-REI.A.2 | Reasoning w/ Equations & Inequalities | 3 (solving rational equations, extraneous solutions) | 3/0/0 |
| HSA-REI.C.5 | Reasoning w/ Equations & Inequalities | 3 (elimination's "combine equations" justification) | 1/2/0 |
| HSA-REI.D.12 | Reasoning w/ Equations & Inequalities | 3 (dashed/solid lines, shading, system-of-inequalities regions) | 3/0/0 |
| HSF-LE.B.5 | Linear, Quadratic, & Exponential Models | 3 (interpreting slope/intercept/exponential parameters) | 3/0/0 |
| HSA-REI.A.1 | Reasoning w/ Equations & Inequalities | 2 (addition/multiplication property of equality) | 2/0/0 |
| HSA-REI.D.11 | Reasoning w/ Equations & Inequalities | 2 (graphical meaning of system/quadratic solutions) | 1/1/0 |
| HSA-APR.C.4 | Arithmetic w/ Polynomials & Rational Expr. | 2 (difference-of-squares factoring/recognition) | 2/0/0 |
| HSF-IF.A.2 | Interpreting Functions | 2 (evaluating expressions by substitution) | 0/2/0 |
| HSF-LE.A.1 | Linear, Quadratic, & Exponential Models | 2 (growth vs. decay) | 2/0/0 |
| HSA-REI.D.10 | Reasoning w/ Equations & Inequalities | 1 (point on a line = solution) | 1/0/0 |
| HSA-SSE.B.3 | Seeing Structure in Expressions | 1 (point-slope → slope-intercept conversion) | 0/1/0 |
| HSA-APR.B.3 | Arithmetic w/ Polynomials & Rational Expr. | 1 (factoring toward zeros) | 0/1/0 |
| HSF-IF.C.7 | Interpreting Functions | 1 (parabola direction) | 0/1/0 |
| HSF-LE.A.2 | Linear, Quadratic, & Exponential Models | 1 (applying exponential growth models) | 1/0/0 |
| HSN-CN.C.7 | The Complex Number System | 1 (negative discriminant → forward reference to complex solutions) | 0/1/0 |

## Gaps: Algebra-1-range standards with no concept

22 non-"+" standards in the Algebra/Functions/relevant-Number&Quantity
range have **zero** mapped Algebra 1 concepts:

`HSN-RN.A.1`, `HSN-RN.B.3`, `HSN-Q.A.1`, `HSN-Q.A.2`, `HSN-Q.A.3`,
`HSA-SSE.A.1`, `HSA-SSE.B.4`, `HSA-APR.B.2`, `HSA-CED.A.3`,
`HSA-CED.A.4`, `HSA-REI.C.7`, `HSF-IF.A.1`, `HSF-IF.A.3`,
`HSF-IF.B.5`, `HSF-IF.C.8`, `HSF-IF.C.9`, `HSF-BF.A.1`, `HSF-BF.A.2`,
`HSF-BF.B.3`, `HSF-BF.B.4`, `HSF-LE.A.3`, `HSF-LE.A.4`

The two most actionable patterns in that list:

- **No formal function concept.** `HSF-IF.A.1`–`A.3` (what a function
  is, function notation, sequences-as-functions) and `HSF-BF.A.1`/`A.2`/
  `B.3`/`B.4` (building, transforming, inverting functions) are
  completely absent. Chapter 4 is *titled* "Graphing Linear Equations
  **and Functions**" but its actual content (read directly from
  `curriculum.js`) never introduces `f(x)` notation, domain/range
  terminology, or the definition of a function — it only covers
  intercepts, slope, and slope-intercept form. The function vocabulary
  the title promises isn't actually delivered anywhere in the course.
- **No Statistics & Probability content at all.** Every standard in
  `HSS-ID`, `HSS-IC`, `HSS-CP`, and `HSS-MD` has zero mapped concepts —
  not a gap in one strand, the entire domain is untouched. Whether that
  belongs in *this* course or a separate one is a curriculum-design
  call, not something this audit can settle, but it's worth surfacing
  since Statistics & Probability is one of the four domains your
  manager asked this audit to check against.

`HSA-CED.A.4` (rearranging a formula to isolate a variable) is also
notable: it's a common, simple Algebra 1 skill (e.g. solving `d = rt`
for `t`) that doesn't appear as its own concept anywhere in the 120.

## Possibly off-curriculum / level-mismatch candidates

No concept looks **off-curriculum** in the sense of not belonging in a
math course at all — all 120 are legitimate, well-formed algebra
content. The 31 concepts with no mapped standard split cleanly into two
groups, both of which are normal for a traditional Algebra 1 course:

- **21 are below Algebra 1 / middle-school prerequisites** that CCSS's
  high-school standards assume rather than re-teach: order of
  operations (Ch. 1), signed-number arithmetic and the basic number
  properties (Ch. 2), number-line graphing of a one-variable inequality
  (Ch. 6), and the integer-exponent laws themselves as opposed to their
  *extension* to rational exponents (Ch. 8). These read as intentional
  review/scaffolding at the start of the course, not misplaced content.
- **10 are out of this audit's domain scope, not out of Algebra 1's.**
  Chapter 5's parallel/perpendicular-slope concepts (5 concepts) and
  Chapter 12's Pythagorean-theorem/distance-formula concepts (5
  concepts) are CCSS **Geometry** standards (`G-GPE.B.5`, `G-GPE.B.7`,
  `8.G.B.7`) — outside the Algebra/Functions/Number & Quantity/
  Statistics domains this audit was scoped to. They're commonly folded
  into an Algebra 1 course (this app's chapter titles even say
  "Connections to Geometry"), and nothing here suggests removing them —
  it just means a strict Common-Core-domain audit can't give them an
  Algebra standard, which is itself a sign of how the 2004-textbook
  sequence predates CCSS's stricter domain split.

**Above-level finding:** Chapter 11's `multiplying-rational-expressions`,
`dividing-rational-expressions`, `adding-rational-expressions-same-
denominator`, and `adding-rational-expressions-different-denominators`
all map to `HSA-APR.D.7`, which carries CCSS's official "+" designation
— content intended for students on an advanced/STEM pathway, typically
Algebra 2 rather than a first Algebra 1 course. This is the clearest
single "may not match current standards" finding in the audit, and
matches exactly the kind of mismatch a pre-Common-Core 2004 textbook
sequence would be expected to produce.

## Lesson text vs. mapped standard

Each chapter's lesson content (`curriculum.js`) was read against the
standard(s) its concepts mapped to, looking for factual or framing
conflicts. **None found.** This was a chapter-level read, not a
sentence-by-sentence formal verification, so treat this as "nothing
jumped out," not an exhaustive check.

## Math verification results

Every quiz question's `correctIndex` was checked against an
independently computed answer wherever the question was a numeric or
symbolic identity (evaluating an expression, solving an equation/
inequality/system, factoring, simplifying a radical, the Pythagorean
theorem, etc.) — not by re-reading my own earlier hand-check. The
verification script is `.audit-work/verify_math.js`; full per-question
results are in `audit.json` and `.audit-work/math_verification_results.json`.

| | Count |
|---|---|
| Verified computationally, **matches** `correctIndex` | 89 |
| Verified computationally, **mismatches** `correctIndex` | **0** |
| Not independently computable (conceptual/definitional/graphical — see below) | 31 |

**No mismatches and no ambiguous/multiple-defensible-answer questions**
were found among the 89 directly verified. (The verification script
itself needed several rounds of fixing — mostly a recurring bug where
the quiz text's unicode minus sign `−` wasn't being normalized before
regex matching, which produced several false "mismatches" that turned
out to be bugs in the checker, not the quiz. Every one of those was
traced to its root cause and re-verified before being counted above.)

The 31 not-independently-computable questions are genuinely conceptual
or definitional — naming a property, reading a graph description,
translating a word phrase, or recalling a formula's name — not
arithmetic a script can check. They're listed in the teacher checklist
below since they're exactly the kind of question where a human reviewer
adds the most value.

## Needs a teacher's judgment

- **The 4 "low confidence" standard links**, where the concept is only
  loosely related to the standard it's mapped to:
  `identifying-the-discriminant-formula`, `identifying-standard-form-
  of-a-quadratic` (both → `HSA-REI.B.4`), `choosing-substitution-vs-
  elimination` (→ `HSA-REI.C.6`), `negative-exponent-rule` and
  `evaluating-negative-exponents` (→ `HSN-RN.A.2`).
- **The 4 "above Algebra 1 level" rational-expression concepts** in
  Chapter 11 (listed above) — decide whether to keep them in Algebra 1,
  move them to Algebra 2, or just note the level mismatch and leave
  them, given they're commonly taught in Algebra 1 regardless of CCSS's
  "+" label.
- **The Statistics & Probability gap** — a curriculum-scope decision,
  not a content-quality one.
- **The missing formal-function content** (Chapter 4's title promises
  functions; the lesson text doesn't deliver `f(x)` notation or a
  function definition) — decide whether that's worth adding to Chapter
  4 or is intentionally deferred.
- **The 31 not-independently-computable quiz questions** (full list in
  `audit.json`, flagged `NOT_COMPUTABLE`) — spot-check these by hand;
  they're the ones most likely to have a genuinely debatable "best"
  answer, since a script can't judge phrasing/definitional precision
  the way a teacher can.
- **The 10 Geometry-domain concepts** (Ch. 5 parallel/perpendicular
  slope, Ch. 12 Pythagorean/distance) — confirm there's no appetite to
  either re-home them under a future Geometry audit's standards or
  leave them exactly where they are; nothing here requires a change.
