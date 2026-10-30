// Practice view (Quick practice / Show your work / Spot the mistake).
// Everything correct-or-not is decided by the server's code; this file only
// shows problems, sends answers, and renders what comes back. Nova is only
// called from the explicit "Why did I miss it?"-style buttons.
//
// Builds its own full-screen overlay on first open, so index.html only
// needs a button that calls window.Practice.open().
(function () {
  'use strict';

  const ROUND_SIZE = 10;
  const TABS = [
    { id: 'quick', label: 'Quick practice', enabled: true },
    { id: 'steps', label: 'Show your work', enabled: true },
    { id: 'spot', label: 'Spot the mistake', enabled: false }
  ];

  let root = null;
  let opener = null;
  const state = {
    concepts: null,      // /api/practice/concepts response
    quick: { round: [], current: null, answered: false }
  };

  // ── Tiny DOM helper (textContent only — nothing is ever set as HTML) ──
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
    return data;
  }

  // ── Shell ─────────────────────────────────────────────────────────────
  function build() {
    const tabButtons = TABS.map((t, i) => el('button', {
      class: 'pr-tab', type: 'button', role: 'tab', id: `pr-tab-${t.id}`,
      'aria-controls': `pr-panel-${t.id}`, 'aria-selected': i === 0 ? 'true' : 'false',
      tabindex: i === 0 ? '0' : '-1', disabled: !t.enabled,
      title: t.enabled ? null : 'Coming soon',
      onclick: () => selectTab(t.id)
    }, t.label));

    const tablist = el('div', { class: 'pr-tabs', role: 'tablist', 'aria-label': 'Practice modes' }, tabButtons);
    tablist.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
      const enabled = tabButtons.filter((b) => !b.disabled);
      let i = enabled.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      if (e.key === 'ArrowRight') i = (i + 1) % enabled.length;
      else if (e.key === 'ArrowLeft') i = (i - 1 + enabled.length) % enabled.length;
      else if (e.key === 'Home') i = 0;
      else i = enabled.length - 1;
      enabled[i].focus();
      selectTab(enabled[i].id.replace('pr-tab-', ''));
    });

    root = el('div', { class: 'pr-overlay', id: 'practiceOverlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pr-title', hidden: true },
      el('div', { class: 'pr-header' },
        el('h2', { class: 'pr-title', id: 'pr-title' }, 'Practice'),
        tablist,
        el('button', { class: 'pr-close', type: 'button', onclick: close }, '✕ Close')
      ),
      el('div', { class: 'pr-body' },
        TABS.map((t, i) => el('section', {
          class: 'pr-panel', id: `pr-panel-${t.id}`, role: 'tabpanel', 'aria-labelledby': `pr-tab-${t.id}`, hidden: i !== 0
        }))
      ),
      el('div', { class: 'pr-sr-only', 'aria-live': 'polite', id: 'pr-live' })
    );
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    document.body.appendChild(root);
  }

  function selectTab(id) {
    for (const t of TABS) {
      const btn = document.getElementById(`pr-tab-${t.id}`);
      const panel = document.getElementById(`pr-panel-${t.id}`);
      const on = t.id === id;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
    }
    if (id === 'quick') renderQuick();
    if (PANELS[id]) PANELS[id]();
  }

  function announce(msg) {
    const live = document.getElementById('pr-live');
    if (live) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); }
  }

  async function open() {
    opener = document.activeElement;
    if (!root) build();
    root.hidden = false;
    document.getElementById('pr-tab-quick').focus();
    selectTab('quick');
  }

  function close() {
    if (!root) return;
    root.hidden = true;
    if (opener && opener.focus) opener.focus();
  }

  // ── Concepts ──────────────────────────────────────────────────────────
  async function loadConcepts() {
    if (!state.concepts) state.concepts = await api('GET', '/api/practice/concepts');
    return state.concepts;
  }

  function conceptInfo(id) {
    for (const ch of state.concepts.chapters) for (const c of ch.concepts) if (c.id === id) return c;
    return null;
  }

  function conceptSelect(id, selected, filter) {
    const sel = el('select', { class: 'pr-select', id });
    for (const ch of state.concepts.chapters) {
      const concepts = ch.concepts.filter(filter || (() => true));
      if (!concepts.length) continue;
      const group = el('optgroup', { label: ch.title });
      for (const c of concepts) group.appendChild(el('option', { value: c.id, selected: c.id === selected }, c.label));
      sel.appendChild(group);
    }
    return sel;
  }

  function defaultConcept(filter) {
    const chs = state.concepts.chapters;
    const ch = chs.find((c) => c.id === state.concepts.current_chapter) || chs[0];
    const pool = ch.concepts.filter(filter || (() => true));
    return (pool[0] || chs.flatMap((c) => c.concepts).filter(filter || (() => true))[0]).id;
  }

  // ── Quick practice ────────────────────────────────────────────────────
  let quickBuilt = false;

  async function renderQuick() {
    const panel = document.getElementById('pr-panel-quick');
    if (quickBuilt) return;
    panel.textContent = '';
    panel.appendChild(el('p', { class: 'pr-muted' }, 'Loading…'));
    try {
      await loadConcepts();
    } catch (err) {
      panel.textContent = '';
      panel.appendChild(el('p', { class: 'pr-error' }, err.message));
      return;
    }
    quickBuilt = true;
    panel.textContent = '';

    const select = conceptSelect('pr-quick-concept', defaultConcept());
    const modeMc = el('input', { type: 'radio', name: 'pr-quick-mode', value: 'mc', checked: true });
    const modeTyped = el('input', { type: 'radio', name: 'pr-quick-mode', value: 'typed' });
    const syncMode = () => {
      const info = conceptInfo(select.value);
      const numeric = info && info.answerType === 'number';
      modeTyped.disabled = !numeric;
      if (!numeric) modeMc.checked = true;
    };
    select.addEventListener('change', () => { syncMode(); startRound(); });
    modeMc.addEventListener('change', () => nextProblem());
    modeTyped.addEventListener('change', () => nextProblem());
    syncMode();

    panel.appendChild(el('div', { class: 'pr-controls' },
      el('div', { class: 'pr-field' }, el('label', { class: 'pr-label', for: 'pr-quick-concept' }, 'Concept'), select),
      el('fieldset', { class: 'pr-mode' },
        el('legend', {}, 'Answer by'),
        el('label', {}, modeMc, el('span', {}, 'Choosing')),
        el('label', {}, modeTyped, el('span', {}, 'Typing'))
      )
    ));
    panel.appendChild(el('div', { id: 'pr-quick-stage' }));
    startRound();
  }

  function quickSettings() {
    const concept = document.getElementById('pr-quick-concept').value;
    const typed = document.querySelector('input[name="pr-quick-mode"][value="typed"]');
    return { concept, mode: typed && typed.checked && !typed.disabled ? 'typed' : 'mc' };
  }

  function startRound() {
    state.quick.round = [];
    nextProblem();
  }

  async function nextProblem() {
    const stage = document.getElementById('pr-quick-stage');
    if (!stage) return;
    if (state.quick.round.length >= ROUND_SIZE) return renderSummary();
    const { concept, mode } = quickSettings();
    stage.textContent = '';
    stage.appendChild(el('p', { class: 'pr-muted' }, 'Loading a problem…'));
    let problem;
    try {
      problem = await api('GET', `/api/practice/problem?concept=${encodeURIComponent(concept)}&mode=${mode}`);
    } catch (err) {
      stage.textContent = '';
      stage.appendChild(el('p', { class: 'pr-error' }, err.message));
      return;
    }
    state.quick.current = problem;
    state.quick.answered = false;
    renderProblem(problem);
  }

  function renderProblem(problem) {
    const stage = document.getElementById('pr-quick-stage');
    stage.textContent = '';
    const n = state.quick.round.length + 1;
    const card = el('div', { class: 'pr-card' },
      el('p', { class: 'pr-progress' }, `Problem ${n} of ${ROUND_SIZE}`),
      el('p', { class: 'pr-prompt', id: 'pr-quick-prompt' }, problem.prompt)
    );

    if (problem.mode === 'mc') {
      const grid = el('div', { class: 'pr-options', role: 'group', 'aria-labelledby': 'pr-quick-prompt' });
      problem.options.forEach((text) => {
        grid.appendChild(el('button', { class: 'pr-option', type: 'button', onclick: () => submit(text) }, text));
      });
      card.appendChild(grid);
      stage.appendChild(card);
      grid.querySelector('button').focus();
    } else {
      const input = el('input', {
        class: 'pr-input', type: 'text', id: 'pr-quick-input', autocomplete: 'off', inputmode: 'text',
        maxlength: '30', 'aria-label': 'Your answer', placeholder: 'e.g. 7, -3, 2/5'
      });
      const check = el('button', { class: 'pr-btn primary', type: 'button', onclick: () => submit(input.value) }, 'Check');
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(input.value); } });
      card.appendChild(el('div', { class: 'pr-typed' }, input, check));
      card.appendChild(el('p', { class: 'pr-error', id: 'pr-quick-inputerr', role: 'alert' }));
      stage.appendChild(card);
      input.focus();
    }
    stage.appendChild(el('div', { id: 'pr-quick-result' }));
  }

  async function submit(answer) {
    const problem = state.quick.current;
    if (!problem || state.quick.answered) return;
    if (problem.mode === 'typed' && !String(answer).trim()) return;
    let result;
    try {
      result = await api('POST', '/api/practice/answer', { token: problem.token, answer: String(answer) });
    } catch (err) {
      const errBox = document.getElementById('pr-quick-inputerr');
      if (errBox) errBox.textContent = err.message;
      else announce(err.message);
      return;
    }
    state.quick.answered = true;
    state.quick.round.push({ conceptId: problem.conceptId, correct: result.correct, mistakeLabel: result.mistakeLabel });

    const stage = document.getElementById('pr-quick-stage');
    stage.querySelectorAll('.pr-option').forEach((b) => {
      b.disabled = true;
      if (b.textContent === result.correctAnswer) b.classList.add('is-correct');
      else if (b.textContent === answer) b.classList.add('is-wrong');
    });
    const input = document.getElementById('pr-quick-input');
    if (input) { input.readOnly = true; stage.querySelector('.pr-typed .pr-btn').disabled = true; }

    const box = document.getElementById('pr-quick-result');
    box.textContent = '';
    const resultCard = el('div', { class: `pr-result ${result.correct ? 'good' : 'bad'}` },
      el('p', { class: 'pr-result-title' }, result.correct ? '✓ Correct' : `✗ Not quite. The answer is ${result.correctAnswer}`),
      !result.correct && result.mistakeLabel ? el('p', {}, `Looks like ${result.mistakeLabel}.`) : null,
      el('p', { class: 'pr-label' }, 'Worked solution'),
      el('ol', { class: 'pr-worked' }, result.worked.map((line) => el('li', {}, line)))
    );
    const nextBtn = el('button', { class: 'pr-btn primary', type: 'button', onclick: nextProblem },
      state.quick.round.length >= ROUND_SIZE ? 'See summary' : 'Next problem');
    const actions = el('div', { class: 'pr-actions' }, nextBtn);
    if (!result.correct) {
      const why = el('button', { class: 'pr-btn', type: 'button' }, 'Why did I miss it?');
      why.addEventListener('click', () => askNova(why, resultCard, {
        trigger: 'practice_feedback', token: problem.token, answer: String(answer)
      }));
      actions.appendChild(why);
    }
    resultCard.appendChild(actions);
    box.appendChild(resultCard);
    announce(result.correct ? 'Correct.' : `Not quite. The answer is ${result.correctAnswer}.`);
    nextBtn.focus();
  }

  // Shared by every "ask Nova" button: one call per click, button disabled
  // after so the free quota isn't burned by repeat clicks.
  async function askNova(button, container, body) {
    button.disabled = true;
    const note = el('div', { class: 'pr-nova', 'aria-live': 'polite' }, el('span', { class: 'pr-nova-name' }, 'Nova'), 'Thinking…');
    container.appendChild(note);
    try {
      const data = await api('POST', '/api/tutor', body);
      note.lastChild.textContent = data.reply;
    } catch (err) {
      note.lastChild.textContent = err.message;
      button.disabled = false;
    }
  }

  function renderSummary() {
    const stage = document.getElementById('pr-quick-stage');
    stage.textContent = '';
    const round = state.quick.round;
    const right = round.filter((r) => r.correct).length;
    const slips = {};
    round.filter((r) => !r.correct).forEach((r) => {
      const k = r.mistakeLabel || 'a different slip';
      slips[k] = (slips[k] || 0) + 1;
    });
    const again = el('button', { class: 'pr-btn primary', type: 'button', onclick: startRound }, 'Another round');
    stage.appendChild(el('div', { class: 'pr-card' },
      el('p', { class: 'pr-progress' }, 'Round summary'),
      el('p', { class: 'pr-prompt' }, `${right} out of ${round.length} correct`),
      Object.keys(slips).length
        ? el('div', {}, el('p', {}, 'What tripped you up:'), el('ul', { class: 'pr-summary-list' },
            Object.entries(slips).map(([k, n]) => el('li', {}, `${k} (${n}×)`))))
        : el('p', {}, 'Clean round, no slips.'),
      el('div', { class: 'pr-actions' }, again)
    ));
    announce(`Round done: ${right} out of ${round.length} correct.`);
    again.focus();
  }

  // ── Show your work ────────────────────────────────────────────────────
  // The student types one line at a time; the server's checker decides
  // each line. A valid line joins the log, an invalid one stays in the
  // input with a short reason, and "can't check that format" is never
  // counted as a mistake. The answer is never shown here.
  const work = { problem: null, lines: [], rejected: '', done: false, busy: false };
  let stepsBuilt = false;
  const stepsFilter = (c) => c.steps;

  async function renderSteps() {
    const panel = document.getElementById('pr-panel-steps');
    if (stepsBuilt) return;
    panel.textContent = '';
    try { await loadConcepts(); } catch (err) {
      panel.appendChild(el('p', { class: 'pr-error' }, err.message));
      return;
    }
    stepsBuilt = true;
    const select = conceptSelect('pr-steps-concept', defaultConcept(stepsFilter), stepsFilter);
    select.addEventListener('change', newWorkProblem);
    panel.appendChild(el('div', { class: 'pr-controls' },
      el('div', { class: 'pr-field' }, el('label', { class: 'pr-label', for: 'pr-steps-concept' }, 'Concept'), select)));
    panel.appendChild(el('div', { id: 'pr-steps-stage' }));
    newWorkProblem();
  }

  async function newWorkProblem() {
    const stage = document.getElementById('pr-steps-stage');
    stage.textContent = '';
    stage.appendChild(el('p', { class: 'pr-muted' }, 'Loading a problem…'));
    const concept = document.getElementById('pr-steps-concept').value;
    try {
      work.problem = await api('GET', `/api/practice/problem?concept=${encodeURIComponent(concept)}&mode=steps`);
    } catch (err) {
      stage.textContent = '';
      stage.appendChild(el('p', { class: 'pr-error' }, err.message));
      return;
    }
    work.lines = [work.problem.start];
    work.rejected = '';
    work.done = false;
    renderWork();
  }

  function formatExample() {
    return work.problem.kind === 'equation' ? '2x + 3 = 11' : '3x + 5';
  }

  function renderWork() {
    const stage = document.getElementById('pr-steps-stage');
    stage.textContent = '';
    const p = work.problem;
    const log = el('ol', { class: 'pr-log', id: 'pr-steps-log', 'aria-label': 'Your work so far' },
      work.lines.map((line, i) => el('li', {},
        el('span', { class: 'pr-mark ok', 'aria-hidden': 'true' }, i === 0 ? '▸' : '✓'),
        el('span', {}, line),
        el('span', { class: 'pr-sr-only' }, i === 0 ? '(starting line)' : '(checked)'))));
    const card = el('div', { class: 'pr-card' },
      el('p', { class: 'pr-progress' }, p.kind === 'equation' ? 'Solve it one line at a time' : 'Simplify it one line at a time'),
      el('p', { class: 'pr-prompt' }, p.prompt),
      log);

    if (work.done) {
      card.appendChild(el('div', { class: 'pr-result good' },
        el('p', { class: 'pr-result-title' }, '✓ Solved'),
        el('p', {}, work.summary)));
      const next = el('button', { class: 'pr-btn primary', type: 'button', onclick: newWorkProblem }, 'New problem');
      card.appendChild(el('div', { class: 'pr-actions' }, next));
      stage.appendChild(card);
      next.focus();
      return;
    }

    const input = el('input', {
      class: 'pr-input', type: 'text', id: 'pr-steps-input', autocomplete: 'off', spellcheck: 'false',
      maxlength: String(p.maxLength || 60), 'aria-label': 'Your next line', 'aria-describedby': 'pr-steps-feedback',
      placeholder: `Next line, e.g. ${formatExample()}`
    });
    input.value = work.rejected;
    const check = el('button', { class: 'pr-btn primary', type: 'button', onclick: () => submitLine(input.value) }, 'Check line');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitLine(input.value); } });
    const undo = el('button', { class: 'pr-btn small', type: 'button', disabled: work.lines.length < 2, onclick: undoLine }, 'Undo last line');
    const hint = el('button', { class: 'pr-btn small', type: 'button', id: 'pr-steps-hint' }, 'Stuck? Hint');
    const hintBox = el('div', { id: 'pr-steps-hintbox' });
    hint.addEventListener('click', () => {
      hintBox.textContent = '';
      askNova(hint, hintBox, {
        trigger: 'step_hint', token: p.token,
        lastValidLine: work.lines[work.lines.length - 1], rejectedLine: work.rejected || undefined
      });
    });
    card.appendChild(el('div', { class: 'pr-typed' }, input, check));
    card.appendChild(el('p', { class: 'pr-step-feedback', id: 'pr-steps-feedback', 'aria-live': 'polite' }));
    card.appendChild(el('div', { class: 'pr-actions' }, undo, hint));
    card.appendChild(hintBox);
    stage.appendChild(card);
    input.focus();
  }

  function setStepFeedback(text, bad) {
    const fb = document.getElementById('pr-steps-feedback');
    if (!fb) return;
    fb.textContent = text;
    fb.className = 'pr-step-feedback' + (bad ? ' bad' : '');
  }

  async function submitLine(raw) {
    const line = String(raw).trim();
    if (!line || work.busy || work.done) return;
    work.busy = true;
    let r;
    try {
      r = await api('POST', '/api/practice/step', {
        token: work.problem.token, previousLine: work.lines[work.lines.length - 1], line
      });
    } catch (err) {
      work.busy = false;
      setStepFeedback(err.message, true);
      return;
    }
    work.busy = false;
    if (r.result === 'equivalent') {
      work.lines.push(line);
      work.rejected = '';
      if (r.finished) {
        work.done = true;
        work.summary = `Solved in ${r.lineCount} line${r.lineCount === 1 ? '' : 's'}, ${r.slips} slip${r.slips === 1 ? '' : 's'}.`;
        renderWork();
        announce(work.summary);
        return;
      }
      renderWork();
      setStepFeedback('✓ That checks out. Keep going.', false);
    } else if (r.result === 'not_equivalent') {
      work.rejected = line;
      setStepFeedback(`✕ ${r.reason}`, true);
      const input = document.getElementById('pr-steps-input');
      if (input) { input.focus(); input.select(); }
    } else {
      work.rejected = '';
      setStepFeedback(`I can't check that format, try something like ${formatExample()}.`, false);
      const input = document.getElementById('pr-steps-input');
      if (input) input.focus();
    }
  }

  function undoLine() {
    if (work.lines.length < 2 || work.done) return;
    work.lines.pop();
    work.rejected = '';
    renderWork();
    setStepFeedback('Removed your last line.', false);
  }

  // Later stages register their tab renderers here.
  const PANELS = { steps: renderSteps };

  window.Practice = { open, close, _internals: { el, api, askNova, announce, loadConcepts, conceptSelect, defaultConcept, state, PANELS, TABS } };
})();
