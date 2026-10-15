// Boss fight flavor text + sprite descriptor — one original boss per
// Algebra 1 chapter, keyed to curriculum.js's chapter ids exactly.
// Text/names are original creations for this app, not references to any
// existing game or franchise. `sprite` says which of the 4 original base
// designs (battle-sprites.js: golem/owl/crab/jelly) this boss uses, with
// its own hue (0-359, drives that base's whole palette) and accessory
// (a named prop battle-sprites.js knows how to draw for that base) so
// all 12 look distinct despite sharing a base silhouette. No LLM calls
// during battle: all lines are fixed, instant, zero quota cost.
const BOSSES = {
  'algebra1-01': {
    id: 'algebra1-01',
    name: 'The Order Keeper',
    sprite: { base: 'golem', hue: 28, accessory: 'tablet' },
    taunts: [
      "Parentheses first. ALWAYS parentheses first.",
      "You call that an order of operations?"
    ],
    hitLine: "Hey! You can't just skip steps on me!",
    defeatPlayerLine: "Out of order. Try again, in order this time.",
    defeatedLine: "Fine... you evaluated that... correctly."
  },
  'algebra1-02': {
    id: 'algebra1-02',
    name: 'The Sign Flipper',
    sprite: { base: 'owl', hue: 200, accessory: 'signCoin' },
    taunts: [
      "Negative vibes only down here.",
      "Distribute THIS."
    ],
    hitLine: "Ow — that was a real property, not a fake one!",
    defeatPlayerLine: "Absolute value of that loss: still a loss.",
    defeatedLine: "Alright, alright — the signs are back in your favor."
  },
  'algebra1-03': {
    id: 'algebra1-03',
    name: 'Balance Baron',
    sprite: { base: 'crab', hue: 48, accessory: 'scaleClaws' },
    taunts: [
      "Tip the scale and the whole equation falls!",
      "Isolate THIS, if you can."
    ],
    hitLine: "You kept both sides equal — unfair!",
    defeatPlayerLine: "The scale tips my way. Come back balanced.",
    defeatedLine: "...both sides equal. I have no comeback for that."
  },
  'algebra1-04': {
    id: 'algebra1-04',
    name: 'Rise \'n Run',
    sprite: { base: 'jelly', hue: 150, accessory: 'slopeAntenna' },
    taunts: [
      "Steep enough for you?",
      "Find MY slope. Go on."
    ],
    hitLine: "That's a clean rise over run — right in the intercept!",
    defeatPlayerLine: "Undefined slope. Undefined outcome for you.",
    defeatedLine: "You graphed me... perfectly. Rude."
  },
  'algebra1-05': {
    id: 'algebra1-05',
    name: 'The Perpendicular',
    sprite: { base: 'golem', hue: 265, accessory: 'crossbar' },
    taunts: [
      "Our slopes will NEVER match.",
      "Negative reciprocal. Learn it."
    ],
    hitLine: "A perfect point-slope hit — right through me!",
    defeatPlayerLine: "You and victory? Not even parallel.",
    defeatedLine: "Okay — that line went exactly where you said it would."
  },
  'algebra1-06': {
    id: 'algebra1-06',
    name: 'Shady Character',
    sprite: { base: 'owl', hue: 258, accessory: 'shadeCloak' },
    taunts: [
      "Everything below this line is MINE.",
      "Flip the sign and I get stronger!"
    ],
    hitLine: "You shaded me out of my own region!",
    defeatPlayerLine: "Dashed line, solid loss. That's you.",
    defeatedLine: "Fine. The solution region is... yours."
  },
  'algebra1-07': {
    id: 'algebra1-07',
    name: 'Eliminator X',
    sprite: { base: 'crab', hue: 6, accessory: 'xClaws' },
    taunts: [
      "Two equations, zero chances for you.",
      "Substitute me? I dare you."
    ],
    hitLine: "You eliminated my variable — and my pride!",
    defeatPlayerLine: "No solution for you. Parallel lines, parallel losses.",
    defeatedLine: "One clean intersection point. I respect it."
  },
  'algebra1-08': {
    id: 'algebra1-08',
    name: 'Captain Compound',
    sprite: { base: 'jelly', hue: 320, accessory: 'growthSpikes' },
    taunts: [
      "I grow faster every single turn!",
      "Exponents only get BIGGER down here."
    ],
    hitLine: "You simplified me down to size!",
    defeatPlayerLine: "Exponential decay — that's your score, not mine.",
    defeatedLine: "Growth rate: negative. For me, that is."
  },
  'algebra1-09': {
    id: 'algebra1-09',
    name: 'Parabolt',
    sprite: { base: 'golem', hue: 190, accessory: 'boltCrown' },
    taunts: [
      "I open upward — straight into victory!",
      "Find my roots. I'll wait."
    ],
    hitLine: "Right at the vertex — nice shot!",
    defeatPlayerLine: "Negative discriminant. No real comeback for you.",
    defeatedLine: "Two real roots, both pointing at my defeat."
  },
  'algebra1-10': {
    id: 'algebra1-10',
    name: 'The Foilguard',
    sprite: { base: 'owl', hue: 95, accessory: 'foilShield' },
    taunts: [
      "First, Outer, Inner, Last — all of them beat you!",
      "Try to factor THIS mess."
    ],
    hitLine: "You factored me clean in half!",
    defeatPlayerLine: "GCF of your effort and victory: one. Not enough.",
    defeatedLine: "...difference of squares. You got me."
  },
  'algebra1-11': {
    id: 'algebra1-11',
    name: 'The Canceller',
    sprite: { base: 'crab', hue: 170, accessory: 'cancelMark' },
    taunts: [
      "Cross-multiply if you dare!",
      "Watch your domain — or don't."
    ],
    hitLine: "Cancelled a common factor right off me!",
    defeatPlayerLine: "Undefined. Just like your chances.",
    defeatedLine: "You checked the domain AND got the answer. Showoff."
  },
  'algebra1-12': {
    id: 'algebra1-12',
    name: 'Hypotenu-Sir',
    sprite: { base: 'jelly', hue: 42, accessory: 'triangleCrown' },
    taunts: [
      "a-squared plus b-squared equals MY WIN.",
      "Simplify that radical if you can!"
    ],
    hitLine: "Straight down the hypotenuse — ouch!",
    defeatPlayerLine: "Distance formula says: you didn't make it.",
    defeatedLine: "Fine. c really does equal the square root of that."
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BOSSES };
}
