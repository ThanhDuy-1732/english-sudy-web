# Batch 1: Adaptive Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the unified mistake model, skill mastery engine, and upgrade Today Planner to use both — forming the data foundation every subsequent batch depends on.

**Architecture:** Three new modules in `src/lib/`: `mistakes.ts` (cross-skill mistake store), `mastery.ts` (deterministic 0–100 mastery calculator), and updates to `src/lib/plan/generate-plan.ts` (planner reads mastery + mistakes). A new `/mistakes` route surfaces the global mistake notebook. No AI calls — all logic is deterministic.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest (jsdom), localStorage

**Spec:** `docs/requirement/DEVELOPMENT_DIRECTION.md` §4.1, §4.2 (Phase 1–2), §4.3 (Phase 3)

## Global Constraints

- No new npm dependencies.
- API keys stay server-side — new modules are client-safe (no provider imports).
- localStorage is primary storage — SSR guard (`typeof window === "undefined"`) on every read.
- All date comparisons use local date (follow `formatDate` pattern in `src/lib/daily-challenge.ts`).
- Mastery engine must be deterministic and derivable from history — no AI calls.
- `confidence` field must prevent a single attempt from swinging mastery drastically.
- Backward compatibility: old records without new fields must be handled with safe defaults.
- `npm test && npm run lint && npm run build` must pass after every task.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/mistakes.ts` | UnifiedMistake type + CRUD + skill/category/status filters |
| Create | `src/lib/__tests__/mistakes.test.ts` | Unit tests |
| Create | `src/lib/mastery.ts` | SkillMastery type + deterministic calculation from session+mistake history |
| Create | `src/lib/__tests__/mastery.test.ts` | Unit tests |
| Modify | `src/lib/plan/generate-plan.ts` | Accept mastery + unified mistakes in context; rewrite block-generation logic |
| Modify | `src/lib/__tests__/generate-plan.test.ts` | Update tests for new context shape |
| Create | `src/app/mistakes/page.tsx` | `/mistakes` — global mistake notebook with skill/category/status filters |

---

## Task 1: UnifiedMistake model + CRUD

**Files:**
- Create: `src/lib/mistakes.ts`
- Create: `src/lib/__tests__/mistakes.test.ts`

**Interfaces — Produces (used by Tasks 3–5):**
```ts
export type MistakeSkill = "vocabulary" | "grammar" | "reading" | "listening" | "speaking" | "writing";
export type MistakeStatus = "new" | "reviewing" | "resolved";

export interface UnifiedMistake {
  id: string;
  skill: MistakeSkill;
  category: string;           // e.g. "prepositions", "verb-form", "articles"
  source: string;             // e.g. "exam:RC5", "grammar:conditionals", "writing:task2"
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  occurrenceCount: number;
  status: MistakeStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
}
```

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/mistakes.test.ts
import {
  getMistakes, addMistake, resolveMistake,
  getMistakesBySkill, getMistakesByStatus
} from "../mistakes";

beforeEach(() => { localStorage.clear(); });

test("addMistake stores and retrieves a mistake", () => {
  addMistake({ skill: "grammar", category: "articles", source: "exam:RC5",
    userAnswer: "a", correctAnswer: "the", explanation: "specific noun needs 'the'" });
  const all = getMistakes();
  expect(all).toHaveLength(1);
  expect(all[0].skill).toBe("grammar");
  expect(all[0].status).toBe("new");
  expect(all[0].occurrenceCount).toBe(1);
});

test("addMistake with same source+category increments occurrenceCount", () => {
  addMistake({ skill: "grammar", category: "articles", source: "exam:RC5",
    userAnswer: "a", correctAnswer: "the", explanation: "specific noun" });
  addMistake({ skill: "grammar", category: "articles", source: "exam:RC5",
    userAnswer: "an", correctAnswer: "the", explanation: "specific noun" });
  const all = getMistakes();
  expect(all).toHaveLength(1);
  expect(all[0].occurrenceCount).toBe(2);
});

test("resolveMistake updates status and sets reviewedAt", () => {
  addMistake({ skill: "grammar", category: "articles", source: "exam:RC5",
    userAnswer: "a", correctAnswer: "the", explanation: "x" });
  const id = getMistakes()[0].id;
  resolveMistake(id);
  expect(getMistakes()[0].status).toBe("resolved");
  expect(getMistakes()[0].reviewedAt).toBeDefined();
});

test("getMistakesBySkill filters correctly", () => {
  addMistake({ skill: "grammar", category: "tenses", source: "exam:RC5",
    userAnswer: "go", correctAnswer: "went", explanation: "past tense" });
  addMistake({ skill: "vocabulary", category: "word-choice", source: "review",
    userAnswer: "big", correctAnswer: "vast", explanation: "register" });
  expect(getMistakesBySkill("grammar")).toHaveLength(1);
  expect(getMistakesBySkill("vocabulary")).toHaveLength(1);
});

test("getMistakesByStatus filters correctly", () => {
  addMistake({ skill: "grammar", category: "tenses", source: "exam:RC5",
    userAnswer: "go", correctAnswer: "went", explanation: "x" });
  const id = getMistakes()[0].id;
  resolveMistake(id);
  expect(getMistakesByStatus("new")).toHaveLength(0);
  expect(getMistakesByStatus("resolved")).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern=mistakes --no-coverage
```

