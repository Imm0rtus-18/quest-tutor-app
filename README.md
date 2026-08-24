# Quest Tutor — local prototype

A small backend that keeps your Gemini API key private on the server, plus
the frontend UI, wired together so Nova can actually respond.

## Setup

1. **Install Node.js 18 or later**, if you don't already have it.
   https://nodejs.org

2. **Install dependencies.** From inside this folder, run:
   ```
   npm install
   ```

3. **Add your API key.** Copy `.env.example` to a new file named `.env`,
   then paste in your real Gemini API key:
   ```
   cp .env.example .env
   ```
   Get a free key at Google AI Studio: https://aistudio.google.com — no
   credit card required. The free tier has daily/per-minute request limits,
   which is plenty for development but worth knowing about if requests
   start failing after heavy testing in one day.

4. **Run the server:**
   ```
   npm start
   ```

5. **Open the app** in your browser at http://localhost:3000

## What's here

- `server.js` — the backbone. Holds the system prompt and your API key,
  and is the only thing that talks to Gemini's API.
- `public/index.html` — the frontend (same UI as before), now calling
  your local server at `/api/tutor` instead of calling Gemini directly.
- Only the Math subject is wired to a real system prompt right now —
  `SYSTEM_PROMPTS` in `server.js` is where new subjects get added later.

## If you're continuing in Claude Code

You can hand this whole folder to Claude Code and ask it to run `npm install`
and `npm start` for you, or to help troubleshoot if something doesn't start
cleanly (wrong Node version, missing key, port already in use, etc.).
