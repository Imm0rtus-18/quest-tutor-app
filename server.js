require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { QUESTIONS, LEVEL_ORDER } = require('./questions');
const { CURRICULUM } = require('./curriculum');
const { QUIZZES } = require('./quizzes');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Real channel IDs resolved from each channel's own live YouTube page
// (externalId / canonical link), not typed from memory — YouTube channel IDs
// are opaque and unrelated to the channel's @handle, so a guessed or
// misremembered ID would silently match zero videos forever.
const REPUTABLE_CHANNELS = [
  'UC4a-Gbdw7vOaccHmFo40b9g', // Khan Academy
  'UCoHhuummRZaIVX7bD4t2czg', // Professor Leonard
  'UCFe6jenM1Bc54qtBsIJGRZQ', // PatrickJMT
  'UClOR1BiPyOkkIAnv9Cmj4iw', // Mario's Math Tutoring
  'UCEWpbFLzoYGPfuWUMFPSaoA'  // The Organic Chemistry Tutor
];

// Primary model — read exclusively from the GEMINI_MODEL env var.
// Defaults to gemini-3.6-flash, a stable current model on the free tier.
// Override with GEMINI_MODEL=gemini-3.5-flash-lite in .env if you hit daily rate limits.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// Automatic one-shot retry model used when the primary model is deprecated or unavailable.
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

const BCRYPT_ROUNDS = 12;
const XP_PER_MESSAGE = 18;

// How much history /api/history returns for the student's own view vs. how
// much gets sent to Gemini as conversational context. These are deliberately
// different: the student should never see their history appear to vanish,
// but Gemini only needs recent turns to keep teaching the current topic well
// (current_topic in curriculum.js carries the "where are we" context instead
// of the model needing the student's entire lifetime history).
const HISTORY_DISPLAY_LIMIT = 200;
const GEMINI_CONTEXT_MESSAGES = 20;

const LEVEL_LABELS = {
  algebra1: 'Algebra I',
  geometry: 'Geometry',
  algebra2: 'Algebra II',
  precalc: 'Pre-Calculus'
};

const REWARD_ITEMS = [
  {
    id: 'stargazer-badge',
    name: 'Stargazer badge',
    description: 'A bright constellation badge for your Nova profile.',
    cost: 120,
    icon: '✦'
  },
  {
    id: 'nova-theme',
    name: 'Nova color theme',
    description: 'Unlock a new cosmic colorway for your learning space.',
    cost: 260,
    icon: '◈'
  },
  {
    id: 'mission-skip',
    name: 'Mission skip',
    description: 'Take a well-earned shortcut past one practice mission.',
    cost: 420,
    icon: '↗'
  },
  {
    id: 'galaxy-title',
    name: 'Galaxy explorer title',
    description: 'Show off an explorer title beside your name.',
    cost: 650,
    icon: '♢'
  },
  {
    id: 'nova-avatar',
    name: 'Nova avatar glow',
    description: 'Give your Nova avatar a rare golden glow.',
    cost: 900,
    icon: '✧'
  },
  {
    id: 'captain-crown',
    name: 'Captain’s crown',
    description: 'The top-tier reward for students who keep exploring.',
    cost: 1200,
    icon: '♛'
  }
];

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Run on startup — creates tables if they don't already exist.
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_progress (
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      subject_level TEXT,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      onboarding_complete BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS current_topic_index INTEGER DEFAULT 0;
    ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS last_active_date DATE;
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE;
    -- One-time backfill: any pre-existing messages with no conversation_id
    -- (from before conversations existed) get bundled into one "Earlier
    -- conversation" per user, so nothing is lost. Naturally idempotent —
    -- once every message has a conversation_id, the INSERT's SELECT (and
    -- therefore the UPDATE) finds nothing to do on later startups.
    WITH backfill AS (
      INSERT INTO conversations (user_id, title, created_at)
      SELECT user_id, 'Earlier conversation', MIN(created_at)
      FROM messages
      WHERE conversation_id IS NULL
      GROUP BY user_id
      RETURNING id, user_id
    )
    UPDATE messages m
    SET conversation_id = b.id
    FROM backfill b
    WHERE m.conversation_id IS NULL AND m.user_id = b.user_id;
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      chapter_id TEXT NOT NULL,
      questions JSONB NOT NULL,
      answers JSONB,
      score INTEGER,
      passed BOOLEAN,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES user_progress(user_id) ON DELETE CASCADE,
      reward_id VARCHAR(80),
      item_type VARCHAR(20) NOT NULL DEFAULT 'catalog',
      source_type VARCHAR(20),
      source_url TEXT,
      photo_data TEXT,
      note TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'approved',
      saved_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (user_id, reward_id)
    );
    ALTER TABLE wishlist_items ALTER COLUMN reward_id DROP NOT NULL;
    ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) NOT NULL DEFAULT 'catalog';
    ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);
    ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS source_url TEXT;
    ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS photo_data TEXT;
    ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS note TEXT;
    ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved';
  `);
}

// XP cap per level — must stay in sync with the same formula in the frontend.
function xpCap(level) {
  return Math.round(200 * Math.pow(1.15, level));
}

// Apply an XP delta and persist it, given a row the caller already fetched
// (e.g. /api/tutor fetches xp/level/subject_level once at the top of the
// request for system-prompt selection — this reuses that instead of
// re-querying the same row again later in the same request).
async function addXp(userId, amount, current) {
  let { xp, level, subject_level } = current;
  xp += amount;
  let leveledUp = false;
  let cap = xpCap(level);

  if (xp >= cap) {
    xp = xp - cap;
    level += 1;
    leveledUp = true;
  }

  await pool.query(
    'UPDATE user_progress SET xp = $1, level = $2, updated_at = NOW() WHERE user_id = $3',
    [xp, level, userId]
  );

  return { xp, level, xp_cap: xpCap(level), leveled_up: leveledUp, subject_level };
}

// Shuffle helper (Fisher-Yates) — a real shuffle, different every call, not a
// fixed alternate pattern.
function shuffled(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build a per-level breakdown of what was actually answered right/wrong —
// matches by option id (stable, shuffle-proof), never by array position.
// Used both for deterministic placement scoring and for the LLM explanation.
function buildPerformanceBreakdown(answers) {
  const breakdown = LEVEL_ORDER.map(level => ({ level, label: LEVEL_LABELS[level], items: [] }));
  const byLevel = new Map(breakdown.map(b => [b.level, b]));

  for (const q of QUESTIONS) {
    const answer = answers.find(a => a.id === q.id);
    const correctOption = q.options.find(o => o.id === q.correctOptionId);
    const chosenOption = answer ? q.options.find(o => o.id === answer.selectedOptionId) : null;
    byLevel.get(q.level).items.push({
      question: q.question,
      correctAnswer: correctOption ? correctOption.text : null,
      chosenAnswer: chosenOption ? chosenOption.text : null,
      correct: !!chosenOption && chosenOption.id === q.correctOptionId
    });
  }
  return breakdown;
}

// Placement scoring — pure deterministic logic, no LLM. Walks levels in
// order and places the student at the FIRST level they did not pass (2+ of 3
// correct = passed), so failing an early level always caps placement there
// regardless of what happens on later questions. If every level was passed,
// the last level (precalc) is the ceiling.
function scorePlacement(breakdown) {
  for (const levelResult of breakdown) {
    const correctCount = levelResult.items.filter(item => item.correct).length;
    if (correctCount < 2) return levelResult.level;
  }
  return breakdown[breakdown.length - 1].level;
}

// One LLM call that writes a short, specific explanation of an already-
// decided placement — it never influences the placement itself.
async function explainPlacement(breakdown, placementLevel) {
  if (!GEMINI_API_KEY) return null;

  const summary = breakdown.map(levelResult => {
    const correctCount = levelResult.items.filter(item => item.correct).length;
    const lines = levelResult.items.map(item =>
      `- "${item.question}" — ${item.correct
        ? 'answered correctly'
        : `answered incorrectly (chose "${item.chosenAnswer || 'no answer'}", correct answer was "${item.correctAnswer}")`}`
    ).join('\n');
    return `${levelResult.label}: ${correctCount}/3 correct\n${lines}`;
  }).join('\n\n');

  const systemPrompt = `You are Nova, writing a short placement summary for a student who just finished a math placement test.
