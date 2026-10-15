// Pure physics constants + step functions for the boss battle — no DOM,
// no canvas, nothing browser-specific, so the exact same code that
// drives the real game can be driven by a Node script to simulate jump
// arcs and verify every platform/orb spawn is actually reachable
// (scripts/test-battle-reachability.js) instead of eyeballing numbers.
// Loaded in the browser via <script src="battle-physics.js">,
// attaching to window.BattlePhysics; required directly in Node.
(function (root) {
  'use strict';

  const CANVAS_W = 320, CANVAS_H = 180;
  const STEP_MS = 1000 / 60;
  const GRAVITY = 0.62;
  const MAX_FALL = 9;
  const MOVE_SPEED = 1.5;
  const JUMP_VELOCITY = -7.2;
  const JUMP_CUT_MULT = 0.45;
  const COYOTE_MS = 100;
  const JUMP_BUFFER_MS = 100;
  const PLAYER_SIZE = 16;
  const GROUND_Y = 160;

  const CONST = {
    CANVAS_W, CANVAS_H, STEP_MS, GRAVITY, MAX_FALL, MOVE_SPEED,
    JUMP_VELOCITY, JUMP_CUT_MULT, COYOTE_MS, JUMP_BUFFER_MS,
    PLAYER_SIZE, GROUND_Y
  };

  // One fixed-timestep physics tick for a single free body (no platform
  // collision — that's handled separately by the caller comparing y
  // against surfaces). Mirrors exactly what battle.js's updatePlayer
  // does to vy/x/y each tick while airborne, so a simulated trajectory
  // here is the same trajectory the real game produces.
  function step(body) {
    body.vy = Math.min(body.vy + GRAVITY, MAX_FALL);
    body.x += body.vx;
    body.y += body.vy;
    return body;
  }

  // Simulates a full standing jump (jump held the whole time — no jump
  // cut — moving horizontally at full speed throughout) from (0,0),
  // y negative = up. Returns every tick until the body returns to y=0
  // while falling (vy >= 0), i.e. lands back at the takeoff height.
  function simulateJumpTrajectory() {
    const points = [{ step: 0, x: 0, y: 0, vy: JUMP_VELOCITY }];
    const body = { x: 0, y: 0, vx: MOVE_SPEED, vy: JUMP_VELOCITY };
    for (let i = 1; i <= 1000; i++) {
      step(body);
      points.push({ step: i, x: body.x, y: body.y, vy: body.vy });
      if (body.y >= 0 && body.vy >= 0) break;
    }
    return points;
  }

  // Maximum rise (positive px) a standing jump reaches above the
  // takeoff height.
  function maxJumpRise() {
    const traj = simulateJumpTrajectory();
    return -Math.min(...traj.map(p => p.y));
  }

  // Total airtime (ms) of a full held jump, start to landing back at
  // the same height.
  function jumpAirtimeMs() {
    const traj = simulateJumpTrajectory();
    return (traj.length - 1) * STEP_MS;
  }

  // Can a jump from a surface at `fromY` reach a target surface at
  // `toY` (both in the same absolute y coordinate system, smaller y =
  // higher up), landing somewhere within [targetX, targetX+targetW],
  // given the player starts the jump anywhere within
  // [fromX, fromX+fromW]? marginPct (e.g. 0.2) requires the rise needed
  // to be comfortably within maxJumpRise, not just barely possible.
  // Returns { reachable, riseNeeded, maxRise, horizontalGapNeeded, horizontalAvailable }.
  function canReachPlatform(fromX, fromW, fromY, targetX, targetW, targetY, marginPct) {
    const riseNeeded = fromY - targetY; // positive if target is above the takeoff surface
    const maxRise = maxJumpRise();
    const riseOk = riseNeeded <= 0 || riseNeeded <= maxRise / (1 + marginPct);

    // Horizontal gap: the closest edge-to-edge distance between the two
    // surfaces' x-ranges (0 or negative if they already overlap).
    const gap = Math.max(fromX - (targetX + targetW), targetX - (fromX + fromW), 0);
    const traj = simulateJumpTrajectory();
    // Horizontal distance covered by the time the trajectory has risen
    // at least riseNeeded (i.e. the earliest moment the jump is high
    // enough to land on the target) — that's the real "can I get there"
    // check, not just total jump distance.
    let horizontalAvailable = 0;
    for (const pt of traj) {
      if (-pt.y >= riseNeeded) { horizontalAvailable = pt.x; break; }
    }
    if (riseNeeded <= 0) horizontalAvailable = traj[traj.length - 1].x; // no rise needed — full jump distance available to drift
    const horizontalOk = gap <= horizontalAvailable / (1 + marginPct);

    return { reachable: riseOk && horizontalOk, riseNeeded, maxRise, horizontalGapNeeded: gap, horizontalAvailable };
  }

  const BattlePhysics = {
    CONST, step, simulateJumpTrajectory, maxJumpRise, jumpAirtimeMs, canReachPlatform
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BattlePhysics;
  } else {
    root.BattlePhysics = BattlePhysics;
  }
})(typeof window !== 'undefined' ? window : this);
