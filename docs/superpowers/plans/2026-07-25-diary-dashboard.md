# Diary Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/diary` page with an interactive 26-week heatmap calendar where clicking a day opens a slide-in drawer showing words learned and study time for that day.

**Architecture:** New client page `src/app/diary/page.tsx` reads existing localStorage data via `getCalendarData`, `getStudyTimePerDay`, and a new `getWordsForDate` helper. Two new components handle the calendar (`DiaryCalendar`) and the slide-in detail panel (`DayDrawer`). No new API routes needed.

**Tech Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Jest (jsdom) · `@testing-library/react`

## Global Constraints

- All data reads from localStorage only — no new API routes, no Supabase calls.
- No new npm packages — use only what is already installed.
- API keys must stay server-side; these components are client-only and must not import from `src/lib/providers/`.
- Vietnamese locale for all user-visible date strings (`vi-VN`).
- Follow existing Tailwind color palette: primary purple `#7f56d9`, dark bg `#2c1f4a`, body bg `#f7f4ff`, muted text `#6b6384`.
- Run `npm test` after each task to confirm no regressions.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/stats.ts` | Add `getWordsForDate(date)` helper |
| Modify | `src/lib/__tests__/stats.test.ts` | Tests for `getWordsForDate` |
| Create | `src/components/DiaryCalendar.tsx` | Interactive heatmap calendar |
| Create | `src/components/DayDrawer.tsx` | Slide-in detail panel |
| Create | `src/app/diary/page.tsx` | Diary page wiring everything together |
| Modify | `src/app/layout.tsx` | Add "Nhật ký" navbar link |
| Modify | `CONTEXT.md` | Document new page and components |

---

## Task 1: Add `getWordsForDate` to stats.ts

**Files:**
- Modify: `src/lib/stats.ts`
- Modify: `src/lib/__tests__/stats.test.ts`

**Interfaces:**
- Consumes: `getLearnedWords()` from `src/lib/storage.ts` (already imported in stats.ts), `LearnedWord` type from `src/lib/storage.ts`
- Produces: `export function getWordsForDate(date: string): LearnedWord[]`
  - `date` is `"YYYY-MM-DD"` string
  - Returns all `LearnedWord` objects whose `learnedAt` ISO string starts with `date`

- [ ] **Step 1: Write failing tests in `src/lib/__tests__/stats.test.ts`**

Add these tests at the end of the existing file (keep all existing tests intact):

```ts
import { getCalendarData, getStudyTimePerDay, getTopicDistribution, getWordsForDate, getWordsPerDay } from "../stats";

// ... existing tests unchanged above ...

test("getWordsForDate returns words learned on the given date", () => {
  localStorage.setItem("learnedWords", JSON.stringify([
    { word: "ambitious", learnedAt: "2026-07-16T08:00:00.000Z", meaning: "đầy tham vọng", example: "", topic: "TOEIC" },
    { word: "persevere", learnedAt: "2026-07-16T10:00:00.000Z", meaning: "kiên trì", example: "", topic: "TOEIC" },
    { word: "diligent",  learnedAt: "2026-07-15T08:00:00.000Z", meaning: "chăm chỉ",   example: "", topic: "TOEIC" },
  ]));
  const result = getWordsForDate("2026-07-16");
  expect(result).toHaveLength(2);
  expect(result.map(w => w.word)).toEqual(["ambitious", "persevere"]);
});

test("getWordsForDate returns empty array when no words on that date", () => {
  localStorage.setItem("learnedWords", JSON.stringify([
    { word: "ambitious", learnedAt: "2026-07-16T08:00:00.000Z", meaning: "đầy tham vọng", example: "", topic: "TOEIC" },
  ]));
  expect(getWordsForDate("2026-07-15")).toEqual([]);
});