Reference their actual performance — specific topics or question types they got right or wrong — instead of generic praise. Be honest about gaps that led to the placement, while staying warm and encouraging.
Keep it to 2-3 short sentences.
Do not use markdown formatting of any kind — no asterisks, no headers, no bullet lists.
Do not use LaTeX or dollar-sign math notation. Write math in plain text.`;

  const userMessage = `Placement result: ${LEVEL_LABELS[placementLevel]}.

Per-level performance:
${summary}

Write the explanation now.`;

  try {
    let { response, data } = await callGeminiWithFallback(systemPrompt, [{ role: 'user', content: userMessage }]);

    if (!response.ok) {
      console.error('Placement explanation error:', data);
      return null;
    }

    const candidate = (data.candidates || [])[0];
    if (!candidate) return null;

    let text = (candidate.content && candidate.content.parts || [])
      .map(part => part.text || '')
      .filter(Boolean)
      .join('\n');

    text = stripMarkdownAndLatex(text);

    return text.trim() || null;
  } catch (err) {
    console.error('Placement explanation request failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Replit serves the app behind an HTTPS proxy (and shows it inside an iframe
// on replit.com). Trust the proxy so `secure` cookies work, and use
// SameSite=None so the session cookie is sent from within the cross-site iframe.
app.set('trust proxy', 1);

app.use(session({
  store: new PgSession({
    pool,
    tableName: 'sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'dev-fallback-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    // SameSite=None + Secure is required for the cookie to work inside the
    // Replit preview iframe (cross-site context). Browsers reject
    // SameSite=None cookies without Secure, hence both together.
    sameSite: 'none',
    secure: true,
    // CHIPS: modern browsers (Chrome/Safari) block even SameSite=None
    // third-party cookies in cross-site iframes like the Replit preview
    // unless the cookie is Partitioned.
    partitioned: true
  }
}));

app.use(express.json({ limit: '8mb' }));

// CSRF protection: with SameSite=None cookies (required for the Replit
// preview iframe), any site could send authenticated requests. Block unsafe
// methods whose Origin header doesn't match this app's own hosts.
const ALLOWED_ORIGIN_SUFFIXES = ['.replit.dev', '.replit.app', '.repl.co'];
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser clients (curl, tests) have no Origin
  let host;
  try { host = new URL(origin).hostname; } catch { return res.status(403).json({ error: 'Invalid origin.' }); }
  const selfHost = req.hostname;
  const allowed = host === selfHost ||
    host === 'localhost' || host === '127.0.0.1' ||
    ALLOWED_ORIGIN_SUFFIXES.some((s) => host.endsWith(s));
  if (!allowed) return res.status(403).json({ error: 'Cross-site request blocked.' });
  next();
});

// Prevent HTML from being cached so the browser always gets fresh JS/CSS.
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

// ---------------------------------------------------------------------------
// System prompts — one per placement level
// ---------------------------------------------------------------------------

const BASE_STYLE = `
Talk like a chill, sharp friend who happens to be really good at this
subject — not a textbook, not a hype-man, not a formal teacher. Casual
register: contractions, plain everyday words, low formality. Keep replies
short — a few sentences, not paragraphs. Skip filler openers like "Great
question!" or "Absolutely!" — just respond like a person would.

It's fine to sound a little playful or use casual phrasing ("yeah",
"okay so", "here's the thing"), but don't force slang or try hard to
sound young — that reads as cringe, not cool. Being casual doesn't mean
being vague or skipping steps in the math — stay accurate and keep
actually moving the student toward understanding the concept, not just
chatting.

Do not use markdown formatting (no asterisks, no headers, no bullet
lists unless asked) or LaTeX/dollar-sign math notation — write math in
plain text (^ for exponents, / for fractions). If you're not sure about
something, say so plainly instead of guessing.

When you've actually taught the student's current topic and checked
whether they're following it (e.g. asked a quick question or had them
try one themselves), call the adjust_lesson_progress function: "advance"
once they've got it, "repeat" if you should go over it again a different
way, or "back" if they seem confused enough that revisiting the previous
topic first would help. Don't call it on every message — only once
you've taught something and gotten a real signal of whether it landed.
`;

const SYSTEM_PROMPTS = {
  algebra1: `You are Nova, a warm and patient Algebra I tutor guiding a student through a space-themed learning app.
Stay strictly within Algebra I topics: linear equations and inequalities, graphing lines, slope, basic factoring, exponent rules, ratios and proportions, and word problems using these. If asked about anything beyond Algebra I, gently redirect back.
${BASE_STYLE}`,

  geometry: `You are Nova, a warm and patient Geometry tutor guiding a student through a space-themed learning app.
Stay strictly within Geometry topics: angles, triangles and the Pythagorean theorem, area/perimeter/volume, congruence and similarity, circles, basic coordinate geometry, and simple logical proofs. If asked about anything beyond Geometry, gently redirect back.
${BASE_STYLE}`,

  algebra2: `You are Nova, a warm and patient Algebra II tutor guiding a student through a space-themed learning app.
