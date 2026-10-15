// Proves (1) every platform (and therefore every orb spawn point — orbs
// only ever spawn on a platform surface) is reachable from the surface
// below it with at least a 20% jump-capability margin, and (2) every
// attack pattern's same-dodge-type projectile spacing leaves enough time
// for a full jump, with margin — using the exact same physics step
// function, arena layout, and attack-pattern data the real game uses,
// not numbers picked by eye. Run with:
//   node scripts/test-battle-reachability.js
const physics = require('../public/battle-physics.js');
const arena = require('../public/battle-arena.js');
const attacks = require('../public/battle-attacks.js');

const MARGIN = 0.2;
let allPassed = true;

console.log('=== Physics constants ===');
console.log(physics.CONST);

const maxRise = physics.maxJumpRise();
const airtime = physics.jumpAirtimeMs();
const traj = physics.simulateJumpTrajectory();
console.log('\n=== Simulated standing jump (held, moving at full speed) ===');
console.log('max jump height (rise):', maxRise.toFixed(2), 'px');
console.log('jump airtime (takeoff to landing at same height):', airtime.toFixed(1), 'ms');
console.log('max horizontal distance over the full jump:', traj[traj.length - 1].x.toFixed(2), 'px');
console.log('usable rise with 20% margin (maxRise / 1.2):', (maxRise / (1 + MARGIN)).toFixed(2), 'px');

function check(label, from, to) {
  const r = physics.canReachPlatform(from.x, from.w, from.y, to.x, to.w, to.y, MARGIN);
  const marginPct = r.riseNeeded > 0 ? ((r.maxRise / r.riseNeeded - 1) * 100).toFixed(1) + '%' : 'n/a (no rise needed)';
  console.log(
    `\n${label}: riseNeeded=${r.riseNeeded.toFixed(1)}px, maxRise=${r.maxRise.toFixed(1)}px, ` +
    `margin=${marginPct}, horizontalGap=${r.horizontalGapNeeded.toFixed(1)}px, ` +
    `horizontalAvailableAtThatHeight=${r.horizontalAvailable.toFixed(1)}px -> ${r.reachable ? 'REACHABLE' : 'NOT REACHABLE'}`
  );
  if (!r.reachable) allPassed = false;
}

console.log('\n=== Arena layout ===');
console.log(arena.SURFACES);

console.log('\n=== Reachability checks ===');
const ground = arena.SURFACES.find(s => s.kind === 'ground');
const platforms = arena.ORB_SURFACES;

check('ground -> platform A (lower)', ground, platforms[0]);
check('platform A -> platform B (higher)', platforms[0], platforms[1]);
// Every orb spawn point is a platform surface, already checked above —
// but confirm explicitly per the spec's wording, deriving spawn point
// from the exact same (x + w/2, y) orb spawn uses in battle.js.
platforms.forEach((plat, i) => {
  const spawnX = plat.x + plat.w / 2;
  console.log(`\norb spawn point on platform ${i === 0 ? 'A' : 'B'}: x=${spawnX}, y=${plat.y - 10} — reachable because the platform itself is (checked above).`);
});

console.log('\n=== Projectile spacing checks (same-dodge-type gap vs. jump airtime) ===');
const safeSpacing = attacks.minSafeSpacingMs(airtime);
console.log(`jump airtime=${airtime.toFixed(1)}ms, required safety margin=${(attacks.SAFETY_MARGIN * 100).toFixed(0)}%, minimum safe spacing=${safeSpacing.toFixed(1)}ms`);
Object.keys(attacks.SAME_TYPE_SPACING_MS).forEach(pattern => {
  const spacing = attacks.SAME_TYPE_SPACING_MS[pattern];
  const ok = attacks.isPatternSafe(pattern, airtime);
  const spacingLabel = Number.isFinite(spacing) ? spacing + 'ms' : 'n/a (single shot)';
  const marginPct = Number.isFinite(spacing) ? ((spacing / safeSpacing - 1) * 100).toFixed(1) + '%' : 'n/a';
  console.log(`${pattern}: same-type spacing=${spacingLabel}, margin over minimum=${marginPct} -> ${ok ? 'SAFE' : 'UNSAFE'}`);
  if (!ok) allPassed = false;
});

console.log('\n' + (allPassed ? 'ALL REACHABILITY CHECKS PASSED' : 'REACHABILITY CHECK FAILED'));
process.exit(allPassed ? 0 : 1);
