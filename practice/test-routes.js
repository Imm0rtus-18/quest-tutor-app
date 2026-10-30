// End-to-end test of the practice API over real HTTP, with an in-memory
// fake of the two tables it touches and a fake LLM. No network, no DB.
//   node practice/test-routes.js
const assert = require('assert');
const express = require('express');
const { mountPractice, makeTokenCodec } = require('./routes');
const { generateProblem } = require('./generators');
const { CURRICULUM } = require('../curriculum');

const SECRET = 'test-secret';
const attempts = [];
const fakePool = {
  async query(sql, params) {
    if (/INSERT INTO practice_attempts/.test(sql)) {
      const nonce = params[6];
      if (attempts.some((a) => a.nonce === nonce)) return { rowCount: 0, rows: [] };
      attempts.push({ user_id: params[0], mode: params[1], concept_id: params[2], correct: params[3], mistake_tag: params[4], step_errors: params[5], nonce });
      return { rowCount: 1, rows: [] };
    }
    if (/FROM user_progress/.test(sql)) return { rows: [{ subject_level: 'algebra1', current_topic_index: 2 }] };
    if (/FROM practice_attempts/.test(sql)) return { rows: [] };
    throw new Error('unexpected query ' + sql);
  }
};
const novaCalls = [];
const fakeAskNova = async (system, user) => { novaCalls.push({ system, user }); return 'First sentence. Second one is 2.5 long. Third. Fourth should be cut.'; };

const app = express();
app.use(express.json());
const sessions = {};
app.use((req, res, next) => { const u = Number(req.headers['x-test-user'] || 0); req.session = u ? (sessions[u] = sessions[u] || { userId: u, id: 'sess-' + u }) : {}; next(); });
const requireAuth = (req, res, next) => (req.session.userId ? next() : res.status(401).json({ error: 'Not authenticated.' }));
const practice = mountPractice(app, { pool: fakePool, requireAuth, askNova: fakeAskNova, secret: SECRET, curriculum: CURRICULUM });
app.post('/api/tutor', requireAuth, (req, res) => {
  if (practice.isPracticeTrigger(req.body && req.body.trigger)) return practice.handleTutorTrigger(req, res);
  res.status(418).json({ error: 'normal tutor path not under test' });
});

let base;
async function call(method, path, body, user = 1) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': String(user) } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json() };
}
function decode(token) { return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()); }

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([name, 'pass']); } catch (e) { results.push([name, 'FAIL: ' + e.message]); }
}

