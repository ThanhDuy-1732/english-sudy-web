# Batch 1 / T1: LearningSession Model + Storage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `src/lib/sessions.ts` with the `LearningSession` type and all CRUD functions, backed by localStorage, with a full unit test suite.

**Architecture:** Pure functions over a localStorage key `learningSessions`. SSR-safe. Cap at 500, sorted newest-first. No new dependencies.

**Tech Stack:** TypeScript, Jest (jsdom)

**Spec:** `docs/superpowers/specs/2026-09-17-development-roadmap-design.md` — Batch 1

**Next task:** `docs/superpowers/plans/batch1/t2-review-session.md`

## Global Constraints

- No new npm dependencies.
- SSR guard on every localStorage read (`typeof window === "undefined"`).
- All date grouping uses **local date** (not UTC slice).
- `npm test && npm run lint && npm run build` must pass at the end.

---

## Files

| Action | File |
|---|---|
| Create | `src/lib/sessions.ts` |
| Create | `src/lib/__tests__/sessions.test.ts` |

## Interfaces Produced (used by T2–T6)

```ts
export type LearningActivityType =
  | "vocabulary" | "review" | "grammar" | "exam" | "speaking" | "writing";

export interface LearningSession {
  id: string;
  type: LearningActivityType;
  startedAt: string;        // ISO
  finishedAt?: string;      // ISO
  durationSeconds: number;
  totalItems?: number;
  correctItems?: number;
  metadata?: Record<string, unknown>;
}

startSession(type: LearningActivityType, metadata?: Record<string, unknown>): string
updateSession(id: string, patch: Partial<Pick<LearningSession, "totalItems" | "correctItems" | "metadata">>): void
finishSession(id: string, totals?: { totalItems?: number; correctItems?: number }): void
cancelSession(id: string): void
getSessions(): LearningSession[]
getSessionsForDate(localDateStr: string): LearningSession[]  // "YYYY-MM-DD"
getRecentSessions(n: number): LearningSession[]
```

---

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/sessions.test.ts`:

```ts
import {
  startSession,
  updateSession,
  finishSession,
  cancelSession,
  getSessions,
  getSessionsForDate,
  getRecentSessions,
} from "../sessions";

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-09-17T10:00:00.000+07:00"));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("startSession", () => {
  it("creates a session with correct type and startedAt", () => {
    const id = startSession("review");
    const sessions = getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(id);
    expect(sessions[0].type).toBe("review");
    expect(sessions[0].durationSeconds).toBe(0);
    expect(sessions[0].finishedAt).toBeUndefined();
  });

  it("stores metadata when provided", () => {
    startSession("exam", { part: "RC5" });
    expect(getSessions()[0].metadata).toEqual({ part: "RC5" });
  });
});

describe("finishSession", () => {
  it("sets finishedAt and calculates durationSeconds", () => {
    const id = startSession("review");
    jest.advanceTimersByTime(90_000);
    finishSession(id, { totalItems: 10, correctItems: 8 });
    const s = getSessions()[0];
    expect(s.finishedAt).toBeDefined();
    expect(s.durationSeconds).toBe(90);
    expect(s.totalItems).toBe(10);
    expect(s.correctItems).toBe(8);
  });

  it("is idempotent — second call is a no-op", () => {
    const id = startSession("review");
    jest.advanceTimersByTime(30_000);
    finishSession(id);
    const first = getSessions()[0].durationSeconds;
    jest.advanceTimersByTime(60_000);
    finishSession(id);
    expect(getSessions()[0].durationSeconds).toBe(first);
  });
});

describe("cancelSession", () => {
  it("removes the session", () => {
    const id = startSession("speaking");
    cancelSession(id);
    expect(getSessions()).toHaveLength(0);
  });

  it("is a no-op for unknown id", () => {
    startSession("writing");
    cancelSession("nonexistent");
    expect(getSessions()).toHaveLength(1);
  });
});

describe("updateSession", () => {
  it("patches totalItems and correctItems", () => {
    const id = startSession("exam");
    updateSession(id, { totalItems: 5, correctItems: 3 });
    const s = getSessions()[0];
    expect(s.totalItems).toBe(5);
    expect(s.correctItems).toBe(3);
  });
});

