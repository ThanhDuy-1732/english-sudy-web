# Batch 3: Exam Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tag metadata to exam questions, make drill adaptive (70% weak / 20% normal / 10% strong), add question reporting, and surface category-level analytics — making exam practice smarter without adding new parts.

**Architecture:** Extend `ExamQuestion` with optional `tags?: string[]`; `src/lib/exam/exam-tags.ts` maintains per-tag accuracy; drill page reads tag stats to bias question selection; a lightweight report-flag modal writes to `localStorage`; result page shows category breakdown. Exam mistakes bridge into `UnifiedMistake` via Batch 1.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest (jsdom), localStorage

**Spec:** `docs/requirement/DEVELOPMENT_DIRECTION.md` §6 (Exam Intelligence), Batch 3 in §18

## Global Constraints

- No new npm dependencies.
- `tags` field on `ExamQuestion` is optional — existing records without it work as-is.
- Adaptive distribution: 70% weak tags / 20% normal / 10% strong — configurable via `ADAPTIVE_WEIGHTS` constant.
- Exam mistakes must also write to `UnifiedMistake` (Batch 1) on top of existing `MistakeEntry`.
- Difficulty must not flip more than 1 level per 3 consecutive results.
- `npm test && npm run lint && npm run build` must pass after every task.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/exam/types.ts` | Add `tags?: string[]` to `ExamQuestion` |
| Create | `src/lib/exam/exam-tags.ts` | Tag accuracy store + adaptive question selector |
| Create | `src/lib/exam/__tests__/exam-tags.test.ts` | Unit tests |
| Modify | `src/lib/exam/exam-storage.ts` | Bridge `addMistake` to also write `UnifiedMistake` |
| Modify | `src/app/exam/drill/[part]/page.tsx` | Pass adaptive weights to item selection |
| Create | `src/components/exam/ReportQuestionModal.tsx` | Flag/report question UI |
| Modify | `src/app/exam/drill/[part]/page.tsx` | Add report button per question |
| Modify | `src/app/exam/drill/[part]/page.tsx` | Show category breakdown in result summary |

---

## Task 1: Add `tags` to `ExamQuestion` and tag accuracy store

**Files:**
- Modify: `src/lib/exam/types.ts`
- Create: `src/lib/exam/exam-tags.ts`
- Create: `src/lib/exam/__tests__/exam-tags.test.ts`

**Interfaces — Produces:**
```ts
// In exam-tags.ts:
export interface TagAccuracy {
  tag: string;
  correct: number;
  total: number;
  accuracy: number;    // 0–100
  strength: "weak" | "normal" | "strong";
}
```

- [ ] **Step 1: Extend `ExamQuestion` in `src/lib/exam/types.ts`**

Find the `ExamQuestion` interface and add the optional field:
```ts
export interface ExamQuestion {
  // ... existing fields ...
  tags?: string[];    // e.g. ["preposition", "verb-form", "business"]
}
```

- [ ] **Step 2: Write failing tests for exam-tags**

```ts
// src/lib/exam/__tests__/exam-tags.test.ts
import {
  recordTagResult, getTagAccuracies, selectAdaptiveItems
} from "../exam-tags";
import type { ExamItem } from "../types";

beforeEach(() => { localStorage.clear(); });

function makeItem(tags: string[]): ExamItem {
  return {
    id: crypto.randomUUID(), kind: "TOEIC", part: "RC5", level: 2,
    questions: [{ id: "q1", type: "incomplete_sentence", prompt: "test",
      options: ["a","b","c","d"], answer: "a", explanation: "x", tags }],
    createdAt: new Date().toISOString(),
  };
}

test("recordTagResult stores accuracy per tag", () => {
  recordTagResult(["preposition", "articles"], true);
  recordTagResult(["preposition"], false);
  const acc = getTagAccuracies();
  const prep = acc.find((t) => t.tag === "preposition")!;
  expect(prep.total).toBe(2);
  expect(prep.correct).toBe(1);
  expect(prep.accuracy).toBe(50);
});