Expected: FAIL — "Cannot find module '../mistakes'"

- [ ] **Step 3: Implement `src/lib/mistakes.ts`**

```ts
const KEY = "unifiedMistakes";
const MAX = 1000;

function ls(): UnifiedMistake[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as UnifiedMistake[]) : [];
  } catch { return []; }
}

function save(items: UnifiedMistake[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
}

export function getMistakes(): UnifiedMistake[] { return ls(); }

export function addMistake(input: {
  skill: MistakeSkill; category: string; source: string;
  userAnswer: string; correctAnswer: string; explanation: string;
}): UnifiedMistake {
  const all = ls();
  const existing = all.find(
    (m) => m.source === input.source && m.category === input.category && m.status !== "resolved"
  );
  const now = new Date().toISOString();
  if (existing) {
    const updated = { ...existing,
      occurrenceCount: existing.occurrenceCount + 1,
      userAnswer: input.userAnswer,
      explanation: input.explanation,
      updatedAt: now,
    };
    save(all.map((m) => m.id === existing.id ? updated : m));
    return updated;
  }
  const m: UnifiedMistake = { ...input, id: crypto.randomUUID(),
    occurrenceCount: 1, status: "new", createdAt: now, updatedAt: now };
  save([m, ...all]);
  return m;
}

export function resolveMistake(id: string): void {
  const now = new Date().toISOString();
  save(ls().map((m) => m.id === id
    ? { ...m, status: "resolved", reviewedAt: now, updatedAt: now }
    : m));
}

export function setMistakeStatus(id: string, status: MistakeStatus): void {
  const now = new Date().toISOString();
  save(ls().map((m) => m.id === id ? { ...m, status, updatedAt: now } : m));
}

export function getMistakesBySkill(skill: MistakeSkill): UnifiedMistake[] {
  return ls().filter((m) => m.skill === skill);
}

export function getMistakesByStatus(status: MistakeStatus): UnifiedMistake[] {
  return ls().filter((m) => m.status === status);
}

export function getTopCategories(
  skill?: MistakeSkill, limit = 5
): { category: string; count: number; skill: MistakeSkill }[] {
  const items = skill ? getMistakesBySkill(skill) : ls();
  const counts = new Map<string, { count: number; skill: MistakeSkill }>();
  for (const m of items) {
    const key = `${m.skill}:${m.category}`;
    const entry = counts.get(key) ?? { count: 0, skill: m.skill };
    counts.set(key, { ...entry, count: entry.count + m.occurrenceCount });
  }
  return Array.from(counts.entries())
    .map(([key, v]) => ({ category: key.split(":")[1], ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern=mistakes --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/mistakes.ts src/lib/__tests__/mistakes.test.ts
git commit -m "feat: add UnifiedMistake model and CRUD (batch1)"
```

---

## Task 2: Skill Mastery Engine

**Files:**
- Create: `src/lib/mastery.ts`
- Create: `src/lib/__tests__/mastery.test.ts`

**Interfaces — Produces (used by Task 4):**
```ts
export type MasterySkill = "vocabulary" | "grammar" | "reading" | "listening" | "speaking" | "writing";

export interface CategoryMastery {
  category: string;
  mastery: number;      // 0–100
  confidence: number;  // 0–1, low when < 5 attempts
  attempts: number;
  trend: "up" | "down" | "stable";
  lastPracticedAt: string;
}

export interface SkillMastery {
  skill: MasterySkill;
  overallMastery: number;   // 0–100, weighted average of categories
  categories: CategoryMastery[];
  lastUpdatedAt: string;
}
```

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/mastery.test.ts
import {
  computeCategoryMastery, computeSkillMastery,
  getWeakestSkills, getStrongestSkills
} from "../mastery";
import type { MasteryInput } from "../mastery";

