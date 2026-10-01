# Batch 5: Vocabulary & Insights — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a vocabulary quiz mode, AI context practice (mini-story from selected words), real streak tracking, mastery timeline snapshots, and a weekly learning report with actionable insights.

**Architecture:** Vocab quiz reads from `learnedWords` localStorage and uses `/api/generate-fillblank` + `/api/grade-sentence` for question generation. Context practice calls a new `/api/vocab/context` route (reuses existing AI provider chain). Streak and mastery timeline are computed in `src/lib/stats.ts` additions. Weekly report renders in `/stats` as a new tab.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest (jsdom), localStorage

**Spec:** `docs/requirement/DEVELOPMENT_DIRECTION.md` §9 (Vocabulary v2), §10 (Stats & Learning Insights), Batch 5 in §18

## Global Constraints

- No new npm dependencies.
- Vocabulary quiz must NOT call AI for every question — use existing `learnedWords` data for distractors when possible; call AI only for fill/sentence/dictation modes.
- Mastery timeline snapshots are append-only and capped at 365 entries.
- Streak counts a day as active if at least one `LearningSession` exists for that local date.
- Weekly report must work even if some skills have no data (show "—" not crash).
- `npm test && npm run lint && npm run build` must pass after every task.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/streak.ts` | Current streak, longest streak, active-days-this-week |
| Create | `src/lib/__tests__/streak.test.ts` | Unit tests |
| Create | `src/lib/mastery-timeline.ts` | Append + read mastery snapshots |
| Create | `src/lib/__tests__/mastery-timeline.test.ts` | Unit tests |
| Create | `src/app/vocab/quiz/page.tsx` | `/vocab/quiz` — vocab quiz session |
| Create | `src/app/vocab/context/page.tsx` | `/vocab/context` — AI context practice |
| Create | `src/app/api/vocab/context/route.ts` | Server-side AI call for context generation |
| Modify | `src/app/stats/page.tsx` | Add weekly report tab + actionable insights |

---

## Task 1: Streak tracking

**Files:**
- Create: `src/lib/streak.ts`
- Create: `src/lib/__tests__/streak.test.ts`

**Interfaces — Produces (used by Task 5 stats):**
```ts
export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  activeDaysThisWeek: number;
}
```

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/streak.test.ts
import { computeStreak } from "../streak";
import type { LearningSession } from "../sessions";

function makeSession(dateStr: string): LearningSession {
  return { id: dateStr, type: "review", startedAt: `${dateStr}T10:00:00`,
    durationSeconds: 600, finishedAt: `${dateStr}T10:10:00` };
}

test("currentStreak counts consecutive days up to today", () => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);

  function fmt(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  const sessions = [today, yesterday, twoDaysAgo].map((d) => makeSession(fmt(d)));
  const result = computeStreak(sessions);
  expect(result.currentStreak).toBe(3);
});

test("streak breaks if a day is missing", () => {
  const sessions = [
    makeSession("2026-09-22"),
    // 2026-09-21 missing
    makeSession("2026-09-20"),
  ];
  // Only counts from today backward; depends on "today" in test
  // We test that the two non-consecutive dates don't both count
  const result = computeStreak(sessions, new Date("2026-09-22"));
  expect(result.currentStreak).toBe(1);
});

test("longestStreak finds the longest run", () => {
  const sessions = [
    makeSession("2026-09-01"), makeSession("2026-09-02"), makeSession("2026-09-03"),
    // gap
    makeSession("2026-09-10"), makeSession("2026-09-11"),
  ];
  const result = computeStreak(sessions, new Date("2026-09-11"));
  expect(result.longestStreak).toBe(3);
});

test("activeDaysThisWeek counts Mon–Sun of current week", () => {
  const sessions = [
    makeSession("2026-09-21"), // Mon
    makeSession("2026-09-22"), // Tue
  ];
  const result = computeStreak(sessions, new Date("2026-09-22"));
  expect(result.activeDaysThisWeek).toBe(2);
});
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="streak" --no-coverage
```

- [ ] **Step 3: Implement `src/lib/streak.ts`**

