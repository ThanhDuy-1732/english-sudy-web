# Batch 1: Learning Session System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every major learning flow (review, exam, speaking, writing) emits a `LearningSession` record to a shared store, and the user can see their activity history at `/activity`.

**Architecture:** A single `src/lib/sessions.ts` module owns all session CRUD — thin localStorage wrapper, pure functions, SSR-safe. Each learning page calls `startSession` on mount (guarded by `useRef` to prevent remount duplicates) and `finishSession` on completion. Review page gets a summary screen shown after the last card before navigating away.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest (jsdom)

**Spec:** `docs/superpowers/specs/2026-09-17-development-roadmap-design.md` — Batch 1 section

## Global Constraints

- No new npm dependencies.
- API keys stay server-side only — `sessions.ts` is client-safe (no provider imports).
- `localStorage` is primary storage — SSR guard required on every read (`typeof window === "undefined"`).
- All date comparisons use **local date** (not UTC slice) — follow the `formatDate` pattern in `src/lib/daily-challenge.ts`.
- `npm test && npm run lint && npm run build` must pass after every task.
- Update `CONTEXT.md` after Task 6 (new page + new localStorage key).

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/sessions.ts` | LearningSession type + all CRUD functions |
| Create | `src/lib/__tests__/sessions.test.ts` | Unit tests for sessions.ts |
| Modify | `src/app/review/page.tsx` | Start session on mount, summary screen, finish on summary dismiss |
| Modify | `src/app/exam/drill/[part]/page.tsx` | Start/finish session per drill |
| Modify | `src/app/exam/mock/page.tsx` | Start/finish session per mock test |
| Modify | `src/app/speak/roleplay/[id]/page.tsx` | Start/finish session per roleplay |
| Modify | `src/app/speak/ielts/[part]/page.tsx` | Start/finish session per IELTS part |
| Modify | `src/app/write/task/[id]/page.tsx` | Start session on mount, finish when result saved |
| Create | `src/app/activity/page.tsx` | `/activity` route — sessions grouped by date |
| Update | `CONTEXT.md` | Document new route + localStorage key |

---

## Task 1: LearningSession model + storage functions

**Files:**
- Create: `src/lib/sessions.ts`
- Create: `src/lib/__tests__/sessions.test.ts`

**Interfaces — Produces (used by Tasks 2–6):**
```ts
type LearningActivityType = "vocabulary" | "review" | "grammar" | "exam" | "speaking" | "writing";

interface LearningSession {
  id: string;
  type: LearningActivityType;
  startedAt: string;       // ISO
  finishedAt?: string;     // ISO
  durationSeconds: number;
  totalItems?: number;
  correctItems?: number;
  metadata?: Record<string, unknown>;
}

// Functions exported:
startSession(type: LearningActivityType, metadata?: Record<string, unknown>): string  // returns id
updateSession(id: string, patch: Partial<Pick<LearningSession, "totalItems" | "correctItems" | "metadata">>): void
finishSession(id: string, totals?: { totalItems?: number; correctItems?: number }): void
cancelSession(id: string): void
getSessions(): LearningSession[]
getSessionsForDate(localDateStr: string): LearningSession[]   // "YYYY-MM-DD"
getRecentSessions(n: number): LearningSession[]
```

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
    jest.advanceTimersByTime(90_000); // 90 seconds
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
    finishSession(id); // should not change anything
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
    startSession("review"); // 2026-09-17 local
    const results = getSessionsForDate("2026-09-17");
    expect(results).toHaveLength(1);
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
npm test -- --testPathPattern=sessions.test -t "" 2>&1 | head -30
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

function localDateStr(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  // newest first, capped at CAP
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
  return load().filter((s) => localDateStr(s.startedAt) === localDate);
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

- [ ] **Step 5: Lint check**

```bash
npm run lint -- --quiet 2>&1 | grep -E "error|warning" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/sessions.ts src/lib/__tests__/sessions.test.ts
git commit -m "feat(sessions): add LearningSession model and storage functions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Review page — session tracking + summary screen