const BASE_INPUT: MasteryInput = {
  skill: "grammar",
  category: "articles",
  attempts: [
    { correct: true, at: "2026-09-20T10:00:00Z" },
    { correct: false, at: "2026-09-21T10:00:00Z" },
    { correct: true, at: "2026-09-22T10:00:00Z" },
  ],
};

test("computeCategoryMastery returns 0–100 value", () => {
  const result = computeCategoryMastery(BASE_INPUT);
  expect(result.mastery).toBeGreaterThanOrEqual(0);
  expect(result.mastery).toBeLessThanOrEqual(100);
  expect(result.attempts).toBe(3);
});

test("low sample count gives low confidence", () => {
  const result = computeCategoryMastery({ ...BASE_INPUT,
    attempts: [{ correct: true, at: "2026-09-22T10:00:00Z" }] });
  expect(result.confidence).toBeLessThan(0.5);
});

test("5+ attempts give confidence >= 0.8", () => {
  const attempts = Array.from({ length: 6 }, (_, i) => ({
    correct: i % 2 === 0, at: `2026-09-${10 + i}T10:00:00Z`
  }));
  const result = computeCategoryMastery({ ...BASE_INPUT, attempts });
  expect(result.confidence).toBeGreaterThanOrEqual(0.8);
});

test("recent trend detection", () => {
  const improving = [
    { correct: false, at: "2026-09-10T10:00:00Z" },
    { correct: false, at: "2026-09-15T10:00:00Z" },
    { correct: true,  at: "2026-09-20T10:00:00Z" },
    { correct: true,  at: "2026-09-21T10:00:00Z" },
    { correct: true,  at: "2026-09-22T10:00:00Z" },
  ];
  const result = computeCategoryMastery({ ...BASE_INPUT, attempts: improving });
  expect(result.trend).toBe("up");
});