test("strength classification", () => {
  // Weak: accuracy < 50
  for (let i = 0; i < 5; i++) recordTagResult(["weak-tag"], false);
  // Strong: accuracy >= 80
  for (let i = 0; i < 5; i++) recordTagResult(["strong-tag"], true);
  const acc = getTagAccuracies();
  expect(acc.find((t) => t.tag === "weak-tag")!.strength).toBe("weak");
  expect(acc.find((t) => t.tag === "strong-tag")!.strength).toBe("strong");
});

test("selectAdaptiveItems weights weak items higher", () => {
  recordTagResult(["preposition"], false);
  recordTagResult(["preposition"], false);
  recordTagResult(["business"], true);
  recordTagResult(["business"], true);
  recordTagResult(["business"], true);

  const weakItem = makeItem(["preposition"]);
  const strongItem = makeItem(["business"]);
  const items = [weakItem, strongItem, makeItem(["preposition"]), makeItem(["business"])];
  const selected = selectAdaptiveItems(items, 4);
  const weakCount = selected.filter((x) => x.questions[0].tags?.includes("preposition")).length;
  const strongCount = selected.filter((x) => x.questions[0].tags?.includes("business")).length;
  // Weak should appear more often than strong
  expect(weakCount).toBeGreaterThanOrEqual(strongCount);
});
```

- [ ] **Step 3: Run tests to verify fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="exam-tags" --no-coverage
```

- [ ] **Step 4: Implement `src/lib/exam/exam-tags.ts`**

```ts
const KEY = "examTagAccuracy";
const MAX_RECORDS = 500;

// ponytail: global weights constant, make configurable if A/B needed
const ADAPTIVE_WEIGHTS = { weak: 0.70, normal: 0.20, strong: 0.10 };

interface TagRecord {
  tag: string;
  correct: number;
  total: number;
}

function ls(): TagRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as TagRecord[]) : [];
  } catch { return []; }
}

function save(records: TagRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
}

export function recordTagResult(tags: string[], correct: boolean): void {
  const records = ls();
  const now = tags.map((tag) => {
    const existing = records.find((r) => r.tag === tag);
    if (existing) {
      return { ...existing, correct: existing.correct + (correct ? 1 : 0), total: existing.total + 1 };
    }
    return { tag, correct: correct ? 1 : 0, total: 1 };
  });
  const otherRecords = records.filter((r) => !tags.includes(r.tag));
  save([...otherRecords, ...now]);
}

function toStrength(accuracy: number, total: number): "weak" | "normal" | "strong" {
  if (total < 3) return "normal"; // not enough data
  if (accuracy < 50) return "weak";
  if (accuracy >= 80) return "strong";
  return "normal";
}

export function getTagAccuracies(): TagAccuracy[] {
  return ls().map((r) => {
    const accuracy = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 50;
    return { tag: r.tag, correct: r.correct, total: r.total, accuracy,
      strength: toStrength(accuracy, r.total) };
  });
}

export function getWeakTags(limit = 10): TagAccuracy[] {
  return getTagAccuracies()
    .filter((t) => t.strength === "weak")
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit);
}

/** Re-order items using adaptive weights. Items without tags are treated as "normal". */
export function selectAdaptiveItems(items: import("./types").ExamItem[], count: number): import("./types").ExamItem[] {
  const acc = getTagAccuracies();
  const strengthMap = new Map(acc.map((t) => [t.tag, t.strength]));

  function itemStrength(item: import("./types").ExamItem): "weak" | "normal" | "strong" {
    const tags = item.questions.flatMap((q) => q.tags ?? []);
    if (tags.length === 0) return "normal";
    const strengths = tags.map((t) => strengthMap.get(t) ?? "normal");
    if (strengths.includes("weak")) return "weak";
    if (strengths.every((s) => s === "strong")) return "strong";
    return "normal";
  }

  const weak = items.filter((i) => itemStrength(i) === "weak");
  const normal = items.filter((i) => itemStrength(i) === "normal");
  const strong = items.filter((i) => itemStrength(i) === "strong");

  const weakCount = Math.round(count * ADAPTIVE_WEIGHTS.weak);
  const normalCount = Math.round(count * ADAPTIVE_WEIGHTS.normal);
  const strongCount = count - weakCount - normalCount;

  function pick<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  // Fill any shortage from other buckets
  let result = [
    ...pick(weak, weakCount),
    ...pick(normal, normalCount),
    ...pick(strong, strongCount),
  ];
  if (result.length < count) {
    const remaining = items.filter((i) => !result.includes(i));
    result = [...result, ...pick(remaining, count - result.length)];
  }
  return result.slice(0, count).sort(() => Math.random() - 0.5);
}
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="exam-tags" --no-coverage
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/exam/types.ts src/lib/exam/exam-tags.ts src/lib/exam/__tests__/exam-tags.test.ts
git commit -m "feat: add exam tag accuracy + adaptive item selection (batch3)"
```