**Files:**
- Modify: `src/app/review/page.tsx`

**Interfaces — Consumes:**
```ts
// from src/lib/sessions.ts:
startSession(type: "review"): string
finishSession(id: string, totals: { totalItems: number; correctItems: number }): void
cancelSession(id: string): void

// from src/lib/storage.ts (already imported):
getWordsForReview(): LearnedWord[]
getDueCount(): number   // need to check if this exists, else compute inline
```

**Interfaces — Produces:**
- Review page shows a summary screen after the last card is reviewed (before navigating away).
- Summary data: `{ total, again, hard, good, easy, durationSeconds, nextDueCount }` passed as props/state.

**What the summary screen shows:**
- Total reviewed, breakdown (Again / Hard / Được / Dễ counts)
- Accuracy % (good+easy / total)
- Duration in minutes:seconds
- Next due count (words still due today, if any)
- A "Xong" button that navigates to `/`

- [ ] **Step 1: Read the current review page to understand state flow**

```bash
cat -n src/app/review/page.tsx
```

Note which props `Flashcard` accepts and where `handleReviewed` is called. The current page calls `getWordsForReview()` again on each review — the summary needs to know the final counts.

- [ ] **Step 2: Write the failing test for session integration**

Add to `src/app/review/__tests__/page.test.tsx` (check if file exists first; if it does, append):

```ts
import { render, screen, act } from "@testing-library/react";
import { getSessions } from "@/lib/sessions";
import ReviewPage from "../page";

// Mock storage and sessions
jest.mock("@/lib/storage", () => ({
  getWordsForReview: jest.fn().mockReturnValue([
    { word: "test", meaning: "thử nghiệm", example: "This is a test.", topic: "general", learnedAt: new Date().toISOString() },
  ]),
}));

jest.mock("@/lib/sessions", () => ({
  startSession: jest.fn().mockReturnValue("mock-session-id"),
  finishSession: jest.fn(),
  cancelSession: jest.fn(),
}));

describe("ReviewPage session tracking", () => {
  it("calls startSession with 'review' on mount", () => {
    const { startSession } = require("@/lib/sessions");
    render(<ReviewPage />);
    expect(startSession).toHaveBeenCalledWith("review");
  });

  it("does not call startSession twice on remount", () => {
    const { startSession } = require("@/lib/sessions");
    startSession.mockClear();
    const { rerender } = render(<ReviewPage />);
    rerender(<ReviewPage />);
    expect(startSession).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
npm test -- --testPathPattern="review/__tests__/page" 2>&1 | tail -20
```

