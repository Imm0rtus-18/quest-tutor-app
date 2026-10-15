// The boss battle arena's static layout — single source of truth shared
// by battle.js (rendering/collision) and
// scripts/test-battle-reachability.js (the Node reachability proof), so
// the test can never silently drift out of sync with what the game
// actually uses. Platform heights below were derived from
// battle-physics.js's simulated jump arc, not picked by eye — see that
// test script for the numbers.
(function (root) {
  'use strict';

  const GROUND_Y = 160;

  // Each hop (ground -> platform A, platform A -> platform B) is a 26px
  // rise. The simulated max standing-jump rise is ~38.3px, so 26px
  // leaves about 47% headroom — comfortably past the required 20%
  // margin. Platform B is shifted only 15px right of platform A's
  // start, well inside the ~7px-at-that-rise-but-34.5px-at-full-arc
  // horizontal travel the jump simulation shows is available by the
  // time a jump has risen 26px (see test-battle-reachability.js).
  const SURFACES = [
    { x: 0, y: GROUND_Y, w: 320, h: 20, kind: 'ground' },
    { x: 40, y: 134, w: 72, h: 8, kind: 'platform' },
    { x: 55, y: 108, w: 72, h: 8, kind: 'platform' }
  ];
  const ORB_SURFACES = SURFACES.filter(s => s.kind === 'platform');
  const BOSS_POS = { x: 266, y: GROUND_Y - 40, w: 36, h: 40 };
  const PLAYER_START = { x: 24, y: GROUND_Y - 16 };

  const ARENA = { GROUND_Y, SURFACES, ORB_SURFACES, BOSS_POS, PLAYER_START };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ARENA;
  } else {
    root.BattleArena = ARENA;
  }
})(typeof window !== 'undefined' ? window : this);