(async () => {
  const server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  await test('login required', async () => {
    assert.strictEqual((await call('GET', '/api/practice/problem?concept=two-step-equations', null, 0)).status, 401);
    assert.strictEqual((await call('POST', '/api/practice/answer', { token: 'x', answer: '1' }, 0)).status, 401);
  });

  await test('concepts grouped by chapter, current chapter from DB', async () => {
    const r = await call('GET', '/api/practice/concepts');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.current_chapter, 'algebra1-03');
    assert.ok(r.body.chapters.length >= 5);
    assert.ok(r.body.chapters[0].concepts.every((c) => c.practice && c.practice.attempts === 0));
  });

  await test('problem response never reveals the answer', async () => {
    const r = await call('GET', '/api/practice/problem?concept=two-step-equations&mode=mc');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(Object.keys(r.body).sort(), ['answerType', 'conceptId', 'mode', 'options', 'prompt', 'token']);
    const p = decode(r.body.token);
    assert.deepStrictEqual(Object.keys(p).sort(), ['c', 'e', 'm', 'n', 's', 'u']);
    assert.ok(p.e - Date.now() > 1.9 * 3600e3 && p.e - Date.now() <= 2 * 3600e3);
  });

  await test('typed mode omits options; choice concepts force mc', async () => {
    const t = await call('GET', '/api/practice/problem?concept=two-step-equations&mode=typed');
    assert.strictEqual(t.body.mode, 'typed'); assert.ok(!('options' in t.body));
    const c = await call('GET', '/api/practice/problem?concept=translating-sum-phrases&mode=typed');
    assert.strictEqual(c.body.mode, 'mc'); assert.strictEqual(c.body.options.length, 4);
  });

  await test('correct answer graded right and recorded once per nonce', async () => {
    const r = await call('GET', '/api/practice/problem?concept=two-step-equations&mode=mc');
    const p = decode(r.body.token);
    const truth = generateProblem(p.c, p.s);
    const a1 = await call('POST', '/api/practice/answer', { token: r.body.token, answer: truth.answer });
    assert.strictEqual(a1.status, 200);
    assert.strictEqual(a1.body.correct, true);
    assert.strictEqual(a1.body.recorded, true);
    assert.ok(Array.isArray(a1.body.worked) && a1.body.worked.length);
    const a2 = await call('POST', '/api/practice/answer', { token: r.body.token, answer: truth.answer });
    assert.strictEqual(a2.body.recorded, false);
    assert.strictEqual(attempts.filter((a) => a.nonce === p.n).length, 1);
  });

  await test('wrong option returns its mistake tag', async () => {
    const r = await call('GET', '/api/practice/problem?concept=multi-step-equations-with-distribution&mode=mc');
    const p = decode(r.body.token);
    const wrong = generateProblem(p.c, p.s).options.find((o) => o.tag);
    const a = await call('POST', '/api/practice/answer', { token: r.body.token, answer: wrong.text });
    assert.strictEqual(a.body.correct, false);
    assert.strictEqual(a.body.mistake, wrong.tag);
    assert.ok(a.body.mistakeLabel);
  });

  await test('typed answers normalized (x = 6/1, unicode minus, decimals)', async () => {
    const r = await call('GET', '/api/practice/problem?concept=two-step-equations&mode=typed');
    const truth = generateProblem(decode(r.body.token).c, decode(r.body.token).s);
    const typed = `x = ${truth.answer.replace('-', '−')}/1`;
    const a = await call('POST', '/api/practice/answer', { token: r.body.token, answer: typed });
    assert.strictEqual(a.body.correct, true, typed);
    const bad = await call('POST', '/api/practice/answer', { token: r.body.token, answer: 'banana' });
    assert.strictEqual(bad.status, 422);
  });

  await test('tampered, foreign and expired tokens rejected', async () => {
    const r = await call('GET', '/api/practice/problem?concept=two-step-equations&mode=mc');
    const [body, mac] = r.body.token.split('.');
    const p = decode(r.body.token); p.s = p.s + 1;
    const forged = Buffer.from(JSON.stringify(p)).toString('base64url') + '.' + mac;
    assert.strictEqual((await call('POST', '/api/practice/answer', { token: forged, answer: '1' })).status, 400);
    assert.strictEqual((await call('POST', '/api/practice/answer', { token: r.body.token, answer: '1' }, 2)).status, 400);
    const codec = makeTokenCodec(SECRET);
    const old = codec.issue({ conceptId: 'two-step-equations', seed: 5, mode: 'mc', userId: 1 }, Date.now() - 3 * 3600e3).token;
    assert.strictEqual((await call('POST', '/api/practice/answer', { token: old, answer: '1' })).status, 400);
    assert.ok(body);
  });

  await test("practice_feedback quotes server-rebuilt data, caps at 3 sentences", async () => {
    const r = await call('GET', '/api/practice/problem?concept=two-step-equations&mode=mc');
    const p = decode(r.body.token);
    const truth = generateProblem(p.c, p.s);
    const wrong = truth.options.find((o) => o.tag);
    const before = novaCalls.length;
    const f = await call('POST', '/api/tutor', { trigger: 'practice_feedback', token: r.body.token, answer: wrong.text });
    assert.strictEqual(f.status, 200);
    assert.strictEqual(f.body.reply, 'First sentence. Second one is 2.5 long. Third.');
    const sent = novaCalls[before].user;
    assert.ok(sent.includes(`Correct answer: "${truth.answer}"`));
    assert.ok(sent.includes(`Student's answer: "${wrong.text}"`));
    const ok = await call('POST', '/api/tutor', { trigger: 'practice_feedback', token: r.body.token, answer: truth.answer });
    assert.strictEqual(ok.status, 400);
    assert.strictEqual(novaCalls.length, before + 1);
  });

  // ── Stage B: Show your work ──
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function stepsProblem(concept = 'two-step-equations') {
    const r = await call('GET', `/api/practice/problem?concept=${concept}&mode=steps`);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(!('answer' in r.body) && !('options' in r.body));
    return { ...r.body, truth: generateProblem(decode(r.body.token).c, decode(r.body.token).s) };
  }

  await test('steps: concepts flag which ones support Show your work', async () => {
    const r = await call('GET', '/api/practice/concepts');
    const all = r.body.chapters.flatMap((c) => c.concepts);
    assert.ok(all.find((c) => c.id === 'two-step-equations').steps);
    assert.ok(!all.find((c) => c.id === 'translating-sum-phrases').steps);
    assert.strictEqual((await call('GET', '/api/practice/problem?concept=translating-sum-phrases&mode=steps')).status, 400);
  });

  await test('steps: valid, invalid, unknown, then finished with counts', async () => {
    await sleep(1100);
    const p = await stepsProblem();
    const bad = await call('POST', '/api/practice/step', { token: p.token, previousLine: p.start, line: 'x = 999999' });
    assert.strictEqual(bad.body.result, 'not_equivalent');
    assert.strictEqual(bad.body.finished, false);
    const unk = await call('POST', '/api/practice/step', { token: p.token, previousLine: p.start, line: 'x = y' });
    assert.strictEqual(unk.body.result, 'unknown');
    const good = await call('POST', '/api/practice/step', { token: p.token, previousLine: p.start, line: `${p.answer === undefined ? '' : ''}x = ${p.truth.answer}` });
    assert.strictEqual(good.body.result, 'equivalent');
    assert.strictEqual(good.body.finished, true);
    assert.strictEqual(good.body.lineCount, 1);
    assert.strictEqual(good.body.slips, 1); // unknown never counts as a slip
    const rec = attempts.find((a) => a.nonce === decode(p.token).n);
    assert.ok(rec && rec.mode === 'steps' && rec.step_errors === 1 && rec.correct === true);
    const again = await call('POST', '/api/practice/step', { token: p.token, previousLine: `x = ${p.truth.answer}`, line: `x = ${p.truth.answer}` });
    assert.strictEqual(again.status, 409);
  });

  await test('steps: "4 = x" form finishes; intermediate line does not', async () => {
    await sleep(1100);
    const p = await stepsProblem('one-step-equations-multiplication-division');
    const mid = p.start; // restating the start is equivalent but not finished
    const r1 = await call('POST', '/api/practice/step', { token: p.token, previousLine: p.start, line: mid });
    assert.strictEqual(r1.body.result, 'equivalent');
    assert.strictEqual(r1.body.finished, false);
    const r2 = await call('POST', '/api/practice/step', { token: p.token, previousLine: mid, line: `${p.truth.answer} = x` });
    assert.strictEqual(r2.body.finished, true);
  });

  await test('steps: client cannot claim a previous line the server never accepted', async () => {
    await sleep(1100);
    const p = await stepsProblem();
    const r = await call('POST', '/api/practice/step', { token: p.token, previousLine: `x = ${p.truth.answer}`, line: `x = ${p.truth.answer}` });
    assert.strictEqual(r.status, 409);
  });

  await test('steps: undo by sending an earlier accepted line', async () => {
    await sleep(1100);
    const p = await stepsProblem('two-step-equations');
    const l1 = p.start.replace(' = ', ' + 0 = ');
    await call('POST', '/api/practice/step', { token: p.token, previousLine: p.start, line: l1 });
    const r = await call('POST', '/api/practice/step', { token: p.token, previousLine: p.start, line: `x = ${p.truth.answer}` });
    assert.strictEqual(r.body.finished, true);
    assert.strictEqual(r.body.lineCount, 1); // the undone line no longer counts
  });

  await test('steps: length cap enforced server-side', async () => {
    await sleep(1100);
    const p = await stepsProblem();
    const r = await call('POST', '/api/practice/step', { token: p.token, previousLine: p.start, line: 'x'.repeat(61) });
    assert.strictEqual(r.body.result, 'unknown');
  });

  await test('steps: rate limit 5 per second per session', async () => {
    await sleep(1100);
    const p = await stepsProblem();
    const statuses = await Promise.all(Array.from({ length: 7 }, () =>
      call('POST', '/api/practice/step', { token: p.token, previousLine: p.start, line: 'x = y' }).then((r) => r.status)));
    assert.strictEqual(statuses.filter((s) => s === 200).length, 5);
    assert.strictEqual(statuses.filter((s) => s === 429).length, 2);
  });

  await test('step_hint quotes the server-held last line and the code reason, never the answer', async () => {
    await sleep(1100);
    const p = await stepsProblem('two-step-equations');
    const before = novaCalls.length;
    const r = await call('POST', '/api/tutor', { trigger: 'step_hint', token: p.token, lastValidLine: 'x = 1', rejectedLine: 'x = 999999' });
    assert.strictEqual(r.status, 200);
    const sent = novaCalls[before].user;
    assert.ok(sent.includes(`Their last correct line: "${p.start}"`), sent);
    assert.ok(sent.includes('What the checker said about it:'));
    assert.ok(!sent.includes(`x = ${p.truth.answer}"`));
    assert.ok(/Never give the final answer/.test(sent));
  });

  server.close();
  const w = Math.max(...results.map((r) => r[0].length));
  for (const [n, s] of results) console.log(`${n.padEnd(w)}  ${s}`);
  const failed = results.filter((r) => r[1] !== 'pass').length;
  console.log(`${results.length} route tests, ${failed} failing`);
  process.exit(failed ? 1 : 0);
})();
