# Browser E2E suite

Drives a real Chrome through the running app. It complements the Jest unit tests: it covers what jsdom cannot see
(layout, theming, contrast, hydration, real navigation, storage failures).

```bash
npm run dev          # in one terminal
npm run e2e          # in another (about 10 minutes)
node --test --test-concurrency=1 "e2e/contrast.e2e.js"   # a single file
```

| Variable | Meaning |
|---|---|
| `CHROME_PATH` | Chrome/Chromium binary (defaults to the macOS app, then `/usr/bin/google-chrome`, `chromium`) |
| `E2E_BASE` | App URL (default `http://localhost:3000`) |
| `E2E_AI=1` | Also run the scenarios that call the real AI providers (skipped by default; they cost quota and are slow) |
| `E2E_DEBUG=1` | Print per-state timings in `states.e2e.js` |

## Files

- `contrast.e2e.js` – every page in both themes: text contrast ≥ 3, `data-theme` applied, no hydration mismatch, no uncaught errors.
- `states.e2e.js` – interactive states (flipped cards, quizzes, modals, drawers, mobile menu) in both themes.
- `mock-exam.e2e.js`, `writing.e2e.js`, `vocab-grammar.e2e.js`, `data-settings.e2e.js` – feature flows with deterministic AI mocks.
- `sync.e2e.js` – two devices sharing data through a sync key, offline queue replay and invalid-key message (needs the local Supabase from `.env.local`).
- `resilience.e2e.js` – AI endpoints failing (HTTP 502 and network abort), hostile storage (wrong-typed, blocked, full) and HTML injection.

## Writing scenarios

- Use `scenario(name, async ({ browser, check }) => …)`; `check(label, ok, note)` collects every failure and the scenario asserts once at the end.
- `newPage(browser, { theme, seed, intercept })` gives each page an isolated browser context, seeds `localStorage` once, and sets the OS colour scheme. Return `true` from `intercept` after answering a request (see `json()` and `aiMocks()` in `fixtures.js`).
- Keep the app server running; a dead server shows up as `ERR_CONNECTION_REFUSED` or "detached Frame" in many checks at once.
