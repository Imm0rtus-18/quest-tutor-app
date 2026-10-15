// Original pixel-art sprite engine for the boss battle. Everything here
// is hand-authored rect/cell data for this app — 4 original creature
// bases (a stacked-stone math-block golem, a clockwork owl, a crystal
// crab, a storm-cloud jelly), each chapter boss getting its own hue and
// accessory from bosses.js so all 12 read as distinct despite sharing a
// base silhouette. Nothing here is drawn from or intended to resemble
// any existing game or franchise character.
//
// Every sprite is pre-rendered ONCE to an offscreen canvas (buildAll()),
// then the battle loop only ever drawImage()s those — no per-frame
// shape math, no per-frame allocation.
//
// Public API: window.BattleSprites.buildAll() -> {
//   boss(bossSprite) -> { idle:[c0,c1], attack:c, hurt:c, defeated:c },
//   nova -> { idle:[c0,c1], run:[c0..c2], jump:c, fall:c, hurt:c },
//   glyph(name, variant) -> c,   // variant: 'rolling' | 'flying'
//   orb:c, shot:c
// }
(function (root) {
  'use strict';

  const GRID = 24, PIXEL = 2; // boss sprites: 24x24 logical -> 48x48px
  const NOVA_PIXEL = 2;        // Nova: 8x8 logical -> 16x16px
  const GLYPH_PIXEL = 3;       // projectile glyphs: 8x8 logical -> 24x24px

  function R(x, y, w, h, role) { return { x, y, w, h, role }; }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  }

  // -----------------------------------------------------------------
  // Boss palette — derived from one hue per boss (bosses.js), so no
  // per-boss hex list to hand-author/keep in sync. 'accessory*' roles
  // use the complementary hue so a boss's prop always reads apart from
  // its body.
  // -----------------------------------------------------------------
  function bossPalette(hue) {
    return {
      primary: `hsl(${hue},55%,52%)`,
      secondary: `hsl(${(hue + 26) % 360},48%,40%)`,
      secondaryDark: `hsl(${(hue + 26) % 360},48%,24%)`,
      light: `hsl(${hue},45%,88%)`,
      accessoryBase: `hsl(${(hue + 180) % 360},38%,52%)`,
      accessoryAccent: `hsl(${(hue + 180) % 360},70%,72%)`,
      eye: '#141414',
      eyeHurt: '#e8453a'
    };
  }
  const GRAY_PALETTE = {
    primary: '#8a8a8a', secondary: '#6a6a6a', secondaryDark: '#4a4a4a',
    light: '#bcbcbc', accessoryBase: '#5a5a5a', accessoryAccent: '#777777',
    eye: '#222222', eyeHurt: '#222222'
  };

  // -----------------------------------------------------------------
  // The 4 base creature designs — body + feet are fixed per base;
  // accessories vary by boss (named in bosses.js) and attackLean gives
  // each base its own wind-up nudge direction.
  // -----------------------------------------------------------------
  const BASES = {
    golem: {
      body: [
        R(4, 16, 16, 6, 'secondary'),
        R(5, 9, 14, 7, 'primary'),
        R(6, 2, 12, 7, 'secondary'),
        R(9, 4, 2, 2, 'eye'), R(13, 4, 2, 2, 'eye')
      ],
      feet: [R(6, 22, 4, 2, 'secondaryDark'), R(14, 22, 4, 2, 'secondaryDark')],
      attackLean: { dx: 1, dy: 0 },
      accessories: {
        tablet: [R(18, 10, 4, 6, 'accessoryBase'), R(19, 11, 2, 1, 'accessoryAccent'), R(19, 13, 2, 1, 'accessoryAccent')],
        crossbar: [R(1, 6, 22, 2, 'accessoryBase')],
        boltCrown: [R(8, -1, 2, 3, 'accessoryAccent'), R(11, -2, 2, 4, 'accessoryAccent'), R(14, -1, 2, 3, 'accessoryAccent')]
      }
    },
    owl: {
      body: [
        R(6, 10, 12, 12, 'secondary'),
        R(7, 2, 10, 9, 'primary'),
        R(2, 12, 3, 8, 'secondaryDark'),
        R(19, 12, 3, 8, 'secondaryDark'),
        R(9, 5, 3, 3, 'light'), R(13, 5, 3, 3, 'light'),
        R(10, 6, 1, 1, 'eye'), R(14, 6, 1, 1, 'eye')
      ],
      feet: [R(8, 22, 3, 2, 'secondaryDark'), R(13, 22, 3, 2, 'secondaryDark')],
      attackLean: { dx: 0, dy: -1 },
      accessories: {
        signCoin: [R(10, 12, 4, 4, 'accessoryBase'), R(11, 13, 2, 2, 'accessoryAccent')],
        shadeCloak: [R(4, 14, 16, 8, 'accessoryBase')],
        foilShield: [R(8, 12, 8, 7, 'accessoryBase'), R(10, 14, 4, 1, 'accessoryAccent')]
      }
    },
    crab: {
      body: [
        R(4, 12, 16, 8, 'primary'),
        R(4, 12, 16, 2, 'secondary'),
        R(0, 12, 5, 6, 'secondary'),
        R(19, 12, 5, 6, 'secondary'),
        R(8, 8, 2, 4, 'primary'), R(14, 8, 2, 4, 'primary'),
        R(7, 6, 3, 3, 'light'), R(14, 6, 3, 3, 'light'),
        R(8, 7, 1, 1, 'eye'), R(15, 7, 1, 1, 'eye')
      ],
      feet: [R(6, 20, 2, 3, 'secondaryDark'), R(10, 20, 2, 3, 'secondaryDark'), R(14, 20, 2, 3, 'secondaryDark'), R(18, 20, 2, 3, 'secondaryDark')],
      attackLean: { dx: 0, dy: 0 },
      accessories: {
        scaleClaws: [R(0, 10, 5, 2, 'accessoryAccent'), R(19, 10, 5, 2, 'accessoryAccent')],
        xClaws: [R(1, 13, 3, 1, 'accessoryAccent'), R(1, 16, 3, 1, 'accessoryAccent'), R(20, 13, 3, 1, 'accessoryAccent'), R(20, 16, 3, 1, 'accessoryAccent')],
        cancelMark: [R(11, 9, 2, 11, 'accessoryAccent')]
      }
    },
    jelly: {
      body: [
        R(5, 5, 14, 3, 'primary'),
        R(3, 8, 18, 6, 'primary'),
        R(5, 14, 14, 3, 'secondary'),
        R(6, 17, 2, 6, 'secondaryDark'), R(10, 17, 2, 6, 'secondaryDark'),
        R(14, 17, 2, 6, 'secondaryDark'), R(18, 17, 2, 6, 'secondaryDark'),
        R(9, 9, 2, 2, 'eye'), R(13, 9, 2, 2, 'eye')
      ],
      feet: [],
      attackLean: { dx: 0, dy: -1 },
      accessories: {
        slopeAntenna: [R(15, -2, 2, 2, 'accessoryAccent'), R(15, 0, 2, 6, 'accessoryAccent')],
        growthSpikes: [R(4, 4, 2, 3, 'accessoryAccent'), R(9, 2, 2, 3, 'accessoryAccent'), R(14, 2, 2, 3, 'accessoryAccent'), R(18, 4, 2, 3, 'accessoryAccent')],
        triangleCrown: [R(10, 0, 4, 4, 'accessoryAccent')]
      }
    }
  };

  function drawRects(ctx, rects, palette, offsetX, offsetY) {
    rects.forEach(r => {
      ctx.fillStyle = palette[r.role] || palette.primary;
      ctx.fillRect((r.x + offsetX) * PIXEL, (r.y + offsetY) * PIXEL, r.w * PIXEL, r.h * PIXEL);
    });
  }

  function bossFrameRects(baseName, accessoryName, frame) {
    const base = BASES[baseName];
    const accessory = base.accessories[accessoryName] || [];
    let rects = base.body.concat(base.feet, accessory);
    if (frame === 'hurt') rects = rects.map(r => (r.role === 'eye' ? Object.assign({}, r, { role: 'eyeHurt' }) : r));
    return rects;
  }

  function renderBossFrame(spriteDesc, frame) {
    const { canvas, ctx } = makeCanvas(GRID * PIXEL, GRID * PIXEL);
    const base = BASES[spriteDesc.base];
    const palette = frame === 'defeated' ? GRAY_PALETTE : bossPalette(spriteDesc.hue);
    const rects = bossFrameRects(spriteDesc.base, spriteDesc.accessory, frame);

    let offsetX = 0, offsetY = frame === 'idle1' ? 1 : 0;
    if (frame === 'attack') { offsetX = base.attackLean.dx; offsetY += base.attackLean.dy; }

    if (frame === 'defeated') {
      // Squashed flat, anchored to the ground — a generic "defeated"
      // transform that works for any of the 4 bases with no per-base
      // logic needed.
      ctx.save();
      ctx.translate(0, GRID * PIXEL);
      ctx.scale(1, 0.5);
      ctx.translate(0, -GRID * PIXEL);
      drawRects(ctx, rects, palette, offsetX, offsetY);
      ctx.restore();
    } else {
      drawRects(ctx, rects, palette, offsetX, offsetY);
    }
    return canvas;
  }

  function buildBossSpriteSet(spriteDesc) {
    return {
      idle: [renderBossFrame(spriteDesc, 'idle0'), renderBossFrame(spriteDesc, 'idle1')],
      attack: renderBossFrame(spriteDesc, 'attack'),
      hurt: renderBossFrame(spriteDesc, 'hurt'),
      defeated: renderBossFrame(spriteDesc, 'defeated')
    };
  }

  // -----------------------------------------------------------------
  // Nova — same 8x8 pixel pattern as the existing .nova-sprite SVG
  // markup used elsewhere in the app, with small per-frame cell
  // substitutions (no limbs to re-pose, since the original mark is a
  // simple rounded-blob silhouette — motion reads through the tapered
  // base shifting and the eye row).
  // -----------------------------------------------------------------
  const NOVA_CREAM = '#FAF6EF', NOVA_DARK = '#1A1A1A';
  const NOVA_BASE = [
    [3, 0, 2, 1], [2, 1, 4, 1], [1, 2, 6, 1], [0, 3, 2, 1],
    [2, 3, 1, 1, true], [3, 3, 1, 1], [4, 3, 1, 1, true], [5, 3, 3, 1],
    [0, 4, 8, 1], [1, 5, 6, 1], [2, 6, 4, 1], [3, 7, 2, 1]
  ];
  function shiftRow(pixels, rowY, dx) {
    return pixels.map(p => (p[1] === rowY ? [p[0] + dx, p[1], p[2], p[3], p[4]] : p));
  }
  const NOVA_FRAMES = {
    idle0: NOVA_BASE,
    idle1: shiftRow(NOVA_BASE, 6, 0), // bob handled by caller's y-offset, not geometry
    run0: shiftRow(shiftRow(NOVA_BASE, 6, -1), 7, -1),
    run1: NOVA_BASE,
    run2: shiftRow(shiftRow(NOVA_BASE, 6, 1), 7, 1),
    jump: NOVA_BASE.filter(p => p[1] !== 7).map(p => (p[1] === 6 ? [p[0], p[1] + 1, p[2], p[3], p[4]] : p)),
    fall: NOVA_BASE.map(p => (p[1] === 4 ? [p[0] - 1, p[1], p[2] + 2, p[3], p[4]] : p)),
    hurt: NOVA_BASE.map(p => (p[4] ? [p[0], p[1], p[2], p[3], false] : p)) // eyes "closed" (cream, not dark)
  };
  function renderNovaFrame(frameKey) {
    const { canvas, ctx } = makeCanvas(8 * NOVA_PIXEL, 8 * NOVA_PIXEL);
    NOVA_FRAMES[frameKey].forEach(([x, y, w, h, dark]) => {
      ctx.fillStyle = dark ? NOVA_DARK : NOVA_CREAM;
      ctx.fillRect(x * NOVA_PIXEL, y * NOVA_PIXEL, w * NOVA_PIXEL, h * NOVA_PIXEL);
    });
    return canvas;
  }
  function buildNovaSpriteSet() {
    return {
      idle: [renderNovaFrame('idle0'), renderNovaFrame('idle1')],
      run: [renderNovaFrame('run0'), renderNovaFrame('run1'), renderNovaFrame('run2')],
      jump: renderNovaFrame('jump'),
      fall: renderNovaFrame('fall'),
      hurt: renderNovaFrame('hurt')
    };
  }

  // -----------------------------------------------------------------
  // Projectile glyphs — pixel math symbols on an 8x8 grid. Rolling and
  // flying variants of the SAME glyph use different colors (warm/dusty
  // for rolling along the ground, bright/glowing for flying) so the two
  // attack types are visually distinct at a glance, independent of the
  // spin/bob motion battle.js already applies.
  // -----------------------------------------------------------------
  const GLYPH_CELLS = {
    x: [[0, 0], [1, 1], [6, 0], [7, 1], [2, 2], [5, 2], [3, 3], [4, 3], [3, 4], [4, 4], [2, 5], [5, 5], [1, 6], [6, 6], [0, 7], [7, 7]],
    equals: [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]],
    div: [[3, 1], [4, 1], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [3, 5], [4, 5]],
    sqrt: [[0, 4], [1, 5], [2, 6], [3, 5], [4, 4], [4, 3], [5, 2], [6, 1], [7, 1]],
    pi: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [5, 2], [5, 3], [5, 4], [5, 5], [5, 6]],
    sigma: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [1, 2], [2, 3], [3, 4], [2, 5], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]],
    percent: [[1, 1], [2, 1], [1, 2], [2, 2], [5, 5], [6, 5], [5, 6], [6, 6], [2, 5], [3, 4], [4, 3], [5, 2]]
  };
  const GLYPH_COLORS = {
    rolling: { fill: '#c9a876', outline: '#5e4c30' },
    flying: { fill: '#8fd0ee', outline: '#17334a' }
  };
  function renderGlyph(glyphName, variant) {
    const cells = GLYPH_CELLS[glyphName] || GLYPH_CELLS.x;
    const colors = GLYPH_COLORS[variant] || GLYPH_COLORS.flying;
    const { canvas, ctx } = makeCanvas(8 * GLYPH_PIXEL, 8 * GLYPH_PIXEL);
    ctx.fillStyle = colors.outline;
    cells.forEach(([x, y]) => {
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
        ctx.fillRect((x + dx) * GLYPH_PIXEL, (y + dy) * GLYPH_PIXEL, GLYPH_PIXEL, GLYPH_PIXEL);
      });
    });
    ctx.fillStyle = colors.fill;
    cells.forEach(([x, y]) => ctx.fillRect(x * GLYPH_PIXEL, y * GLYPH_PIXEL, GLYPH_PIXEL, GLYPH_PIXEL));
    return canvas;
  }

  // Which glyph each chapter's projectiles use — a loose topical match
  // where one exists (quadratic formula -> sqrt, rational expressions
  // -> div, etc.), otherwise just picked for variety across the 7 shapes.
  const PROJECTILE_GLYPH_BY_CHAPTER = {
    'algebra1-01': 'x', 'algebra1-02': 'equals', 'algebra1-03': 'equals',
    'algebra1-04': 'x', 'algebra1-05': 'pi', 'algebra1-06': 'percent',
    'algebra1-07': 'equals', 'algebra1-08': 'sigma', 'algebra1-09': 'sqrt',
    'algebra1-10': 'x', 'algebra1-11': 'div', 'algebra1-12': 'sqrt'
  };

  // -----------------------------------------------------------------
  // Orb (glowing power-up) and charged shot — small pre-rendered
  // sprites; the "pulse"/"glow" is a scale/alpha the battle loop applies
  // at draw time, not a re-render.
  // -----------------------------------------------------------------
  function renderOrb() {
    const { canvas, ctx } = makeCanvas(24, 24);
    ctx.fillStyle = '#b8860b';
    ctx.beginPath(); ctx.arc(12, 12, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath(); ctx.arc(9, 9, 3, 0, Math.PI * 2); ctx.fill();
    return canvas;
  }
  function renderShot() {
    const { canvas, ctx } = makeCanvas(16, 16);
    ctx.fillStyle = '#b8860b';
    ctx.beginPath(); ctx.arc(8, 8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath(); ctx.arc(8, 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(6, 6, 2, 0, Math.PI * 2); ctx.fill();
    return canvas;
  }

  // -----------------------------------------------------------------
  // Public build-all entry point — call once per battle start; caches
  // nothing itself (the caller holds the result for the battle's
  // lifetime and discards it on destroy()).
  // -----------------------------------------------------------------
  function buildAll() {
    const bossCache = new Map();
    const glyphCache = new Map();
    return {
      boss(spriteDesc) {
        const key = spriteDesc.base + '|' + spriteDesc.hue + '|' + spriteDesc.accessory;
        if (!bossCache.has(key)) bossCache.set(key, buildBossSpriteSet(spriteDesc));
        return bossCache.get(key);
      },
      nova: buildNovaSpriteSet(),
      glyph(chapterId, variant) {
        const name = PROJECTILE_GLYPH_BY_CHAPTER[chapterId] || 'x';
        const key = name + '|' + variant;
        if (!glyphCache.has(key)) glyphCache.set(key, renderGlyph(name, variant));
        return glyphCache.get(key);
      },
      orb: renderOrb(),
      shot: renderShot()
    };
  }

  const BattleSprites = { buildAll };
  if (typeof module !== 'undefined' && module.exports) module.exports = BattleSprites;
  else root.BattleSprites = BattleSprites;
})(typeof window !== 'undefined' ? window : this);