test("getWeakestSkills returns skills sorted by mastery asc", () => {
  const skills = [
    { skill: "grammar" as const, overallMastery: 44, categories: [], lastUpdatedAt: "" },
    { skill: "vocabulary" as const, overallMastery: 80, categories: [], lastUpdatedAt: "" },
    { skill: "reading" as const, overallMastery: 60, categories: [], lastUpdatedAt: "" },
  ];
  const result = getWeakestSkills(skills, 2);
  expect(result[0].skill).toBe("grammar");
  expect(result[1].skill).toBe("reading");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern=mastery --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement `src/lib/mastery.ts`**

```ts
export type MasterySkill = "vocabulary" | "grammar" | "reading" | "listening" | "speaking" | "writing";

export interface CategoryMastery {
  category: string;
  mastery: number;
  confidence: number;
  attempts: number;
  trend: "up" | "down" | "stable";
  lastPracticedAt: string;
}

export interface SkillMastery {
  skill: MasterySkill;
  overallMastery: number;
  categories: CategoryMastery[];
  lastUpdatedAt: string;
}

export interface AttemptRecord {
  correct: boolean;
  at: string;
}

export interface MasteryInput {
  skill: MasterySkill;
  category: string;
  attempts: AttemptRecord[];
}

/** Exponential decay weight — recent attempts matter more */
function decayWeight(daysAgo: number): number {
  return Math.exp(-daysAgo / 14); // half-life ~10 days
}

export function computeCategoryMastery(input: MasteryInput): CategoryMastery {
  const { attempts, category } = input;
  if (attempts.length === 0) {
    return { category, mastery: 0, confidence: 0, attempts: 0,
      trend: "stable", lastPracticedAt: new Date().toISOString() };
  }

  const now = Date.now();
  let weightedCorrect = 0;
  let weightedTotal = 0;

  for (const a of attempts) {
    const daysAgo = (now - new Date(a.at).getTime()) / 86400000;
    const w = decayWeight(Math.max(0, daysAgo));
    weightedTotal += w;
    if (a.correct) weightedCorrect += w;
  }

  const mastery = weightedTotal > 0
    ? Math.round((weightedCorrect / weightedTotal) * 100)
    : 0;

  // Confidence: asymptotically approaches 1 as attempts grow
  const confidence = Math.min(1, attempts.length / 10);

  // Trend: compare last 3 vs prior 3
  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at));
  let trend: "up" | "down" | "stable" = "stable";
  if (sorted.length >= 4) {
    const half = Math.floor(sorted.length / 2);
    const recent = sorted.slice(-half);
    const prior = sorted.slice(-half * 2, -half);
    const recentAcc = recent.filter((a) => a.correct).length / recent.length;
    const priorAcc = prior.filter((a) => a.correct).length / prior.length;
    if (recentAcc - priorAcc > 0.15) trend = "up";
    else if (priorAcc - recentAcc > 0.15) trend = "down";
  }

  const lastPracticedAt = sorted[sorted.length - 1].at;
  return { category, mastery, confidence, attempts: attempts.length, trend, lastPracticedAt };
}

export function computeSkillMastery(
  skill: MasterySkill,
  categoryInputs: MasteryInput[]
): SkillMastery {
  const categories = categoryInputs.map(computeCategoryMastery);
  const withData = categories.filter((c) => c.attempts > 0);
  const overallMastery = withData.length > 0
    ? Math.round(withData.reduce((s, c) => s + c.mastery * c.confidence, 0) /
        withData.reduce((s, c) => s + c.confidence, 0))
    : 0;
  return {
    skill, overallMastery, categories,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function getWeakestSkills(skills: SkillMastery[], limit = 3): SkillMastery[] {
  return [...skills].sort((a, b) => a.overallMastery - b.overallMastery).slice(0, limit);
}

export function getStrongestSkills(skills: SkillMastery[], limit = 3): SkillMastery[] {
  return [...skills].sort((a, b) => b.overallMastery - a.overallMastery).slice(0, limit);
}

// ─── localStorage cache for computed mastery ────────────────────────────────
const KEY = "skillMasteryCache";

export function getCachedMastery(): SkillMastery[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as SkillMastery[]) : [];
  } catch { return []; }
}

export function saveMasteryCache(skills: SkillMastery[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(skills));
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern=mastery --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mastery.ts src/lib/__tests__/mastery.test.ts
git commit -m "feat: add deterministic Skill Mastery Engine (batch1)"
```

---

## Task 3: Today Planner v2

**Files:**
- Modify: `src/lib/plan/generate-plan.ts`
- Modify: `src/lib/__tests__/generate-plan.test.ts` (if exists, else create)

**Interfaces — Consumes (from Task 1–2):**
- `UnifiedMistake` from `src/lib/mistakes.ts`
- `SkillMastery` from `src/lib/mastery.ts`

**Interfaces — Produces:**
```ts
// PlanBlock already exists — add `masteryScore?: number` to payload
// PlanContext replaces the current inline ctx type
export interface PlanContext {
  dueWords: number;
  unifiedMistakes: UnifiedMistake[];   // replaces old MistakeEntry[]
  skillMastery: SkillMastery[];
  attempts: ExamAttempt[];             // kept for weakestType()
  lastSpeakingAt?: string;
  lastWritingAt?: string;
  settings: ExamSettings;
  availableMin: number;
}
```

- [ ] **Step 1: Write failing test for new planner context shape**

```ts
// src/lib/__tests__/generate-plan.test.ts
import { generatePlan, type PlanContext } from "../plan/generate-plan";
import type { SkillMastery } from "../mastery";

const BASE_MASTERY: SkillMastery[] = [
  { skill: "grammar", overallMastery: 44, categories: [
      { category: "prepositions", mastery: 44, confidence: 0.9, attempts: 12,
        trend: "down", lastPracticedAt: "2026-09-15T10:00:00Z" }
    ], lastUpdatedAt: "" },
  { skill: "vocabulary", overallMastery: 75, categories: [], lastUpdatedAt: "" },
];

const BASE_CTX: PlanContext = {
  dueWords: 5,
  unifiedMistakes: [],
  skillMastery: BASE_MASTERY,
  attempts: [],
  settings: { primaryExam: "TOEIC", level: 2, listeningRate: 1, autoAdvance: false },
  availableMin: 30,
};

test("grammar block appears when mastery < 50", () => {
  const blocks = generatePlan(BASE_CTX);
  const grammarBlock = blocks.find((b) => b.kind === "grammar");
  expect(grammarBlock).toBeDefined();
  expect(grammarBlock?.reason).toContain("44");
});

test("srs block appears when dueWords > 0", () => {
  const blocks = generatePlan(BASE_CTX);
  expect(blocks.find((b) => b.kind === "srs_review")).toBeDefined();
});

test("total time does not exceed availableMin", () => {
  const blocks = generatePlan(BASE_CTX);
  const total = blocks.reduce((s, b) => s + b.estimatedMin, 0);
  expect(total).toBeLessThanOrEqual(BASE_CTX.availableMin);
});

test("unified mistakes block appears when >= 5 unresolved cross-skill", () => {
  const mistakes = Array.from({ length: 6 }, (_, i) => ({
    id: String(i), skill: "grammar" as const, category: "tenses",
    source: "exam:RC5", userAnswer: "go", correctAnswer: "went",
    explanation: "x", occurrenceCount: 1, status: "new" as const,
    createdAt: "", updatedAt: "",
  }));
  const blocks = generatePlan({ ...BASE_CTX, unifiedMistakes: mistakes, dueWords: 0 });
  expect(blocks.find((b) => b.kind === "mistakes")).toBeDefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern=generate-plan --no-coverage
```

- [ ] **Step 3: Update `generate-plan.ts` to use new context**

Replace the `generatePlan` signature and internal logic:

```ts
// Add to imports at top of file:
import type { UnifiedMistake } from "@/lib/mistakes";
import type { SkillMastery } from "@/lib/mastery";

// Replace ctx type with PlanContext:
export interface PlanContext {
  dueWords: number;
  unifiedMistakes: UnifiedMistake[];
  skillMastery: SkillMastery[];
  attempts: ExamAttempt[];
  lastSpeakingAt?: string;
  lastWritingAt?: string;
  settings: ExamSettings;
  availableMin: number;
}

// In generatePlan, replace the mistakes block logic:
// Old: const unresolved = ctx.mistakes.filter((m) => !m.resolved);
// New:
const unresolved = ctx.unifiedMistakes.filter((m) => m.status !== "resolved");
if (unresolved.length >= 5) {
  blocks.push({
    id: "mistakes",
    kind: "mistakes",
    title: "Xem lại lỗi sai",
    reason: `${unresolved.length} lỗi chưa giải quyết`,
    estimatedMin: 10,
    href: "/mistakes",
    done: false,
  });
}

// Add grammar block based on mastery:
const weakGrammar = ctx.skillMastery
  .find((s) => s.skill === "grammar" && s.overallMastery < 60);
if (weakGrammar) {
  const weakCat = weakGrammar.categories
    .filter((c) => c.confidence > 0.3)
    .sort((a, b) => a.mastery - b.mastery)[0];
  blocks.push({
    id: "grammar-weak",
    kind: "grammar",
    title: weakCat ? `Ngữ pháp — ${weakCat.category}` : "Luyện ngữ pháp",
    reason: `Mastery ${weakGrammar.overallMastery}%${weakCat ? ` — yếu nhất: ${weakCat.category}` : ""}`,
    estimatedMin: 10,
    href: "/grammar",
    payload: weakCat ? { focusCategory: weakCat.category } : undefined,
    done: false,
  });
}
```

- [ ] **Step 4: Update the `/today` page to pass the new context shape**

In `src/app/today/page.tsx`, replace the old `mistakes` and add `skillMastery`:

```ts
// Replace getMistakes() import (from exam-storage) with:
import { getMistakes as getUnifiedMistakes } from "@/lib/mistakes";
import { getCachedMastery } from "@/lib/mastery";

// In the plan generation call:
const plan = generatePlan({
  dueWords: getWordsForReview().length,
  unifiedMistakes: getUnifiedMistakes(),
  skillMastery: getCachedMastery(),
  attempts: getAttempts(),
  lastSpeakingAt: localStorage.getItem("lastSpeakingAt") ?? undefined,
  lastWritingAt: localStorage.getItem("lastWritingAt") ?? undefined,
  settings: getExamSettings(),
  availableMin: budget,
});
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern=generate-plan --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/plan/generate-plan.ts src/app/today/page.tsx src/lib/__tests__/generate-plan.test.ts
git commit -m "feat: upgrade Today Planner v2 with mastery + unified mistakes (batch1)"
```

---

## Task 4: `/mistakes` — Global Mistake Notebook

**Files:**
- Create: `src/app/mistakes/page.tsx`

**Interfaces — Consumes:**
- `getMistakes`, `getMistakesBySkill`, `getMistakesByStatus`, `resolveMistake`, `setMistakeStatus` from `src/lib/mistakes.ts`

- [ ] **Step 1: Create `src/app/mistakes/page.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getMistakes, resolveMistake, setMistakeStatus,
  type UnifiedMistake, type MistakeSkill, type MistakeStatus
} from "@/lib/mistakes";

const SKILL_LABELS: Record<MistakeSkill, string> = {
  vocabulary: "Từ vựng", grammar: "Ngữ pháp", reading: "Đọc",
  listening: "Nghe", speaking: "Nói", writing: "Viết",
};

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<UnifiedMistake[]>([]);
  const [filterSkill, setFilterSkill] = useState<MistakeSkill | "all">("all");
  const [filterStatus, setFilterStatus] = useState<MistakeStatus | "all">("new");

  useEffect(() => { setMistakes(getMistakes()); }, []);

  const filtered = mistakes
    .filter((m) => filterSkill === "all" || m.skill === filterSkill)
    .filter((m) => filterStatus === "all" || m.status === filterStatus);

  function handleResolve(id: string) {
    resolveMistake(id);
    setMistakes(getMistakes());
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Sổ lỗi</h1>
        <Link href="/today" className="text-sm text-blue-500">← Hôm nay</Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-4">
        {(["all", "vocabulary", "grammar", "reading", "listening", "speaking", "writing"] as const).map((s) => (
          <button key={s}
            onClick={() => setFilterSkill(s)}
            className={`px-3 py-1 rounded text-sm ${filterSkill === s ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
            {s === "all" ? "Tất cả" : SKILL_LABELS[s]}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-6">
        {(["all", "new", "reviewing", "resolved"] as const).map((s) => (
          <button key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded text-sm ${filterStatus === s ? "bg-purple-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
            {s === "all" ? "Tất cả" : s === "new" ? "Mới" : s === "reviewing" ? "Đang học" : "Đã giải quyết"}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-gray-500 text-center py-12">Không có lỗi nào.</p>
      )}

      <ul className="space-y-3">
        {filtered.map((m) => (
          <li key={m.id} className="border rounded-lg p-4 dark:border-gray-700">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-medium text-blue-500">{SKILL_LABELS[m.skill]} · {m.category}</span>
              <span className="text-xs text-gray-400">{m.occurrenceCount}×</span>
            </div>
            <div className="text-sm mb-1">
              <span className="line-through text-red-500">{m.userAnswer}</span>
              {" → "}
              <span className="font-medium text-green-600">{m.correctAnswer}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{m.explanation}</p>
            {m.status !== "resolved" && (
              <button onClick={() => handleResolve(m.id)}
                className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">
                Đánh dấu đã hiểu
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -20
```

Expected: ✓ Compiled

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/thankz/Code/study && npm test && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/app/mistakes/page.tsx
git commit -m "feat: add /mistakes global mistake notebook (batch1)"
```

---

## Acceptance Criteria

- [ ] `getMistakes()` returns cross-skill mistakes (not just exam).
- [ ] Same source+category mistake increments `occurrenceCount` instead of creating a duplicate.
- [ ] `computeCategoryMastery` returns 0–100, deterministic, derivable from any attempt history.
- [ ] Low sample count (< 5 attempts) produces `confidence < 0.5`.
- [ ] Today Planner generates a grammar block when `grammar.overallMastery < 60`.
- [ ] Today Planner references `/mistakes` (not `/exam/mistakes`) for the mistakes block.
- [ ] `/mistakes` page filters by skill and status.
- [ ] `npm test && npm run lint && npm run build` pass.

## Risks

- **mastery.ts is not yet fed by real activity** — `getCachedMastery()` returns `[]` until Batch 2–4 (grammar, exam, speaking, writing) start writing mastery snapshots. Planner degrades gracefully (no mastery blocks shown).
- **Existing exam mistakes not migrated** — `/exam/mistakes` and `UnifiedMistake` coexist; Batch 3 will bridge exam mistakes into the unified system.

## Dependencies

- None (Batch 1 is the foundation).

## Out of Scope

- Feeding mastery from actual user activity (done in Batches 2–5).
- Migrating existing `MistakeEntry` (exam-specific) to `UnifiedMistake` (Batch 3).
- Sync of `unifiedMistakes` to Supabase (Batch 6).
