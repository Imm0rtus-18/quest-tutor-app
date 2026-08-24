# Quest Tutor ("Nova's Quest") — Project Context

An AI tutoring web app. The tutor character is named Nova. Built by a
non-technical founder working with their manager — all code changes
happen through AI coding tools (previously Claude Code + Replit), never
hand-written.

## Current stack

- Backend: Node.js / Express (`server.js`)
- Frontend: vanilla HTML/CSS/JS (`public/index.html` = student app,
  `public/parent.html` = parent portal)
- Database: Postgres via `DATABASE_URL` (provider-agnostic — works with
  Render's own Postgres or Neon, no code difference)
- AI: Google Gemini API (`GEMINI_API_KEY`) — NOT Anthropic's API. This was
  a deliberate switch made to use a free tier during development.
- Auth: bcrypt + express-session + connect-pg-simple (sessions persist in
  Postgres, survive server restarts)

## Features implemented so far

- Login/signup, session-based auth
- One-time onboarding: 10-question(ish) placement test across Algebra 1,
  Geometry, Algebra 2, Pre-Calculus (`questions.js`), deterministic
  scoring (not LLM-judged) — places student in a level, gates the rest of
  the app until complete
- Left-panel "quest map" flowchart showing the 4 levels, current one
  active/glowing, completed ones checked, locked ones ahead
- Real-time chat with Nova, scoped per-level via `SYSTEM_PROMPTS` (one
  system prompt per subject_level, keyed exactly to `algebra1` /
  `geometry` / `algebra2` / `precalc` — must match `LEVEL_ORDER` in
  questions.js)
- Persisted chat history — returning users see their prior conversation,
  not a reset
- XP/level/streak, currently a flat +18 XP per message (LLM-judged XP
  scoring — where the AI decides how much a message earned based on how
  meaningful/on-topic it was — is planned but NOT built yet)
- Dev bypass: typing "next level please" (exact match, case-insensitive)
  skips the LLM entirely and advances subject_level directly — testing
  tool only, no XP awarded
- Rewards/wishlist shop: students spend XP on catalog items
  (`REWARD_ITEMS` in server.js) or add custom wishlist items (photo/note/
  source URL), which need parent approval
- Parent Portal (`/parent`, `public/parent.html`): review pending wishlist
  approvals, see a progress summary

## Hard-won lessons — do not repeat these mistakes

1. **Never let an agent pick a Gemini model name from its own training
   knowledge.** This has broken the app multiple times — the model
   lineup changes fast and an agent will confidently substitute an
   outdated/retired model name even when told not to. The model name
   MUST only ever come from the `GEMINI_MODEL` env var or the exact
   fallback string already in server.js. If a "model not found" or quota
   error appears, the fix is checking ai.google.dev/gemini-api/docs/models
   for the current name and updating the env var — not letting an agent
   guess a replacement.

2. **The backend is the only source of truth for user state — never trust
   a value the frontend sends.** There was a real bug where the tutor and
   UI kept showing "Algebra II" regardless of actual placement, because
   routes were reading a client-sent value instead of looking up
   `subject_level` fresh from the database. Any route touching per-user
   state should re-query the DB, not trust the request body.

3. **Tone/formatting**: Nova must never use markdown (`**bold**`, headers,
   bullet lists) or LaTeX (`$y=b^x$`) — the chat UI renders plain text
   only, so that syntax shows up literally as asterisks and dollar signs.
   The system prompt instructs against this, AND there's a server-side
   cleanup step stripping any that slips through. Keep both — don't
   remove the cleanup step just because the prompt says not to.

4. **API keys are never pasted into chat** (this happened twice during
   development — both keys were rotated). Keys belong only in `.env`
   locally or the hosting platform's secret/environment variable manager.

## Deployment

Moving from Replit to: Render (hosting, connected via GitHub) + Postgres
(Render's own or Neon — DATABASE_URL is all that matters). The Replit
export includes a large amount of Replit-specific internal tooling
(`.local/`, `.agents/`, `.replit`, `replit.nix`, `scribe.db`,
workflow-logs) that should NOT be pushed to GitHub or deployed — only
these belong in the real repo: `server.js`, `questions.js`, `package.json`,
`public/`, `.env.example`, `README.md`, `.gitignore`.

## Not built yet (known next steps)

- LLM-judged XP scoring (replacing the flat +18/message)
- Anything beyond these 4 math levels
