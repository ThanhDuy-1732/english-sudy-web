# Admin monitoring (Neon + /admin) — design

## Why
Owner wants to see, on the app itself (not the Vercel dashboard): how fast / reliable the AI features are, and how people use the app. Today metrics are in-memory per instance (lost on cold start) and there is no usage data at all.

## Goals
- Durable record of every AI call (task, provider, latency, ok, fallback, repair).
- Anonymous usage: page views and "finished a session" per feature, per device.
- `/admin` page, locked by existing `ADMIN_SECRET`, showing the last N days.

## Non-goals / anti-goals
- No user accounts, no login, no names/emails/IP stored.
- Must not slow down user requests (writes happen after the response).
- App must keep working if the DB is down or `DATABASE_URL` is unset (logging becomes a no-op).

## Approaches considered
- A. Vercel Analytics only — no code, but data is only on Vercel's dashboard and Hobby has no custom events. Rejected: owner wants it on-site.
- **B. Neon Postgres + own `/admin` — chosen.** One place, owner's data, history.
- C. Hybrid — usage still off-site. Rejected.

## Design
- **DB**: Neon, `DATABASE_URL` server-only (`.env.local`, Vercel env). Driver `@neondatabase/serverless` (HTTP, suits serverless). Schema in `db/schema.sql`:
  `events(id bigserial, at timestamptz default now(), kind text  -- 'ai' | 'page' | 'done', device text, name text, ms int, ok bool, provider text, fallback bool, repair bool)` + index on `(kind, at)`.
- **AI calls**: in `callTask` (single choke point), next to `recordMetric`, schedule `logEvent(...)` with Next 15 `after()`. Errors swallowed + `console.warn`.
- **Usage**: client keeps a random `deviceId` (UUID, localStorage). A tiny `UsageTracker` in `layout.tsx` posts `{kind:'page', name: pathname}` on route change to `POST /api/track`. `done` events sent from the central place where learning sessions are saved (one call site, found during planning). `/api/track` validates kind/length, ignores bad input.
- **Read**: `GET /api/admin/stats?days=7` (same `x-admin-secret` check as `/api/admin/metrics`) returns:
  per-task count / p50 / p95 / error % / fallback % ; AI calls + errors per day; active devices per day; top pages; done counts per feature.
- **UI**: `/admin` client page: secret input (kept in sessionStorage), range 1/7/30 days, plain tables + CSS bars, no chart lib.

## Builder's calls (mine, correctable)
- No retention job yet; add a 90-day delete when the table grows.
- `/api/track` is unauthenticated, so numbers can be spammed; acceptable for a personal app, add rate limiting if abused.
- Existing in-memory `/api/admin/metrics` stays as is.