```ts
import type { LearningSession } from "./sessions";

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  activeDaysThisWeek: number;
}

function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function computeStreak(sessions: LearningSession[], referenceDate = new Date()): StreakInfo {
  const activeDates = new Set(sessions.map((s) => localDate(s.startedAt)));

  // Current streak — count backward from reference date
  let currentStreak = 0;
  const cursor = new Date(referenceDate);
  cursor.setHours(12, 0, 0, 0);
  while (activeDates.has(formatDate(cursor))) {
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak — sort dates and find longest consecutive run
  const sorted = Array.from(activeDates).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of sorted) {
    if (prev) {
      const diff = (new Date(date).getTime() - new Date(prev).getTime()) / 86400000;
      if (diff === 1) {
        run++;
      } else {
        run = 1;
      }
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = date;
  }

  // Active days this week (Mon–Sun)
  const weekStart = new Date(referenceDate);
  const day = weekStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  let activeDaysThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    if (d > referenceDate) break;
    if (activeDates.has(formatDate(d))) activeDaysThisWeek++;
  }

  return { currentStreak, longestStreak: longest, activeDaysThisWeek };
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="streak" --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/streak.ts src/lib/__tests__/streak.test.ts
git commit -m "feat: add streak tracking (batch5)"
```

---

## Task 2: Mastery Timeline snapshots

**Files:**
- Create: `src/lib/mastery-timeline.ts`
- Create: `src/lib/__tests__/mastery-timeline.test.ts`

**Interfaces — Produces:**
```ts
export interface MasterySnapshot {
  date: string;          // YYYY-MM-DD
  skill: string;
  mastery: number;       // 0–100
}
```

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/mastery-timeline.test.ts
import { recordMasterySnapshot, getMasteryTimeline, getSkillTrend } from "../mastery-timeline";

beforeEach(() => { localStorage.clear(); });

test("recordMasterySnapshot stores a snapshot", () => {
  recordMasterySnapshot("grammar", 44);
  const timeline = getMasteryTimeline("grammar");
  expect(timeline).toHaveLength(1);
  expect(timeline[0].mastery).toBe(44);
  expect(timeline[0].skill).toBe("grammar");
});

test("recordMasterySnapshot does not duplicate same date+skill", () => {
  recordMasterySnapshot("grammar", 44);
  recordMasterySnapshot("grammar", 46); // same day, different value
  expect(getMasteryTimeline("grammar")).toHaveLength(1);
  expect(getMasteryTimeline("grammar")[0].mastery).toBe(46); // last write wins
});

test("getSkillTrend compares last 7 vs prior 7 days", () => {
  // Simulate improving grammar
  for (let i = 14; i > 7; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    localStorage.setItem("masteryTimeline", JSON.stringify([
      ...JSON.parse(localStorage.getItem("masteryTimeline") ?? "[]"),
      { date, skill: "grammar", mastery: 40 },
    ]));
  }
  for (let i = 7; i > 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    localStorage.setItem("masteryTimeline", JSON.stringify([
      ...JSON.parse(localStorage.getItem("masteryTimeline") ?? "[]"),
      { date, skill: "grammar", mastery: 65 },
    ]));
  }
  expect(getSkillTrend("grammar")).toBe("up");
});
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="mastery-timeline" --no-coverage
```

- [ ] **Step 3: Implement `src/lib/mastery-timeline.ts`**

```ts
const KEY = "masteryTimeline";
const MAX = 365 * 6; // ~6 skills * 365 days

function ls(): MasterySnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as MasterySnapshot[]) : [];
  } catch { return []; }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordMasterySnapshot(skill: string, mastery: number): void {
  const date = today();
  const all = ls().filter((s) => !(s.date === date && s.skill === skill));
  const updated = [...all, { date, skill, mastery }];
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(updated.slice(-MAX)));
  }
}

export function getMasteryTimeline(skill: string): MasterySnapshot[] {
  return ls().filter((s) => s.skill === skill).sort((a, b) => a.date.localeCompare(b.date));
}