Stay strictly within Algebra II topics: quadratics, polynomials, exponents, logarithms, systems of equations, sequences and series, functions and their graphs, and rational expressions. If asked about anything beyond Algebra II, gently redirect back.
${BASE_STYLE}`,

  precalc: `You are Nova, a warm and patient Pre-Calculus tutor guiding a student through a space-themed learning app.
Stay strictly within Pre-Calculus topics: trigonometric functions and identities, the unit circle, polynomial and rational functions, exponential and logarithmic functions, vectors, conic sections, and sequences/series. If asked about anything beyond Pre-Calculus, gently redirect back.
${BASE_STYLE}`
};

// ---------------------------------------------------------------------------
// Gemini helpers (unchanged)
// ---------------------------------------------------------------------------

function toGeminiContents(messages) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
}

function isModelUnavailableError(data) {
  const msg = (data.error && data.error.message) || '';
  return /no longer available|not found|deprecated|model.*unavailable/i.test(msg);
}

// Lower-level call that takes an already Gemini-shaped `contents` array
// directly — used by callGemini() below for the normal text-message path,
// and directly by the function-calling round trip in /api/tutor, which needs
// to include raw functionCall/functionResponse parts that toGeminiContents()
// (plain-text-only) can't represent.
async function callGeminiRaw(model, systemPrompt, contents, tools) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 1000 }
  };
  if (tools) body.tools = tools;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  return { response, data };
}

async function callGemini(model, systemPrompt, messages, tools) {
  return callGeminiRaw(model, systemPrompt, toGeminiContents(messages), tools);
}

// Calls PRIMARY_MODEL and, if (and only if) it's unavailable, retries once
// with FALLBACK_MODEL — the one-shot retry shape shared by every Gemini call
// site in this file. The model names themselves still only ever come from
// the PRIMARY_MODEL/FALLBACK_MODEL constants above, never chosen here.
// onFallback, if given, is called with the primary call's failed `data`
// right before the fallback attempt (used for caller-specific logging).
async function callGeminiWithFallback(systemPrompt, messages, onFallback, tools) {
  let { response, data } = await callGemini(PRIMARY_MODEL, systemPrompt, messages, tools);
  if (!response.ok && isModelUnavailableError(data)) {
    if (onFallback) onFallback(data);
    ({ response, data } = await callGemini(FALLBACK_MODEL, systemPrompt, messages, tools));
  }
  return { response, data };
}

// Safety-net cleanup — strips markdown/LaTeX that slips through despite the
// system prompt instructing against it (BASE_STYLE and the placement-
// explanation prompt both say not to use it; the chat UI renders plain text
// only). Shared by the tutor route and the placement explanation — keep this
// even though the prompts already say not to use markdown/LaTeX.
function stripMarkdownAndLatex(text) {
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\$\$([^$]+)\$\$/g, '$1').replace(/\$([^$]+)\$/g, '$1');
  return text;
}

// ---------------------------------------------------------------------------
// YouTube — reputable-channel video search (used by the search_youtube_video
// Gemini tool below). search.list only accepts a single channelId per call,
// which is too restrictive across a 5-channel allowlist, so instead this
// runs one topic search and filters the results down to allowed channels.
// ---------------------------------------------------------------------------

async function searchReputableYoutubeVideo(query) {
  if (!YOUTUBE_API_KEY || !query) return null;

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('safeSearch', 'strict');
  url.searchParams.set('maxResults', '10');
  url.searchParams.set('q', query);
  url.searchParams.set('key', YOUTUBE_API_KEY);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('YouTube search error:', data.error || data);
      return null;
    }

    const match = (data.items || []).find(
      item => item.id && item.id.videoId && REPUTABLE_CHANNELS.includes(item.snippet.channelId)
    );
    if (!match) return null;

    return {
      videoId: match.id.videoId,
      title: match.snippet.title,
      channelTitle: match.snippet.channelTitle,
      thumbnail:
        (match.snippet.thumbnails &&
          (match.snippet.thumbnails.medium || match.snippet.thumbnails.default) &&
          (match.snippet.thumbnails.medium || match.snippet.thumbnails.default).url) || null
    };
  } catch (err) {
    console.error('YouTube search request failed:', err);
    return null;
  }
}

// Gemini tool declaration — Nova can call this to find a real video instead
// of writing out a link itself. The description is the only thing steering
// when/how the model uses it, since SYSTEM_PROMPTS isn't being touched here.
const YOUTUBE_SEARCH_TOOL = {
  functionDeclarations: [{
    name: 'search_youtube_video',
    description: 'Search for a short educational video on the current topic from a trusted math education channel.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A concise search query describing the math topic or concept to find a video about.'
        }
      },
      required: ['query']
    }
  }]
};

// Gemini tool declaration — Nova calls this once she's taught the current
// topic and checked whether the student is following, so the app can move
// current_topic_index the same way the "next level please" bypass moves
// subject_level. Reuses the same function-calling pattern as the YouTube
// search tool above.
const ADJUST_LESSON_PROGRESS_TOOL = {
  functionDeclarations: [{
    name: 'adjust_lesson_progress',
    description: 'Move the student\'s lesson progress after teaching the current topic and checking their understanding.',
    parameters: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['advance', 'repeat', 'back'],
          description: '"advance" if the student has got the current topic and is ready for the next one, "repeat" if the current topic should be re-taught a different way, or "back" if they need the previous topic revisited first.'
        }
      },
      required: ['direction']
    }
  }]
};

// Combined tool list for /api/tutor — Nova can call either function in the
// same turn.
const TUTOR_TOOLS = [{
  functionDeclarations: [
    ...YOUTUBE_SEARCH_TOOL.functionDeclarations,
    ...ADJUST_LESSON_PROGRESS_TOOL.functionDeclarations
  ]
}];

// A few different natural ways for Nova to nudge a student who's gone quiet
// mid-lesson — picked at random per idle_continue call so it's not always
// the same line.
const IDLE_CONTINUE_PROMPTS = [
  "The student has gone quiet for a bit. Naturally pick back up teaching the current topic where you left off — no need to call attention to the pause.",
  "The student hasn't responded in a while. Casually check in — something like asking if they're still there or want to keep going — then continue.",
  "It's been quiet for a bit. Continue explaining the current topic naturally, as if just picking the thread back up.",
  "The student has been idle for a moment. Give a brief, casual nudge to see if they're still around, then keep teaching."
];

// Used once, right after the canned welcome message, to kick off a real
// first lesson without the student having to type anything.
const START_LESSON_INSTRUCTION =
  "The student just arrived and has already been greeted by name in the chat — don't say hello or introduce yourself again. Jump straight into teaching their current topic now.";

// Builds the per-request note telling Nova what the student's current
// lesson topic actually is (current_topic_index in user_progress) — kept
// out of SYSTEM_PROMPTS since it's dynamic per student, not per subject.
function buildLessonFocusNote(currentTopic) {
  if (!currentTopic) return '';
  return `\n\nThe student's current lesson topic is "${currentTopic.title}": ${currentTopic.objective} Use this as the current teaching focus.`;
}

