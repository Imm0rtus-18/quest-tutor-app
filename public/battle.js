// Boss battle — a small platformer wrapper around the exact same chapter
// quiz data/grading the Classic quiz uses. This file owns the canvas
// arena, physics, rendering, and input; it never grades anything itself —
// every answer goes through POST /api/quiz/answer (one question, no
// correct option ever returned) and the final pass/fail always comes
// from the SAME POST /api/quiz/submit the Classic quiz calls, so both
// paths share one source of truth.
//
// Public API: window.BossBattle.start(adj, callbacks) / .destroy()
// adj: the topic_adjustment object from the server — { quiz_session_id,
//   chapter_id, chapter_title, boss, questions } — questions never carry
//   correctIndex.
// callbacks: { sounds, confetti, onSwitchToClassic(partial), onComplete(result) }
//   partial: { answeredSoFar: [{questionId,selectedIndex}], nextIndex }
//   result: the exact shape POST /api/quiz/submit returns.
(function () {
  'use strict';

  // Physics, arena layout, and attack-phase data all come from their own
  // dual-environment (browser + Node) modules — battle-physics.js,
  // battle-arena.js, battle-attacks.js — so
  // scripts/test-battle-reachability.js proves both platform reachability
  // and projectile-spacing safety against the exact numbers the real
  // game runs, never a hand-copied duplicate that could drift out of
  // sync. battle-sprites.js is the (browser-only) pixel-art engine.
  const PHYS = window.BattlePhysics.CONST;
  const CANVAS_W = PHYS.CANVAS_W, CANVAS_H = PHYS.CANVAS_H;
  const STEP_MS = PHYS.STEP_MS;
  const GRAVITY = PHYS.GRAVITY;
  const MAX_FALL = PHYS.MAX_FALL;
  const MOVE_SPEED = PHYS.MOVE_SPEED;
  const JUMP_VELOCITY = PHYS.JUMP_VELOCITY;
  const JUMP_CUT_MULT = PHYS.JUMP_CUT_MULT;
  const COYOTE_MS = PHYS.COYOTE_MS;
  const JUMP_BUFFER_MS = PHYS.JUMP_BUFFER_MS;
  const PLAYER_SIZE = PHYS.PLAYER_SIZE;
  const GROUND_Y = PHYS.GROUND_Y;

  const ARENA = window.BattleArena;
  const SURFACES = ARENA.SURFACES;
  const ORB_SURFACES = ARENA.ORB_SURFACES;
  const BOSS_POSITIONS = [ARENA.BOSS_POS, ARENA.BOSS_POS_ALT];
  const PLAYER_START = ARENA.PLAYER_START;

  const ATTACKS = window.BattleAttacks;

  const INVULN_MS = 1000;
  const MAX_PROJECTILES = 8;
  const MAX_PARTICLES = 60;
  const ORB_MIN_MS = 4000, ORB_MAX_MS = 7000;
  const HP_SEGMENTS = 10;
  const MAX_FLASHES_PER_SEC = 3; // no strobing

  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  // ---------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------
  let el = {};
  function cacheEls() {
    el = {
      overlay: document.getElementById('battleOverlay'),
      stageWrap: document.getElementById('battleStageWrap'),
      start: document.getElementById('battleStart'),
      bossNameStart: document.getElementById('battleBossNameStart'),
      chapterTitleStart: document.getElementById('battleChapterTitleStart'),
      fightBtn: document.getElementById('battleFightBtn'),
      classicBtn: document.getElementById('battleClassicBtn'),
      arena: document.getElementById('battleArena'),
      hud: document.getElementById('battleHud'),
      bossNameHud: document.getElementById('battleBossNameHud'),
      hpBar: document.getElementById('battleHpBar'),
      tally: document.getElementById('battleTally'),
      fullscreenBtn: document.getElementById('battleFullscreenBtn'),
      pauseBtn: document.getElementById('battlePauseBtn'),
      stage: document.getElementById('battleStage'),
      canvas: document.getElementById('battleCanvas'),
      banner: document.getElementById('battleBanner'),
      touchControls: document.getElementById('battleTouchControls'),
      touchLeft: document.getElementById('touchLeftBtn'),
      touchRight: document.getElementById('touchRightBtn'),
      touchJump: document.getElementById('touchJumpBtn'),
      question: document.getElementById('battleQuestionOverlay'),
      questionChapter: document.getElementById('battleQuestionChapter'),
      questionText: document.getElementById('battleQuestionText'),
      questionOptions: document.getElementById('battleQuestionOptions'),
      feedback: document.getElementById('battleFeedback'),
      pauseMenu: document.getElementById('battlePauseMenu'),
      resumeBtn: document.getElementById('battleResumeBtn'),
      pauseClassicBtn: document.getElementById('battlePauseClassicBtn')
    };
  }

  // ---------------------------------------------------------------------
  // Battle state — reset fresh on every start().
  // ---------------------------------------------------------------------
  let S = null;
  let ctx = null;
  let rafId = null;
  let callbacks = {};
  let reduceMotion = false;
  let listenersBound = false;
  let worldCanvas = null; // pre-rendered ground/platforms/parallax — rebuilt only on theme change
  let worldTheme = null;

  function freshState(adj) {
    return {
      phase: 'start', // start | playing | question | outcome
      questions: adj.questions || [],
      questionIndex: 0,
      sessionId: adj.quiz_session_id,
      bossData: adj.boss,
      chapterId: adj.chapter_id,
      chapterTitle: adj.chapter_title || 'this chapter',
      recordedAnswers: [],
      correctCount: 0,
      bossHp: HP_SEGMENTS,
      bossPosIndex: 0,
      bossBobPhase: 0,
      attackPattern: ATTACKS.phaseForHp(HP_SEGMENTS),
      attackState: 'idle', // idle | windup | firing
      nextAttackAt: 1200,
      windupUntil: 0,
      pendingShots: [], // [{delayMs, low}] queued during windup, consumed during firing
      warningMarkerX: null,
      simTime: 0,
      lastFrameAt: 0,
      accumulator: 0,
      paused: false,
      keys: { left: false, right: false },
      jumpPressedAt: -Infinity,
      lastGroundedAt: -Infinity,
      player: { x: PLAYER_START.x, y: PLAYER_START.y, vx: 0, vy: 0, facing: 1, onGround: true, invulnUntil: 0 },
      novaAnim: 'idle', novaFrameTimer: 0, novaRunFrame: 0,
      projectiles: [],
      orb: null,
      nextOrbAt: 2500,
      orbPulse: 0,
      shots: [],
      particles: [],
      flashTimestamps: [], // real Date.now() times of recent flashes, for the 3/s cap
      shakeUntil: 0,
      bossFlashUntil: 0,
      fizzleUntil: 0,
      selectedOption: null
    };
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  function start(adj, cbs) {
    cacheEls();
    callbacks = cbs || {};
    reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    S = freshState(adj);
    S.sprites = window.BattleSprites.buildAll();
    ctx = el.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ensureWorldCanvas();

    el.bossNameStart.textContent = S.bossData ? S.bossData.name : 'the chapter boss';
    el.chapterTitleStart.textContent = S.chapterTitle;
    el.bossNameHud.textContent = S.bossData ? S.bossData.name : '';
    renderHpBar();
    updateTally();

    el.arena.hidden = true;
    el.question.hidden = true;
    el.pauseMenu.hidden = true;
    el.start.hidden = false;
    el.banner.hidden = true;

    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    el.touchControls.hidden = !isTouch;

    el.overlay.classList.remove('hidden');
    bindListeners();
  }

  function destroy() {
    stopLoop();
    exitFullscreenIfActive();
    el.overlay && el.overlay.classList.add('hidden');
    unbindListeners();
    S = null;
  }

  // Pre-renders the static ground/platform/parallax-background world ONCE
  // (not per frame) — rebuilt only when the theme toggle actually flips
  // while a battle is open, consuming the theme the same way the
  // Knowledge Map/Desmos panel do, never touching the toggle itself.
  function ensureWorldCanvas() {
    const theme = getTheme();
    if (worldCanvas && worldTheme === theme) return;
    worldTheme = theme;
    worldCanvas = document.createElement('canvas');
    worldCanvas.width = CANVAS_W;
    worldCanvas.height = CANVAS_H;
    const wctx = worldCanvas.getContext('2d');
    wctx.imageSmoothingEnabled = false;
    renderWorldArt(wctx, theme);
  }

  function renderWorldArt(wctx, theme) {
    const dark = theme === 'dark';
    const sky1 = dark ? '#171326' : '#1b1b3a';
    const sky2 = dark ? '#201a35' : '#272752';
    wctx.fillStyle = sky1;
    wctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 2-layer parallax: far (small, dim) and near (bigger, slightly
    // brighter) silhouette hills — static (the "parallax" read comes
    // from the two layers' different, non-aligned rhythms, not motion).
    wctx.fillStyle = dark ? '#241f3d' : '#30306a';
    for (let x = -20; x < CANVAS_W + 20; x += 46) wctx.fillRect(x, 108, 34, 30);
    wctx.fillStyle = sky2;
    for (let x = -30; x < CANVAS_W + 30; x += 64) wctx.fillRect(x, 122, 48, 26);

    // Ground: a textured strip, not a flat fill.
    const groundTop = dark ? '#3a2d1c' : '#5a4328';
    const groundShade = dark ? '#241b11' : '#3a2c18';
    wctx.fillStyle = groundTop;
    wctx.fillRect(0, GROUND_Y, CANVAS_W, 6);
    wctx.fillStyle = groundShade;
    wctx.fillRect(0, GROUND_Y + 6, CANVAS_W, CANVAS_H - GROUND_Y - 6);
    for (let x = 0; x < CANVAS_W; x += 10) wctx.fillRect(x, GROUND_Y + 2, 5, 2);

    // Platforms: a lighter pixel top edge + a darker underside, so
    // they read as solid blocks rather than flat rectangles.
    const platTop = dark ? '#6a5636' : '#8a7046';
    const platUnder = dark ? '#241b11' : '#3a2c18';
    ORB_SURFACES.forEach(plat => {
      wctx.fillStyle = platTop;
      wctx.fillRect(plat.x, plat.y, plat.w, 3);
      wctx.fillStyle = groundTop;
      wctx.fillRect(plat.x, plat.y + 3, plat.w, plat.h - 5);
      wctx.fillStyle = platUnder;
      wctx.fillRect(plat.x, plat.y + plat.h - 2, plat.w, 2);
    });
  }

  // ---------------------------------------------------------------------
  // Listeners
  // ---------------------------------------------------------------------
  function bindPressHoldButton(button, onPress, onRelease) {
    let activePointerId = null;
    button.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (activePointerId !== null) return;
      activePointerId = e.pointerId;
      try { button.setPointerCapture(e.pointerId); } catch (err) { /* unsupported — still works without capture */ }
      onPress();
    });
    function release(e) {
      if (e.pointerId !== activePointerId) return;
      activePointerId = null;
      try { button.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
      onRelease();
      button.blur();
    }
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('contextmenu', e => e.preventDefault());
    button.addEventListener('click', e => e.preventDefault());
  }

  function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;

    el.fightBtn.addEventListener('click', onFightClicked);
    el.classicBtn.addEventListener('click', () => switchToClassic());
    el.pauseBtn.addEventListener('click', () => openPauseMenu());
    el.resumeBtn.addEventListener('click', () => closePauseMenu());
    el.pauseClassicBtn.addEventListener('click', () => switchToClassic());

    bindPressHoldButton(el.touchLeft, () => { if (S) S.keys.left = true; }, () => { if (S) S.keys.left = false; });
    bindPressHoldButton(el.touchRight, () => { if (S) S.keys.right = true; }, () => { if (S) S.keys.right = false; });
    bindPressHoldButton(el.touchJump, onJumpPressed, onJumpReleased);

    el.fullscreenBtn.addEventListener('click', toggleFullscreen);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', computeStageScale);
    window.addEventListener('orientationchange', computeStageScale);
    document.addEventListener('fullscreenchange', computeStageScale);
  }

  function unbindListeners() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('resize', computeStageScale);
    window.removeEventListener('orientationchange', computeStageScale);
    document.removeEventListener('fullscreenchange', computeStageScale);
    listenersBound = false;
  }

  function computeStageScale() {
    if (!el.stage) return;
    const availW = el.stage.clientWidth;
    const availH = el.stage.clientHeight;
    if (availW <= 0 || availH <= 0) return;

    const integerScale = Math.floor(Math.min(availW / CANVAS_W, availH / CANVAS_H));
    let cssW, cssH;
    if (integerScale >= 1) {
      cssW = CANVAS_W * integerScale;
      cssH = CANVAS_H * integerScale;
    } else {
      const fitScale = Math.min(availW / CANVAS_W, availH / CANVAS_H);
      cssW = CANVAS_W * fitScale;
      cssH = CANVAS_H * fitScale;
    }
    el.canvas.style.width = cssW + 'px';
    el.canvas.style.height = cssH + 'px';
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (el.stageWrap.requestFullscreen) el.stageWrap.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
  function exitFullscreenIfActive() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  function onVisibilityChange() { /* loop checks document.hidden itself */ }

  function isTypingTarget(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
  }

  const SCROLL_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']);

  function onKeyDown(e) {
    if (!S || isTypingTarget(e)) return;
    if (SCROLL_KEYS.has(e.key)) e.preventDefault();

    if (S.phase === 'question') { handleQuestionKey(e); return; }
    if (S.phase !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') S.keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') S.keys.right = true;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') onJumpPressed();
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') openPauseMenu();
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  }
  function onKeyUp(e) {
    if (!S) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') S.keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') S.keys.right = false;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') onJumpReleased();
  }
  function onJumpPressed() {
    if (!S || S.phase !== 'playing') return;
    S.jumpPressedAt = S.simTime;
  }
  function onJumpReleased() {
    if (!S) return;
    const p = S.player;
    if (p.vy < JUMP_VELOCITY * JUMP_CUT_MULT) p.vy = JUMP_VELOCITY * JUMP_CUT_MULT;
  }

  function onFightClicked() {
    el.start.hidden = true;
    el.arena.hidden = false;
    computeStageScale();
    enterPlaying();
    startLoop();
  }

  function switchToClassic() {
    stopLoop();
    exitFullscreenIfActive();
    el.overlay.classList.add('hidden');
    const partial = { answeredSoFar: S ? S.recordedAnswers.slice() : [], nextIndex: S ? S.recordedAnswers.length : 0 };
    const cb = callbacks.onSwitchToClassic;
    S = null;
    if (cb) cb(partial);
  }

  function openPauseMenu() {
    if (!S || S.phase !== 'playing') return;
    S.paused = true;
    el.pauseMenu.hidden = false;
  }
  function closePauseMenu() {
    if (!S) return;
    el.pauseMenu.hidden = true;
    S.paused = false;
  }

  // ---------------------------------------------------------------------
  // Game loop — fixed 60Hz update, clamped delta, paused while the tab is
  // hidden, the question overlay is open, or the pause menu is open.
  // ---------------------------------------------------------------------
  function startLoop() {
    S.lastFrameAt = performance.now();
    stopLoop();
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }
  function loop(now) {
    if (!S) return;
    rafId = requestAnimationFrame(loop);
    const frameDelta = Math.min(now - S.lastFrameAt, 250);
    S.lastFrameAt = now;

    if (document.hidden || S.paused || S.phase !== 'playing') {
      render();
      return;
    }

    S.accumulator += frameDelta;
    while (S.accumulator >= STEP_MS) {
      update(STEP_MS);
      S.accumulator -= STEP_MS;
    }
    render();
  }

  function enterPlaying() {
    S.phase = 'playing';
    S.nextOrbAt = S.simTime + rand(ORB_MIN_MS, ORB_MAX_MS);
    S.nextAttackAt = S.simTime + rand.apply(null, ATTACKS.ATTACK_INTERVAL_MS[S.attackPattern]);
  }

  // ---------------------------------------------------------------------
  // Fixed-step update
  // ---------------------------------------------------------------------
  function update(dt) {
    S.simTime += dt;
    updatePlayer(dt);
    updateNovaAnim();
    updateProjectiles(dt);
    updateOrb(dt);
    updateAttackState(dt);
    updateParticles(dt);
    S.bossBobPhase += dt * 0.003;
  }

  function updatePlayer(dt) {
    const p = S.player;
    const moveDir = (S.keys.right ? 1 : 0) - (S.keys.left ? 1 : 0);
    p.vx = moveDir * MOVE_SPEED;
    if (moveDir !== 0) p.facing = moveDir;

    p.vy = clamp(p.vy + GRAVITY, -Infinity, MAX_FALL);
    p.x = clamp(p.x + p.vx, 4, CANVAS_W - PLAYER_SIZE - 4);
    p.y += p.vy;

    p.onGround = false;
    const feetY = p.y + PLAYER_SIZE;
    for (const surf of SURFACES) {
      const withinX = p.x + PLAYER_SIZE > surf.x && p.x < surf.x + surf.w;
      if (!withinX) continue;
      const prevFeetY = feetY - p.vy;
      if (p.vy >= 0 && prevFeetY <= surf.y + 1 && feetY >= surf.y) {
        p.y = surf.y - PLAYER_SIZE;
        p.vy = 0;
        p.onGround = true;
      }
    }
    if (p.onGround) S.lastGroundedAt = S.simTime;

    const canJump = p.onGround || (S.simTime - S.lastGroundedAt <= COYOTE_MS);
    const wantsJump = S.simTime - S.jumpPressedAt <= JUMP_BUFFER_MS;
    if (wantsJump && canJump) {
      p.vy = JUMP_VELOCITY;
      p.onGround = false;
      S.jumpPressedAt = -Infinity;
      S.lastGroundedAt = -Infinity;
    }

    if (p.invulnUntil && S.simTime > p.invulnUntil) p.invulnUntil = 0;
  }

  // Idle/run/jump/fall — picked from physical state, not a separate
  // input-driven state machine, so it can never drift from what the
  // player is actually doing.
  function updateNovaAnim() {
    const p = S.player;
    let anim;
    if (!p.onGround) anim = p.vy < 0 ? 'jump' : 'fall';
    else if (p.vx !== 0) anim = 'run';
    else anim = 'idle';

    if (anim !== S.novaAnim) { S.novaAnim = anim; S.novaFrameTimer = 0; }
    S.novaFrameTimer += STEP_MS;
    if (anim === 'run' && S.novaFrameTimer > 90) {
      S.novaFrameTimer = 0;
      S.novaRunFrame = (S.novaRunFrame + 1) % 3;
    }
  }

  // ---------------------------------------------------------------------
  // Boss attacks — telegraphed (wind-up + a ground marker for low
  // shots), phase-dependent (single/double/arc by HP, derived from
  // battle-attacks.js), with a hop to the alternate boss spot whenever
  // the phase changes.
  // ---------------------------------------------------------------------
  function updateAttackState(dt) {
    const newPattern = ATTACKS.phaseForHp(S.bossHp);
    if (newPattern !== S.attackPattern) {
      S.attackPattern = newPattern;
      S.bossPosIndex = S.bossPosIndex === 0 ? 1 : 0; // hop to the other spot
    }

    if (S.attackState === 'idle') {
      if (S.simTime >= S.nextAttackAt) beginWindup();
      return;
    }
    if (S.attackState === 'windup') {
      if (S.simTime >= S.windupUntil) beginFiring();
      return;
    }
    if (S.attackState === 'firing') {
      for (let i = S.pendingShots.length - 1; i >= 0; i--) {
        const shot = S.pendingShots[i];
        if (S.simTime >= shot.fireAt) {
          fireProjectile(shot.low);
          S.pendingShots.splice(i, 1);
        }
      }
      if (S.pendingShots.length === 0) {
        S.attackState = 'idle';
        S.warningMarkerX = null;
        S.nextAttackAt = S.simTime + rand.apply(null, ATTACKS.ATTACK_INTERVAL_MS[S.attackPattern]);
      }
    }
  }

  function beginWindup() {
    S.attackState = 'windup';
    S.windupUntil = S.simTime + ATTACKS.WINDUP_MS;

    const sub = ATTACKS.SUB_INTERVAL_MS;
    let shots;
    if (S.attackPattern === 'single') {
      shots = [{ low: Math.random() < 0.5, fireAt: 0 }];
    } else if (S.attackPattern === 'double') {
      const low = Math.random() < 0.5;
      shots = [{ low, fireAt: 0 }, { low, fireAt: sub }];
    } else { // arc: low/high/low — same-type (low) spacing is 2 sub-intervals
      shots = [{ low: true, fireAt: 0 }, { low: false, fireAt: sub }, { low: true, fireAt: sub * 2 }];
    }
    S.pendingShots = shots.map(s => ({ low: s.low, fireAt: S.windupUntil + s.fireAt }));
    S.warningMarkerX = shots.some(s => s.low) ? bossPos().x : null;
  }

  function beginFiring() {
    S.attackState = 'firing';
  }

  function bossPos() { return BOSS_POSITIONS[S.bossPosIndex]; }

  function fireProjectile(isLow) {
    if (S.projectiles.length >= MAX_PROJECTILES) return;
    const danger = (HP_SEGMENTS - S.bossHp) / HP_SEGMENTS;
    const speed = rand(0.8, 1.4) + danger * 0.6;
    const boss = bossPos();
    S.projectiles.push({
      low: isLow,
      x: boss.x,
      y: isLow ? GROUND_Y - 8 : GROUND_Y - PLAYER_SIZE - 12,
      w: 8, h: 8,
      vx: -speed,
      bobBase: isLow ? GROUND_Y - 8 : null,
      age: 0,
      spin: 0
    });
  }

  function updateProjectiles(dt) {
    for (let i = S.projectiles.length - 1; i >= 0; i--) {
      const proj = S.projectiles[i];
      proj.x += proj.vx;
      proj.age += dt;
      proj.spin += dt * 0.006; // rolling ones roll, flying ones spin
      if (proj.low) proj.y = proj.bobBase - Math.abs(Math.sin(proj.age * 0.006)) * 6;
      if (proj.x < -12) { S.projectiles.splice(i, 1); continue; }

      const p = S.player;
      if (!p.invulnUntil && rectsOverlap(
        { x: p.x, y: p.y, w: PLAYER_SIZE, h: PLAYER_SIZE },
        { x: proj.x, y: proj.y, w: proj.w, h: proj.h }
      )) {
        triggerHit();
      }
    }
  }

  // Caps flashes to MAX_FLASHES_PER_SEC regardless of how many hit/fizzle
  // events happen close together — avoids any strobing effect.
  function canFlashNow() {
    const now = Date.now();
    S.flashTimestamps = S.flashTimestamps.filter(t => now - t < 1000);
    if (S.flashTimestamps.length >= MAX_FLASHES_PER_SEC) return false;
    S.flashTimestamps.push(now);
    return true;
  }

  function triggerHit() {
    const p = S.player;
    if (p.invulnUntil > S.simTime) return;
    p.invulnUntil = S.simTime + INVULN_MS;
    // Small knockback + pop — no HP/score/time/progress loss of any kind.
    p.vx = 0;
    p.vy = -2.5;
    p.x = clamp(p.x - p.facing * 10, 4, CANVAS_W - PLAYER_SIZE - 4);
    if (!reduceMotion && canFlashNow()) S.shakeUntil = S.simTime + 150;
    spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, '#e8453a', 6);
    if (callbacks.sounds && callbacks.sounds.hit) callbacks.sounds.hit();
  }

  function updateOrb(dt) {
    if (!S.orb) {
      if (S.simTime >= S.nextOrbAt && S.questionIndex < S.questions.length) spawnOrb();
      return;
    }
    S.orb.bobPhase += dt * 0.004;
    S.orbPulse += dt * 0.006;
    const p = S.player;
    if (rectsOverlap(
      { x: p.x, y: p.y, w: PLAYER_SIZE, h: PLAYER_SIZE },
      { x: S.orb.x - 5, y: S.orb.y - 5, w: 10, h: 10 }
    )) {
      S.orb = null;
      openQuestion();
    }
  }

  function spawnOrb() {
    const platform = ORB_SURFACES[Math.floor(Math.random() * ORB_SURFACES.length)];
    S.orb = { x: platform.x + platform.w / 2, y: platform.y - 10, bobPhase: 0 };
  }

  function updateParticles(dt) {
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const particle = S.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) { S.particles.splice(i, 1); continue; }
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.1;
    }
  }
  function spawnParticles(x, y, color, count) {
    if (reduceMotion) return;
    const room = MAX_PARTICLES - S.particles.length;
    const n = Math.max(0, Math.min(count, room));
    for (let i = 0; i < n; i++) {
      S.particles.push({
        x, y, color,
        vx: rand(-1.6, 1.6), vy: rand(-2.2, -0.4),
        life: rand(250, 450)
      });
    }
  }

  // ---------------------------------------------------------------------
  // Question overlay — reuses .ob-option/.ob-question styling. No timer.
  // ---------------------------------------------------------------------
  function openQuestion() {
    S.phase = 'question';
    S.paused = false;
    S.selectedOption = null;
    const q = S.questions[S.questionIndex];

    el.questionChapter.textContent = `Question ${S.questionIndex + 1} of ${S.questions.length} — ${S.chapterTitle}`;
    el.questionText.textContent = q.question;
    el.feedback.textContent = '';
    el.questionOptions.innerHTML = '';
    q.options.forEach((text, idx) => {
      const btn = document.createElement('button');
      btn.className = 'ob-option';
      btn.type = 'button';
      btn.textContent = text;
      btn.dataset.optionIndex = String(idx);
      btn.addEventListener('click', () => confirmAnswer(idx));
      el.questionOptions.appendChild(btn);
    });
    el.question.hidden = false;
    const firstOption = el.questionOptions.querySelector('.ob-option');
    if (firstOption) firstOption.focus();
  }

  function handleQuestionKey(e) {
    const buttons = Array.from(el.questionOptions.querySelectorAll('.ob-option'));
    if (!buttons.length) return;
    const digit = parseInt(e.key, 10);
    if (digit >= 1 && digit <= buttons.length) { e.preventDefault(); confirmAnswer(digit - 1); return; }

    let idx = buttons.findIndex(b => b === document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      idx = (idx + 1 + buttons.length) % buttons.length;
      buttons[idx].focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      idx = (idx - 1 + buttons.length) % buttons.length;
      buttons[idx].focus();
    } else if (e.key === 'Enter' && idx >= 0) {
      e.preventDefault();
      confirmAnswer(idx);
    }
  }

  async function confirmAnswer(optionIndex) {
    if (S.selectedOption !== null) return;
    S.selectedOption = optionIndex;
    el.questionOptions.querySelectorAll('.ob-option').forEach(b => { b.disabled = true; });

    let correct = false;
    try {
      const res = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: S.sessionId, questionIndex: S.questionIndex, selectedIndex: optionIndex })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not check that answer.');
      correct = !!data.correct;
    } catch (err) {
      el.feedback.textContent = err.message || "Couldn't reach the server — try again.";
      el.questionOptions.querySelectorAll('.ob-option').forEach(b => { b.disabled = false; });
      S.selectedOption = null;
      return;
    }

    const q = S.questions[S.questionIndex];
    S.recordedAnswers.push({ questionId: q.id, selectedIndex: optionIndex });
    if (correct) S.correctCount++;

    const chosenBtn = el.questionOptions.querySelector(`[data-option-index="${optionIndex}"]`);
    if (chosenBtn) chosenBtn.textContent += correct ? '  ✓' : '  ✗';
    el.feedback.textContent = correct ? 'Correct!' : 'Not quite.';

    setTimeout(() => resolveQuestion(correct), 700);
  }

  function resolveQuestion(correct) {
    el.question.hidden = true;
    S.questionIndex++;
    updateTally();

    if (correct) {
      S.bossHp = Math.max(0, S.bossHp - 1);
      renderHpBar();
      if (callbacks.sounds && callbacks.sounds.correct) callbacks.sounds.correct();
      fireChargedShot(() => afterResolveAnimation(correct));
    } else {
      if (callbacks.sounds && callbacks.sounds.wrong) callbacks.sounds.wrong();
      fizzleOrb(() => afterResolveAnimation(correct));
    }
  }

  function afterResolveAnimation(correct) {
    const boss = S.bossData;
    if (boss) {
      showBanner(correct ? boss.hitLine : boss.taunts[Math.floor(Math.random() * boss.taunts.length)], 1400);
    }
    setTimeout(() => {
      if (!S) return;
      if (S.questionIndex >= S.questions.length) {
        finishBattle();
      } else {
        S.phase = 'playing';
        S.nextOrbAt = S.simTime + rand(ORB_MIN_MS, ORB_MAX_MS);
      }
    }, 1400);
  }

  function updateTally() {
    el.tally.textContent = `Power-ups ${S.questionIndex} / ${S.questions.length} · Correct ${S.correctCount}`;
  }

  function renderHpBar() {
    el.hpBar.innerHTML = '';
    for (let i = 0; i < HP_SEGMENTS; i++) {
      const seg = document.createElement('div');
      seg.className = 'battle-hp-segment' + (i < S.bossHp ? ' filled' : '');
      el.hpBar.appendChild(seg);
    }
    el.hpBar.setAttribute('aria-label', `Boss HP: ${S.bossHp} of ${HP_SEGMENTS}`);
  }

  function showBanner(text, ms) {
    el.banner.textContent = text;
    el.banner.hidden = false;
    setTimeout(() => { if (el.banner.textContent === text) el.banner.hidden = true; }, ms);
  }

  // Short, real-time (not sim-time) cosmetic animations.
  function fireChargedShot(done) {
    if (reduceMotion) { done(); return; }
    const startX = S.player.x + PLAYER_SIZE / 2, startY = S.player.y + PLAYER_SIZE / 2;
    const boss = bossPos();
    const endX = boss.x + boss.w / 2, endY = boss.y + boss.h / 2;
    const shot = { x: startX, y: startY };
    S.shots.push(shot);
    const t0 = performance.now();
    const dur = 350;
    function step() {
      const t = Math.min(1, (performance.now() - t0) / dur);
      shot.x = startX + (endX - startX) * t;
      shot.y = startY + (endY - startY) * t;
      render();
      if (t < 1) requestAnimationFrame(step);
      else {
        S.shots.splice(S.shots.indexOf(shot), 1);
        if (canFlashNow()) S.bossFlashUntil = performance.now() + 180;
        spawnParticles(endX, endY, '#ffe66d', 8);
        render();
        done();
      }
    }
    requestAnimationFrame(step);
  }

  function fizzleOrb(done) {
    if (reduceMotion) { done(); return; }
    S.fizzleUntil = performance.now() + 300;
    render();
    setTimeout(done, 300);
  }

  async function finishBattle() {
    S.phase = 'outcome';
    el.feedback.textContent = '';
    let result;
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_session_id: S.sessionId })
      });
      result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not grade the battle.');
    } catch (err) {
      showBanner(err.message || 'Could not reach the server.', 2000);
      setTimeout(() => finishBattle(), 1500);
      return;
    }

    const boss = S.bossData;
    if (result.passed) {
      if (S.bossHp === 1 && !reduceMotion) {
        showBanner('Final strike!', 900);
        await sleep(900);
        S.bossHp = 0;
        renderHpBar();
      }
      // Defeat: a flicker (a couple of flash toggles, rate-capped same as
      // everything else), a particle burst, then confetti.
      S.defeated = true;
      if (!reduceMotion) {
        for (let i = 0; i < 2; i++) {
          if (canFlashNow()) { S.bossFlashUntil = performance.now() + 120; render(); await sleep(120); }
          render(); await sleep(120);
        }
        const boss2 = bossPos();
        spawnParticles(boss2.x + boss2.w / 2, boss2.y + boss2.h / 2, '#ffd34d', 20);
        render();
      }
      showBanner(boss ? boss.defeatedLine : 'Chapter cleared!', 1600);
      if (callbacks.confetti) callbacks.confetti();
      await sleep(reduceMotion ? 200 : 1600);
    } else {
      showBanner(boss ? `${boss.defeatPlayerLine} (HP ${S.bossHp}/${HP_SEGMENTS})` : `Not quite — HP ${S.bossHp}/${HP_SEGMENTS}`, 1800);
      await sleep(reduceMotion ? 200 : 1800);
    }

    exitFullscreenIfActive();
    el.overlay.classList.add('hidden');
    stopLoop();
    const onComplete = callbacks.onComplete;
    S = null;
    if (onComplete) onComplete(result);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ---------------------------------------------------------------------
  // Rendering — pre-rendered sprites only (battle-sprites.js), drawImage
  // at draw time; no per-frame shape math or allocation. Subtle shake
  // only (prefers-reduced-motion disables it entirely), flashes capped
  // at MAX_FLASHES_PER_SEC.
  // ---------------------------------------------------------------------
  function render() {
    if (!S || !ctx) return;
    ensureWorldCanvas();

    ctx.save();
    if (!reduceMotion && S.shakeUntil > performance.now()) {
      ctx.translate(rand(-2, 2), rand(-2, 2));
    }

    ctx.clearRect(-4, -4, CANVAS_W + 8, CANVAS_H + 8);
    ctx.drawImage(worldCanvas, 0, 0);

    const sprites = S.sprites;
    const boss = bossPos();
    const bobY = reduceMotion ? 0 : Math.round(Math.sin(S.bossBobPhase) * 2);

    // warning marker for an incoming low attack
    if (S.warningMarkerX !== null && S.attackState === 'windup') {
      ctx.fillStyle = 'rgba(255,214,77,0.6)';
      ctx.fillRect(S.warningMarkerX - 4, GROUND_Y - 2, 8, 2);
    }

    // boss
    if (S.bossHp <= 0 || S.defeated) {
      ctx.drawImage(sprites.boss(S.bossData.sprite).defeated, boss.x, boss.y + boss.h / 2, boss.w, boss.h / 2);
    } else {
      const flashing = S.bossFlashUntil && performance.now() < S.bossFlashUntil;
      let frame;
      if (S.attackState === 'windup' || S.attackState === 'firing') frame = sprites.boss(S.bossData.sprite).attack;
      else frame = sprites.boss(S.bossData.sprite).idle[Math.floor(S.bossBobPhase) % 2 === 0 ? 0 : 1];
      ctx.drawImage(frame, boss.x, boss.y + bobY, boss.w, boss.h);
      if (flashing) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillRect(boss.x, boss.y + bobY, boss.w, boss.h);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // orb (pulse)
    if (S.orb) {
      const bob = Math.sin(S.orb.bobPhase) * 3;
      const pulse = reduceMotion ? 1 : 1 + Math.sin(S.orbPulse) * 0.12;
      const size = 12 * pulse;
      ctx.drawImage(sprites.orb, S.orb.x - size / 2, S.orb.y - size / 2 + bob, size, size);
    }

    if (S.fizzleUntil && performance.now() < S.fizzleUntil) {
      ctx.fillStyle = 'rgba(120,120,130,0.25)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // projectiles — themed glyph, spinning/bobbing
    S.projectiles.forEach(p => {
      const sprite = sprites.glyph(S.chapterId, p.low ? 'rolling' : 'flying');
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.spin);
      ctx.drawImage(sprite, -p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    // charged shots
    S.shots.forEach(s => ctx.drawImage(sprites.shot, s.x - 5, s.y - 5, 10, 10));

    // particles (hit/impact/defeat bursts)
    S.particles.forEach(particle => {
      ctx.globalAlpha = Math.max(0, particle.life / 400);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 1, particle.y - 1, 2, 2);
      ctx.globalAlpha = 1;
    });

    // player (blinks while invulnerable)
    const p = S.player;
    const blinking = p.invulnUntil > S.simTime && Math.floor(performance.now() / 90) % 2 === 0;
    if (!blinking) {
      let frame;
      if (p.invulnUntil > S.simTime) frame = sprites.nova.hurt;
      else if (S.novaAnim === 'jump') frame = sprites.nova.jump;
      else if (S.novaAnim === 'fall') frame = sprites.nova.fall;
      else if (S.novaAnim === 'run') frame = sprites.nova.run[S.novaRunFrame];
      else frame = sprites.nova.idle[Math.floor(S.simTime / 500) % 2];
      ctx.save();
      if (p.facing < 0) { ctx.translate(p.x + PLAYER_SIZE, p.y); ctx.scale(-1, 1); ctx.drawImage(frame, 0, 0, PLAYER_SIZE, PLAYER_SIZE); }
      else { ctx.drawImage(frame, p.x, p.y, PLAYER_SIZE, PLAYER_SIZE); }
      ctx.restore();
    }

    ctx.restore();
  }

  window.BossBattle = { start, destroy };
})();
