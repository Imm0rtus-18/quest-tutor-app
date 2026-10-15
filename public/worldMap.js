// Knowledge Map world renderer — procedurally draws every tile type onto
// offscreen <canvas> elements (no image files, no external assets), one
// canvas per island, composited into a pan/zoomable world. Original art
// only: no characters, sprites, landmarks, or layouts from any existing
// game. Depends on mapData.js (KM_* constants) being loaded first.
//
// Public API: window.KnowledgeMapWorld.render(container, apiData, theme)
// and .destroy() — called from index.html's openKnowledgeMap/
// closeKnowledgeMap.
(function () {
  'use strict';

  const DISPLAY_SCALE = 2; // each 16px tile renders at 32 CSS px on screen
  const OUTLINE = '#141414'; // pixel-art outlines stay near-black in both themes
  const ZOOM_LABEL_THRESHOLD = 1.1; // show per-stop title labels once zoomed in at least this far

  // Same pixel sprite used for Nova's mark elsewhere in the app (chat
  // header, auth screen) — reused here as the player marker on the
  // current stop.
  const NOVA_SPRITE_SVG = '<svg class="nova-sprite" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="3" y="0" width="2" height="1" fill="#FAF6EF"/><rect x="2" y="1" width="4" height="1" fill="#FAF6EF"/><rect x="1" y="2" width="6" height="1" fill="#FAF6EF"/><rect x="0" y="3" width="2" height="1" fill="#FAF6EF"/><rect x="2" y="3" width="1" height="1" fill="#1A1A1A"/><rect x="3" y="3" width="1" height="1" fill="#FAF6EF"/><rect x="4" y="3" width="1" height="1" fill="#1A1A1A"/><rect x="5" y="3" width="3" height="1" fill="#FAF6EF"/><rect x="0" y="4" width="8" height="1" fill="#FAF6EF"/><rect x="1" y="5" width="6" height="1" fill="#FAF6EF"/><rect x="2" y="6" width="4" height="1" fill="#FAF6EF"/><rect x="3" y="7" width="2" height="1" fill="#FAF6EF"/></svg>';

  // ---------------------------------------------------------------------
  // Palettes — every tile type gets a light (day) and dark (night) set.
  // ---------------------------------------------------------------------
  const PALETTES = {
    water: {
      light: { base: '#4A90C4', deep: '#3A7AAE', shimmer: '#8FD0EE' },
      dark: { base: '#17334A', deep: '#102638', shimmer: '#3E6B8C' }
    },
    sand: {
      light: { base: '#E8D28A', speck: '#D0B86C' },
      dark: { base: '#7C6A42', speck: '#5E4F30' }
    },
    grass: {
      light: { base: '#5FAE4A', shade: '#4A8F3A', bright: '#7AC768' },
      dark: { base: '#27461F', shade: '#1C3617', bright: '#345A2B' }
    },
    grassEdge: {
      light: { base: '#5FAE4A', shade: '#3E7A30', bright: '#8FD67A' },
      dark: { base: '#27461F', shade: '#162C13', bright: '#3E6632' }
    },
    tree: {
      light: { canopy: '#3E8E3E', canopyDark: '#2A6E2A', canopyLight: '#5CAE52', trunk: '#6B4A2E' },
      dark: { canopy: '#1A3A1A', canopyDark: '#102810', canopyLight: '#244C22', trunk: '#3E2C1C' }
    },
    path: {
      light: { base: '#C9A876', speck: '#AD8C5C' },
      dark: { base: '#5E4C30', speck: '#473A24' }
    },
    cliffTop: {
      light: { grass: '#5FAE4A', lip: '#9C7A4E', lipDark: '#7E5F3A' },
      dark: { grass: '#27461F', lip: '#4E3C26', lipDark: '#3A2C1C' }
    },
    cliffFace: {
      light: { band1: '#B08E5C', band2: '#977646', band3: '#7C5F35', band4: '#604828' },
      dark: { band1: '#5A4730', band2: '#493823', band3: '#382A1A', band4: '#281D12' }
    },
    rock: {
      light: { base: '#8E8E92', shade: '#6E6E72', highlight: '#ACACB0' },
      dark: { base: '#45454A', shade: '#323236', highlight: '#5A5A60' }
    },
    snow: {
      light: { base: '#F2F6FA', shade: '#D6E2EC' },
      dark: { base: '#A8B8C4', shade: '#7E92A0' }
    },
    cloud: {
      light: { base: '#FFFFFF', shade: '#DCE6EE' },
      dark: { base: '#B8C6D2', shade: '#8898A6' }
    },
    platform: {
      light: { base: '#BCA8DA', edge: '#9A82C2', glow: '#E0D2F4' },
      dark: { base: '#4A3A68', edge: '#362852', glow: '#645088' }
    }
  };

  function pal(tile, theme) {
    const p = PALETTES[tile];
    return p ? (theme === 'dark' ? p.dark : p.light) : null;
  }

  // Deterministic pseudo-random in [0,1) from a tile's grid position, so
  // repeated tiles of the same type get varied-but-stable detail pixels
  // (no flicker on redraw, no two neighboring tiles looking identical).
  function hash2(r, c, salt) {
    let h = (r * 374761393 + c * 668265263 + salt * 2246822519) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 1000) / 1000;
  }

  // ---------------------------------------------------------------------
  // Tile drawing — each function fills a TILE_SIZE x TILE_SIZE square at
  // (px,py) on the given 2D context with small hand-pattern rects. All
  // drawing happens at native 16px resolution; CSS scales the canvas up.
  // ---------------------------------------------------------------------
  const S = KM_TILE_SIZE; // 16

  // Every world-space pixel value (island offsets, tile positions, the
  // world container itself) is authored in native 16px-tile units in
  // mapData.js, then uniformly multiplied by DISPLAY_SCALE here — the
  // same single multiplication the terrain canvases use to size their
  // CSS display size — so terrain, bridges, the gate, and stops can
  // never drift apart onto different scales.
  function toPx(nativeValue) { return nativeValue * DISPLAY_SCALE; }
  const WORLD_PX_W = toPx(KM_WORLD.width);
  const WORLD_PX_H = toPx(KM_WORLD.height);

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawWater(ctx, px, py, r, c, theme, shimmerFrame) {
    const p = pal('water', theme);
    rect(ctx, px, py, S, S, p.base);
    // a few darker "deep water" pixels for texture
    const n = hash2(r, c, 1);
    if (n < 0.35) rect(ctx, px + 2, py + 10, 4, 2, p.deep);
    if (n > 0.6) rect(ctx, px + 9, py + 3, 3, 2, p.deep);
    // 2-frame stepped shimmer: alternating highlight pixels
    const shimmerOn = (Math.floor(hash2(r, c, 2) * 2) === shimmerFrame);
    if (shimmerOn) {
      rect(ctx, px + 5, py + 6, 3, 1, p.shimmer);
      rect(ctx, px + 11, py + 11, 2, 1, p.shimmer);
    } else {
      rect(ctx, px + 2, py + 4, 2, 1, p.shimmer);
      rect(ctx, px + 8, py + 13, 3, 1, p.shimmer);
    }
  }

  function drawSand(ctx, px, py, r, c, theme) {
    const p = pal('sand', theme);
    rect(ctx, px, py, S, S, p.base);
    const n = hash2(r, c, 3);
    rect(ctx, px + Math.floor(n * 10) + 2, py + Math.floor(hash2(r, c, 4) * 10) + 2, 2, 2, p.speck);
    rect(ctx, px + Math.floor(hash2(r, c, 5) * 10) + 1, py + Math.floor(hash2(r, c, 6) * 10) + 1, 1, 1, p.speck);
  }

  function drawGrass(ctx, px, py, r, c, theme, dithered) {
    const p = pal(dithered ? 'grassEdge' : 'grass', theme);
    rect(ctx, px, py, S, S, p.base);
    const n1 = hash2(r, c, 7), n2 = hash2(r, c, 8);
    // blade-texture pixels, denser/dithered near island edges
    const count = dithered ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const bx = px + Math.floor(hash2(r, c, 10 + i) * (S - 2));
      const by = py + Math.floor(hash2(r, c, 20 + i) * (S - 2));
      rect(ctx, bx, by, 1, 2, i % 2 === 0 ? p.shade : p.bright);
    }
  }

  function drawTree(ctx, px, py, r, c, theme) {
    // trees sit on a grass base
    drawGrass(ctx, px, py, r, c, theme, false);
    const p = pal('tree', theme);
    // trunk
    rect(ctx, px + 7, py + 11, 2, 4, p.trunk);
    // round canopy via a small stepped pixel cluster
    rect(ctx, px + 4, py + 3, 8, 2, p.canopyDark);
    rect(ctx, px + 3, py + 5, 10, 4, p.canopy);
    rect(ctx, px + 4, py + 9, 8, 2, p.canopyDark);
    rect(ctx, px + 5, py + 5, 3, 2, p.canopyLight);
  }

  function drawPath(ctx, px, py, r, c, theme) {
    const p = pal('path', theme);
    rect(ctx, px, py, S, S, p.base);
    const n = hash2(r, c, 11);
    rect(ctx, px + Math.floor(n * 10) + 2, py + Math.floor(hash2(r, c, 12) * 10) + 2, 2, 1, p.speck);
  }

  function drawCliffTop(ctx, px, py, r, c, theme) {
    const p = pal('cliffTop', theme);
    rect(ctx, px, py, S, S / 2, p.grass);
    rect(ctx, px, py + S / 2, S, S / 4, p.lip);
    rect(ctx, px, py + S * 0.75, S, S / 4, p.lipDark);
  }

  function drawCliffFace(ctx, px, py, r, c, theme) {
    const p = pal('cliffFace', theme);
    const bandH = S / 4;
    rect(ctx, px, py, S, bandH, p.band1);
    rect(ctx, px, py + bandH, S, bandH, p.band2);
    rect(ctx, px, py + bandH * 2, S, bandH, p.band3);
    rect(ctx, px, py + bandH * 3, S, bandH, p.band4);
    // vertical strata separators for an angular, layered look
    const n = hash2(r, c, 13);
    const sx = px + 3 + Math.floor(n * 8);
    rect(ctx, sx, py, 1, S, p.band4);
  }

  function drawRock(ctx, px, py, r, c, theme) {
    const p = pal('rock', theme);
    rect(ctx, px, py, S, S, pal('water', theme).base); // rocks rest on water/void at coast
    const n = hash2(r, c, 14);
    const bx = px + 2 + Math.floor(n * 3), by = py + 3 + Math.floor(hash2(r, c, 15) * 3);
    rect(ctx, bx, by, 11 - Math.floor(n * 3), 10, p.shade);
    rect(ctx, bx + 1, by + 1, 8, 7, p.base);
    rect(ctx, bx + 2, by + 1, 3, 2, p.highlight);
  }

  function drawSnow(ctx, px, py, r, c, theme) {
    const p = pal('snow', theme);
    rect(ctx, px, py, S, S, p.base);
    const n = hash2(r, c, 16);
    if (n < 0.4) rect(ctx, px + Math.floor(n * 10) + 2, py + Math.floor(hash2(r, c, 17) * 10) + 2, 3, 2, p.shade);
  }

  function drawCloud(ctx, px, py, r, c, theme) {
    const p = pal('cloud', theme);
    rect(ctx, px, py, S, S, pal('water', theme).base);
    rect(ctx, px + 2, py + 5, 12, 7, p.base);
    rect(ctx, px + 4, py + 3, 8, 4, p.base);
    rect(ctx, px + 3, py + 10, 10, 2, p.shade);
  }

  function drawPlatform(ctx, px, py, r, c, theme) {
    const p = pal('platform', theme);
    rect(ctx, px, py, S, S, pal('water', theme).base);
    rect(ctx, px + 1, py + 2, 14, 11, p.edge);
    rect(ctx, px + 2, py + 3, 12, 8, p.base);
    const n = hash2(r, c, 18);
    if (n < 0.3) rect(ctx, px + 4, py + 4, 3, 1, p.glow);
  }

  const DRAWERS = {
    water: (ctx, px, py, r, c, theme, shimmer) => drawWater(ctx, px, py, r, c, theme, shimmer),
    sand: (ctx, px, py, r, c, theme) => drawSand(ctx, px, py, r, c, theme),
    grass: (ctx, px, py, r, c, theme) => drawGrass(ctx, px, py, r, c, theme, false),
    grassEdge: (ctx, px, py, r, c, theme) => drawGrass(ctx, px, py, r, c, theme, true),
    tree: (ctx, px, py, r, c, theme) => drawTree(ctx, px, py, r, c, theme),
    path: (ctx, px, py, r, c, theme) => drawPath(ctx, px, py, r, c, theme),
    cliffTop: (ctx, px, py, r, c, theme) => drawCliffTop(ctx, px, py, r, c, theme),
    cliffFace: (ctx, px, py, r, c, theme) => drawCliffFace(ctx, px, py, r, c, theme),
    rock: (ctx, px, py, r, c, theme) => drawRock(ctx, px, py, r, c, theme),
    snow: (ctx, px, py, r, c, theme) => drawSnow(ctx, px, py, r, c, theme),
    cloud: (ctx, px, py, r, c, theme) => drawCloud(ctx, px, py, r, c, theme),
    platform: (ctx, px, py, r, c, theme) => drawPlatform(ctx, px, py, r, c, theme)
  };

  function renderIslandCanvas(canvas, islandData, theme, shimmerFrame) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const rows = islandData.grid;
    canvas.width = rows[0].length * S;
    canvas.height = rows.length * S;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const code = rows[r][c];
        const tileType = KM_TILE_LEGEND[code];
        if (!tileType) continue;
        const drawer = DRAWERS[tileType];
        if (drawer) drawer(ctx, c * S, r * S, r, c, theme, shimmerFrame);
      }
    }
  }

  // Open water filling the ENTIRE world rectangle (not just the gaps
  // between islands) so panning/zooming never reveals a flat, un-tiled
  // edge — the islands simply sit on top of it.
  function renderWorldWaterCanvas(canvas, theme, shimmerFrame) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const cols = Math.ceil(KM_WORLD.width / S);
    const rows = Math.ceil(KM_WORLD.height / S);
    canvas.width = cols * S;
    canvas.height = rows * S;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) drawWater(ctx, c * S, r * S, r, c, theme, shimmerFrame);
    }
  }

  // ---------------------------------------------------------------------
  // Bridges, ferry, and the central Calculus Gate — all original, drawn
  // procedurally, positioned in world (16px-tile) coordinate space.
  // ---------------------------------------------------------------------
  function tileCenterWorld(island, tile) {
    return {
      x: toPx(island.worldX + tile.col * S + S / 2),
      y: toPx(island.worldY + tile.row * S + S / 2)
    };
  }

  function renderConnection(svg, conn, theme) {
    const fromIsland = KM_ISLANDS[conn.from.island];
    const toIsland = KM_ISLANDS[conn.to.island];
    const a = tileCenterWorld(fromIsland, conn.from);
    const b = tileCenterWorld(toIsland, conn.to);
    const isFerry = conn.type === 'ferry';
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('class', isFerry ? 'km-ferry-line' : 'km-bridge-line');
    svg.appendChild(line);
    if (isFerry) {
      const dock = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      dock.setAttribute('cx', mid.x); dock.setAttribute('cy', mid.y);
      dock.setAttribute('r', 7);
      dock.setAttribute('class', 'km-ferry-dock');
      svg.appendChild(dock);
    }
  }

  function renderGate(svg) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'km-gate');
    g.setAttribute('transform', `translate(${toPx(KM_WORLD.gateX)},${toPx(KM_WORLD.gateY)}) scale(${DISPLAY_SCALE})`);

    const whirl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    whirl.setAttribute('class', 'km-gate-whirlpool');
    whirl.setAttribute('r', 72);
    g.appendChild(whirl);

    // Weathered-stone infinity ring (lemniscate), drawn as two overlapping
    // circles with a shared pinch, original silhouette, not a game asset.
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const k = 46;
    ring.setAttribute('d', `M ${-k * 2} 0 C ${-k * 2} ${-k}, ${-k} ${-k}, 0 0 C ${k} ${-k}, ${k * 2} ${-k}, ${k * 2} 0 C ${k * 2} ${k}, ${k} ${k}, 0 0 C ${-k} ${k}, ${-k * 2} ${k}, ${-k * 2} 0 Z`);
    ring.setAttribute('class', 'km-gate-ring');
    g.appendChild(ring);

    const crystal = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    crystal.setAttribute('points', '0,-14 9,0 0,14 -9,0');
    crystal.setAttribute('class', 'km-gate-crystal');
    g.appendChild(crystal);

    // Four rune sockets, one per subject, positioned around the ring.
    const socketPos = [
      { id: 'algebra1', dx: -k * 2, dy: 30 },
      { id: 'geometry', dx: -k * 2, dy: -30 },
      { id: 'algebra2', dx: k * 2, dy: -30 },
      { id: 'precalc', dx: k * 2, dy: 30 }
    ];
    socketPos.forEach(s => {
      const socket = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      socket.setAttribute('cx', s.dx); socket.setAttribute('cy', s.dy);
      socket.setAttribute('r', 8);
      socket.setAttribute('class', 'km-gate-socket');
      socket.setAttribute('data-subject', s.id);
      g.appendChild(socket);
    });

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = 'Calculus: coming soon';
    g.appendChild(title);

    svg.appendChild(g);
    return g;
  }

  function litSockets(g, subjectsLit) {
    g.querySelectorAll('.km-gate-socket').forEach(socket => {
      const id = socket.getAttribute('data-subject');
      socket.classList.toggle('lit', !!subjectsLit[id]);
    });
  }

  // ---------------------------------------------------------------------
  // Decorative drifting clouds (ambient, not tied to any island/state).
  // ---------------------------------------------------------------------
  function renderAmbientClouds(container, reduceMotion) {
    // Positions are authored as fractions of the world rectangle so they
    // stay proportionally placed regardless of DISPLAY_SCALE.
    const positions = [
      { top: 0.047, startLeft: -0.040, duration: 42 },
      { top: 0.163, startLeft: -0.101, duration: 55 },
      { top: 0.721, startLeft: -0.071, duration: 48 },
      { top: 0.837, startLeft: -0.132, duration: 60 }
    ];
    positions.forEach((p, i) => {
      const cloud = document.createElement('div');
      cloud.className = 'km-ambient-cloud';
      cloud.style.top = (p.top * WORLD_PX_H) + 'px';
      cloud.style.left = (p.startLeft * WORLD_PX_W) + 'px';
      if (!reduceMotion) {
        cloud.style.animation = `km-drift ${p.duration}s linear ${i * -7}s infinite`;
      }
      container.appendChild(cloud);
    });
  }

  // ---------------------------------------------------------------------
  // Stops — rendered as real DOM elements (tooltips/focus/keyboard), laid
  // out in each island's LOCAL tile-coordinate space so they inherit the
  // island wrapper's own bob animation automatically.
  // ---------------------------------------------------------------------
  function renderStops(islandWrap, islandId, islandData, apiSubject, data) {
    const isCurrentSubject = apiSubject.id === data.subject_level;
    const topics = apiSubject.topics || [];
    const stops = getIslandStops(islandData);
    stops.forEach((tile, i) => {
      const topic = topics[i];
      if (!topic) return;
      let state = 'locked';
      if (isCurrentSubject && i < data.current_topic_index) state = 'completed';
      else if (isCurrentSubject && i === data.current_topic_index) state = 'active';
      const isBoss = i === stops.length - 1;

      const stop = document.createElement('button');
      stop.type = 'button';
      stop.className = 'km-stop km-stop-' + state + (isBoss ? ' km-stop-boss' : '');
      stop.style.left = toPx(tile.col * S + S / 2) + 'px';
      stop.style.top = toPx(tile.row * S + S / 2) + 'px';
      stop.dataset.subject = islandId;
      stop.dataset.seq = String(i);
      stop.dataset.topicId = topic.id;
      stop.title = `${apiSubject.label} — ${topic.title}: ${topic.objective}`;
      stop.setAttribute('aria-label', stop.title + ' (' + state + ')');

      const icon = document.createElement('span');
      icon.className = 'km-stop-icon';
      if (state === 'active') {
        icon.innerHTML = NOVA_SPRITE_SVG;
      } else {
        icon.textContent = state === 'completed' ? '⚑' : state === 'locked' ? '\u{1F512}' : (topic.symbol || '•');
      }
      stop.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'km-stop-label';
      label.textContent = topic.title;
      stop.appendChild(label);

      islandWrap.appendChild(stop);
    });
  }

  // ---------------------------------------------------------------------
  // Public render / destroy
  // ---------------------------------------------------------------------
  let state = {
    shimmerInterval: null,
    zoomBehavior: null,
    resetTransform: null,
    svgSelection: null
  };

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function render(container, apiData, theme) {
    destroy(); // clear any previous render (e.g. theme change / reopen)
    container.innerHTML = '';
    const reduceMotion = prefersReducedMotion();

    const viewportW = container.clientWidth || 1200;
    const viewportH = container.clientHeight || 800;

    // Outer element d3-zoom listens on; inner element it transforms.
    const zoomHost = document.createElement('div');
    zoomHost.className = 'km-zoom-host';
    container.appendChild(zoomHost);

    const world = document.createElement('div');
    world.className = 'km-world';
    world.style.width = WORLD_PX_W + 'px';
    world.style.height = WORLD_PX_H + 'px';
    zoomHost.appendChild(world);

    const subjectsById = {};
    (apiData.subjects || []).forEach(s => { subjectsById[s.id] = s; });

    // Layer order (bottom to top): water, islands, bridges/gate, clouds,
    // stops/badges. Each layer is a separate pass over the islands so the
    // DOM append order controls stacking directly, rather than relying on
    // z-index to fight the stacking contexts each bobbing wrap creates.

    // 1. Open water — fills the entire world rectangle, not just the gaps
    // between islands, so panning/zooming never reveals a flat edge.
    const waterCanvas = document.createElement('canvas');
    waterCanvas.className = 'km-world-water';
    waterCanvas.style.width = WORLD_PX_W + 'px';
    waterCanvas.style.height = WORLD_PX_H + 'px';
    renderWorldWaterCanvas(waterCanvas, theme, 0);
    world.appendChild(waterCanvas);

    // 2. Island terrain canvases only (banners/stops render in pass 5).
    const islandCanvases = {};
    const islandMeta = [];
    Object.keys(KM_ISLANDS).forEach((id, idx) => {
      const islandData = KM_ISLANDS[id];
      const stopCount = getIslandStops(islandData).length;
      islandMeta.push({ id, idx, islandData, stopCount });

      const wrap = document.createElement('div');
      wrap.className = 'km-island-wrap km-island-terrain';
      wrap.style.left = toPx(islandData.worldX) + 'px';
      wrap.style.top = toPx(islandData.worldY) + 'px';
      wrap.style.width = toPx(islandData.grid[0].length * S) + 'px';
      wrap.style.height = toPx(islandData.grid.length * S) + 'px';
      if (!reduceMotion) {
        wrap.style.animation = `km-bob 2.6s steps(6) ${idx * -0.6}s infinite`;
      }

      const canvas = document.createElement('canvas');
      canvas.className = 'km-island-canvas';
      canvas.style.width = toPx(islandData.grid[0].length * S) + 'px';
      canvas.style.height = toPx(islandData.grid.length * S) + 'px';
      renderIslandCanvas(canvas, islandData, theme, 0);
      wrap.appendChild(canvas);
      islandCanvases[id] = canvas;

      world.appendChild(wrap);
    });

    // 3. Bridges, ferry, and the central gate — above the islands.
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'km-connections-svg');
    svg.setAttribute('width', WORLD_PX_W);
    svg.setAttribute('height', WORLD_PX_H);
    world.appendChild(svg);

    KM_CONNECTIONS.forEach(conn => renderConnection(svg, conn, theme));
    const gateEl = renderGate(svg);

    const bossLit = {};
    islandMeta.forEach(({ id, islandData, stopCount }) => {
      const subj = subjectsById[id];
      const isCurrentSubject = subj && subj.id === apiData.subject_level;
      bossLit[id] = !!(isCurrentSubject && apiData.current_topic_index >= stopCount - 1 && subj.topics && subj.topics.length);
    });
    litSockets(gateEl, bossLit);

    // 4. Ambient drifting clouds — above bridges, below stops/badges.
    renderAmbientClouds(world, reduceMotion);

    // 5. Per-island overlay (banner + stops) — topmost layer. Positioned
    // and animated identically to that island's terrain wrap (same
    // offset, same bob timing) so it still bobs together with its
    // island despite being a separate DOM subtree.
    islandMeta.forEach(({ id, idx, islandData, stopCount }) => {
      const subj = subjectsById[id];

      const overlay = document.createElement('div');
      overlay.className = 'km-island-wrap km-island-overlay';
      overlay.style.left = toPx(islandData.worldX) + 'px';
      overlay.style.top = toPx(islandData.worldY) + 'px';
      overlay.style.width = toPx(islandData.grid[0].length * S) + 'px';
      overlay.style.height = toPx(islandData.grid.length * S) + 'px';
      if (!reduceMotion) {
        overlay.style.animation = `km-bob 2.6s steps(6) ${idx * -0.6}s infinite`;
      }

      const completeCount = subj && subj.id === apiData.subject_level ? Math.min(apiData.current_topic_index, stopCount) : 0;
      const banner = document.createElement('div');
      banner.className = 'km-island-banner';
      banner.innerHTML = `<span class="km-island-banner-label">${subj ? subj.label : islandData.label}</span>` +
        `<span class="km-island-banner-badge">${completeCount} / ${stopCount} complete</span>`;
      overlay.appendChild(banner);

      if (subj) renderStops(overlay, id, islandData, subj, apiData);

      world.appendChild(overlay);
    });

    // Water shimmer: redraw the ocean + each island canvas on a slow
    // stepped interval, alternating between 2 shimmer frames. Skipped
    // under reduced motion.
    if (!reduceMotion) {
      let frame = 0;
      state.shimmerInterval = setInterval(() => {
        frame = frame === 0 ? 1 : 0;
        renderWorldWaterCanvas(waterCanvas, theme, frame);
        Object.keys(KM_ISLANDS).forEach(id => {
          renderIslandCanvas(islandCanvases[id], KM_ISLANDS[id], theme, frame);
        });
      }, 650);
    }

    // Pan + zoom on the whole world via d3-zoom. Minimum zoom is whatever
    // scale makes the world fully cover the viewport in both dimensions
    // (so zooming out never reveals empty space past the world's edge);
    // panning is clamped to the world's own bounds for the same reason.
    const maxZoom = 3;
    const minZoom = Math.min(maxZoom, Math.max(viewportW / WORLD_PX_W, viewportH / WORLD_PX_H));
    const d3Selection = d3.select(zoomHost);
    const zoomBehavior = d3.zoom()
      .scaleExtent([minZoom, maxZoom])
      .extent([[0, 0], [viewportW, viewportH]])
      .translateExtent([[0, 0], [WORLD_PX_W, WORLD_PX_H]])
      .on('zoom', event => {
        world.style.transform = `translate(${event.transform.x}px,${event.transform.y}px) scale(${event.transform.k})`;
        world.classList.toggle('km-labels-visible', event.transform.k >= ZOOM_LABEL_THRESHOLD);
      });
    d3Selection.call(zoomBehavior);

    const resetTransform = d3.zoomIdentity
      .translate(viewportW / 2, viewportH / 2)
      .scale(minZoom)
      .translate(-WORLD_PX_W / 2, -WORLD_PX_H / 2);
    d3Selection.call(zoomBehavior.transform, resetTransform);

    state.zoomBehavior = zoomBehavior;
    state.resetTransform = resetTransform;
    state.svgSelection = d3Selection;
  }

  function destroy() {
    if (state.shimmerInterval) clearInterval(state.shimmerInterval);
    state.shimmerInterval = null;
    state.zoomBehavior = null;
    state.resetTransform = null;
    state.svgSelection = null;
  }

  function zoomBy(factor) {
    if (state.svgSelection && state.zoomBehavior) {
      state.svgSelection.transition().duration(200).call(state.zoomBehavior.scaleBy, factor);
    }
  }
  function resetView() {
    if (state.svgSelection && state.zoomBehavior && state.resetTransform) {
      state.svgSelection.transition().duration(300).call(state.zoomBehavior.transform, state.resetTransform);
    }
  }

  window.KnowledgeMapWorld = { render, destroy, zoomBy, resetView };
})();