test("getWordsForDate returns empty array when storage is empty", () => {
  expect(getWordsForDate("2026-07-16")).toEqual([]);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=stats
```

Expected: FAIL — `getWordsForDate` is not exported from `../stats`

- [ ] **Step 3: Add `getWordsForDate` to `src/lib/stats.ts`**

Also add the import for `LearnedWord` at the top if not already present. Add at the end of the file:

```ts
import { getLearnedWords, type LearnedWord } from "./storage";

// ... existing code unchanged ...

export function getWordsForDate(date: string): LearnedWord[] {
  return getLearnedWords().filter((w) => w.learnedAt.startsWith(date));
}
```

Note: `getLearnedWords` is already imported in stats.ts. Only add the `LearnedWord` type to the existing import line:
```ts
import { getLearnedWords, type LearnedWord } from "./storage";
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=stats
```

Expected: all tests PASS including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts src/lib/__tests__/stats.test.ts
git commit -m "feat: add getWordsForDate helper to stats"
```

---

## Task 2: Create `DiaryCalendar` component

**Files:**
- Create: `src/components/DiaryCalendar.tsx`

**Interfaces:**
- Consumes: `CalendarDay` from `src/lib/stats`
- Produces:
  ```ts
  interface DiaryCalendarProps {
    data: CalendarDay[];                    // 26 weeks of CalendarDay (level 0–3, count, date)
    studyTimeByDate: Record<string, number>; // date "YYYY-MM-DD" → minutes studied
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
  }
  export default function DiaryCalendar(props: DiaryCalendarProps): JSX.Element
  ```

- [ ] **Step 1: Create `src/components/DiaryCalendar.tsx`**

```tsx
"use client";

import type { CalendarDay } from "@/lib/stats";

const LEVEL_COLORS = [
  "bg-gray-100",
  "bg-[#ede9fe]",
  "bg-[#c4b5fd]",
  "bg-[#7f56d9]",
] as const;

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface DiaryCalendarProps {
  data: CalendarDay[];
  studyTimeByDate: Record<string, number>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export default function DiaryCalendar({ data, studyTimeByDate, selectedDate, onSelectDate }: DiaryCalendarProps) {
  const firstDate = data[0] ? new Date(`${data[0].date}T12:00:00`) : null;
  const leadingEmptyDays = firstDate?.getDay() ?? 0;
  const cells: (CalendarDay | null)[] = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...data,
  ];
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <section aria-labelledby="diary-calendar-title">
      <h2 id="diary-calendar-title" className="mb-3 font-semibold text-gray-700">
        Lịch học tập
      </h2>
      <div className="overflow-x-auto pb-1" tabIndex={0} aria-label="Lịch nhật ký học tập">
        <div className="flex min-w-max gap-1">
          <div className="mr-1 flex flex-col gap-1">
            <div className="h-3 w-8" />
            {DAY_LABELS.map((label) => (
              <div key={label} className="flex h-3 w-8 items-center text-[10px] text-gray-400">
                {label}
              </div>
            ))}
          </div>
          {weeks.map((week, weekIndex) => {
            const firstDay = week.find((d): d is CalendarDay => d !== null);
            const monthLabel =
              weekIndex === 0 || firstDay?.date.slice(8) === "01"
                ? new Date(`${firstDay?.date}T12:00:00`).toLocaleDateString("vi-VN", { month: "short" })
                : "";
            return (
              <div key={firstDay?.date ?? weekIndex} className="flex flex-col gap-1">
                <div className="h-3 text-[10px] text-gray-400">{monthLabel}</div>
                {week.map((day, dayIndex) =>
                  day ? (
                    <button
                      key={day.date}
                      type="button"
                      title={`${day.date}: ${day.count} từ · ${studyTimeByDate[day.date] ?? 0} phút`}
                      aria-label={`${day.date}: ${day.count} từ, ${studyTimeByDate[day.date] ?? 0} phút`}
                      onClick={() => onSelectDate(day.date)}
                      className={[
                        "h-3 w-3 rounded-sm transition-opacity hover:opacity-80",
                        LEVEL_COLORS[day.level],
                        selectedDate === day.date ? "ring-2 ring-[#7f56d9] ring-offset-1" : "",
                      ].join(" ")}
                    />
                  ) : (
                    <div key={`empty-${weekIndex}-${dayIndex}`} className="h-3 w-3" aria-hidden="true" />
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
        <span>Ít</span>
        {LEVEL_COLORS.map((color, i) => (
          <span key={i} aria-label={`Mức ${i}`} className={`h-3 w-3 rounded-sm ${color}`} />
        ))}
        <span>Nhiều</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no type errors for `DiaryCalendar.tsx`.

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all existing tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/DiaryCalendar.tsx
git commit -m "feat: add DiaryCalendar interactive heatmap component"
```

---

## Task 3: Create `DayDrawer` component

**Files:**
- Create: `src/components/DayDrawer.tsx`

**Interfaces:**
- Consumes: `LearnedWord` from `src/lib/storage`
- Produces:
  ```ts
  interface DayDrawerProps {
    date: string | null;          // "YYYY-MM-DD"
    words: LearnedWord[];
    studyMinutes: number;
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (date: string) => void;
  }
  export default function DayDrawer(props: DayDrawerProps): JSX.Element
  ```

- [ ] **Step 1: Create `src/components/DayDrawer.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { LearnedWord } from "@/lib/storage";

interface DayDrawerProps {
  date: string | null;
  words: LearnedWord[];
  studyMinutes: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (date: string) => void;
}

function offsetDate(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDateVi(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function MasteryStars({ mastery = 0 }: { mastery?: number }) {
  return (
    <span className="text-xs text-amber-400" aria-label={`Mastery: ${mastery}/5`}>
      {"★".repeat(mastery)}{"☆".repeat(5 - mastery)}
    </span>
  );
}

export default function DayDrawer({ date, words, studyMinutes, isOpen, onClose, onNavigate }: DayDrawerProps) {
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());

  function toggleWord(word: string) {
    setExpandedWords((prev) => {
      const next = new Set(prev);
      next.has(word) ? next.delete(word) : next.add(word);
      return next;
    });
  }

  const noData = words.length === 0 && studyMinutes === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết ngày học"
        className={[
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <p className="font-semibold text-[#2c1f4a] capitalize">
            {date ? formatDateVi(date) : ""}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {noData ? (
            <p className="py-12 text-center text-sm text-gray-400">Không có dữ liệu cho ngày này.</p>
          ) : (
            <>
              {/* Summary */}
              <div className="mb-5 flex gap-4">
                <div className="flex items-center gap-2 rounded-xl bg-[#f7f4ff] px-4 py-3">
                  <span className="text-lg">📚</span>
                  <div>
                    <p className="font-display text-2xl font-bold text-[#2c1f4a]">{words.length}</p>
                    <p className="text-xs text-[#6b6384]">từ</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-[#f7f4ff] px-4 py-3">
                  <span className="text-lg">⏱</span>
                  <div>
                    <p className="font-display text-2xl font-bold text-[#2c1f4a]">{studyMinutes}</p>
                    <p className="text-xs text-[#6b6384]">phút</p>
                  </div>
                </div>
              </div>

              {/* Word list */}
              {words.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">
                  Không có từ nào được học hôm này.
                </p>
              ) : (
                <ul className="space-y-2">
                  {words.map((w) => (
                    <li key={w.word} className="rounded-xl border border-gray-100 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleWord(w.word)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <div>
                          <span className="font-medium text-[#2c1f4a]">{w.word}</span>
                          <span className="mx-2 text-gray-300">—</span>
                          <span className="text-sm text-[#6b6384]">{w.meaning}</span>
                        </div>
                        <span className="ml-2 text-gray-400 text-xs">{expandedWords.has(w.word) ? "▲" : "▼"}</span>
                      </button>
                      {expandedWords.has(w.word) && (
                        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-1">
                          {w.example && (
                            <p className="text-sm text-gray-600 italic">"{w.example}"</p>
                          )}
                          <MasteryStars mastery={w.mastery} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Footer navigation */}
        {date && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <button
              type="button"
              onClick={() => onNavigate(offsetDate(date, -1))}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-[#7f56d9] hover:bg-[#f7f4ff]"
            >
              ← Ngày trước
            </button>
            <button
              type="button"
              onClick={() => onNavigate(offsetDate(date, 1))}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-[#7f56d9] hover:bg-[#f7f4ff]"
            >
              Ngày sau →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no type errors for `DayDrawer.tsx`.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/DayDrawer.tsx
git commit -m "feat: add DayDrawer slide-in component"
```

---

## Task 4: Create `/diary` page

**Files:**
- Create: `src/app/diary/page.tsx`

**Interfaces:**
- Consumes:
  - `getCalendarData(weeks: number): CalendarDay[]` from `src/lib/stats`
  - `getStudyTimePerDay(days: number): DailyStudyTime[]` from `src/lib/stats`
  - `getWordsForDate(date: string): LearnedWord[]` from `src/lib/stats`
  - `DiaryCalendar` from `src/components/DiaryCalendar`
  - `DayDrawer` from `src/components/DayDrawer`

- [ ] **Step 1: Create `src/app/diary/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import DiaryCalendar from "@/components/DiaryCalendar";
import DayDrawer from "@/components/DayDrawer";
import {
  getCalendarData,
  getStudyTimePerDay,
  getWordsForDate,
  type CalendarDay,
} from "@/lib/stats";
import type { LearnedWord } from "@/lib/storage";

export default function DiaryPage() {
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [studyTimeByDate, setStudyTimeByDate] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drawerWords, setDrawerWords] = useState<LearnedWord[]>([]);
  const [drawerMinutes, setDrawerMinutes] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    setCalendarData(getCalendarData(26));
    const studyDays = getStudyTimePerDay(26 * 7);
    const byDate: Record<string, number> = {};
    for (const d of studyDays) byDate[d.date] = d.minutes;
    setStudyTimeByDate(byDate);
  }, []);

  const openDay = useCallback(
    (date: string) => {
      setSelectedDate(date);
      setDrawerWords(getWordsForDate(date));
      setDrawerMinutes(studyTimeByDate[date] ?? 0);
      setIsDrawerOpen(true);
    },
    [studyTimeByDate]
  );

  function handleNavigate(date: string) {
    openDay(date);
  }

  function handleClose() {
    setIsDrawerOpen(false);
  }

  return (
    <main className="min-h-full min-w-0 bg-[#f7f4ff] px-4 py-10 text-[#2c1f4a] sm:px-6 lg:py-14">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f56d9]">
            Nhật ký học tập
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Lộ trình học</h1>
          <p className="mt-2 text-sm text-[#6b6384]">
            Click vào một ngày để xem chi tiết hôm đó học gì.
          </p>
        </div>

        <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
          <DiaryCalendar
            data={calendarData}
            studyTimeByDate={studyTimeByDate}
            selectedDate={selectedDate}
            onSelectDate={openDay}
          />
        </section>
      </div>

      <DayDrawer
        date={selectedDate}
        words={drawerWords}
        studyMinutes={drawerMinutes}
        isOpen={isDrawerOpen}
        onClose={handleClose}
        onNavigate={handleNavigate}
      />
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no type errors; page builds successfully.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/diary/page.tsx
git commit -m "feat: add /diary page with interactive calendar"
```

---

## Task 5: Add navbar link + update CONTEXT.md

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `CONTEXT.md`

**Interfaces:**
- No new interfaces. This task only wires up the new page into navigation and documents it.

- [ ] **Step 1: Add "Nhật ký" link to `src/app/layout.tsx`**

Find the existing `<a href="/review">` block in the navbar. Insert the new link **after** the `/review` link and **before** the `/history` link:

```tsx
<a
  href="/diary"
  className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white"
>
  Nhật ký
</a>
```

- [ ] **Step 2: Update `CONTEXT.md`**

In the **Pages & Routes** table, add a new row:

```
| `/diary` | `src/app/diary/page.tsx` | Daily learning journal — interactive 26-week heatmap, click a day to see words learned and study time in a slide-in drawer |
```

In the **Component Map** table, add two new rows:

```
| `DiaryCalendar` | Interactive 26-week heatmap calendar for /diary; purple color levels 0–3; click cell opens DayDrawer |
| `DayDrawer` | Slide-in right drawer for /diary; shows daily word list (expandable) + study minutes + prev/next nav |
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx CONTEXT.md
git commit -m "feat: add Nhật ký navbar link and update CONTEXT.md"
```