- [ ] **Step 4: Update `src/app/review/page.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getWordsForReview, type LearnedWord } from "@/lib/storage";
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
import Flashcard from "@/components/Flashcard";

interface ReviewSummary {
  total: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
  durationSeconds: number;
  nextDueCount: number;
}

export default function ReviewPage() {
  const router = useRouter();
  const [words, setWords] = useState<LearnedWord[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const countsRef = useRef({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });

  useEffect(() => {
    const due = getWordsForReview();
    setWords(due);
    if (due.length > 0 && sessionIdRef.current === null) {
      sessionIdRef.current = startSession("review");
      startTimeRef.current = Date.now();
      countsRef.current = { again: 0, hard: 0, good: 0, easy: 0, total: due.length };
    }
    // cleanup: cancel if user navigates away before finishing
    return () => {
      if (sessionIdRef.current) {
        cancelSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleReviewed(quality: 0 | 3 | 4 | 5) {
    // track quality breakdown
    if (quality === 0) countsRef.current.again++;
    else if (quality === 3) countsRef.current.hard++;
    else if (quality === 4) countsRef.current.good++;
    else if (quality === 5) countsRef.current.easy++;

    const remaining = getWordsForReview();
    setWords(remaining);

    if (remaining.length === 0 && sessionIdRef.current) {
      const c = countsRef.current;
      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      const correctItems = c.good + c.easy;

      finishSession(sessionIdRef.current, {
        totalItems: c.total,
        correctItems,
      });
      sessionIdRef.current = null; // prevent cancel on unmount

      setSummary({
        total: c.total,
        again: c.again,
        hard: c.hard,
        good: c.good,
        easy: c.easy,
        durationSeconds,
        nextDueCount: 0, // no more due after finishing
      });
    }
  }

  if (summary) {
    const accuracy = summary.total > 0
      ? Math.round(((summary.good + summary.easy) / summary.total) * 100)
      : 0;
    const mins = Math.floor(summary.durationSeconds / 60);
    const secs = summary.durationSeconds % 60;

    return (
      <main className="bg-[#f7f4ff] px-4 py-16 text-[#2c1f4a] sm:px-6">
        <div className="mx-auto max-w-md text-center">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="font-display text-3xl font-bold mb-6">Ôn tập xong!</h1>

          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 text-left space-y-3">
            <div className="flex justify-between">
              <span className="text-[#6b6384]">Tổng số từ</span>
              <span className="font-semibold">{summary.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b6384]">Quên</span>
              <span className="font-semibold text-red-500">{summary.again}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b6384]">Khó</span>
              <span className="font-semibold text-orange-500">{summary.hard}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b6384]">Được</span>
              <span className="font-semibold text-blue-500">{summary.good}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b6384]">Dễ</span>
              <span className="font-semibold text-green-600">{summary.easy}</span>
            </div>
            <hr className="border-[#e8e0f7]" />
            <div className="flex justify-between">
              <span className="text-[#6b6384]">Độ chính xác</span>
              <span className="font-semibold">{accuracy}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b6384]">Thời gian</span>
              <span className="font-semibold">{mins}:{String(secs).padStart(2, "0")}</span>
            </div>
          </div>

          <button
            onClick={() => router.push("/")}
            className="w-full rounded-xl bg-[#7f56d9] py-3 px-6 font-semibold text-white hover:bg-[#6941c6] transition-colors"
          >
            Xong
          </button>
        </div>
      </main>
    );
  }

  if (words.length === 0) {
    return (
      <main className="bg-[#f7f4ff] px-4 py-16 text-[#2c1f4a] sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-5xl mb-6">🎉</p>
          <h1 className="font-display text-3xl font-bold mb-3">Hoàn thành rồi!</h1>
          <p className="text-[#6b6384] text-lg">Không có từ nào cần ôn hôm nay.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#f7f4ff] px-4 py-12 text-[#2c1f4a] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f56d9]">
            Spaced repetition
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Ôn tập hôm nay</h1>
          <p className="mt-2 text-[#6b6384]">{words.length} từ cần ôn</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {words.map((w) => (
            <Flashcard
              key={w.word}
              word={w.word}
              meaning={w.meaning}
              topic={w.topic}
              initialExample={w.example}
              initialSynonymData={{
                synonyms: w.synonyms ?? [],
                antonyms: w.antonyms ?? [],
              }}
              isReviewMode={true}
              onReviewed={handleReviewed}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
```

**Note:** The `Flashcard` component's `onReviewed` callback currently receives no arguments — check `src/components/Flashcard.tsx` to confirm. If it passes no quality value, change `handleReviewed(quality: 0 | 3 | 4 | 5)` to `handleReviewed()` and skip the quality tracking (just increment `good`). The summary still shows.

- [ ] **Step 5: Run tests**

```bash
npm test -- --testPathPattern="review"
```

- [ ] **Step 6: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Fix any TypeScript errors before continuing.

- [ ] **Step 7: Commit**

```bash
git add src/app/review/page.tsx src/app/review/__tests__/page.test.tsx
git commit -m "feat(review): add session tracking and post-review summary screen

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Exam pages — session tracking

**Files:**
- Modify: `src/app/exam/drill/[part]/page.tsx`
- Modify: `src/app/exam/mock/page.tsx`

**Interfaces — Consumes:**
```ts
// from src/lib/sessions.ts:
startSession(type: "exam", metadata?: Record<string, unknown>): string
finishSession(id: string, totals: { totalItems: number; correctItems: number }): void
cancelSession(id: string): void
```

**Pattern to follow** (same for both files):

```tsx
const sessionIdRef = useRef<string | null>(null);