---

## Task 2: Bridge exam mistakes to UnifiedMistake

**Files:**
- Modify: `src/lib/exam/exam-storage.ts`

- [ ] **Step 1: Update `addMistake` in exam-storage to also write UnifiedMistake**

In `src/lib/exam/exam-storage.ts`, find the `addMistake` function and add a dual-write:

```ts
// Add import at top:
import { addMistake as addUnifiedMistake } from "@/lib/mistakes";

// Inside addMistake function, after saving to localStorage:
export function addMistake(entry: MistakeEntry): void {
  // existing exam-specific save logic...
  const mistakes = [entry, ...getMistakes()].slice(0, MAX_MISTAKES);
  lsSet(MISTAKES_KEY, mistakes);
  void pushMistake(entry);

  // Bridge to unified mistake system
  addUnifiedMistake({
    skill: entry.part.startsWith("LC") || entry.part.startsWith("LISTEN") ? "listening" : "reading",
    category: entry.type,
    source: `exam:${entry.part}`,
    userAnswer: entry.userAnswer,
    correctAnswer: entry.correctAnswer,
    explanation: entry.explanation,
  });
}
```

- [ ] **Step 2: Run full tests**

```bash
cd /Users/thankz/Code/study && npm test && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/exam/exam-storage.ts
git commit -m "feat: bridge exam mistakes to UnifiedMistake (batch3)"
```

---

## Task 3: Question Report feature

**Files:**
- Create: `src/components/exam/ReportQuestionModal.tsx`
- Modify: `src/app/exam/drill/[part]/page.tsx`

**Report flag is stored in localStorage under `reportedQuestions`.**

- [ ] **Step 1: Create `src/components/exam/ReportQuestionModal.tsx`**

```tsx
"use client";
import { useState } from "react";

const REASONS = [
  "Đáp án sai",
  "Câu hỏi mơ hồ",
  "Giải thích không đúng",
  "Lỗi ngữ pháp",
  "Khác",
] as const;

interface Props {
  questionId: string;
  itemId: string;
  onClose: () => void;
}

function saveReport(questionId: string, itemId: string, reason: string) {
  if (typeof window === "undefined") return;
  const KEY = "reportedQuestions";
  const existing = (() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
  })();
  localStorage.setItem(KEY, JSON.stringify([
    ...existing,
    { questionId, itemId, reason, reportedAt: new Date().toISOString() },
  ]));
}

export function ReportQuestionModal({ questionId, itemId, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!selected) return;
    saveReport(questionId, itemId, selected);
    setSubmitted(true);
    setTimeout(onClose, 1200);
  }

  if (submitted) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl text-center">
        <p className="text-green-600 font-medium">Đã ghi nhận báo cáo.</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl w-full max-w-sm">
        <h2 className="font-bold mb-4">Báo cáo câu hỏi</h2>
        <div className="space-y-2 mb-4">
          {REASONS.map((r) => (
            <button key={r} onClick={() => setSelected(r)}
              className={`w-full text-left px-3 py-2 rounded border text-sm
                ${selected === r ? "border-blue-500 bg-blue-50 dark:bg-blue-900" : "border-gray-200 dark:border-gray-700"}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded border text-sm">Hủy</button>
          <button onClick={handleSubmit} disabled={!selected}
            className="flex-1 py-2 rounded bg-red-600 text-white text-sm disabled:opacity-40">
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add report button to drill page**