// If the student's most recent quiz attempt on their current chapter was a
// fail, steer Nova toward re-teaching specifically what they missed instead
// of repeating the whole chapter generically. Naturally stops applying once
// they pass (current_topic_index moves on to a different chapter, so this
// lookup no longer matches).
async function buildRemediationNote(userId, currentTopic) {
  if (!currentTopic) return '';
  const { rows } = await pool.query(
    `SELECT answers FROM quiz_sessions
      WHERE user_id = $1 AND chapter_id = $2 AND passed = false
      ORDER BY created_at DESC LIMIT 1`,
    [userId, currentTopic.id]
  );
  const lastFailed = rows[0];
  if (!lastFailed || !Array.isArray(lastFailed.answers)) return '';

  const missedConcepts = [...new Set(
    lastFailed.answers.filter(a => !a.correct).map(a => a.concept).filter(Boolean)
  )];
  if (!missedConcepts.length) return '';

  return `\n\nThe student recently missed a quiz on this chapter, specifically on: ${missedConcepts.join(', ')}. Focus on re-teaching these specific gaps rather than repeating the whole chapter generically.`;
}

// Applies a lesson-progress move Nova requested via the adjust_lesson_progress
// function call, clamped to valid topic indices, and persists it the same
// way the "next level please" bypass persists subject_level changes.
// Shuffles a quiz question's options at serve-time (same Fisher-Yates
// helper as onboarding) and recomputes correctIndex to match the shuffled
// order. The returned, already-shuffled version is what gets stored on
// the quiz_sessions row, so grading always matches what the student
// actually saw — never re-derived from the original bank order.
function buildServedQuiz(bankQuestions) {
  return bankQuestions.map(q => {
    const correctText = q.options[q.correctIndex];
    const options = shuffled(q.options);
    return {
      id: q.id,
      chapterId: q.chapterId,
      question: q.question,
      options,
      correctIndex: options.indexOf(correctText),
      concept: q.concept
    };
  });
}

// Applies a lesson-progress move Nova requested via the adjust_lesson_progress
// function call. 'repeat'/'back' still move current_topic_index directly and
// persist it immediately, exactly as before. 'advance' no longer advances
// directly — a "ready to move on" signal now creates a quiz_session for the
// current chapter and tells the frontend to enter quiz mode; current_topic_index
// only actually moves once the student passes (see POST /api/quiz/submit).
async function applyLessonProgressAdjustment(userId, subjectLevel, currentIndex, direction) {
  const topics = CURRICULUM[subjectLevel] || [];
  if (!topics.length || !['advance', 'repeat', 'back'].includes(direction)) return null;

  if (direction === 'advance') {
    const currentTopic = topics[currentIndex];
    if (!currentTopic) return null;

    const bankQuestions = QUIZZES[currentTopic.id];
    if (!bankQuestions || !bankQuestions.length) {
      // No quiz written for this chapter yet — fall back to the old
      // direct-advance behavior so the student never gets stuck with
      // no quiz to take.
      const newIndex = Math.min(currentIndex + 1, topics.length - 1);
      const advanced = newIndex !== currentIndex;
      if (advanced) {
        await pool.query(
          'UPDATE user_progress SET current_topic_index = $1, updated_at = NOW() WHERE user_id = $2',
          [newIndex, userId]
        );
      }
      return {
        direction,
        applied: advanced,
        previous_topic_index: currentIndex,
        current_topic_index: newIndex,
        completed_topic: advanced ? { id: currentTopic.id, title: currentTopic.title } : null,
        current_topic: topics[newIndex] ? { id: topics[newIndex].id, title: topics[newIndex].title } : null
      };
    }

    const servedQuestions = buildServedQuiz(bankQuestions);
    const { rows } = await pool.query(
      'INSERT INTO quiz_sessions (user_id, chapter_id, questions) VALUES ($1, $2, $3) RETURNING id',
      [userId, currentTopic.id, JSON.stringify(servedQuestions)]
    );

    return {
      direction,
      applied: false,
      quiz_required: true,
      quiz_session_id: rows[0].id,
      chapter_id: currentTopic.id,
      chapter_title: currentTopic.title,
      // Never send correctIndex to the client before grading.
      questions: servedQuestions.map(q => ({ id: q.id, question: q.question, options: q.options }))
    };
  }

  let newIndex = currentIndex;
  if (direction === 'back') newIndex = Math.max(currentIndex - 1, 0);
  // 'repeat' leaves newIndex unchanged.

  if (newIndex !== currentIndex) {
    await pool.query(
      'UPDATE user_progress SET current_topic_index = $1, updated_at = NOW() WHERE user_id = $2',
      [newIndex, userId]
    );
  }

  return {
    direction,
    applied: newIndex !== currentIndex,
    previous_topic_index: currentIndex,
    current_topic_index: newIndex,
    completed_topic: null,
    current_topic: topics[newIndex] ? { id: topics[newIndex].id, title: topics[newIndex].title } : null
  };
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return res.status(400).json({ error: 'Username must be 2–50 characters.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [trimmed, hash]
    );
    const userId = rows[0].id;
    await pool.query(
      'INSERT INTO user_progress (user_id, xp, level, streak, onboarding_complete) VALUES ($1, 0, 0, 0, false)',
      [userId]
    );
    req.session.userId = userId;
    req.session.username = trimmed;
    req.session.save((sessionErr) => {
      if (sessionErr) {
        console.error('[signup] session save error:', sessionErr);
        return res.status(500).json({ error: 'Account created but session could not be saved. Please log in.' });
      }
      res.json({ username: trimmed });
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    console.error('[signup] error:', err);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username.trim()]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    // Regenerate the session on login (prevents session fixation), then save
    // before responding so the browser's next request finds a valid session.
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('Login session regenerate error:', regenErr);
        return res.status(500).json({ error: 'Login failed. Please try again.' });
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Login session save error:', saveErr);
          return res.status(500).json({ error: 'Login failed. Please try again.' });
        }
        res.json({ username: user.username });
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated.' });
  res.json({ username: req.session.username });
});

