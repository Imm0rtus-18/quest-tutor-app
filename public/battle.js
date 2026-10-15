// Boss battle — a small platformer wrapper around the exact same chapter
// quiz data/grading the Classic quiz uses. This file owns the canvas
// arena, physics, rendering, and input; it never grades anything itself —
// every answer goes through POST /api/quiz/answer (one question, no
// correct option ever returned) and the final pass/fail always comes
// from the SAME POST /api/quiz/submit the Classic quiz calls, so both
// paths share one source of truth. All art here is solid-color
// placeholder shapes (Stage 1) — no resemblance to any existing game is
// intended or needed since there's no art yet.
//
// Public API: window.BossBattle.start(adj, callbacks) / .destroy()
// adj: the topic_adjustment object from the server — { quiz_session_id,
//   chapter_id, chapter_title, boss, questions } — questions never carry
//   correctIndex.
// callbacks: { onSwitchToClassic(partial), onComplete(result) }
//   partial: { answeredSoFar: [{questionId,selectedIndex}], nextIndex }
//   result: the exact shape POST /api/quiz/submit returns.
(function () {
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
  const INVULN_MS = 1000;
  const MAX_PROJECTILES = 8;
  const PROJ_MIN_MS = 1200, PROJ_MAX_MS = 2000;
  const ORB_MIN_MS = 4000, ORB_MAX_MS = 7000;
  const PLAYER_SIZE = 16; // 8x8 sprite at 2x scale
  const GROUND_Y = 160;
  const HP_SEGMENTS = 10;

  const SURFACES = [
    { x: 0, y: GROUND_Y, w: CANVAS_W, h: 20 },
    { x: 40, y: 122, w: 58, h: 8 },
    { x: 182, y: 92, w: 58, h: 8 }
  ];
  const BOSS_POS = { x: 266, y: GROUND_Y - 40, w: 36, h: 40 };
  const PLAYER_START = { x: 24, y: GROUND_Y - PLAYER_SIZE };

  // Same 8x8 pixel pattern as the existing .nova-sprite SVG markup used
  // elsewhere in the app (chat header, auth screen) — reused here so the
  // platformer player is recognizably "Nova" without needing image
  // assets. [x, y, w, h, isDark]
  const NOVA_PIXELS = [
    [3, 0, 2, 1], [2, 1, 4, 1], [1, 2, 6, 1], [0, 3, 2, 1],
    [2, 3, 1, 1, true], [3, 3, 1, 1], [4, 3, 1, 1, true], [5, 3, 3, 1],
    [0, 4, 8, 1], [1, 5, 6, 1], [2, 6, 4, 1], [3, 7, 2, 1]
  ];
  const NOVA_CREAM = '#FAF6EF', NOVA_DARK = '#1A1A1A';

  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---------------------------------------------------------------------
  // DOM refs (resolved lazily — this script loads before the body in some
  // cache states would be fine either way since start() is always called
  // well after DOMContentLoaded, from a real user action).
  // ---------------------------------------------------------------------
  let el = {};
  function cacheEls() {
    el = {
      overlay: document.getElementById('battleOverlay'),
      shell: document.getElementById('battleShell'),
      start: document.getElementById('battleStart'),
      bossNameStart: document.getElementById('battleBossNameStart'),
      chapterTitleStart: document.getElementById('battleChapterTitleStart'),
      fightBtn: document.getElementById('battleFightBtn'),
      classicBtn: document.getElementById('battleClassicBtn'),
      arena: document.getElementById('battleArena'),
      bossNameHud: document.getElementById('battleBossNameHud'),
      hpBar: document.getElementById('battleHpBar'),
      tally: document.getElementById('battleTally'),
      pauseBtn: document.getElementById('battlePauseBtn'),
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

  function freshState(adj) {
    return {
      phase: 'start', // start | playing | question | resolving | outcome
      questions: adj.questions || [],
      questionIndex: 0,
      sessionId: adj.quiz_session_id,
      bossData: adj.boss,
      chapterTitle: adj.chapter_title || 'this chapter',
      recordedAnswers: [], // [{questionId, selectedIndex}] — mirrors what the server has recorded
      correctCount: 0,
      bossHp: HP_SEGMENTS,
      simTime: 0,
      lastFrameAt: 0,
      accumulator: 0,
      paused: false,
      keys: { left: false, right: false },
      jumpPressedAt: -Infinity,
      lastGroundedAt: -Infinity,
      player: { x: PLAYER_START.x, y: PLAYER_START.y, vx: 0, vy: 0, facing: 1, onGround: true, invulnUntil: 0 },
      projectiles: [],
      nextProjectileAt: 1200,
      orb: null,
      nextOrbAt: 2500,
      shots: [],
      fizzles: [],
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
    ctx = el.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

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
    el.overlay && el.overlay.classList.add('hidden');
    unbindListeners();
    S = null;
  }

  // ---------------------------------------------------------------------
  // Listeners (bound once per module load, guarded; battle state itself
  // decides whether to react)
  // ---------------------------------------------------------------------
  function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;

    el.fightBtn.addEventListener('click', onFightClicked);
    el.classicBtn.addEventListener('click', () => switchToClassic());
    el.pauseBtn.addEventListener('click', () => openPauseMenu());
    el.resumeBtn.addEventListener('click', () => closePauseMenu());
    el.pauseClassicBtn.addEventListener('click', () => switchToClassic());

    el.touchLeft.addEventListener('touchstart', e => { e.preventDefault(); if (S) S.keys.left = true; });
    el.touchLeft.addEventListener('touchend', e => { e.preventDefault(); if (S) S.keys.left = false; });
    el.touchRight.addEventListener('touchstart', e => { e.preventDefault(); if (S) S.keys.right = true; });
    el.touchRight.addEventListener('touchend', e => { e.preventDefault(); if (S) S.keys.right = false; });
    el.touchJump.addEventListener('touchstart', e => { e.preventDefault(); onJumpPressed(); });
    el.touchJump.addEventListener('touchend', e => { e.preventDefault(); onJumpReleased(); });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function unbindListeners() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    listenersBound = false;
  }

  function onVisibilityChange() {
    // Pausing the rAF loop itself (not just skipping updates) is handled
    // in the loop via document.hidden; nothing else needed here.
  }

  function isTypingTarget(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
  }

  function onKeyDown(e) {
    if (!S || isTypingTarget(e)) return;
    if (S.phase === 'question') { handleQuestionKey(e); return; }
    if (S.phase !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') S.keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') S.keys.right = true;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); onJumpPressed(); }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') openPauseMenu();
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
    enterPlaying();
    startLoop();
  }

  function switchToClassic() {
    stopLoop();
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
    S.nextProjectileAt = S.simTime + rand(PROJ_MIN_MS, PROJ_MAX_MS);
  }

  // ---------------------------------------------------------------------
  // Fixed-step update
  // ---------------------------------------------------------------------
  function update(dt) {
    S.simTime += dt;
    updatePlayer(dt);
    updateProjectiles(dt);
    updateOrb(dt);
    maybeSpawnProjectile();
  }

  function updatePlayer(dt) {
    const p = S.player;
    const moveDir = (S.keys.right ? 1 : 0) - (S.keys.left ? 1 : 0);
    p.vx = moveDir * MOVE_SPEED;
    if (moveDir !== 0) p.facing = moveDir;

    p.vy = clamp(p.vy + GRAVITY, -Infinity, MAX_FALL);
    p.x = clamp(p.x + p.vx, 4, CANVAS_W - PLAYER_SIZE - 4);
    p.y += p.vy;

    const wasOnGround = p.onGround;
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

  function maybeSpawnProjectile() {
    if (S.simTime < S.nextProjectileAt) return;
    if (S.projectiles.length < MAX_PROJECTILES) {
      const danger = (HP_SEGMENTS - S.bossHp) / HP_SEGMENTS; // 0..1, more variety as HP drops
      const isLow = Math.random() < 0.5;
      const speed = rand(0.8, 1.4) + danger * 0.6;
      S.projectiles.push({
        low: isLow,
        x: BOSS_POS.x,
        y: isLow ? GROUND_Y - 8 : GROUND_Y - PLAYER_SIZE - 12,
        w: 8, h: 8,
        vx: -speed,
        bobBase: isLow ? GROUND_Y - 8 : null,
        age: 0
      });
    }
    const danger = (HP_SEGMENTS - S.bossHp) / HP_SEGMENTS;
    S.nextProjectileAt = S.simTime + rand(PROJ_MIN_MS, PROJ_MAX_MS) * (1 - danger * 0.3);
  }

  function updateProjectiles(dt) {
    for (let i = S.projectiles.length - 1; i >= 0; i--) {
      const proj = S.projectiles[i];
      proj.x += proj.vx;
      proj.age += dt;
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

  function triggerHit() {
    const p = S.player;
    if (p.invulnUntil > S.simTime) return;
    p.invulnUntil = S.simTime + INVULN_MS;
    // Small knockback + pop — no HP/score/time/progress loss of any kind.
    p.vx = 0;
    p.vy = -2.5;
    p.x = clamp(p.x - p.facing * 10, 4, CANVAS_W - PLAYER_SIZE - 4);
    if (callbacks.sounds && callbacks.sounds.hit) callbacks.sounds.hit();
  }

  function updateOrb(dt) {
    if (!S.orb) {
      if (S.simTime >= S.nextOrbAt && S.questionIndex < S.questions.length) spawnOrb();
      return;
    }
    S.orb.bobPhase += dt * 0.004;
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
    const platforms = SURFACES.slice(1); // not the ground
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    S.orb = { x: platform.x + platform.w / 2, y: platform.y - 10, bobPhase: 0 };
  }

  // ---------------------------------------------------------------------
  // Question overlay — reuses .ob-option/.ob-question styling. No timer.
  // ---------------------------------------------------------------------
  function openQuestion() {
    S.phase = 'question';
    S.paused = false; // phase check alone already stops updates; paused is for the explicit pause menu
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
    if (S.selectedOption !== null) return; // already submitting this question
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

    // Feedback is never color-only: text + icon on the chosen button.
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

  // Short, real-time (not sim-time) cosmetic animations — simple enough
  // not to need routing through the fixed-step loop.
  function fireChargedShot(done) {
    if (reduceMotion) { done(); return; }
    const startX = S.player.x + PLAYER_SIZE / 2, startY = S.player.y + PLAYER_SIZE / 2;
    const endX = BOSS_POS.x + BOSS_POS.w / 2, endY = BOSS_POS.y + BOSS_POS.h / 2;
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
        S.bossFlashUntil = performance.now() + 180;
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
      setTimeout(() => finishBattle(), 1500); // retry — the session is still ungraded, safe to retry
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
      showBanner(boss ? boss.defeatedLine : 'Chapter cleared!', 1600);
      await sleep(reduceMotion ? 200 : 1600);
    } else {
      showBanner(boss ? `${boss.defeatPlayerLine} (HP ${S.bossHp}/${HP_SEGMENTS})` : `Not quite — HP ${S.bossHp}/${HP_SEGMENTS}`, 1800);
      await sleep(reduceMotion ? 200 : 1800);
    }

    el.overlay.classList.add('hidden');
    stopLoop();
    const onComplete = callbacks.onComplete;
    S = null;
    if (onComplete) onComplete(result);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ---------------------------------------------------------------------
  // Rendering — low internal resolution, scaled up via CSS
  // image-rendering:pixelated. Solid-color placeholder shapes (Stage 1).
  // ---------------------------------------------------------------------
  function render() {
    if (!S || !ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#12121f';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // surfaces
    ctx.fillStyle = '#5a4328';
    for (const s of SURFACES) ctx.fillRect(s.x, s.y, s.w, s.h);

    // boss
    const boss = BOSS_POS;
    const flashing = S.bossFlashUntil && performance.now() < S.bossFlashUntil;
    ctx.fillStyle = S.bossHp <= 0 ? '#555' : (flashing ? '#ffffff' : '#d8362a');
    ctx.fillRect(boss.x, boss.y, boss.w, boss.h);

    // orb
    if (S.orb) {
      const bob = Math.sin(S.orb.bobPhase) * 3;
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(S.orb.x - 5, S.orb.y - 5 + bob, 10, 10);
    }

    // fizzle flash at last orb spot isn't tracked post-collection; show a
    // simple full-arena tint instead, very briefly.
    if (S.fizzleUntil && performance.now() < S.fizzleUntil) {
      ctx.fillStyle = 'rgba(120,120,130,0.25)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // projectiles
    ctx.fillStyle = '#9b59b6';
    for (const p of S.projectiles) ctx.fillRect(p.x, p.y, p.w, p.h);

    // charged shots
    ctx.fillStyle = '#ffe66d';
    for (const s of S.shots) ctx.fillRect(s.x - 3, s.y - 3, 6, 6);

    // player (blinks while invulnerable)
    const p = S.player;
    const blinking = p.invulnUntil > S.simTime && Math.floor(performance.now() / 90) % 2 === 0;
    if (!blinking) drawNova(p.x, p.y, 2);
  }

  function drawNova(px, py, scale) {
    for (const [x, y, w, h, dark] of NOVA_PIXELS) {
      ctx.fillStyle = dark ? NOVA_DARK : NOVA_CREAM;
      ctx.fillRect(px + x * scale, py + y * scale, w * scale, h * scale);
    }
  }

  window.BossBattle = { start, destroy };
})();
