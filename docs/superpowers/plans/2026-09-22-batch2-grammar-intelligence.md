# Batch 2: Grammar Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track per-topic/sub-rule grammar progress, add a quiz mode with adaptive difficulty, support bookmarking, and connect grammar weak spots to TOEIC RC5 practice — completing the learn→quiz→practice→mastery loop for grammar.

**Architecture:** `src/lib/grammar-progress.ts` stores attempt records per topic+subrule; a new `/grammar/quiz` route serves 5/10/20-question sessions; bookmarks live in `src/lib/grammar-bookmarks.ts`; grammar mastery is written to the Batch 1 `skillMasteryCache`. TOEIC link reuses the existing `/exam/drill/RC5` route with a `focusTag` param.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest (jsdom), localStorage

**Spec:** `docs/requirement/DEVELOPMENT_DIRECTION.md` §5 (Grammar Development), Batch 2 in §18

## Global Constraints

- No new npm dependencies.
- All storage is localStorage; SSR guard on every read.
- Grammar quiz must integrate with `LearningSession` (`src/lib/sessions.ts`).
- Grammar mistakes must write to `UnifiedMistake` (`src/lib/mistakes.ts`) from Batch 1.
- Grammar mastery must update `skillMasteryCache` via `saveMasteryCache` from Batch 1 `src/lib/mastery.ts`.
- Static grammar topics live in `src/lib/grammar-data.ts` — do not modify that file's data.
- `npm test && npm run lint && npm run build` must pass after every task.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/grammar-progress.ts` | GrammarAttempt type + CRUD; compute accuracy per topic+subrule |
| Create | `src/lib/__tests__/grammar-progress.test.ts` | Unit tests |
| Create | `src/lib/grammar-bookmarks.ts` | Bookmark topic/subrule identifiers |
| Modify | `src/app/grammar/page.tsx` | Add progress indicators, bookmark buttons |
| Create | `src/app/grammar/quiz/page.tsx` | `/grammar/quiz` — quiz session page |

---

## Task 1: Grammar Progress — attempt tracking

**Files:**
- Create: `src/lib/grammar-progress.ts`
- Create: `src/lib/__tests__/grammar-progress.test.ts`

**Interfaces — Produces (used by Tasks 3–4):**
```ts
export interface GrammarAttempt {
  id: string;
  topicId: string;
  subRuleId: string;
  correct: boolean;
  at: string;
}

export interface GrammarProgress {
  topicId: string;
  subRuleId: string;
  attempts: number;
  correct: number;
  accuracy: number;       // 0–100
  mastery: number;        // 0–100 (matches mastery engine scale)
  lastPracticedAt: string;
}
```

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/grammar-progress.test.ts
import {
  recordGrammarAttempt, getGrammarProgress,
  getTopicProgress, getWeakSubRules
} from "../grammar-progress";

beforeEach(() => { localStorage.clear(); });

test("recordGrammarAttempt stores an attempt", () => {
  recordGrammarAttempt({ topicId: "conditionals", subRuleId: "zero", correct: true });
  const progress = getGrammarProgress("conditionals", "zero");
  expect(progress).not.toBeNull();
  expect(progress!.attempts).toBe(1);
  expect(progress!.correct).toBe(1);
  expect(progress!.accuracy).toBe(100);
});

test("accuracy updates after wrong attempt", () => {
  recordGrammarAttempt({ topicId: "tenses", subRuleId: "past_simple", correct: true });
  recordGrammarAttempt({ topicId: "tenses", subRuleId: "past_simple", correct: false });
  const p = getGrammarProgress("tenses", "past_simple")!;
  expect(p.accuracy).toBe(50);
});

test("getTopicProgress aggregates all subrules", () => {
  recordGrammarAttempt({ topicId: "articles", subRuleId: "definite", correct: true });
  recordGrammarAttempt({ topicId: "articles", subRuleId: "indefinite", correct: false });
  const all = getTopicProgress("articles");
  expect(all).toHaveLength(2);
});

test("getWeakSubRules returns subrules with accuracy < threshold", () => {
  recordGrammarAttempt({ topicId: "conditionals", subRuleId: "second", correct: false });
  recordGrammarAttempt({ topicId: "conditionals", subRuleId: "first", correct: true });
  const weak = getWeakSubRules(70);
  expect(weak.some((w) => w.subRuleId === "second")).toBe(true);
  expect(weak.some((w) => w.subRuleId === "first")).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern=grammar-progress --no-coverage
```

