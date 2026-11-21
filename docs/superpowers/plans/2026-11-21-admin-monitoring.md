# Admin Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Durable AI-call + anonymous usage events in Neon, viewed on `/admin`.
**Architecture:** One `events` table. Server logs AI calls from `callTask` via Next `after()`; client beacons page views / finished sessions to `/api/track`. `/api/admin/stats` aggregates in SQL; `/admin` renders tables.
**Tech Stack:** Next 15, `@neondatabase/serverless`, Jest.
**Spec:** `docs/superpowers/specs/2026-11-21-admin-monitoring-design.md`

## Global Constraints
- `DATABASE_URL` server-only; never imported from client components.
- Unset `DATABASE_URL` or DB error → no-op, never throws into the request.
- No names/emails/IP stored; device = random UUID in localStorage `deviceId`.
- Admin auth = existing `x-admin-secret` / `ADMIN_SECRET` (timing-safe), 503 unset, 401 wrong.

## Review Focus
- `/api/track` with junk body (wrong kind, huge name, non-JSON) → 204/400, nothing inserted. (Task 2 test)
- `callTask` outside a request scope (tests, scripts) → `after()` unavailable must not throw. (Task 2: guarded)
- Stats with zero rows → empty arrays, page shows "Chưa có dữ liệu". (Task 3)
- `days` param garbage/huge → clamped to 1..90. (Task 3 test)
- localStorage blocked → tracking silently skipped. (Task 2: try/catch)

---

### Task 1: Schema + DB helper
**Files:** Create `db/schema.sql`, `src/lib/db-events.ts`
**Produces:** `type EventKind = "ai" | "page" | "done"`; `logEvent(e: {kind; name; device?; ms?; ok?; provider?; fallback?; repair?}): Promise<void>`; `getStats(days: number): Promise<Stats>`.
- [ ] Apply schema to Neon; verify table exists.

### Task 2: Writers
**Files:** Create `src/app/api/track/route.ts`, `src/lib/track.ts`, `src/components/UsageTracker.tsx`; Modify `src/lib/ai-tasks.ts` (finally block), `src/lib/sessions.ts` (`finishSession`), `src/app/layout.tsx`.
- [ ] Test `src/app/api/__tests__/track.test.ts`: valid `{kind:"page",name:"/vocab",device}` → 204 + `logEvent` called; `kind:"ai"` or name > 200 chars or bad JSON → 400, not called.

### Task 3: Stats API + page
**Files:** Create `src/lib/admin-auth.ts` (`checkAdmin(req): NextResponse | null`), `src/app/api/admin/stats/route.ts`, `src/app/admin/page.tsx`; Modify `src/app/api/admin/metrics/route.ts` to use `checkAdmin`.
- [ ] Test `src/app/api/__tests__/admin-stats.test.ts`: no secret env → 503; wrong → 401; right + `days=999` → `getStats(90)`.

### Task 4: Verify + docs
- [ ] `npm test`, `npm run lint`, `npm run build`; update `CONTEXT.md`; check `/admin` in browser.