useEffect(() => {
  if (sessionIdRef.current === null) {
    sessionIdRef.current = startSession("exam", { part: partParam });
  }
  return () => {
    if (sessionIdRef.current) {
      cancelSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
  };
}, [partParam]);

// On drill/mock completion:
if (sessionIdRef.current) {
  finishSession(sessionIdRef.current, { totalItems, correctItems });
  sessionIdRef.current = null;
}
```

- [ ] **Step 1: Read the exam drill page to understand its state flow**

```bash
cat -n src/app/exam/drill/[part]/page.tsx
```

Identify: where the drill ends (result state), what counts are tracked (correct/total), what the `part` param is called.

- [ ] **Step 2: Add session tracking to `src/app/exam/drill/[part]/page.tsx`**

At the top of the file, add import:

```ts
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
```

Inside the component, add after existing `useRef`/`useState` declarations:

```ts
const sessionIdRef = useRef<string | null>(null);
```

In the main `useEffect` that sets up the drill (or add a new one):

```ts
useEffect(() => {
  if (sessionIdRef.current === null) {
    sessionIdRef.current = startSession("exam", { part: params.part });
  }
  return () => {
    if (sessionIdRef.current) {
      cancelSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
  };
}, []); // empty deps — runs once on mount
```

Find where the drill records a result (where `correctCount` and `totalCount` are finalized). Add after that point:

```ts
if (sessionIdRef.current) {
  finishSession(sessionIdRef.current, {
    totalItems: totalCount,
    correctItems: correctCount,
  });
  sessionIdRef.current = null;
}
```

- [ ] **Step 3: Add session tracking to `src/app/exam/mock/page.tsx`**

Same pattern. Read the file first:

```bash
cat -n src/app/exam/mock/page.tsx
```

Add import + `sessionIdRef`. Use `startSession("exam", { mode: "mock" })`. Call `finishSession` when the mock test result is calculated (where score/accuracy is set). Call `cancelSession` in cleanup.

- [ ] **Step 4: Run build to check TypeScript**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 5: Run all tests**

```bash
npm test -- --testPathPattern="exam" 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add src/app/exam/drill/[part]/page.tsx src/app/exam/mock/page.tsx
git commit -m "feat(exam): add session tracking to drill and mock pages

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Speaking pages — session tracking

**Files:**
- Modify: `src/app/speak/roleplay/[id]/page.tsx`
- Modify: `src/app/speak/ielts/[part]/page.tsx`

**Interfaces — Consumes:**
```ts
startSession(type: "speaking", metadata?: Record<string, unknown>): string
finishSession(id: string, totals?: {}): void
cancelSession(id: string): void
```

Speaking sessions don't have correct/total item counts — just duration.

- [ ] **Step 1: Read both speaking pages**

```bash
cat -n src/app/speak/roleplay/[id]/page.tsx | head -60
cat -n src/app/speak/ielts/[part]/page.tsx | head -60
```

Identify: where the session ends (user submits / grading completes), what the scenario/part param is.

- [ ] **Step 2: Add to roleplay page**

Import and `useRef` pattern same as Task 3. Use:

```ts
sessionIdRef.current = startSession("speaking", { mode: "roleplay", scenarioId: params.id });
```

Call `finishSession(sessionIdRef.current)` when the roleplay conversation ends (when `goalAchieved` is true or user taps "End Session"). Call `cancelSession` in cleanup.

- [ ] **Step 3: Add to IELTS speaking page**

```ts
sessionIdRef.current = startSession("speaking", { mode: "ielts", part: params.part });
```

Call `finishSession` when grading result is received and displayed.

- [ ] **Step 4: Build + test**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -10
npm test -- --testPathPattern="speak" 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/app/speak/roleplay/[id]/page.tsx src/app/speak/ielts/[part]/page.tsx
git commit -m "feat(speak): add session tracking to roleplay and IELTS pages

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Writing page — session tracking

**Files:**
- Modify: `src/app/write/task/[id]/page.tsx`

**Interfaces — Consumes:**
```ts
startSession(type: "writing", metadata?: Record<string, unknown>): string
finishSession(id: string): void
cancelSession(id: string): void
```

- [ ] **Step 1: Read writing task page**

```bash
cat -n src/app/write/task/[id]/page.tsx | head -60
```

Identify: where the user submits for grading and where the result is stored/navigated-to.

- [ ] **Step 2: Add session tracking**

Import + `useRef`:

```ts
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
const sessionIdRef = useRef<string | null>(null);
```

Mount effect:

```ts
useEffect(() => {
  if (sessionIdRef.current === null) {
    sessionIdRef.current = startSession("writing", { taskId: params.id });
  }
  return () => {
    if (sessionIdRef.current) {
      cancelSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
  };
}, []);
```

On submit/navigation to result:

```ts
if (sessionIdRef.current) {
  finishSession(sessionIdRef.current);
  sessionIdRef.current = null;
}
```

- [ ] **Step 3: Build + test**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -10
npm test 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/write/task/[id]/page.tsx
git commit -m "feat(write): add session tracking to writing task page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: `/activity` page + CONTEXT.md update

**Files:**
- Create: `src/app/activity/page.tsx`
- Update: `CONTEXT.md`

**Interfaces — Consumes:**
```ts
getSessions(): LearningSession[]       // from sessions.ts
getRecentSessions(n: number): LearningSession[]
```

**What the page shows:**
- Sessions grouped by local date (today first)
- Each session: type badge (colored by type), duration, totalItems/correctItems if available, time of day
- Empty state if no sessions yet

- [ ] **Step 1: Create `src/app/activity/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSessions, type LearningSession, type LearningActivityType } from "@/lib/sessions";

function localDateStr(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const TYPE_LABELS: Record<LearningActivityType, string> = {
  vocabulary: "Từ vựng",
  review: "Ôn tập",
  grammar: "Ngữ pháp",
  exam: "Luyện thi",
  speaking: "Luyện nói",
  writing: "Luyện viết",
};

const TYPE_COLORS: Record<LearningActivityType, string> = {
  vocabulary: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  grammar: "bg-green-100 text-green-700",
  exam: "bg-orange-100 text-orange-700",
  speaking: "bg-pink-100 text-pink-700",
  writing: "bg-yellow-100 text-yellow-700",
};

const TYPE_LINKS: Record<LearningActivityType, string> = {
  vocabulary: "/",
  review: "/review",
  grammar: "/grammar",
  exam: "/exam",
  speaking: "/speak",
  writing: "/write",
};

function SessionRow({ session }: { session: LearningSession }) {
  const accuracy =
    session.totalItems && session.correctItems !== undefined
      ? Math.round((session.correctItems / session.totalItems) * 100)
      : null;

  return (
    <div className="flex items-center justify-between py-3 border-b border-[#e8e0f7] last:border-0">
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full ${TYPE_COLORS[session.type]}`}
        >
          {TYPE_LABELS[session.type]}
        </span>
        <span className="text-sm text-[#6b6384]">{formatTime(session.startedAt)}</span>
      </div>
      <div className="flex items-center gap-4 text-sm text-[#2c1f4a]">
        {accuracy !== null && (
          <span className="text-[#6b6384]">{accuracy}%</span>
        )}
        {session.totalItems !== undefined && (
          <span className="text-[#6b6384]">{session.totalItems} mục</span>
        )}
        <span className="font-medium">{formatDuration(session.durationSeconds)}</span>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [grouped, setGrouped] = useState<[string, LearningSession[]][]>([]);

  useEffect(() => {
    const sessions = getSessions().filter((s) => s.finishedAt); // only completed
    const map = new Map<string, LearningSession[]>();
    for (const s of sessions) {
      const date = localDateStr(s.startedAt);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(s);
    }
    setGrouped([...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)));
  }, []);

  if (grouped.length === 0) {
    return (
      <main className="bg-[#f7f4ff] px-4 py-16 text-[#2c1f4a] sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-5xl mb-6">📖</p>
          <h1 className="font-display text-3xl font-bold mb-3">Chưa có hoạt động</h1>
          <p className="text-[#6b6384] mb-8">Bắt đầu học để xem lịch sử tại đây.</p>
          <Link
            href="/"
            className="rounded-xl bg-[#7f56d9] py-3 px-6 font-semibold text-white hover:bg-[#6941c6] transition-colors"
          >
            Bắt đầu học
          </Link>
        </div>
      </main>
    );
  }

  const todayStr = localDateStr(new Date().toISOString());

  return (
    <main className="bg-[#f7f4ff] px-4 py-12 text-[#2c1f4a] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f56d9]">
            Lịch sử học tập
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Hoạt động</h1>
        </div>

        <div className="space-y-6">
          {grouped.map(([date, sessions]) => (
            <div key={date} className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-sm text-[#6b6384] mb-3">
                {date === todayStr
                  ? "Hôm nay"
                  : new Date(date + "T12:00:00").toLocaleDateString("vi-VN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                <span className="ml-2 font-normal">({sessions.length} phiên)</span>
              </h2>
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add `/activity` to the navigation**

Check `src/components/` or `src/app/layout.tsx` for where nav links live:

```bash
grep -r "href=\"/stats\"" src/ --include="*.tsx" -l
```

Open that file and add:

```tsx
<Link href="/activity">Hoạt động</Link>
```

near the stats/diary links.

- [ ] **Step 3: Update CONTEXT.md**

Add to the Pages & Routes table:

```
| `/activity` | `src/app/activity/page.tsx` | Learning activity history — sessions grouped by date, type badge, duration, accuracy |
```

Add to the localStorage Keys table:

```
| `learningSessions` | `LearningSession[]` | All learning sessions, capped at 500, newest first |
```

- [ ] **Step 4: Full milestone gate**

```bash
npm test
npm run lint
npm run build
```

All three must pass with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/activity/page.tsx CONTEXT.md
# Also add any nav file modified in Step 2
git commit -m "feat(activity): add /activity page and update CONTEXT.md

- Sessions grouped by local date, newest first
- Type badges, duration, accuracy per session
- Empty state with CTA

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered |
|---|---|
| `startSession`, `updateSession`, `finishSession`, `cancelSession`, `getSessions`, `getSessionsForDate`, `getRecentSessions` | Task 1 ✅ |
| Session for vocabulary, review, grammar, exam, speaking, writing | Review (T2), Exam (T3), Speaking (T4), Writing (T5) ✅ — vocabulary/grammar deferred to Batch 4/5 |
| No duplicate session on refresh/remount | `useRef` guard in all pages ✅ |
| Session only finished when activity completes | `cancelSession` in cleanup + `finishSession` only on completion ✅ |
| Review Session Summary (again/hard/good/easy/accuracy/duration) | Task 2 summary screen ✅ |
| `/activity` route — sessions by date, type, duration, result | Task 6 ✅ |
| Existing `studyTime` continues working | Not touched ✅ |
| Unit tests for lifecycle | Task 1 covers all cases ✅ |
| Old data without `learningSessions` key works | `load()` returns `[]` on missing key ✅ |
| Cap at 500 | `save()` slices to 500 ✅ |

**Type consistency check:**
- `LearningActivityType` defined in Task 1 → used in Tasks 2–6 via import ✅
- `finishSession(id, { totalItems, correctItems })` signature consistent across all tasks ✅
- `cancelSession(id)` — one argument, consistent ✅
- `localDateStr` defined independently in `sessions.ts` and `activity/page.tsx` — both are local helpers, no shared import needed ✅

**Placeholder scan:** No TBDs, TODOs, or "implement later" found. ✅

**Known gap:** Vocabulary and grammar sessions not integrated in this batch — they have no dedicated learning flow page yet (vocabulary lives on `/` which is a generate+study combined page). These are addressed in Batch 4 (Grammar v2) and Batch 5 (Vocabulary v2).