In `src/app/exam/drill/[part]/page.tsx`, import `ReportQuestionModal` and add a small "⚑ Báo cáo" button near each question. Toggle modal on click.

```tsx
import { ReportQuestionModal } from "@/components/exam/ReportQuestionModal";

// In state:
const [reportingQuestion, setReportingQuestion] = useState<{ questionId: string; itemId: string } | null>(null);

// In JSX, near each question:
<button onClick={() => setReportingQuestion({ questionId: q.id, itemId: item.id })}
  className="text-xs text-gray-400 hover:text-red-500 mt-1">
  ⚑ Báo cáo
</button>

{reportingQuestion && (
  <ReportQuestionModal
    questionId={reportingQuestion.questionId}
    itemId={reportingQuestion.itemId}
    onClose={() => setReportingQuestion(null)}
  />
)}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/exam/ReportQuestionModal.tsx src/app/exam/drill/[part]/page.tsx
git commit -m "feat: add exam question report feature (batch3)"
```

---

## Task 4: Category analytics in exam result

**Files:**
- Modify: `src/app/exam/drill/[part]/page.tsx` (result summary section)

After a drill completes, compute accuracy per tag and show a breakdown table.

- [ ] **Step 1: Add tag-based result breakdown**

In the result/summary section of the drill page, after `finishSession`, call `recordTagResult` per answer and display a breakdown:

```tsx
import { recordTagResult, getTagAccuracies } from "@/lib/exam/exam-tags";

// After scoring:
for (const ans of sessionAnswers) {
  const question = allItems.flatMap((i) => i.questions).find((q) => q.id === ans.questionId);
  if (question?.tags) {
    recordTagResult(question.tags, ans.correct);
  }
}

const tagStats = getTagAccuracies()
  .filter((t) => /* only tags seen in this session */ sessionTags.has(t.tag))
  .sort((a, b) => a.accuracy - b.accuracy);

// In result JSX:
{tagStats.length > 0 && (
  <div className="mt-4">
    <h3 className="text-sm font-medium mb-2">Phân tích theo chủ đề</h3>
    <div className="space-y-1">
      {tagStats.map((t) => (
        <div key={t.tag} className="flex items-center gap-2 text-sm">
          <span className="w-32 truncate text-gray-600">{t.tag}</span>
          <div className="flex-1 h-2 bg-gray-200 rounded">
            <div className="h-2 rounded"
              style={{ width: `${t.accuracy}%`,
                backgroundColor: t.accuracy < 50 ? "#ef4444" : t.accuracy < 75 ? "#f97316" : "#22c55e" }} />
          </div>
          <span className="text-xs text-gray-500 w-8 text-right">{t.accuracy}%</span>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Full test and build**

```bash
cd /Users/thankz/Code/study && npm test && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/exam/drill/[part]/page.tsx
git commit -m "feat: add category-level exam analytics (batch3)"
```

---

## Acceptance Criteria

- [ ] `ExamQuestion.tags` is optional and existing questions work without it.
- [ ] `recordTagResult` accumulates per-tag accuracy across sessions.
- [ ] Adaptive drill picks ~70% weak tags / 20% normal / 10% strong.
- [ ] Each wrong answer in exam creates a `UnifiedMistake` (in addition to `MistakeEntry`).
- [ ] Report modal saves to `reportedQuestions` in localStorage.
- [ ] Result page shows per-tag accuracy bars for tags seen in that session.
- [ ] `npm test && npm run lint && npm run build` pass.

## Risks

- Drill page may need significant restructuring to inject `selectAdaptiveItems` — read the page carefully before modifying.
- `sessionTags` tracking in Task 4 requires collecting tags during the drill, not just at the end.

## Dependencies

- Batch 1 (`src/lib/mistakes.ts`) — for `addUnifiedMistake` in Task 2.
- Existing `MistakeEntry` / `addMistake` in `exam-storage.ts` — must remain unchanged externally.

## Out of Scope

- AI-generated tags (tags are set manually or left empty).
- Removing flagged questions from the bank automatically (flag count tracking is future work).
- IELTS adaptive drill (same logic applies — extend `selectAdaptiveItems` call in IELTS pages if needed).
