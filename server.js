require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { QUESTIONS, LEVEL_ORDER } = require('./questions');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Primary model — read exclusively from the GEMINI_MODEL env var.
// Defaults to gemini-3.6-flash, a stable current model on the free tier.
// Override with GEMINI_MODEL=gemini-3.5-flash-lite in .env if you hit daily rate limits.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// Automatic one-shot retry model used when the primary model is deprecated or unavailable.
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

const BCRYPT_ROUNDS = 12;
const XP_PER_MESSAGE = 18;

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
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
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

// Add XP for a user, handle level-up, persist, return new state.
async function addXp(userId, amount) {
  const { rows } = await pool.query(
    'SELECT xp, level, subject_level FROM user_progress WHERE user_id = $1',
    [userId]
  );
  if (!rows.length) return null;

  let { xp, level, subject_level } = rows[0];
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
    let { response, data } = await callGemini(PRIMARY_MODEL, systemPrompt, [{ role: 'user', content: userMessage }]);

    if (!response.ok && isModelUnavailableError(data)) {
      ({ response, data } = await callGemini(FALLBACK_MODEL, systemPrompt, [{ role: 'user', content: userMessage }]));
    }
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

    // Safety-net cleanup (same rule as the tutor route — no markdown/LaTeX).
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/\$\$([^$]+)\$\$/g, '$1').replace(/\$([^$]+)\$/g, '$1');

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
Talk the way a genuinely good human teacher would — calm, encouraging,
and clear, not like a hype-driven chatbot.

Tone:
- Write like a real teacher speaking to one student, not a performance.
  Skip exclamation-point stacking, over-the-top enthusiasm, and emoji —
  at most one emoji occasionally, if ever, never more than one per
  message.
- Vary your openings. Don't start every message the same way.

Formatting:
- Do not use markdown formatting of any kind — no asterisks, no
  headers, no bullet lists unless the student explicitly asks for one.
- Do not use LaTeX or dollar-sign math notation. Write math in plain
  text: use ^ for exponents, a slash for fractions, and describe steps
  in plain sentences.

Teaching approach:
- Teach step by step, one idea at a time. Periodically ask the student
  to explain a concept back in their own words before moving on.
- If you're not fully certain about something, say so plainly rather
  than guessing.
- Keep replies concise — a few short sentences or steps at a time.
- End most replies with a question or a clear next step, naturally.
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

async function callGemini(model, systemPrompt, messages) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: toGeminiContents(messages),
      generationConfig: { maxOutputTokens: 1000 }
    })
  });
  const data = await response.json();
  return { response, data };
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
    const { rows } = await pool.query(
      'SELECT xp, level, streak, subject_level, onboarding_complete FROM user_progress WHERE user_id = $1',
      [req.session.userId]
    );
    const prog = rows[0] || { xp: 0, level: 0, streak: 0, subject_level: null, onboarding_complete: false };
    res.json({ ...prog, xp_cap: xpCap(prog.level) });
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

app.get('/api/history', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT role, content FROM messages WHERE user_id = $1 ORDER BY created_at ASC',
      [req.session.userId]
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
      'UPDATE user_progress SET subject_level = $1, onboarding_complete = true, updated_at = NOW() WHERE user_id = $2',
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

  const { messages, subject } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request must include a non-empty "messages" array.' });
  }

  const userId = req.session.userId;
  const userMsg = messages[messages.length - 1];

  // ── Developer bypass — "next level please" ─────────────────────────
  if (userMsg.content.trim().toLowerCase() === 'next level please') {
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
        'UPDATE user_progress SET subject_level = $1, updated_at = NOW() WHERE user_id = $2',
        [newLevel, userId]
      );
      reply = `Moving you on to ${LEVEL_LABELS[newLevel]}. Take your time — there's no rush getting comfortable with the new material.`;
    }

    // Save the bypass exchange to history for session continuity.
    try {
      await pool.query(
        'INSERT INTO messages (user_id, role, content) VALUES ($1, $2, $3)',
        [userId, 'user', userMsg.content]
      );
      await pool.query(
        'INSERT INTO messages (user_id, role, content) VALUES ($1, $2, $3)',
        [userId, 'assistant', reply]
      );
    } catch (err) {
      console.error('Failed to save bypass messages:', err);
    }

    return res.json({ reply, subject_level: newLevel });
  }

  // ── Normal path ────────────────────────────────────────────────────
  // Ignore the "subject" field from the frontend — read the real placement from DB.
  const { rows: subjectRows } = await pool.query(
    'SELECT subject_level FROM user_progress WHERE user_id = $1',
    [userId]
  );
  const subjectLevel = subjectRows[0]?.subject_level || null;
  if (!subjectLevel) {
    console.warn(`User ${userId} reached /api/tutor with null subject_level — defaulting to algebra1.`);
  }
  const systemPrompt = SYSTEM_PROMPTS[subjectLevel] || SYSTEM_PROMPTS.algebra1;

  try {
    await pool.query(
      'INSERT INTO messages (user_id, role, content) VALUES ($1, $2, $3)',
      [userId, 'user', userMsg.content]
    );
  } catch (err) {
    console.error('Failed to save user message:', err);
  }

  try {
    let { response, data } = await callGemini(PRIMARY_MODEL, systemPrompt, messages);

    if (!response.ok && isModelUnavailableError(data)) {
      console.warn(
        `Model "${PRIMARY_MODEL}" is unavailable (${data.error && data.error.message}). ` +
        `Retrying with fallback "${FALLBACK_MODEL}".`
      );
      ({ response, data } = await callGemini(FALLBACK_MODEL, systemPrompt, messages));

      if (!response.ok && isModelUnavailableError(data)) {
        console.error(`Fallback model "${FALLBACK_MODEL}" is also unavailable:`, data);
        return res.status(503).json({
          error:
            'The tutor model is no longer available. Please update the GEMINI_MODEL ' +
            'environment variable to a current model (e.g. gemini-3.6-flash) and restart the server.'
        });
      }
    }

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(response.status).json({
        error: (data.error && data.error.message) || 'The tutor service returned an error.'
      });
    }

    const candidate = (data.candidates || [])[0];

    if (!candidate) {
      console.error('Gemini returned no candidate:', data.promptFeedback || data);
      return res.json({ reply: "I can't answer that one — let's try a different question." });
    }

    let text = (candidate.content && candidate.content.parts || [])
      .map(part => part.text || '')
      .filter(Boolean)
      .join('\n');

    // Safety-net cleanup (unchanged)
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/\$\$([^$]+)\$\$/g, '$1').replace(/\$([^$]+)\$/g, '$1');

    let progress = null;
    try {
      await pool.query(
        'INSERT INTO messages (user_id, role, content) VALUES ($1, $2, $3)',
        [userId, 'assistant', text]
      );
      progress = await addXp(userId, XP_PER_MESSAGE);
    } catch (err) {
      console.error('Failed to save assistant message or update XP:', err);
    }

    res.json({ reply: text, progress });
  } catch (err) {
    console.error('Tutor request failed:', err);
    res.status(502).json({ error: 'Could not reach the tutor service. Please try again.' });
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