- [ ] **Step 3: Implement `src/lib/grammar-progress.ts`**

```ts
const KEY = "grammarAttempts";
const MAX = 2000;

function ls(): GrammarAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as GrammarAttempt[]) : [];
  } catch { return []; }
}

function save(items: GrammarAttempt[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
}

function attemptKey(topicId: string, subRuleId: string) {
  return `${topicId}::${subRuleId}`;
}

export function recordGrammarAttempt(input: {
  topicId: string; subRuleId: string; correct: boolean;
}): void {
  const attempt: GrammarAttempt = {
    id: crypto.randomUUID(),
    topicId: input.topicId,
    subRuleId: input.subRuleId,
    correct: input.correct,
    at: new Date().toISOString(),
  };
  save([...ls(), attempt]);

  // Update unified mastery cache
  refreshGrammarMastery();
}

export function getGrammarProgress(topicId: string, subRuleId: string): GrammarProgress | null {
  const all = ls().filter(
    (a) => a.topicId === topicId && a.subRuleId === subRuleId
  );
  if (all.length === 0) return null;
  return buildProgress(topicId, subRuleId, all);
}

export function getTopicProgress(topicId: string): GrammarProgress[] {
  const all = ls().filter((a) => a.topicId === topicId);
  const bySubRule = new Map<string, GrammarAttempt[]>();
  for (const a of all) {
    const k = a.subRuleId;
    bySubRule.set(k, [...(bySubRule.get(k) ?? []), a]);
  }
  return Array.from(bySubRule.entries()).map(([subRuleId, attempts]) =>
    buildProgress(topicId, subRuleId, attempts)
  );
}

export function getWeakSubRules(accuracyThreshold = 70): GrammarProgress[] {
  const all = ls();
  const groups = new Map<string, GrammarAttempt[]>();
  for (const a of all) {
    const k = attemptKey(a.topicId, a.subRuleId);
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  return Array.from(groups.entries())
    .map(([k, attempts]) => {
      const [topicId, subRuleId] = k.split("::");
      return buildProgress(topicId, subRuleId, attempts);
    })
    .filter((p) => p.attempts >= 3 && p.accuracy < accuracyThreshold)
    .sort((a, b) => a.accuracy - b.accuracy);
}

function buildProgress(topicId: string, subRuleId: string, attempts: GrammarAttempt[]): GrammarProgress {
  const correct = attempts.filter((a) => a.correct).length;
  const accuracy = Math.round((correct / attempts.length) * 100);
  // ponytail: simple accuracy-as-mastery, upgrade with decay weight if needed
  const mastery = accuracy;
  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at));
  return {
    topicId, subRuleId,
    attempts: attempts.length, correct, accuracy, mastery,
    lastPracticedAt: sorted[sorted.length - 1].at,
  };
}

function refreshGrammarMastery(): void {
  // Re-derive grammar mastery from all attempts and save to cache
  const { computeSkillMastery, getCachedMastery, saveMasteryCache } =
    require("./mastery") as typeof import("./mastery");

  const all = ls();
  const bySubRule = new Map<string, { correct: boolean; at: string }[]>();
  for (const a of all) {
    const k = a.subRuleId;
    bySubRule.set(k, [...(bySubRule.get(k) ?? []), { correct: a.correct, at: a.at }]);
  }

  const categoryInputs = Array.from(bySubRule.entries()).map(([subRuleId, attempts]) => ({
    skill: "grammar" as const,
    category: subRuleId,
    attempts,
  }));

  const grammarMastery = computeSkillMastery("grammar", categoryInputs);
  const existing = getCachedMastery().filter((s) => s.skill !== "grammar");
  saveMasteryCache([grammarMastery, ...existing]);
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern=grammar-progress --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/grammar-progress.ts src/lib/__tests__/grammar-progress.test.ts
git commit -m "feat: add grammar progress tracking (batch2)"
```