export function getSkillTrend(skill: string): "up" | "down" | "stable" {
  const timeline = getMasteryTimeline(skill);
  if (timeline.length < 4) return "stable";
  const half = Math.floor(timeline.length / 2);
  const recent = timeline.slice(-half);
  const prior = timeline.slice(-half * 2, -half);
  const recentAvg = recent.reduce((s, t) => s + t.mastery, 0) / recent.length;
  const priorAvg = prior.reduce((s, t) => s + t.mastery, 0) / prior.length;
  if (recentAvg - priorAvg > 5) return "up";
  if (priorAvg - recentAvg > 5) return "down";
  return "stable";
}
```

- [ ] **Step 4: Run tests and commit**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="mastery-timeline" --no-coverage
git add src/lib/mastery-timeline.ts src/lib/__tests__/mastery-timeline.test.ts
git commit -m "feat: add mastery timeline snapshots (batch5)"
```

---

## Task 3: Vocabulary Quiz — `/vocab/quiz`

**Files:**
- Create: `src/app/vocab/quiz/page.tsx`

**Quiz modes:** Meaning (MCQ), Fill (fill-in-blank via API), Dictation (listen + type). Distractors for MCQ come from other learned words (same topic preferred).

- [ ] **Step 1: Create `src/app/vocab/quiz/page.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getLearnedWords, type LearnedWord } from "@/lib/storage";
import { startSession, finishSession } from "@/lib/sessions";

type QuizMode = "meaning" | "fill" | "dictation";
type Phase = "setup" | "quiz" | "done";

interface MCQQuestion { type: "mcq"; word: string; meaning: string; options: string[]; answer: string }
interface FillQuestion { type: "fill"; word: string; sentence: string; answer: string; isLoading: boolean }
type Question = MCQQuestion | FillQuestion;

function buildMCQ(word: LearnedWord, allWords: LearnedWord[]): MCQQuestion {
  const distractors = allWords
    .filter((w) => w.word !== word.word && w.meaning)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((w) => w.meaning);
  const options = [...distractors, word.meaning].sort(() => Math.random() - 0.5);
  return { type: "mcq", word: word.word, meaning: word.meaning, options, answer: word.meaning };
}

export default function VocabQuizPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<QuizMode>("meaning");
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<{ correct: boolean }[]>([]);
  const sessionIdRef = { current: "" };

  const allWords = typeof window !== "undefined" ? getLearnedWords() : [];

  function startQuiz() {
    const pool = [...allWords].sort(() => Math.random() - 0.5).slice(0, count);
    let qs: Question[];
    if (mode === "meaning") {
      qs = pool.map((w) => buildMCQ(w, allWords));
    } else {
      // fill mode: load sentences lazily
      qs = pool.map((w) => ({
        type: "fill" as const, word: w.word,
        sentence: w.example ?? "", answer: w.word, isLoading: !w.example,
      }));
    }
    setQuestions(qs);
    setCurrentIdx(0);
    setResults([]);
    setSelected(null);
    setInput("");
    sessionIdRef.current = startSession({ type: "vocabulary" });
    setPhase("quiz");
  }

  async function fetchFillSentence(word: string, idx: number) {
    const res = await fetch("/api/generate-fillblank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });
    const data = await res.json();
    setQuestions((prev) => prev.map((q, i) =>
      i === idx && q.type === "fill"
        ? { ...q, sentence: data.sentence, isLoading: false }
        : q
    ));
  }

  useEffect(() => {
    if (phase !== "quiz") return;
    const q = questions[currentIdx];
    if (q?.type === "fill" && q.isLoading) {
      fetchFillSentence(q.word, currentIdx);
    }
  }, [currentIdx, phase, questions]);

  function handleAnswer(answer: string) {
    if (selected !== null) return;
    setSelected(answer);
    const q = questions[currentIdx];
    const correct = answer.trim().toLowerCase() === q.answer.trim().toLowerCase();
    setResults((prev) => [...prev, { correct }]);
  }

  function handleNext() {
    if (currentIdx + 1 >= questions.length) {
      finishSession(sessionIdRef.current, {
        totalItems: results.length + 1,
        correctItems: results.filter((r) => r.correct).length + (selected === questions[currentIdx].answer ? 1 : 0),
      });
      setPhase("done");
      return;
    }
    setSelected(null);
    setInput("");
    setCurrentIdx((i) => i + 1);
  }

  if (phase === "setup") return (
    <main className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-6">Quiz Từ vựng</h1>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Chế độ</p>
          <div className="flex gap-2 flex-wrap">
            {([["meaning","Nghĩa"],["fill","Điền vào chỗ trống"],["dictation","Nghe viết"]] as const).map(([v,l]) => (
              <button key={v} onClick={() => setMode(v)}
                className={`px-3 py-2 rounded text-sm ${mode === v ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
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
        <button onClick={startQuiz} disabled={allWords.length < 4}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
          {allWords.length < 4 ? "Cần ít nhất 4 từ" : "Bắt đầu"}
        </button>
      </div>
    </main>
  );

  if (phase === "done") {
    const correct = results.filter((r) => r.correct).length;
    return (
      <main className="max-w-md mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Kết quả</h1>
        <p className="text-4xl font-bold text-blue-600 mb-1">{correct}/{results.length}</p>
        <p className="text-gray-500 mb-8">{Math.round((correct/results.length)*100)}% chính xác</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => setPhase("setup")} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Làm lại</button>
          <Link href="/" className="px-6 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">Trang chủ</Link>
        </div>
      </main>
    );
  }

  const q = questions[currentIdx];
  if (!q) return null;

  return (
    <main className="max-w-md mx-auto p-4">
      <div className="flex justify-between text-sm text-gray-500 mb-4">
        <span>{mode === "meaning" ? "Chọn nghĩa đúng" : "Điền từ vào chỗ trống"}</span>
        <span>{currentIdx + 1}/{count}</span>
      </div>

      {q.type === "mcq" && (
        <>
          <p className="text-2xl font-bold text-center mb-6">{q.word}</p>
          <div className="space-y-2">
            {q.options.map((opt) => {
              let cls = "w-full text-left px-4 py-3 rounded border text-sm ";
              if (selected === null) cls += "hover:bg-gray-50 dark:hover:bg-gray-800";
              else if (opt === q.answer) cls += "bg-green-50 border-green-500 text-green-800";
              else if (opt === selected) cls += "bg-red-50 border-red-400 text-red-700";
              else cls += "opacity-50";
              return (
                <button key={opt} onClick={() => handleAnswer(opt)} className={cls}>{opt}</button>
              );
            })}
          </div>
        </>
      )}

      {q.type === "fill" && (
        <>
          {q.isLoading
            ? <p className="text-center py-8 text-gray-400">Đang tạo câu hỏi...</p>
            : (
              <>
                <p className="text-base mb-4">{q.sentence.replace(q.word, "______")}</p>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={selected !== null}
                  onKeyDown={(e) => e.key === "Enter" && selected === null && handleAnswer(input)}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                  placeholder="Nhập từ..."
                  autoFocus
                />
                {selected !== null && (
                  <p className={`text-sm mt-2 ${input.toLowerCase() === q.answer.toLowerCase() ? "text-green-600" : "text-red-500"}`}>
                    {input.toLowerCase() === q.answer.toLowerCase() ? "Đúng!" : `Đáp án: ${q.answer}`}
                  </p>
                )}
              </>
            )
          }
        </>
      )}

      {selected !== null && (
        <button onClick={handleNext}
          className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg font-medium">
          {currentIdx + 1 >= count ? "Xem kết quả" : "Tiếp theo"}
        </button>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/vocab/quiz/page.tsx
git commit -m "feat: add vocabulary quiz (batch5)"
```

---

## Task 4: AI Context Practice — `/vocab/context`

**Files:**
- Create: `src/app/api/vocab/context/route.ts`
- Create: `src/app/vocab/context/page.tsx`

- [ ] **Step 1: Create the API route**

```ts
// src/app/api/vocab/context/route.ts
import { NextResponse } from "next/server";
import { callWithFallback } from "@/lib/providers/provider-utils";

export async function POST(req: Request) {
  const { words, format = "dialogue" } = await req.json() as {
    words: string[];
    format: "mini_story" | "dialogue" | "email" | "workplace";
  };

  if (!words?.length) return NextResponse.json({ error: "words required" }, { status: 400 });

  const formatPrompts: Record<string, string> = {
    mini_story: "a short story (3-4 sentences)",
    dialogue: "a short dialogue between two people (4-6 lines)",
    email: "a short professional email",
    workplace: "a short workplace situation description (3-4 sentences)",
  };

  const prompt = `Create ${formatPrompts[format] ?? formatPrompts.dialogue} that naturally uses ALL of these English words: ${words.join(", ")}.
Mark each target word with **bold** formatting.
Return only the text, no explanation.`;

  const text = await callWithFallback({ prompt, outputType: "text" });
  return NextResponse.json({ text });
}
```

- [ ] **Step 2: Create `src/app/vocab/context/page.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getLearnedWords } from "@/lib/storage";

type Format = "mini_story" | "dialogue" | "email" | "workplace";

const FORMAT_LABELS: Record<Format, string> = {
  mini_story: "Truyện ngắn", dialogue: "Hội thoại", email: "Email", workplace: "Tình huống"
};

export default function ContextPracticePage() {
  const [allWords, setAllWords] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<Format>("dialogue");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const words = getLearnedWords().map((w) => w.word);
    setAllWords(words);
  }, []);

  const filtered = allWords.filter((w) => w.toLowerCase().includes(search.toLowerCase()));

  function toggle(word: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word); else next.add(word);
      return next;
    });
  }

  async function generate() {
    if (selected.size < 2) return;
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/vocab/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: Array.from(selected), format }),
    });
    const data = await res.json();
    setResult(data.text ?? "Không thể tạo nội dung.");
    setLoading(false);
  }

  // Render bold words in result
  function renderWithBold(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") ? <strong key={i} className="text-blue-600">{p.slice(2, -2)}</strong> : p
    );
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Luyện từ trong ngữ cảnh</h1>
        <Link href="/" className="text-sm text-blue-500">← Trang chủ</Link>
      </div>

      <p className="text-sm text-gray-500 mb-4">Chọn 2–8 từ, sau đó tạo nội dung chứa các từ đó.</p>

      <input value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3 dark:bg-gray-900 dark:border-gray-700"
        placeholder="Tìm từ..." />

      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto mb-4 border rounded-lg p-3 dark:border-gray-700">
        {filtered.map((w) => (
          <button key={w} onClick={() => toggle(w)}
            className={`px-2 py-1 rounded text-sm ${selected.has(w) ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
            {w}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-3">Đã chọn: {selected.size} từ</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
          <button key={f} onClick={() => setFormat(f)}
            className={`px-3 py-1.5 rounded text-sm ${format === f ? "bg-purple-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
            {FORMAT_LABELS[f]}
          </button>
        ))}
      </div>

      <button onClick={generate} disabled={selected.size < 2 || loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 mb-4">
        {loading ? "Đang tạo..." : "Tạo nội dung"}
      </button>

      {result && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {renderWithBold(result)}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Build check + commit**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -10
git add src/app/api/vocab/context/route.ts src/app/vocab/context/page.tsx
git commit -m "feat: add vocab context practice (batch5)"
```

---

## Task 5: Weekly Report + Actionable Insights in `/stats`

**Files:**
- Modify: `src/app/stats/page.tsx`

Add a "Tuần này" tab showing: study time, sessions, vocab, SRS accuracy, exam accuracy, streak, biggest improvement, weakest area. Add one "Actionable Insight" card that finds the sharpest accuracy drop and links to practice.

- [ ] **Step 1: Add weekly stats computation**

Add a helper function near the top of `stats/page.tsx` (or in a `src/lib/weekly-report.ts` file):

```ts
// src/lib/weekly-report.ts
import type { LearningSession } from "./sessions";
import type { ExamAttempt } from "./exam/types";
import { getLearnedWords } from "./storage";

export interface WeeklyReport {
  studyMinutes: number;
  sessions: number;
  wordsLearned: number;
  srsAccuracy: number | null;
  examAccuracy: number | null;
  biggestImprovement: { skill: string; change: string } | null;
  weakestArea: { skill: string; accuracy: number } | null;
}

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeWeeklyReport(
  sessions: LearningSession[],
  attempts: ExamAttempt[]
): WeeklyReport {
  const since = startOfWeek().toISOString();
  const weekSessions = sessions.filter((s) => s.startedAt >= since);
  const studyMinutes = Math.round(weekSessions.reduce((s, x) => s + x.durationSeconds, 0) / 60);

  const weekWords = getLearnedWords().filter((w) => (w.learnedAt ?? "") >= since).length;

  const reviewSessions = weekSessions.filter((s) => s.type === "review");
  const srsAccuracy = reviewSessions.length > 0
    ? Math.round(reviewSessions.reduce((s, x) => {
        const total = x.totalItems ?? 0;
        const correct = x.correctItems ?? 0;
        return s + (total > 0 ? correct / total : 0);
      }, 0) / reviewSessions.length * 100)
    : null;

  const weekAttempts = attempts.filter((a) => a.startedAt >= since);
  let examAccuracy: number | null = null;
  if (weekAttempts.length > 0) {
    const allAnswers = weekAttempts.flatMap((a) => a.answers);
    if (allAnswers.length > 0) {
      examAccuracy = Math.round(allAnswers.filter((a) => a.correct).length / allAnswers.length * 100);
    }
  }

  return {
    studyMinutes,
    sessions: weekSessions.length,
    wordsLearned: weekWords,
    srsAccuracy,
    examAccuracy,
    biggestImprovement: null, // populated by Batch 1 mastery data when available
    weakestArea: null,        // populated by Batch 1 mastery data when available
  };
}
```

- [ ] **Step 2: Add "Tuần này" tab to stats page**

In `src/app/stats/page.tsx`, add a new tab and render the weekly report:

```tsx
import { computeWeeklyReport } from "@/lib/weekly-report";
import { getSessions } from "@/lib/sessions";
import { getAttempts } from "@/lib/exam/exam-storage";

// In component:
const [activeTab, setActiveTab] = useState<"overview" | "weekly">("overview");
const weeklyReport = computeWeeklyReport(getSessions(), getAttempts());

// Tab switcher above existing content:
<div className="flex gap-2 mb-4">
  {([["overview","Tổng quan"],["weekly","Tuần này"]] as const).map(([v,l]) => (
    <button key={v} onClick={() => setActiveTab(v)}
      className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === v ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
      {l}
    </button>
  ))}
</div>

{activeTab === "weekly" && (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      {[
        ["Thời gian học", `${weeklyReport.studyMinutes} phút`],
        ["Số buổi", `${weeklyReport.sessions}`],
        ["Từ mới", `${weeklyReport.wordsLearned}`],
        ["SRS chính xác", weeklyReport.srsAccuracy != null ? `${weeklyReport.srsAccuracy}%` : "—"],
        ["Exam chính xác", weeklyReport.examAccuracy != null ? `${weeklyReport.examAccuracy}%` : "—"],
      ].map(([label, value]) => (
        <div key={label} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Full test + commit**

```bash
cd /Users/thankz/Code/study && npm test && npm run lint && npm run build 2>&1 | tail -10
git add src/lib/streak.ts src/lib/mastery-timeline.ts src/lib/weekly-report.ts src/app/stats/page.tsx src/app/vocab/quiz/page.tsx src/app/vocab/context/page.tsx
git commit -m "feat: weekly report + actionable insights (batch5)"
```

---

## Acceptance Criteria

- [ ] `computeStreak` correctly counts current streak, longest streak, active days this week.
- [ ] `recordMasterySnapshot` idempotent per day+skill (last write wins for same date).
- [ ] Vocabulary quiz works in meaning (MCQ) and fill modes; starts a `LearningSession`.
- [ ] Context practice generates text with all selected words used.
- [ ] `/stats` "Tuần này" tab shows study minutes, sessions, word count, SRS and exam accuracy.
- [ ] `npm test && npm run lint && npm run build` pass.

## Risks

- `callWithFallback` in `/api/vocab/context/route.ts` — verify actual import path matches other API routes (e.g. `@/lib/providers/provider-utils` vs a different path).
- Vocab quiz `fill` mode calls AI per question — may be slow; show loading state per question.

## Dependencies

- Batch 1 mastery engine (`getCachedMastery`) for `biggestImprovement`/`weakestArea` in weekly report.
- Existing `getSessions`, `getAttempts`, `getLearnedWords` — all present.

## Out of Scope

- Dictation mode (requires TTS + STT — build on top of speaking infrastructure in a later iteration).
- Synonym/antonym quiz mode.
- CEFR / word family metadata on `LearnedWord`.