// ---------------------------------------------------------------------------
// Progress & history
// ---------------------------------------------------------------------------

app.get('/api/progress', requireAuth, async (req, res) => {
  try {
    // This doubles as the "session check" that updates the day streak:
    // same day as last_active_date -> unchanged, exactly yesterday -> +1,
    // anything else (a gap, or first-ever login where last_active_date is
    // still NULL) -> reset to 1. Done as a single UPDATE...RETURNING so
    // this stays one round trip instead of a separate read then write.
    const { rows } = await pool.query(
      `UPDATE user_progress
          SET streak = CASE
                WHEN last_active_date = CURRENT_DATE THEN streak
                WHEN last_active_date = CURRENT_DATE - 1 THEN streak + 1
                ELSE 1
              END,
              last_active_date = CURRENT_DATE,
              updated_at = NOW()
        WHERE user_id = $1
        RETURNING xp, level, streak, subject_level, onboarding_complete, current_topic_index`,
      [req.session.userId]
    );
    const prog = rows[0] || {
      xp: 0, level: 0, streak: 0, subject_level: null, onboarding_complete: false, current_topic_index: 0
    };
    const topics = CURRICULUM[prog.subject_level] || [];
    const currentTopic = topics[prog.current_topic_index] || null;
    res.json({
      ...prog,
      xp_cap: xpCap(prog.level),
      current_topic: currentTopic,
      topics: topics.map(t => ({ id: t.id, title: t.title }))
    });
  } catch (err) {
    console.error('Progress error:', err);
    res.status(500).json({ error: 'Could not load progress.' });
  }
});

// ---------------------------------------------------------------------------
// Rewards & wishlist
// ---------------------------------------------------------------------------

const CUSTOM_SOURCE_TYPES = new Set(['link', 'photo', 'video']);
const CUSTOM_SOURCE_ICONS = { link: '↗', photo: '▧', video: '▶' };

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

app.get('/api/rewards', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT reward_id FROM wishlist_items WHERE user_id = $1 AND item_type = 'catalog'",
      [req.session.userId]
    );
    const savedIds = new Set(rows.map(row => row.reward_id));
    res.json({
      rewards: REWARD_ITEMS.map(reward => ({ ...reward, saved: savedIds.has(reward.id) }))
    });
  } catch (err) {
    console.error('Rewards error:', err);
    res.status(500).json({ error: 'Could not load rewards.' });
  }
});

app.get('/api/wishlist', requireAuth, async (req, res) => {
  try {
    const [wishlistResult, progressResult] = await Promise.all([
      pool.query(
        `SELECT id, reward_id, item_type, source_type, source_url, photo_data,
                note, status, saved_at
         FROM wishlist_items
         WHERE user_id = $1
         ORDER BY saved_at DESC`,
        [req.session.userId]
      ),
      pool.query(
        'SELECT xp FROM user_progress WHERE user_id = $1',
        [req.session.userId]
      )
    ]);

    const currentXp = progressResult.rows[0]?.xp || 0;
    const rewardById = new Map(REWARD_ITEMS.map(reward => [reward.id, reward]));
    const items = wishlistResult.rows
      .map(row => {
        if (row.item_type === 'custom' || (!row.item_type && !row.reward_id)) {
          const sourceType = row.source_type || 'link';
          const sourceLabel = sourceType.charAt(0).toUpperCase() + sourceType.slice(1);
          return {
            id: `custom-${row.id}`,
            wishlist_id: row.id,
            item_type: 'custom',
            source_type: sourceType,
            source_url: row.source_url,
            photo_data: row.photo_data,
            name: `Custom ${sourceLabel.toLowerCase()}`,
            description: row.note || 'Custom reward request',
            icon: CUSTOM_SOURCE_ICONS[sourceType] || '♡',
            status: row.status || 'pending',
            saved_at: row.saved_at,
            cost: null
          };
        }

        const reward = rewardById.get(row.reward_id);
        if (!reward) return null;
        return {
          ...reward,
          item_type: 'catalog',
          status: row.status || 'approved',
          saved_at: row.saved_at,
          progress_xp: currentXp,
          progress_percent: Math.min(100, Math.round((currentXp / reward.cost) * 100))
        };
      })
      .filter(Boolean);

    res.json({ items, xp: currentXp });
  } catch (err) {
    console.error('Wishlist error:', err);
    res.status(500).json({ error: 'Could not load your wishlist.' });
  }
});