---

## Task 2: Grammar Bookmarks

**Files:**
- Create: `src/lib/grammar-bookmarks.ts`

**Interfaces — Produces (used by Task 3 quiz mode):**
```ts
export interface GrammarBookmark {
  topicId: string;
  subRuleId: string;
  createdAt: string;
}
```

- [ ] **Step 1: Implement `src/lib/grammar-bookmarks.ts`**

(No dedicated test needed — it's a thin localStorage wrapper with the same pattern as grammar-storage.ts. The quiz page tests will exercise it.)

```ts
const KEY = "grammarBookmarks";

function ls(): GrammarBookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as GrammarBookmark[]) : [];
  } catch { return []; }
}

export function getBookmarks(): GrammarBookmark[] { return ls(); }

export function isBookmarked(topicId: string, subRuleId: string): boolean {
  return ls().some((b) => b.topicId === topicId && b.subRuleId === subRuleId);
}

export function toggleBookmark(topicId: string, subRuleId: string): boolean {
  const all = ls();
  const idx = all.findIndex((b) => b.topicId === topicId && b.subRuleId === subRuleId);
  if (idx >= 0) {
    localStorage.setItem(KEY, JSON.stringify(all.filter((_, i) => i !== idx)));
    return false;
  }
  localStorage.setItem(KEY, JSON.stringify([
    ...all,
    { topicId, subRuleId, createdAt: new Date().toISOString() },
  ]));
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/grammar-bookmarks.ts
git commit -m "feat: add grammar bookmarks (batch2)"
```

---

## Task 3: Grammar Quiz page — `/grammar/quiz`

**Files:**
- Create: `src/app/grammar/quiz/page.tsx`

**Interfaces — Consumes:**
- `getWeakSubRules`, `recordGrammarAttempt` from `src/lib/grammar-progress.ts`
- `getBookmarks` from `src/lib/grammar-bookmarks.ts`
- `startSession`, `finishSession` from `src/lib/sessions.ts`
- `addMistake` from `src/lib/mistakes.ts`
- Existing `/api/grammar-exercise` API route

**Quiz flow:**
1. User picks count (5/10/20), mode (all/weak/bookmarks), difficulty (Easy/Medium/Hard/Adaptive).
2. Session starts.
3. For each question: fetch from `/api/grammar-exercise` using a topic+subRule selected by mode.
4. User answers → record attempt → if wrong → add to `UnifiedMistake`.
5. Show result summary at end → finish session.

- [ ] **Step 1: Create `src/app/grammar/quiz/page.tsx`**

The page has three states: `"setup"`, `"quiz"`, `"done"`.

```tsx
"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { startSession, finishSession } from "@/lib/sessions";
import { recordGrammarAttempt, getWeakSubRules } from "@/lib/grammar-progress";
import { getBookmarks } from "@/lib/grammar-bookmarks";
import { addMistake } from "@/lib/mistakes";
import { getAllGrammarTopics } from "@/lib/grammar-data";

type QuizMode = "all" | "weak" | "bookmarks";
type Difficulty = "easy" | "medium" | "hard";
type Phase = "setup" | "quiz" | "done";

interface QuizQuestion {
  topicId: string;
  subRuleId: string;
  topicName: string;
  subRuleName: string;
  question: { type: string; question: string; options?: string[]; answer: string };
}

interface QuizResult {
  question: QuizQuestion;
  userAnswer: string;
  correct: boolean;
}

// Select topic+subRule combos for the quiz based on mode
function selectQuizItems(mode: QuizMode, count: number): { topicId: string; subRuleId: string; topicName: string; subRuleName: string }[] {
  const allTopics = getAllGrammarTopics();
  let pool: { topicId: string; subRuleId: string; topicName: string; subRuleName: string }[] = [];

  if (mode === "weak") {
    const weak = getWeakSubRules(70).slice(0, count * 2);
    pool = weak.map((w) => {
      const topic = allTopics.find((t) => t.id === w.topicId);
      const subRule = topic?.subRules?.find((r) => r.id === w.subRuleId);
      return { topicId: w.topicId, subRuleId: w.subRuleId,
        topicName: topic?.title ?? w.topicId, subRuleName: subRule?.title ?? w.subRuleId };
    }).filter((x) => x.topicName);
  } else if (mode === "bookmarks") {
    const bm = getBookmarks();
    pool = bm.map((b) => {
      const topic = allTopics.find((t) => t.id === b.topicId);
      const subRule = topic?.subRules?.find((r) => r.id === b.subRuleId);
      return { topicId: b.topicId, subRuleId: b.subRuleId,
        topicName: topic?.title ?? b.topicId, subRuleName: subRule?.title ?? b.subRuleId };
    }).filter((x) => x.topicName);
  } else {
    for (const topic of allTopics) {
      for (const subRule of topic.subRules ?? []) {
        pool.push({ topicId: topic.id, subRuleId: subRule.id,
          topicName: topic.title, subRuleName: subRule.title });
      }
    }
  }

  // Shuffle and take count
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export default function GrammarQuizPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<QuizMode>("all");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [items, setItems] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sessionId = useRef<string | null>(null);

  async function startQuiz() {
    const pool = selectQuizItems(mode, count);
    if (pool.length === 0) {
      alert("Không đủ nội dung cho chế độ này. Hãy thử chế độ khác.");
      return;
    }
    setLoading(true);
    // Fetch first question
    const first = pool[0];
    const res = await fetch("/api/grammar-exercise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: first.topicName, subRule: first.subRuleName }),
    });
    const q = await res.json();
    setItems([{ ...first, question: q }]);
    sessionId.current = startSession({ type: "grammar" });
    setPhase("quiz");
    setCurrent(0);
    setResults([]);
    setLoading(false);
  }

  async function loadNextQuestion(pool: { topicId: string; subRuleId: string; topicName: string; subRuleName: string }[], index: number) {
    if (index >= pool.length) return;
    const item = pool[index];
    const res = await fetch("/api/grammar-exercise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: item.topicName, subRule: item.subRuleName }),
    });
    const q = await res.json();
    setItems((prev) => [...prev, { ...item, question: q }]);
  }

  function handleAnswer(answer: string) {
    if (selected !== null) return;
    setSelected(answer);
    const q = items[current];
    const correct = answer.trim().toLowerCase() === q.question.answer.trim().toLowerCase();
    recordGrammarAttempt({ topicId: q.topicId, subRuleId: q.subRuleId, correct });
    if (!correct) {
      addMistake({
        skill: "grammar",
        category: q.subRuleId,
        source: `grammar:${q.topicId}`,
        userAnswer: answer,
        correctAnswer: q.question.answer,
        explanation: `${q.topicName} — ${q.subRuleName}`,
      });
    }
    setResults((prev) => [...prev, { question: q, userAnswer: answer, correct }]);
  }

  function handleNext() {
    if (current + 1 >= count) {
      if (sessionId.current) {
        finishSession(sessionId.current, {
          totalItems: results.length,
          correctItems: results.filter((r) => r.correct).length,
        });
      }
      setPhase("done");
      return;
    }
    setSelected(null);
    setCurrent((c) => c + 1);
  }

  const currentQ = items[current];

  if (phase === "setup") {
    return (
      <main className="max-w-md mx-auto p-4">
        <h1 className="text-xl font-bold mb-6">Quiz Ngữ pháp</h1>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Số câu</p>
            <div className="flex gap-2">
              {([5, 10, 20] as const).map((n) => (
                <button key={n} onClick={() => setCount(n)}
                  className={`px-4 py-2 rounded ${count === n ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Chủ đề</p>
            <div className="flex gap-2 flex-wrap">
              {([["all","Tất cả"],["weak","Điểm yếu"],["bookmarks","Đã lưu"]] as const).map(([v,l]) => (
                <button key={v} onClick={() => setMode(v)}
                  className={`px-4 py-2 rounded ${mode === v ? "bg-purple-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Độ khó</p>
            <div className="flex gap-2">
              {([["easy","Dễ"],["medium","Trung bình"],["hard","Khó"]] as const).map(([v,l]) => (
                <button key={v} onClick={() => setDifficulty(v)}
                  className={`px-4 py-2 rounded ${difficulty === v ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <button onClick={startQuiz} disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
            {loading ? "Đang tải..." : "Bắt đầu"}
          </button>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    const correct = results.filter((r) => r.correct).length;
    return (
      <main className="max-w-md mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Kết quả</h1>
        <p className="text-4xl font-bold text-blue-600 mb-1">{correct}/{results.length}</p>
        <p className="text-gray-500 mb-8">{Math.round((correct/results.length)*100)}% chính xác</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => setPhase("setup")} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Làm lại</button>
          <Link href="/grammar" className="px-6 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">Quay lại</Link>
        </div>
      </main>
    );
  }

  // quiz phase
  if (!currentQ) return <p className="p-4 text-center">Đang tải câu hỏi...</p>;

  return (
    <main className="max-w-md mx-auto p-4">
      <div className="flex justify-between text-sm text-gray-500 mb-4">
        <span>{currentQ.topicName} — {currentQ.subRuleName}</span>
        <span>{current + 1}/{count}</span>
      </div>
      <p className="text-base font-medium mb-4">{currentQ.question.question}</p>
      <div className="space-y-2">
        {(currentQ.question.options ?? [currentQ.question.answer, "Other"]).map((opt) => {
          const isCorrect = opt === currentQ.question.answer;
          const isSelected = opt === selected;
          let cls = "w-full text-left px-4 py-3 rounded border text-sm ";
          if (selected === null) cls += "hover:bg-gray-50 dark:hover:bg-gray-800";
          else if (isCorrect) cls += "bg-green-50 border-green-500 text-green-800";
          else if (isSelected) cls += "bg-red-50 border-red-400 text-red-700";
          else cls += "opacity-50";
          return (
            <button key={opt} onClick={() => handleAnswer(opt)} className={cls}>
              {opt}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <button onClick={handleNext} className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg font-medium">
          {current + 1 >= count ? "Xem kết quả" : "Tiếp theo"}
        </button>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify `getAllGrammarTopics` exists in `grammar-data.ts`**

```bash
grep -n "getAllGrammarTopics\|export.*topics\|export.*Topics" /Users/thankz/Code/study/src/lib/grammar-data.ts | head -10
```

If not exported, add: `export function getAllGrammarTopics() { return [...STATIC_TOPICS, ...getUserGrammarTopics()]; }` in `grammar-data.ts` (adjust to match actual export name).

- [ ] **Step 3: Build check**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add src/app/grammar/quiz/page.tsx src/lib/grammar-bookmarks.ts
git commit -m "feat: add grammar quiz + bookmarks (batch2)"
```

---

## Task 4: Grammar progress indicators in `/grammar` page

**Files:**
- Modify: `src/app/grammar/page.tsx`

Add a progress bar under each topic and a bookmark button per sub-rule. Integrate the `getTopicProgress` function.

- [ ] **Step 1: Add progress and bookmark UI to grammar page**

In `src/app/grammar/page.tsx`, import and use `getTopicProgress`, `isBookmarked`, `toggleBookmark`, and add a link to `/grammar/quiz`.

Find where topics are rendered and add after the topic title:
```tsx
// At the top of component:
import { getTopicProgress } from "@/lib/grammar-progress";
import { isBookmarked, toggleBookmark } from "@/lib/grammar-bookmarks";

// In component body (inside useEffect or on render):
// For each rendered topic, compute accuracy:
const progress = getTopicProgress(topic.id);
const topicAccuracy = progress.length > 0
  ? Math.round(progress.reduce((s, p) => s + p.accuracy, 0) / progress.length)
  : null;

// Render under topic title:
{topicAccuracy !== null && (
  <div className="flex items-center gap-2 mt-1">
    <div className="flex-1 h-1.5 bg-gray-200 rounded">
      <div className="h-1.5 bg-blue-500 rounded" style={{ width: `${topicAccuracy}%` }} />
    </div>
    <span className="text-xs text-gray-400">{topicAccuracy}%</span>
  </div>
)}

// Add quiz link in header area:
<Link href="/grammar/quiz" className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg">Quiz</Link>
```

- [ ] **Step 2: Build and test**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/grammar/page.tsx
git commit -m "feat: add grammar progress indicators + quiz link (batch2)"
```

---

## Task 5: Grammar → TOEIC RC5 link

**Files:**
- Modify: `src/app/grammar/quiz/page.tsx` (add "Practice in TOEIC" CTA on done screen)
- Modify: `src/app/exam/drill/[part]/page.tsx` (read optional `?grammarFocus=` query param to label the session)

- [ ] **Step 1: Add TOEIC CTA to quiz done screen**

In the `phase === "done"` section of `src/app/grammar/quiz/page.tsx`, find the worst-performing sub-rule from results and link to RC5:

```tsx
const worstCategory = results
  .filter((r) => !r.correct)
  .map((r) => r.question.subRuleId)
  .reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {});
const topWeak = Object.entries(worstCategory).sort(([,a],[,b]) => b - a)[0]?.[0];

// In JSX:
{topWeak && (
  <Link
    href={`/exam/drill/RC5?grammarFocus=${encodeURIComponent(topWeak)}`}
    className="mt-4 block px-6 py-2 bg-orange-500 text-white rounded-lg text-center">
    Luyện tập trong TOEIC RC5
  </Link>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/grammar/quiz/page.tsx
git commit -m "feat: link grammar quiz weak spots to TOEIC RC5 (batch2)"
```

---

## Acceptance Criteria

- [ ] `recordGrammarAttempt` stores attempts and updates accuracy per topic+subrule.
- [ ] Grammar quiz offers 5/10/20 questions, all/weak/bookmarks modes.
- [ ] Wrong answer in quiz creates a `UnifiedMistake` with `skill: "grammar"`.
- [ ] Grammar mastery cache updates after each quiz attempt.
- [ ] `/grammar` shows accuracy progress bar per topic.
- [ ] Bookmark toggle persists across reloads.
- [ ] Done screen links weak sub-rules to TOEIC RC5.
- [ ] `npm test && npm run lint && npm run build` pass.

## Risks

- `getAllGrammarTopics` may not exist by that name — verify actual export name in `grammar-data.ts` before Task 3.
- Sub-rule IDs must match between `grammar-data.ts` and progress tracking — confirm `subRule.id` exists or use `subRule.title` as the key.

## Dependencies

- Batch 1 (`src/lib/mistakes.ts`, `src/lib/mastery.ts`) — must be complete first.
- Existing `/api/grammar-exercise` API route — already present.

## Out of Scope

- AI-generated adaptive difficulty (uses fixed difficulty levels only).
- Grammar mistakes in the global `/mistakes` page are automatic via `addMistake` — no extra work.
