// Original teaching content, written for this app (not derived from or
// paraphrasing any specific textbook). Chapter titles and ordering follow
// the standard Algebra 1 course sequence used across many textbooks
// (titles/ordering are not protected expression). Only algebra1 is
// populated so far — geometry/algebra2/precalc are left out until their
// own content passes are done.
const CURRICULUM = {
  algebra1: [
    {
      id: 'algebra1-01',
      title: 'Connections to Algebra',
      objective: 'Introduce variables and algebraic expressions, and use the order of operations to evaluate them correctly.',
      content: `Algebra starts from a simple idea: instead of always working with specific numbers, we use letters — called variables — to stand in for numbers we don't know yet or that can change. An expression like 3x + 2 is just a set of instructions: take a number, multiply it by 3, then add 2. Once you know what x is, you can evaluate the expression by plugging that value in and following the instructions in order.

That "in order" part matters. When an expression has more than one operation, everyone needs to follow the same order so we all get the same answer. That order is: parentheses first, then exponents, then multiplication and division (left to right), then addition and subtraction (left to right). This is often remembered as PEMDAS.

Algebra is also a translation tool. Word phrases turn into expressions once you know what each phrase means mathematically: "the sum of" means addition, "less than" means subtraction (written in reverse order), "the product of" means multiplication, and "a number" almost always becomes a variable like x or n.

Example 1: Evaluate 3x + 2 when x = 5.
Substitute: 3(5) + 2. Multiply first: 15 + 2. Add: 17.

Example 2: Translate "five less than twice a number n" into an expression.
"Twice a number n" is 2n. "Five less than" that means we subtract 5 from it — and because "less than" reverses the order, the expression is 2n - 5, not 5 - 2n.`
    },
    {
      id: 'algebra1-02',
      title: 'Properties of Real Numbers',
      objective: 'Work confidently with signed numbers on the number line and use the properties of real numbers to rewrite expressions.',
      content: `Real numbers live on the number line, stretching in both directions from zero. Every number has an absolute value — its distance from zero, always written as a non-negative number, like |-4| = 4. Adding and subtracting signed numbers can be pictured as movement along that line: adding a positive number moves right, adding a negative number (or subtracting a positive one) moves left.

A few properties describe how numbers behave no matter which numbers you plug in, and they're the reason certain algebra "moves" are always legal:
- Commutative property: a + b = b + a, and a * b = b * a — order doesn't matter for addition or multiplication.
- Associative property: how you group three or more terms with addition or multiplication doesn't change the result, e.g. (a + b) + c = a + (b + c).
- Distributive property: a(b + c) = ab + ac. This is the one you'll use constantly — it lets you multiply a single term across a sum inside parentheses.
- Identity and inverse properties: adding 0 or multiplying by 1 changes nothing, and every number has an opposite (adds to 0) and, if nonzero, a reciprocal (multiplies to 1).

Example 1: Use the distributive property to expand 4(x + 3).
Multiply 4 by each term inside the parentheses: 4(x) + 4(3) = 4x + 12.

Example 2: Simplify -3 + 7 - (-2).
Subtracting a negative is the same as adding its opposite, so this becomes -3 + 7 + 2. Adding left to right: -3 + 7 = 4, then 4 + 2 = 6.`
    },
    {
      id: 'algebra1-03',
      title: 'Solving Linear Equations',
      objective: 'Solve one-variable linear equations by using inverse operations to isolate the variable while keeping both sides equal.',
      content: `An equation is a statement that two expressions are equal, like a balance scale that has to stay level. Whatever you do to one side, you must do to the other, or the scale tips and the equation is no longer true. Solving an equation means using inverse operations — the operation that undoes another one — to get the variable alone on one side.

The two rules that make this possible: the addition/subtraction property of equality (you can add or subtract the same amount from both sides) and the multiplication/division property of equality (you can multiply or divide both sides by the same nonzero number). For multi-step equations, a reliable order is: distribute first if needed, combine like terms on each side, move variable terms to one side and number terms to the other, then divide to isolate the variable.

Example 1: Solve 2x + 5 = 17.
Subtract 5 from both sides: 2x = 12. Divide both sides by 2: x = 6.

Example 2: Solve 3(x - 2) = 2x + 4.
Distribute the 3: 3x - 6 = 2x + 4. Subtract 2x from both sides: x - 6 = 4. Add 6 to both sides: x = 10. Check by substituting back in: 3(10 - 2) = 3(8) = 24, and 2(10) + 4 = 24 — both sides match.`
    },
    {
      id: 'algebra1-04',
      title: 'Graphing Linear Equations and Functions',
      objective: 'Plot points on the coordinate plane and graph linear equations using intercepts or slope-intercept form.',
      content: `The coordinate plane is formed by a horizontal x-axis and a vertical y-axis crossing at the origin, (0, 0). Every point is described by an ordered pair (x, y) telling you how far to move horizontally and vertically from the origin.

A linear equation's graph is always a straight line. Two useful features of a line are its intercepts — where it crosses the x-axis (set y = 0 and solve for x) and where it crosses the y-axis (set x = 0 and solve for y) — and its slope, which measures steepness as "rise over run": the change in y divided by the change in x between any two points on the line. A positive slope rises left to right; a negative slope falls.

Many linear equations are easiest to graph once written in slope-intercept form, y = mx + b, where m is the slope and b is the y-intercept. Starting from the point (0, b), you can use the slope to count out rise and run to plot a second point, then draw the line through both.

Example 1: Graph y = 2x - 1 using intercepts.
Set y = 0: 0 = 2x - 1, so x = 1/2 — the x-intercept is (0.5, 0). Set x = 0: y = -1 — the y-intercept is (0, -1). Plot both points and draw the line through them.

Example 2: Find the slope of the line through (1, 2) and (4, 11).
Slope = (change in y) / (change in x) = (11 - 2) / (4 - 1) = 9/3 = 3.`
    },
    {
      id: 'algebra1-05',
      title: 'Writing Linear Equations',
      objective: 'Write the equation of a line from its slope and a point, or from two points, using slope-intercept and point-slope forms.',
      content: `Once you know a line's slope and one point it passes through, you can write its full equation without graphing it. Point-slope form does this directly: y - y1 = m(x - x1), where m is the slope and (x1, y1) is the known point. From there, you can rearrange into the more familiar slope-intercept form, y = mx + b, if you want b explicitly.

If you're given two points instead of a slope, find the slope first using the slope formula (change in y over change in x), then use point-slope form with either of the two points — both will give the same final equation.

Two special relationships are worth knowing: parallel lines always have the same slope, and perpendicular lines have slopes that are negative reciprocals of each other (their product is -1).

Example 1: Write the equation of the line through (2, 3) with slope -2.
Point-slope form: y - 3 = -2(x - 2). Distribute: y - 3 = -2x + 4. Add 3 to both sides: y = -2x + 7.

Example 2: Write the equation of the line through (1, 4) and (3, 10).
Slope = (10 - 4) / (3 - 1) = 6/2 = 3. Using point-slope form with (1, 4): y - 4 = 3(x - 1), which simplifies to y = 3x + 1.`
    },
    {
      id: 'algebra1-06',
      title: 'Solving and Graphing Linear Inequalities',
      objective: 'Solve one-variable inequalities, correctly flipping the inequality sign when needed, and represent solutions graphically.',
      content: `Inequalities compare two expressions using <, >, ≤, or ≥ instead of an equals sign, and they're solved almost exactly like equations — with one crucial exception: multiplying or dividing both sides by a negative number flips the direction of the inequality sign. This happens because multiplying by a negative reverses the order of numbers on the number line.

A solution to a one-variable inequality is usually a whole range of numbers, not just one. That range can be shown on a number line: an open circle means the endpoint is not included (used with < or >), and a filled-in circle means it is included (used with ≤ or ≥), with shading showing every value that makes the inequality true.

Inequalities with two variables, like y > x + 2, describe a whole region of the coordinate plane rather than just a line. You graph the boundary line first — dashed for strict inequalities (< or >), solid for ≤ or ≥ — then shade the side of the line where the inequality holds.

Example 1: Solve -3x + 4 > 16.
Subtract 4 from both sides: -3x > 12. Divide both sides by -3, flipping the inequality: x < -4.

Example 2: Graph y ≤ x + 2.
Draw the line y = x + 2 as a solid line (since ≤ includes equality), then shade the region below it, since y-values there are less than or equal to x + 2.`
    },
    {
      id: 'algebra1-07',
      title: 'Systems of Linear Equations and Inequalities',
      objective: 'Solve systems of two linear equations using substitution and elimination, and interpret the solution as an intersection point.',
      content: `A system of equations is just two (or more) equations considered together. The solution to a system of two lines is the point (x, y) that makes both equations true at once — graphically, that's exactly where the two lines cross. A system can have one solution (lines cross once), no solution (lines are parallel and never meet), or infinitely many solutions (the two equations describe the same line).

Two algebraic methods find that intersection point without graphing. Substitution solves one equation for one variable, then substitutes that expression into the other equation. Elimination adds or subtracts the two equations (after matching up coefficients, if needed) so that one variable cancels out entirely, leaving a single-variable equation to solve.

Systems of inequalities work the same way conceptually: the solution is the region where the shaded areas of both inequalities overlap.

Example 1: Solve by substitution: y = x + 1 and 2x + y = 7.
Substitute the first equation into the second: 2x + (x + 1) = 7, so 3x + 1 = 7, giving 3x = 6 and x = 2. Then y = x + 1 = 3. The solution is (2, 3).

Example 2: Solve by elimination: x + y = 10 and x - y = 2.
Adding the two equations cancels y: 2x = 12, so x = 6. Substituting back into x + y = 10 gives y = 4. The solution is (6, 4).`
    },
    {
      id: 'algebra1-08',
      title: 'Exponents and Exponential Functions',
      objective: 'Apply the laws of exponents to simplify expressions and understand how exponential functions model growth and decay.',
      content: `Exponents are repeated multiplication: x^3 means x * x * x. A handful of rules let you simplify expressions with exponents without expanding them out. When multiplying powers with the same base, add the exponents: x^a * x^b = x^(a+b). When dividing, subtract them: x^a / x^b = x^(a-b). When raising a power to another power, multiply the exponents: (x^a)^b = x^(ab). Any nonzero number raised to the 0 power equals 1, and a negative exponent means "take the reciprocal," e.g. x^-2 = 1/x^2.

Exponential functions have the form y = a * b^x, where a is the starting value and b is the growth or decay factor applied repeatedly. When b is greater than 1, the function models growth (values increase faster and faster); when b is between 0 and 1, it models decay (values shrink toward zero). This is different from a linear function, which changes by the same fixed amount each step — an exponential function changes by the same fixed factor each step.

Example 1: Simplify 2^3 * 2^4.
Same base, so add the exponents: 2^(3+4) = 2^7 = 128.

Example 2: A town's population is modeled by P = 1000(1.05)^t, where t is years from now. Estimate the population after 3 years.
Substitute t = 3: P = 1000(1.05)^3 = 1000(1.157625) ≈ 1158 people.`
    },
    {
      id: 'algebra1-09',
      title: 'Quadratic Equations and Functions',
      objective: 'Solve quadratic equations by factoring and by the quadratic formula, and connect solutions to the graph of a parabola.',
      content: `A quadratic equation has the standard form ax^2 + bx + c = 0, where a is not zero. Its graph is a parabola — a symmetric U-shape that opens upward if a is positive and downward if a is negative. The solutions to the equation (also called roots or zeros) are the x-values where the parabola crosses the x-axis.

One way to solve a quadratic is factoring: rewrite ax^2 + bx + c as a product of two binomials, then use the fact that if two factors multiply to zero, at least one of them must be zero. Not every quadratic factors nicely with whole numbers, though, so the quadratic formula works for any quadratic: x = (-b ± √(b^2 - 4ac)) / (2a). The expression under the square root, b^2 - 4ac, is called the discriminant, and it tells you how many real solutions exist before you even finish solving.

Example 1: Solve x^2 - 5x + 6 = 0 by factoring.
Find two numbers that multiply to 6 and add to -5: those are -2 and -3. So x^2 - 5x + 6 = (x - 2)(x - 3) = 0, giving x = 2 or x = 3.

Example 2: Solve 2x^2 + 3x - 2 = 0 using the quadratic formula.
Here a = 2, b = 3, c = -2. x = (-3 ± √(9 - 4(2)(-2))) / (2(2)) = (-3 ± √25) / 4 = (-3 ± 5) / 4. That gives x = 2/4 = 1/2 or x = -8/4 = -2.`
    },
    {
      id: 'algebra1-10',
      title: 'Polynomials and Factoring',
      objective: 'Add, subtract, and multiply polynomials, and factor them back into simpler expressions using common patterns.',
      content: `A polynomial is an expression built from terms with whole-number exponents, like 3x^2 + 2x - 5. Terms with the exact same variable part are "like terms" and can be combined by adding or subtracting their coefficients — this is how you add or subtract polynomials.

Multiplying polynomials uses the distributive property repeatedly: every term in the first polynomial multiplies every term in the second. For two binomials, this is often organized with FOIL (First, Outer, Inner, Last) as a way to make sure no pair of terms is missed.

Factoring is multiplication in reverse — rewriting a polynomial as a product of simpler polynomials. The first step is always to look for a greatest common factor (GCF) shared by every term. For trinomials like x^2 + bx + c, look for two numbers that multiply to c and add to b. A few patterns are worth recognizing on sight, especially the difference of squares: a^2 - b^2 = (a - b)(a + b).

Example 1: Multiply (x + 3)(x - 5) using FOIL.
First: x * x = x^2. Outer: x * -5 = -5x. Inner: 3 * x = 3x. Last: 3 * -5 = -15. Combine: x^2 - 5x + 3x - 15 = x^2 - 2x - 15.

Example 2: Factor x^2 - 9.
This matches the difference of squares pattern, with a = x and b = 3: x^2 - 9 = (x - 3)(x + 3).`
    },
    {
      id: 'algebra1-11',
      title: 'Rational Expressions and Equations',
      objective: 'Simplify rational expressions by factoring, and solve rational equations by clearing denominators.',
      content: `A rational expression is a fraction where the numerator and/or denominator are polynomials, like (x^2 - 4)/(x + 2). Simplifying one works the same way as simplifying a numeric fraction: factor the numerator and denominator completely, then cancel any factors they share. One extra thing to track with rational expressions is domain restrictions — any value of the variable that would make the original denominator zero has to be excluded, even after simplifying.

Multiplying and dividing rational expressions works like multiplying and dividing numeric fractions (to divide, multiply by the reciprocal of the second expression), just with polynomial factoring involved first. Adding and subtracting requires a common denominator, exactly as with numeric fractions.

A rational equation is an equation containing at least one rational expression. The most reliable way to solve one is to multiply every term by the least common denominator (LCD) of all the fractions involved — this clears the denominators and turns the equation into a regular polynomial equation to solve. Any solution should be checked against the domain restrictions, since it's possible to end up with a value that isn't actually allowed.

Example 1: Simplify (x^2 - 4)/(x + 2).
Factor the numerator as a difference of squares: (x - 2)(x + 2)/(x + 2). Cancel the shared factor (x + 2), assuming x ≠ -2: the simplified expression is x - 2.

Example 2: Solve 3/x = 6/(x + 1).
Cross-multiply: 3(x + 1) = 6x. Distribute: 3x + 3 = 6x. Subtract 3x from both sides: 3 = 3x, so x = 1. Checking: 3/1 = 3 and 6/2 = 3 — both sides match, and x = 1 doesn't violate any domain restriction.`
    },
    {
      id: 'algebra1-12',
      title: 'Radicals and More Connections to Geometry',
      objective: 'Simplify radical expressions and apply the Pythagorean theorem to find missing side lengths and distances.',
      content: `A radical expression involves a root, most commonly a square root, like √72. To simplify a square root, look for the largest perfect-square factor of the number inside and pull its root out front: √72 = √(36 * 2) = √36 * √2 = 6√2. Radicals can only be combined by addition or subtraction if they have the exact same expression under the root (like terms for radicals); multiplying radicals is done by multiplying what's under the roots together: √a * √b = √(ab).

This connects directly to geometry through the Pythagorean theorem, which relates the three sides of any right triangle: a^2 + b^2 = c^2, where a and b are the two legs and c is the hypotenuse (the side opposite the right angle, and always the longest side). Solving for a missing side usually leaves you with a square root to simplify, using exactly the technique above.

The Pythagorean theorem also underlies the distance formula, which finds the straight-line distance between two points (x1, y1) and (x2, y2) on the coordinate plane by treating the horizontal and vertical separations as the legs of a right triangle: distance = √((x2 - x1)^2 + (y2 - y1)^2).

Example 1: Simplify √72.
72 = 36 * 2, and 36 is a perfect square. So √72 = √36 * √2 = 6√2.

Example 2: A right triangle has legs of length 6 and 8. Find the hypotenuse.
Using a^2 + b^2 = c^2: 6^2 + 8^2 = 36 + 64 = 100. So c = √100 = 10.`
    }
  ]
  // geometry, algebra2, precalc: intentionally left out for now.
};

module.exports = { CURRICULUM };
