// Boss attack-phase data — pure, no DOM, dual-environment (browser +
// Node) like battle-physics.js/battle-arena.js, specifically so the
// minimum spacing between projectiles a player must dodge the SAME way
// (two "jump over this" threats back to back) can be verified in Node
// against the real simulated jump airtime, instead of picked by eye.
// See scripts/test-battle-reachability.js for the check.
(function (root) {
  'use strict';

  // HP thresholds -> attack pattern. 10-7: single shots. 6-4: adds
  // double shots (two same-height projectiles back to back). 3-1: adds
  // an alternating low/high/low arc volley at a slightly faster rate.
  const PHASES = [
    { name: 'single', minHp: 7 },
    { name: 'double', minHp: 4 },
    { name: 'arc', minHp: 0 }
  ];

  function phaseForHp(hp) {
    for (const p of PHASES) if (hp >= p.minHp) return p.name;
    return PHASES[PHASES.length - 1].name;
  }

  // Wind-up before any projectile actually fires — the boss shows its
  // attack frame and (for a low one) a ground warning marker for this
  // long first, so every attack is telegraphed, never a surprise.
  const WINDUP_MS = 400;

  // Interval between whole attacks (randomized within this range),
  // narrowing slightly in the faster later phases.
  const ATTACK_INTERVAL_MS = { single: [1200, 2000], double: [1100, 1800], arc: [900, 1500] };

  // Spacing, in ms, between two projectiles of the SAME dodge type (both
  // "jump over this") within a multi-shot pattern — this is the real
  // "can the player actually get out of the way twice in a row" number,
  // not the raw inter-shot timer. A sub-interval of 250ms between each
  // shot in a pattern, with low/high alternating in the arc volley so
  // consecutive low (jump-required) shots are 2 sub-intervals apart,
  // gives these values.
  const SUB_INTERVAL_MS = 250;
  const SAME_TYPE_SPACING_MS = { single: Infinity, double: SUB_INTERVAL_MS * 2, arc: SUB_INTERVAL_MS * 2 };

  // How much longer than a bare jump airtime the same-type spacing must
  // be, so a real dodge has margin, not a frame-perfect requirement.
  const SAFETY_MARGIN = 0.15;

  function minSafeSpacingMs(jumpAirtimeMs) {
    return jumpAirtimeMs * (1 + SAFETY_MARGIN);
  }

  // Is this pattern's same-type spacing safe given the real simulated
  // jump airtime? (Infinity, for 'single', is always safe — there's
  // only ever one projectile in flight from that pattern at a time.)
  function isPatternSafe(patternName, jumpAirtimeMs) {
    const spacing = SAME_TYPE_SPACING_MS[patternName];
    if (!Number.isFinite(spacing)) return true;
    return spacing >= minSafeSpacingMs(jumpAirtimeMs);
  }

  const BattleAttacks = {
    PHASES, phaseForHp, WINDUP_MS, ATTACK_INTERVAL_MS,
    SUB_INTERVAL_MS, SAME_TYPE_SPACING_MS, SAFETY_MARGIN,
    minSafeSpacingMs, isPatternSafe
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BattleAttacks;
  else root.BattleAttacks = BattleAttacks;
})(typeof window !== 'undefined' ? window : this);
