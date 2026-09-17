# Batch 1 / T2: Review Page — Session Tracking + Summary Screen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session tracking to `/review` and show a summary screen (Again/Hard/Được/Dễ counts, accuracy, duration) after the last card is reviewed.

**Architecture:** `useRef` guards `startSession` call on mount (prevents remount duplicate). `finishSession` called only when `getWordsForReview()` returns empty after a review. Summary shown as a new render state before navigating away.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest

**Spec:** `docs/superpowers/specs/2026-09-17-development-roadmap-design.md` — Batch 1

**Requires:** T1 complete (`src/lib/sessions.ts` exists)

**Previous task:** `docs/superpowers/plans/batch1/t1-sessions-model.md`

**Next task:** `docs/superpowers/plans/batch1/t3-exam-session.md`

## Global Constraints

- No new npm dependencies.
- `useRef` to prevent duplicate session on remount — do not use `useState` for session ID.
- `cancelSession` in `useEffect` cleanup — guards user navigating away mid-session.
- `npm test && npm run lint && npm run build` must pass at the end.

---

## Files

| Action | File |
|---|---|
| Modify | `src/app/review/page.tsx` |
| Modify | `src/app/review/__tests__/page.test.tsx` |

## Interfaces Consumed (from T1)

```ts
import { startSession, finishSession, cancelSession } from "@/lib/sessions";

startSession("review"): string           // returns session id
finishSession(id, { totalItems, correctItems }): void
cancelSession(id): void
```

---

- [ ] **Step 1: Read the current review page and Flashcard's onReviewed signature**

```bash
cat -n src/app/review/page.tsx
grep -n "onReviewed" src/components/Flashcard.tsx | head -10
```

Note: does `onReviewed` receive a quality argument (0 | 3 | 4 | 5)? If yes, the summary can show Again/Hard/Good/Easy breakdown. If no argument, simplify to just track total and treat all as correct.

- [ ] **Step 2: Add a failing test to `src/app/review/__tests__/page.test.tsx`**

If the file doesn't exist yet, create it. If it exists, append these tests:

```ts
import { render } from "@testing-library/react";

jest.mock("@/lib/storage", () => ({
  getWordsForReview: jest.fn().mockReturnValue([
    {
      word: "test",
      meaning: "thử nghiệm",
      example: "This is a test.",
      topic: "general",
      learnedAt: new Date().toISOString(),
    },
  ]),
}));

const mockStartSession = jest.fn().mockReturnValue("mock-session-id");
const mockFinishSession = jest.fn();
const mockCancelSession = jest.fn();

jest.mock("@/lib/sessions", () => ({
  startSession: (...args: unknown[]) => mockStartSession(...args),
  finishSession: (...args: unknown[]) => mockFinishSession(...args),
  cancelSession: (...args: unknown[]) => mockCancelSession(...args),
}));

describe("ReviewPage session tracking", () => {
  beforeEach(() => {
    mockStartSession.mockClear();
    mockFinishSession.mockClear();
    mockCancelSession.mockClear();
  });

  it("calls startSession with 'review' on mount", () => {
    render(<ReviewPage />);
    expect(mockStartSession).toHaveBeenCalledWith("review");
    expect(mockStartSession).toHaveBeenCalledTimes(1);
  });

  it("does not call startSession twice on rerender", () => {
    const { rerender } = render(<ReviewPage />);
    rerender(<ReviewPage />);
    expect(mockStartSession).toHaveBeenCalledTimes(1);
  });
});
```

Add this import at the top (after any existing imports):

```ts
import ReviewPage from "../page";
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
npm test -- --testPathPattern="review/__tests__/page" 2>&1 | tail -20
```

- [ ] **Step 4: Rewrite `src/app/review/page.tsx`**

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
    return () => {
      if (sessionIdRef.current) {
        cancelSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If onReviewed receives quality (0|3|4|5), use this signature.
  // If Flashcard passes no argument, change to: function handleReviewed()
  // and remove the quality tracking lines.
  function handleReviewed(quality?: 0 | 3 | 4 | 5) {
    if (quality === 0) countsRef.current.again++;
    else if (quality === 3) countsRef.current.hard++;
    else if (quality === 4) countsRef.current.good++;
    else if (quality === 5) countsRef.current.easy++;
    else countsRef.current.good++; // fallback if no quality arg

    const remaining = getWordsForReview();
    setWords(remaining);

    if (remaining.length === 0 && sessionIdRef.current) {
      const c = countsRef.current;
      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      finishSession(sessionIdRef.current, {
        totalItems: c.total,
        correctItems: c.good + c.easy,
      });
      sessionIdRef.current = null;
      setSummary({ total: c.total, again: c.again, hard: c.hard, good: c.good, easy: c.easy, durationSeconds });
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
              initialSynonymData={{ synonyms: w.synonyms ?? [], antonyms: w.antonyms ?? [] }}
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

**Note on `onReviewed` signature:** Check `src/components/Flashcard.tsx`. If `onReviewed` is typed as `() => void`, change `handleReviewed(quality?: 0|3|4|5)` to `handleReviewed()` — the quality tracking lines become dead code (remove them, increment `good` only). If typed as `(quality: 0|3|4|5) => void`, the code above works as-is.

- [ ] **Step 5: Run tests**

```bash
npm test -- --testPathPattern="review"
```

- [ ] **Step 6: Full gate**

```bash
npm test && npm run lint && npm run build
```

Fix any TypeScript errors (`onReviewed` type mismatch is the most likely one).

- [ ] **Step 7: Commit**

```bash
git add src/app/review/page.tsx src/app/review/__tests__/page.test.tsx
git commit -m "feat(review): add session tracking and post-review summary screen

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