describe("getSessions", () => {
  it("returns sessions sorted newest first", () => {
    const id1 = startSession("review");
    jest.advanceTimersByTime(1000);
    const id2 = startSession("exam");
    const sessions = getSessions();
    expect(sessions[0].id).toBe(id2);
    expect(sessions[1].id).toBe(id1);
  });

  it("caps at 500 — adding 501st drops oldest", () => {
    for (let i = 0; i < 501; i++) {
      startSession("vocabulary");
    }
    expect(getSessions()).toHaveLength(500);
  });
});

describe("getSessionsForDate", () => {
  it("returns sessions for local date string", () => {
    startSession("review");
    expect(getSessionsForDate("2026-09-17")).toHaveLength(1);
  });

  it("returns empty for a different date", () => {
    startSession("review");
    expect(getSessionsForDate("2026-09-16")).toHaveLength(0);
  });
});

describe("getRecentSessions", () => {
  it("returns the N most recent sessions", () => {
    startSession("review");
    startSession("exam");
    startSession("speaking");
    expect(getRecentSessions(2)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
npm test -- --testPathPattern=sessions.test 2>&1 | head -20
```

Expected: `Cannot find module '../sessions'`

- [ ] **Step 3: Implement `src/lib/sessions.ts`**

```ts
export type LearningActivityType =
  | "vocabulary"
  | "review"
  | "grammar"
  | "exam"
  | "speaking"
  | "writing";

export interface LearningSession {
  id: string;
  type: LearningActivityType;
  startedAt: string;
  finishedAt?: string;
  durationSeconds: number;
  totalItems?: number;
  correctItems?: number;
  metadata?: Record<string, unknown>;
}

const KEY = "learningSessions";
const CAP = 500;

function load(): LearningSession[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed as LearningSession[];
  } catch {
    return [];
  }
}

function save(sessions: LearningSession[]): void {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  localStorage.setItem(KEY, JSON.stringify(sorted.slice(0, CAP)));
}

export function startSession(
  type: LearningActivityType,
  metadata?: Record<string, unknown>
): string {
  const id = crypto.randomUUID();
  const session: LearningSession = {
    id,
    type,
    startedAt: new Date().toISOString(),
    durationSeconds: 0,
    ...(metadata ? { metadata } : {}),
  };
  const sessions = load();
  sessions.push(session);
  save(sessions);
  return id;
}

export function updateSession(
  id: string,
  patch: Partial<Pick<LearningSession, "totalItems" | "correctItems" | "metadata">>
): void {
  const sessions = load();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], ...patch };
  save(sessions);
}

export function finishSession(
  id: string,
  totals?: { totalItems?: number; correctItems?: number }
): void {
  const sessions = load();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  if (sessions[idx].finishedAt) return; // idempotent
  const now = new Date();
  const started = new Date(sessions[idx].startedAt);
  sessions[idx] = {
    ...sessions[idx],
    finishedAt: now.toISOString(),
    durationSeconds: Math.round((now.getTime() - started.getTime()) / 1000),
    ...(totals?.totalItems !== undefined ? { totalItems: totals.totalItems } : {}),
    ...(totals?.correctItems !== undefined ? { correctItems: totals.correctItems } : {}),
  };
  save(sessions);
}

export function cancelSession(id: string): void {
  const sessions = load();
  save(sessions.filter((s) => s.id !== id));
}

export function getSessions(): LearningSession[] {
  return load();
}

export function getSessionsForDate(localDate: string): LearningSession[] {
  return load().filter((s) => {
    const d = new Date(s.startedAt);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}` === localDate;
  });
}

export function getRecentSessions(n: number): LearningSession[] {
  return load().slice(0, n);
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npm test -- --testPathPattern=sessions.test
```

Expected: all green

- [ ] **Step 5: Full gate**

```bash
npm test && npm run lint && npm run build
```

All must pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sessions.ts src/lib/__tests__/sessions.test.ts
git commit -m "feat(sessions): add LearningSession model and storage functions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
