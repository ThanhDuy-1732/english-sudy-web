# Study Timer — Design Spec

**Date:** 2026-07-21  
**Status:** Approved

## Overview

Add a unified study timer to the app that simultaneously tracks daily study time (auto) and supports user-set countdown sessions. The timer lives in the header navbar with pause/resume controls, and study time data is visualized on the Stats page.

## Architecture

### TimerContext (`src/contexts/TimerContext.tsx`)

A new React context wrapping the entire app via `layout.tsx`. Owns all timer state and the single `setInterval` that drives it.

**State shape:**
```ts
{
  todaySeconds: number;        // total seconds studied today
  isRunning: boolean;          // false when paused
  isCountdownMode: boolean;    // true when a countdown is active
  countdownTarget: number | null;   // total seconds for current countdown session
  countdownRemaining: number | null; // seconds left in countdown
}
```

**Behaviors:**
- On mount: reads today's date key from localStorage `"studyTime"` and initializes `todaySeconds`
- While `isRunning=true`: every second, increments `todaySeconds` and decrements `countdownRemaining` (if countdown active)
- Writes `todaySeconds` to localStorage with 5s debounce to avoid excessive writes
- When `countdownRemaining` reaches 0: clears countdown state, triggers the "time's up" modal
- `pause()` / `resume()` toggle `isRunning`
- `startCountdown(seconds: number)` sets `isCountdownMode=true`, `countdownTarget=seconds`, `countdownRemaining=seconds`, `isRunning=true`
- `stopCountdown()` clears countdown state, returns to normal study-time display

### localStorage Schema

Key: `"studyTime"`  
Value: `Record<string, number>` — date string → total seconds studied  

```json
{ "2026-07-21": 1800, "2026-07-20": 900 }
```

Existing keys are never deleted. Each session appends to the current day's value.

## Components

### HeaderTimer (`src/components/HeaderTimer.tsx`)

Rendered inside the header in `layout.tsx`. Consumes `TimerContext`.

**Display modes:**
- **Normal (no countdown):** `⏱ 12:34` — elapsed study time today, neutral color
- **Countdown active:** `⏳ 08:45` — remaining countdown time, purple/accent color to distinguish
- **Paused (either mode):** `⏸` icon prefix, text at reduced opacity

**Interactions:**
- Click timer text → toggle pause/resume
- Click clock/`+` icon button → open `SetCountdownModal`

### SetCountdownModal

A small modal with:
- Input field: "Học trong ___ phút"
- Quick presets: 10 min, 25 min, 45 min (buttons that populate the input)
- "Bắt đầu" button → calls `startCountdown(minutes * 60)`

### TimeUpModal

Triggered automatically when countdown reaches 0. Contains:
- Message: "Hết giờ rồi! Bạn đã học **X phút** hôm nay."
- Button "Nghỉ thôi" → closes modal
- Button "Học thêm X phút" → calls `startCountdown(countdownTarget)` with same duration

## Stats Page Integration

### New stat tile

Adds a 4th tile to the existing 3-tile row in `/stats`:  
**"Hôm nay"** — shows today's study time in minutes (e.g. `32 phút`).  
Reads `todaySeconds` from `TimerContext` (always live, no extra localStorage read needed).

### New chart: `StudyTimeChart` (`src/components/charts/StudyTimeChart.tsx`)

A bar chart showing study minutes per day for the last 30 days. Follows the same pattern as `WordsPerDayChart` — receives `{ date: string, minutes: number }[]` data prop and renders using the existing charting approach.

### New stats function

```ts
// src/lib/stats.ts
export function getStudyTimePerDay(days = 30): { date: string; minutes: number }[]
```

Reads `localStorage["studyTime"]`, converts seconds to minutes (rounded), returns an array of `days` entries (filling missing days with 0), same shape as `getWordsPerDay`.

## Data Flow

```
TimerContext (setInterval)
  → todaySeconds increments each second
  → debounced write to localStorage["studyTime"][today]
  → countdownRemaining decrements → 0 → TimeUpModal

HeaderTimer (reads TimerContext) → displays live time, controls pause/resume
SetCountdownModal → calls startCountdown() on TimerContext
TimeUpModal → calls startCountdown() or dismisses

StatsPage (on mount)
  → getStudyTimePerDay() reads localStorage["studyTime"]
  → StudyTimeChart renders bar chart
  → today tile reads today's entry
```

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/contexts/TimerContext.tsx` |
| Create | `src/components/HeaderTimer.tsx` |
| Create | `src/components/charts/StudyTimeChart.tsx` |
| Modify | `src/app/layout.tsx` — wrap with TimerContext, add HeaderTimer to header |
| Modify | `src/lib/stats.ts` — add `getStudyTimePerDay()` |
| Modify | `src/app/stats/page.tsx` — add tile + StudyTimeChart |

## Out of Scope

- Idle detection (timer runs while app is open regardless of user activity)
- Push notifications for countdown end (browser modal only)
- Syncing study time to Supabase/Firebase (localStorage only for now)
- Per-session breakdown (only daily totals)