app.post('/api/wishlist/custom', requireAuth, async (req, res) => {
  const { sourceType, sourceUrl, photoData, note } = req.body || {};
  const normalizedNote = typeof note === 'string' ? note.trim() : '';

  if (!CUSTOM_SOURCE_TYPES.has(sourceType)) {
    return res.status(400).json({ error: 'Choose a link, photo, or video source.' });
  }
  if (normalizedNote.length < 3 || normalizedNote.length > 240) {
    return res.status(400).json({ error: 'Add a short note between 3 and 240 characters.' });
  }

  let normalizedUrl = null;
  let normalizedPhotoData = null;

  if (sourceType === 'photo') {
    if (typeof photoData !== 'string' ||
        photoData.length > 7000000 ||
        !/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(photoData)) {
      return res.status(400).json({ error: 'Upload a JPG, PNG, WEBP, or GIF image up to 5 MB.' });
    }
    normalizedPhotoData = photoData;
  } else {
    normalizedUrl = typeof sourceUrl === 'string' ? sourceUrl.trim() : '';
    if (normalizedUrl.length > 2048 || !isHttpUrl(normalizedUrl)) {
      return res.status(400).json({ error: 'Paste a valid http:// or https:// link.' });
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO wishlist_items
        (user_id, reward_id, item_type, source_type, source_url, photo_data, note, status)
       VALUES ($1, NULL, 'custom', $2, $3, $4, $5, 'pending')
       RETURNING id, saved_at, status`,
      [req.session.userId, sourceType, normalizedUrl, normalizedPhotoData, normalizedNote]
    );
    res.status(201).json({
      id: rows[0].id,
      item_type: 'custom',
      status: rows[0].status,
      saved_at: rows[0].saved_at
    });
  } catch (err) {
    console.error('Save custom wishlist item error:', err);
    res.status(500).json({ error: 'Could not submit that wishlist item.' });
  }
});

app.post('/api/wishlist/:rewardId', requireAuth, async (req, res) => {
  const reward = REWARD_ITEMS.find(item => item.id === req.params.rewardId);
  if (!reward) return res.status(404).json({ error: 'That reward does not exist.' });

  try {
    await pool.query(
      'INSERT INTO wishlist_items (user_id, reward_id) VALUES ($1, $2) ON CONFLICT (user_id, reward_id) DO NOTHING',
      [req.session.userId, reward.id]
    );
    res.json({ saved: true, reward_id: reward.id });
  } catch (err) {
    console.error('Save wishlist item error:', err);
    res.status(500).json({ error: 'Could not save that reward.' });
  }
});

app.delete('/api/wishlist/:rewardId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM wishlist_items WHERE user_id = $1 AND reward_id = $2',
      [req.session.userId, req.params.rewardId]
    );
    res.json({ saved: false, reward_id: req.params.rewardId });
  } catch (err) {
    console.error('Remove wishlist item error:', err);
    res.status(500).json({ error: 'Could not remove that reward.' });
  }
});

app.delete('/api/wishlist/custom/:itemId', requireAuth, async (req, res) => {
  if (!/^\d+$/.test(req.params.itemId)) {
    return res.status(400).json({ error: 'That wishlist item is invalid.' });
  }

  try {
    const result = await pool.query(
      "DELETE FROM wishlist_items WHERE id = $1 AND user_id = $2 AND item_type = 'custom'",
      [Number(req.params.itemId), req.session.userId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Wishlist item not found.' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Remove custom wishlist item error:', err);
    res.status(500).json({ error: 'Could not remove that wishlist item.' });
  }
});

// ───────────────────────────────────────────────────────────────────
// Parent portal
app.get('/parent', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'parent.html'));
});

app.get('/api/parent/pending', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.id, w.source_type, w.source_url, w.photo_data, w.note, w.saved_at,
              u.username
         FROM wishlist_items w
         JOIN users u ON u.id = w.user_id
        WHERE w.item_type = 'custom' AND w.status = 'pending' AND w.user_id = $1
        ORDER BY w.saved_at ASC`,
      [req.session.userId]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('Parent pending list error:', err);
    res.status(500).json({ error: 'Could not load pending submissions.' });
  }
});

app.get('/api/parent/summary', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.username, p.xp, p.level, p.streak, p.subject_level
         FROM user_progress p
         JOIN users u ON u.id = p.user_id
        WHERE p.user_id = $1
        ORDER BY u.username ASC`,
      [req.session.userId]
    );
    res.json({
      students: rows.map(r => ({
        username: r.username,
        xp: r.xp,
        level: r.level,
        xp_cap: xpCap(r.level),
        streak: r.streak,
        subject_level: r.subject_level
      }))
    });
  } catch (err) {
    console.error('Parent summary error:', err);
    res.status(500).json({ error: 'Could not load student progress.' });
  }
});

app.post('/api/parent/wishlist/:itemId/decision', requireAuth, async (req, res) => {
  if (!/^\d+$/.test(req.params.itemId)) {
    return res.status(400).json({ error: 'That wishlist item is invalid.' });
  }
  const { decision } = req.body || {};
  if (decision !== 'approved' && decision !== 'declined') {
    return res.status(400).json({ error: 'Decision must be "approved" or "declined".' });
  }
  try {
    const result = await pool.query(
      `UPDATE wishlist_items SET status = $1
        WHERE id = $2 AND item_type = 'custom' AND status = 'pending' AND user_id = $3
        RETURNING id, status`,
      [decision, Number(req.params.itemId), req.session.userId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Pending item not found — it may already be reviewed.' });
    res.json({ id: result.rows[0].id, status: result.rows[0].status });
  } catch (err) {
    console.error('Parent decision error:', err);
    res.status(500).json({ error: 'Could not update that item.' });
  }
});

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

app.get('/api/conversations', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, title, created_at FROM conversations WHERE user_id = $1 ORDER BY created_at DESC',
      [req.session.userId]
    );
    res.json({ conversations: rows });
  } catch (err) {
    console.error('Conversations list error:', err);
    res.status(500).json({ error: 'Could not load conversations.' });
  }
});

app.post('/api/conversations', requireAuth, async (req, res) => {
  try {
    // Dated title (e.g. "Sep 17, 2:34 PM") — simplest option that needs no
    // later rename once a "first topic" is known.
    const title = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
    const { rows } = await pool.query(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at',
      [req.session.userId, title]
    );
    res.status(201).json({ conversation: rows[0] });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Could not start a new conversation.' });
  }
});

app.get('/api/history', requireAuth, async (req, res) => {
  const conversationId = parseInt(req.query.conversation_id, 10);
  if (!Number.isInteger(conversationId)) {
    return res.status(400).json({ error: 'A conversation_id is required.' });
  }
  try {
    // Filtering by both user_id and conversation_id together means a
    // conversation_id belonging to another user simply matches nothing —
    // no separate ownership check needed for this read.
    const { rows } = await pool.query(
      `SELECT role, content FROM (
         SELECT role, content, created_at FROM messages
         WHERE user_id = $1 AND conversation_id = $2
         ORDER BY created_at DESC
         LIMIT $3
       ) recent ORDER BY created_at ASC`,
      [req.session.userId, conversationId, HISTORY_DISPLAY_LIMIT]
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Could not load history.' });
  }
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

// Returns questions with correctOptionId stripped and option order shuffled
// per-request — never expose answers before submission, and never serve the
// same display order twice.
app.get('/api/onboarding/questions', requireAuth, (req, res) => {
  const safe = QUESTIONS.map(({ id, level, question, options }) => ({
    id, level, question,
    options: shuffled(options).map(({ id, text }) => ({ id, text }))
  }));
  res.json({ questions: safe });
});

app.post('/api/onboarding/submit', requireAuth, async (req, res) => {
  const { answers } = req.body || {};
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers must be an array.' });
  }

  const breakdown = buildPerformanceBreakdown(answers);
  const placement = scorePlacement(breakdown);

  try {
    await pool.query(
      'UPDATE user_progress SET subject_level = $1, onboarding_complete = true, current_topic_index = 0, updated_at = NOW() WHERE user_id = $2',
      [placement, req.session.userId]
    );
    const explanation = await explainPlacement(breakdown, placement);
    res.json({ subject_level: placement, label: LEVEL_LABELS[placement], explanation });
  } catch (err) {
    console.error('Onboarding submit error:', err);
    res.status(500).json({ error: 'Could not save placement. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Tutor route
// ---------------------------------------------------------------------------

app.post('/api/tutor', requireAuth, async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'Server is missing GEMINI_API_KEY. Add it to a .env file (see .env.example) and restart the server.'
    });
  }

  const { messages, subject, trigger, conversation_id } = req.body || {};

  // Auto-triggers ('start_lesson' right after the welcome message,
  // 'idle_continue' after a quiet spell) carry no new real user text — the
  // client sends its existing conversation as context and this flag instead.
  const AUTO_TRIGGERS = new Set(['start_lesson', 'idle_continue']);
  const isAutoTrigger = AUTO_TRIGGERS.has(trigger);

  if (!Array.isArray(messages) || (!isAutoTrigger && messages.length === 0)) {
    return res.status(400).json({ error: 'Request must include a non-empty "messages" array.' });
  }

  const userId = req.session.userId;
  const conversationId = parseInt(conversation_id, 10);
  if (!Number.isInteger(conversationId)) {
    return res.status(400).json({ error: 'A conversation_id is required.' });
  }

  // Writes (unlike the /api/history read) need an explicit ownership check —
  // otherwise a client could pass another user's conversation_id and have
  // their message inserted into someone else's thread.
  const { rows: convCheckRows } = await pool.query(
    'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  if (!convCheckRows.length) {
    return res.status(404).json({ error: 'Conversation not found.' });
  }

  const userMsg = isAutoTrigger ? null : messages[messages.length - 1];

  // ── Developer bypass — "next level please" ─────────────────────────
  if (!isAutoTrigger && userMsg.content.trim().toLowerCase() === 'next level please') {
    const { rows: progRows } = await pool.query(
      'SELECT subject_level FROM user_progress WHERE user_id = $1',
      [userId]
    );
    const currentLevel = progRows[0]?.subject_level;
    const currentIdx = LEVEL_ORDER.indexOf(currentLevel);

    let reply, newLevel;

    if (currentIdx === -1 || currentIdx >= LEVEL_ORDER.length - 1) {
      // Already at the ceiling (precalc) or level unknown
      newLevel = currentLevel || LEVEL_ORDER[LEVEL_ORDER.length - 1];
      reply = "You've worked through the whole track — Algebra 1, Geometry, Algebra 2, and Pre-Calculus. That's a real accomplishment. I'm here whenever you want to dig deeper into any of these topics.";
    } else {
      newLevel = LEVEL_ORDER[currentIdx + 1];
      await pool.query(
        'UPDATE user_progress SET subject_level = $1, current_topic_index = 0, updated_at = NOW() WHERE user_id = $2',
        [newLevel, userId]
      );
      reply = `Moving you on to ${LEVEL_LABELS[newLevel]}. Take your time — there's no rush getting comfortable with the new material.`;
    }

    // Save the bypass exchange to history for session continuity.
    try {
      await pool.query(
        'INSERT INTO messages (user_id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
        [userId, conversationId, 'user', userMsg.content]
      );
      await pool.query(
        'INSERT INTO messages (user_id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
        [userId, conversationId, 'assistant', reply]
      );
    } catch (err) {
      console.error('Failed to save bypass messages:', err);
    }

    return res.json({ reply, subject_level: newLevel });
  }

  // ── Normal path ────────────────────────────────────────────────────
  // Ignore the "subject" field from the frontend — read the real placement from DB.
  // Fetched once here (xp/level/current_topic_index included) so addXp()
  // below doesn't have to re-query the same row again later in the request.
  const { rows: progressRows } = await pool.query(
    'SELECT xp, level, subject_level, current_topic_index FROM user_progress WHERE user_id = $1',
    [userId]
  );
  const progressRow = progressRows[0] || null;
  const subjectLevel = progressRow?.subject_level || null;
  const currentTopicIndex = progressRow?.current_topic_index || 0;
  if (!subjectLevel) {
    console.warn(`User ${userId} reached /api/tutor with null subject_level — defaulting to algebra1.`);
  }
  const topics = CURRICULUM[subjectLevel] || [];
  const currentTopic = topics[currentTopicIndex] || null;

  let systemPrompt = (SYSTEM_PROMPTS[subjectLevel] || SYSTEM_PROMPTS.algebra1) + buildLessonFocusNote(currentTopic);
  systemPrompt += await buildRemediationNote(userId, currentTopic);
  if (trigger === 'start_lesson') {
    systemPrompt += `\n\n${START_LESSON_INSTRUCTION}`;
  } else if (trigger === 'idle_continue') {
    systemPrompt += `\n\n${IDLE_CONTINUE_PROMPTS[Math.floor(Math.random() * IDLE_CONTINUE_PROMPTS.length)]}`;
  }

  if (!isAutoTrigger) {
    try {
      await pool.query(
        'INSERT INTO messages (user_id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
        [userId, conversationId, 'user', userMsg.content]
      );
    } catch (err) {
      console.error('Failed to save user message:', err);
    }
  }

  // Only the most recent turns go to Gemini — full history is still persisted
  // above and still returned in full (up to HISTORY_DISPLAY_LIMIT) by
  // /api/history, this just keeps per-message context/cost/latency bounded.
  let contextMessages = messages.slice(-GEMINI_CONTEXT_MESSAGES);
  if (isAutoTrigger) {
    // Gemini rejects any request whose contents end on a model/assistant
    // turn ("Requests ending with a model turn are not supported") — and
    // after the first exchange, contextMessages is never empty, it just
    // often ends in Nova's last reply. So auto-triggers always need a
    // synthetic trailing user turn, not just when history is empty. This
    // placeholder is never persisted to the messages table or shown to the
    // student — the real instruction for what to actually say lives in
    // systemPrompt above.
    contextMessages = [
      ...contextMessages,
      { role: 'user', content: '(internal trigger — see system prompt instruction)' }
    ];
  }

  try {
    const onFallbackWarn = (primaryData) => {
      console.warn(
        `Model "${PRIMARY_MODEL}" is unavailable (${primaryData.error && primaryData.error.message}). ` +
        `Retrying with fallback "${FALLBACK_MODEL}".`
      );
    };

    let { response, data } = await callGeminiWithFallback(
      systemPrompt, contextMessages, onFallbackWarn, TUTOR_TOOLS
    );

    if (!response.ok && isModelUnavailableError(data)) {
      console.error(`Fallback model "${FALLBACK_MODEL}" is also unavailable:`, data);
      return res.status(503).json({
        error:
          'The tutor model is no longer available. Please update the GEMINI_MODEL ' +
          'environment variable to a current model (e.g. gemini-3.6-flash) and restart the server.'
      });
    }

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(response.status).json({
        error: (data.error && data.error.message) || 'The tutor service returned an error.'
      });
    }

    let candidate = (data.candidates || [])[0];

    if (!candidate) {
      console.error('Gemini returned no candidate:', data.promptFeedback || data);
      return res.json({ reply: "I can't answer that one — let's try a different question." });
    }

    // ── Function calling: Nova can ask for a real video instead of writing
    // a link itself, and/or move the lesson forward/back once she's taught
    // and checked understanding. If she does either, run them, hand the real
    // results back to Gemini, and use its follow-up reply as the response.
    let resource = null;
    let topicAdjustment = null;
    const functionCallParts = (candidate.content && candidate.content.parts || [])
      .filter(part => part.functionCall);

    if (functionCallParts.length) {
      const functionResponseParts = [];

      for (const part of functionCallParts) {
        const fc = part.functionCall;
        let result;

        if (fc.name === 'search_youtube_video') {
          const video = await searchReputableYoutubeVideo((fc.args && fc.args.query) || '');
          if (video) {
            resource = {
              videoId: video.videoId,
              title: video.title,
              channelTitle: video.channelTitle,
              thumbnail: video.thumbnail
            };
          }
          result = video || { found: false };
        } else if (fc.name === 'adjust_lesson_progress') {
          topicAdjustment = await applyLessonProgressAdjustment(
            userId, subjectLevel, currentTopicIndex, fc.args && fc.args.direction
          );
          // Gemini only needs the outcome, not the actual quiz question
          // text/options — that goes to the frontend separately via
          // topic_adjustment below, not into the model's context.
          result = topicAdjustment ? { ...topicAdjustment, questions: undefined } : { applied: false };
        } else {
          result = { found: false };
        }

        functionResponseParts.push({
          functionResponse: {
            name: fc.name,
            ...(fc.id ? { id: fc.id } : {}),
            response: { result }
          }
        });
      }

      const followUpContents = [
        ...toGeminiContents(contextMessages),
        candidate.content,
        { role: 'user', parts: functionResponseParts }
      ];

      let followUp = await callGeminiRaw(PRIMARY_MODEL, systemPrompt, followUpContents, TUTOR_TOOLS);
      if (!followUp.response.ok && isModelUnavailableError(followUp.data)) {
        onFallbackWarn(followUp.data);
        followUp = await callGeminiRaw(FALLBACK_MODEL, systemPrompt, followUpContents, TUTOR_TOOLS);
      }

      if (followUp.response.ok) {
        const followCandidate = (followUp.data.candidates || [])[0];
        if (followCandidate) {
          candidate = followCandidate;
        }
      } else {
        console.error('Gemini follow-up (post function call) error:', followUp.data);
      }
    }

    let text = (candidate.content && candidate.content.parts || [])
      .map(part => part.text || '')
      .filter(Boolean)
      .join('\n');

    text = stripMarkdownAndLatex(text);

    let progress = null;
    try {
      await pool.query(
        'INSERT INTO messages (user_id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
        [userId, conversationId, 'assistant', text]
      );
      // Auto-triggers aren't a real student message, so they don't earn XP —
      // same no-XP treatment as the "next level please" dev bypass.
      if (progressRow && !isAutoTrigger) {
        progress = await addXp(userId, XP_PER_MESSAGE, progressRow);
      }
    } catch (err) {
      console.error('Failed to save assistant message or update XP:', err);
    }

    res.json({ reply: text, progress, resource, topic_adjustment: topicAdjustment });
  } catch (err) {
    console.error('Tutor request failed:', err);
    res.status(502).json({ error: 'Could not reach the tutor service. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Quiz grading (deterministic — not LLM-judged, same approach as onboarding)
// ---------------------------------------------------------------------------

app.post('/api/quiz/submit', requireAuth, async (req, res) => {
  const { quiz_session_id, answers } = req.body || {};
  const sessionId = parseInt(quiz_session_id, 10);
  if (!Number.isInteger(sessionId) || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'quiz_session_id and an answers array are required.' });
  }

  const userId = req.session.userId;

  try {
    const { rows } = await pool.query(
      'SELECT id, chapter_id, questions, passed FROM quiz_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    const session = rows[0];
    if (!session) return res.status(404).json({ error: 'Quiz session not found.' });
    if (session.passed !== null) {
      return res.status(409).json({ error: 'This quiz has already been graded.' });
    }

    const questions = session.questions;
    const answerByQid = new Map(answers.map(a => [a.questionId, a.selectedIndex]));

    let correctCount = 0;
    const gradedAnswers = questions.map(q => {
      const selectedIndex = answerByQid.has(q.id) ? answerByQid.get(q.id) : null;
      const correct = selectedIndex === q.correctIndex;
      if (correct) correctCount++;
      return { questionId: q.id, selectedIndex, correct, concept: q.concept };
    });

    const total = questions.length;
    const passed = correctCount >= Math.ceil(total * 0.9); // 90%+ (9/10) = pass

    await pool.query(
      'UPDATE quiz_sessions SET answers = $1, score = $2, passed = $3 WHERE id = $4',
      [JSON.stringify(gradedAnswers), correctCount, passed, sessionId]
    );

    let newTopic = null;
    let newConversation = null;

    if (passed) {
      const { rows: progressRows } = await pool.query(
        'SELECT subject_level, current_topic_index FROM user_progress WHERE user_id = $1',
        [userId]
      );
      const progressRow = progressRows[0];
      const subjectLevel = progressRow?.subject_level;
      const topics = CURRICULUM[subjectLevel] || [];
      const currentIndex = progressRow?.current_topic_index ?? 0;

      // Only advance if this chapter is still actually the current one —
      // guards against a stale/duplicate submission after the student has
      // already moved on some other way.
      if (topics[currentIndex] && topics[currentIndex].id === session.chapter_id) {
        const newIndex = Math.min(currentIndex + 1, topics.length - 1);
        if (newIndex !== currentIndex) {
          await pool.query(
            'UPDATE user_progress SET current_topic_index = $1, updated_at = NOW() WHERE user_id = $2',
            [newIndex, userId]
          );
          newTopic = { id: topics[newIndex].id, title: topics[newIndex].title };

          const { rows: convRows } = await pool.query(
            'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at',
            [userId, newTopic.title]
          );
          newConversation = convRows[0];
        }
      }
    }

    res.json({
      passed,
      score: correctCount,
      total,
      missed_concepts: passed ? [] : [...new Set(gradedAnswers.filter(a => !a.correct).map(a => a.concept))],
      new_topic: newTopic,
      new_conversation: newConversation
    });
  } catch (err) {
    console.error('Quiz submit error:', err);
    res.status(500).json({ error: 'Could not grade the quiz.' });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Quest Tutor server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
