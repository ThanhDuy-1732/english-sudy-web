# Diary Dashboard Design

**Date:** 2026-07-25
**Status:** Approved

---

## Overview

A new `/diary` page providing a "daily learning journal" — an interactive heatmap calendar showing the user's full learning history at a glance. Clicking any day opens a slide-in drawer showing that day's summary (words learned, minutes studied) and an expandable word list with meanings and examples.

---

## Architecture

### New page
`src/app/diary/page.tsx` — client component.

### Data sources (all existing, no new API needed)
- `getLearnedWords()` from `src/lib/storage.ts` — filtered by `learnedAt` date
- `getStudyTimePerDay(days)` from `src/lib/stats.ts` — daily study minutes
- `getCalendarData(weeks)` from `src/lib/stats.ts` — heatmap intensity levels 0–3

### New helper
`getWordsForDate(date: string): LearnedWord[]` added to `src/lib/stats.ts`.
Filters `learnedWords` where `learnedAt.startsWith(date)` (date = `"YYYY-MM-DD"`).

### Page state
```ts
selectedDate: string | null   // YYYY-MM-DD, set on calendar day click
isDrawerOpen: boolean         // controls drawer visibility
```

No URL params — selection is client-side only, no need to bookmark.

---

## UI

### Page layout
```
[Header]
  p.label  "Nhật ký học tập"
  h1       26-week heatmap calendar (interactive)
  p.sub    "Click vào một ngày để xem chi tiết"

[DiaryCalendar]
  26-week heatmap grid (same visual as StreakCalendar)
  Each cell: colored by word count (0=gray, 1-2=light purple, 3-5=purple, 6+=dark purple)
  Hover: tooltip "X từ · Y phút"
  Click: sets selectedDate, opens drawer, highlights selected cell with ring
```

### Drawer (DayDrawer)
Slide-in panel from the right side, overlaying the page. Backdrop click closes it.

```
[Header]
  [×] close button
  Date: e.g. "Thứ Ba, 22/07/2026"

[Summary row]
  📚 X từ        ⏱ Y phút

[Word list]
  For each word: collapsed row showing  word — meaning
  Click to expand: shows example sentence + mastery stars

[Footer nav]
  [← Ngày trước]        [Ngày sau →]
```

If no words were learned on the selected day: show "Không có từ nào được học hôm này" with the study time still shown (they may have studied but not saved words).

If the selected day has no data at all: show "Không có dữ liệu cho ngày này."

---

## New Components

### `DiaryCalendar` (`src/components/DiaryCalendar.tsx`)
Props:
```ts
interface DiaryCalendarProps {
  data: CalendarDay[];
  studyTimeByDate: Record<string, number>;  // date → minutes
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}
```
- Renders 26-week grid like `StreakCalendar` but each cell is a `<button>`
- Selected date cell gets a ring highlight (`ring-2 ring-[#7f56d9]`)
- Tooltip on hover: built with `title` attribute (simple, no extra library)

### `DayDrawer` (`src/components/DayDrawer.tsx`)
Props:
```ts
interface DayDrawerProps {
  date: string | null;
  words: LearnedWord[];
  studyMinutes: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (date: string) => void;   // for prev/next day buttons
}
```
- Slide animation: `translate-x-full` → `translate-x-0` via Tailwind transition
- Backdrop: fixed overlay `bg-black/30` behind drawer
- Word expand: local `expandedWords: Set<string>` state
- Prev/Next: computes adjacent dates from the current `date`

---

## Navbar

Add "Nhật ký" link to `src/app/layout.tsx` navbar between "Ôn tập" and "Lịch sử":

```tsx
<a href="/diary" className="...">Nhật ký</a>
```

---

## Stats helper addition

```ts
// src/lib/stats.ts
export function getWordsForDate(date: string): LearnedWord[] {
  const words = getLearnedWords();
  return words.filter(w => w.learnedAt.startsWith(date));
}
```

---

## What's NOT in scope

- Editing or deleting words from the diary view (use `/history` for that)
- Filtering by topic within a day
- URL-based date selection / deep linking
- Animations beyond the drawer slide-in

---

## Files to create/modify

| Action | File |
|--------|------|
| Create | `src/app/diary/page.tsx` |
| Create | `src/components/DiaryCalendar.tsx` |
| Create | `src/components/DayDrawer.tsx` |
| Modify | `src/lib/stats.ts` — add `getWordsForDate` |
| Modify | `src/app/layout.tsx` — add navbar link |
| Update | `CONTEXT.md` — new page, new components |
