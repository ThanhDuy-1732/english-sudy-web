# Nhóm Theo Dõi Tiến Trình — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trang thống kê học tập với biểu đồ (bar chart + donut), streak calendar kiểu GitHub, và hiển thị mastery stars trong trang History.

**Architecture:** Tạo `src/lib/stats.ts` để tính toán từ localStorage. Trang `/stats` dùng Recharts render biểu đồ client-side. `StreakCalendar` là pure component tự vẽ SVG grid không cần thư viện. Mastery field đã có trong `LearnedWord` (nếu implement nhóm Học từ vựng trước), nếu không thì mặc định là `0`.

**Tech Stack:** Next.js 14 App Router, TypeScript, TailwindCSS, Recharts

## Global Constraints

- Prerequisite: base plan (`2026-07-16-english-study.md`) đã implement xong
- Recharts là client-only component — tất cả chart components cần `"use client"` và dynamic import nếu cần
- Nếu `mastery` field chưa có trong `LearnedWord`, mặc định về `0` khi đọc (backward compatible)
- Vietnamese UI text

---

## File Map

| File | Action | Trách nhiệm |
|------|--------|-------------|
| `src/lib/stats.ts` | Create | Tính toán dữ liệu thống kê từ localStorage |
| `src/lib/__tests__/stats.test.ts` | Create | Unit test cho stats functions |
| `src/components/charts/WordsPerDayChart.tsx` | Create | Bar chart: số từ học theo ngày |
| `src/components/charts/TopicDistributionChart.tsx` | Create | Pie/Donut chart: phân bổ theo chủ đề |
| `src/components/StreakCalendar.tsx` | Create | GitHub-style contribution grid (SVG) |
| `src/app/stats/page.tsx` | Create | Trang thống kê — kết hợp 3 component trên |
| `src/app/layout.tsx` | Modify | Thêm link "Thống kê" vào nav |
| `src/app/history/page.tsx` | Modify | Hiện mastery stars bên cạnh từng từ |

---

## Task 1: Stats Library

**Files:**
- Create: `src/lib/stats.ts`
- Create: `src/lib/__tests__/stats.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function getWordsPerDay(days?: number): { date: string; count: number }[]
  // date: "YYYY-MM-DD", days: số ngày nhìn lại (default 30)

  function getTopicDistribution(): { topic: string; count: number }[]

  function getCalendarData(weeks?: number): {
    date: string;     // "YYYY-MM-DD"
    count: number;    // số từ học ngày đó
    level: 0 | 1 | 2 | 3;  // 0=none, 1=1-2, 2=3-4, 3=5+
  }[]
  // weeks: số tuần nhìn lại (default 26 — 6 tháng)
  ```

- [ ] **Step 1: Viết failing tests**

Tạo `src/lib/__tests__/stats.test.ts`:

```ts
import { getWordsPerDay, getTopicDistribution, getCalendarData } from "../stats";

const mockStorage = (words: object[]) => {
  localStorage.setItem("learnedWords", JSON.stringify(words));
};

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

test("getWordsPerDay returns empty array when no words", () => {
  const result = getWordsPerDay(7);
  expect(result).toHaveLength(7);
  expect(result.every((d) => d.count === 0)).toBe(true);
});

test("getWordsPerDay counts words learned on each day", () => {
  mockStorage([
    { word: "a", learnedAt: "2026-07-16T08:00:00.000Z" },
    { word: "b", learnedAt: "2026-07-16T10:00:00.000Z" },
    { word: "c", learnedAt: "2026-07-15T08:00:00.000Z" },
  ]);
  const result = getWordsPerDay(7);
  const today = result.find((d) => d.date === "2026-07-16");
  const yesterday = result.find((d) => d.date === "2026-07-15");
  expect(today?.count).toBe(2);
  expect(yesterday?.count).toBe(1);
});

test("getTopicDistribution groups words by topic", () => {
  mockStorage([
    { word: "a", topic: "TOEIC" },
    { word: "b", topic: "TOEIC" },
    { word: "c", topic: "Daily Communication" },
  ]);
  const result = getTopicDistribution();
  const toeic = result.find((t) => t.topic === "TOEIC");
  const daily = result.find((t) => t.topic === "Daily Communication");
  expect(toeic?.count).toBe(2);
  expect(daily?.count).toBe(1);
});

test("getCalendarData assigns correct level", () => {
  mockStorage([
    { word: "a", learnedAt: "2026-07-16T08:00:00.000Z" },
    { word: "b", learnedAt: "2026-07-16T09:00:00.000Z" },
    { word: "c", learnedAt: "2026-07-16T10:00:00.000Z" },
    { word: "d", learnedAt: "2026-07-16T11:00:00.000Z" },
    { word: "e", learnedAt: "2026-07-16T12:00:00.000Z" },
  ]);
  const data = getCalendarData(4);
  const today = data.find((d) => d.date === "2026-07-16");
  expect(today?.count).toBe(5);
  expect(today?.level).toBe(3);
});
```

- [ ] **Step 2: Chạy test — xác nhận fail**

```bash
npm test -- --testPathPattern=stats
```

Expected: FAIL — functions not defined.

- [ ] **Step 3: Tạo `src/lib/stats.ts`**

```ts
import { getLearnedWords } from "./storage";

function toDateStr(isoString: string): string {
  return isoString.slice(0, 10);
}

export function getWordsPerDay(days = 30): { date: string; count: number }[] {
  const words = getLearnedWords();
  const countByDate: Record<string, number> = {};
  words.forEach((w) => {
    const d = toDateStr(w.learnedAt);
    countByDate[d] = (countByDate[d] ?? 0) + 1;
  });

  const result: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    result.push({ date: d, count: countByDate[d] ?? 0 });
  }
  return result;
}

export function getTopicDistribution(): { topic: string; count: number }[] {
  const words = getLearnedWords();
  const countByTopic: Record<string, number> = {};
  words.forEach((w) => {
    countByTopic[w.topic] = (countByTopic[w.topic] ?? 0) + 1;
  });
  return Object.entries(countByTopic).map(([topic, count]) => ({ topic, count }));
}

export function getCalendarData(
  weeks = 26
): { date: string; count: number; level: 0 | 1 | 2 | 3 }[] {
  const days = weeks * 7;
  const raw = getWordsPerDay(days);

  function toLevel(count: number): 0 | 1 | 2 | 3 {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 4) return 2;
    return 3;
  }

  return raw.map((d) => ({ ...d, level: toLevel(d.count) }));
}
```

- [ ] **Step 4: Chạy test — pass**

```bash
npm test -- --testPathPattern=stats
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts src/lib/__tests__/stats.test.ts
git commit -m "feat: add stats library for learning analytics"
```

---

## Task 2: Charts Components

**Files:**
- Create: `src/components/charts/WordsPerDayChart.tsx`
- Create: `src/components/charts/TopicDistributionChart.tsx`

**Interfaces:**
- Consumes:
  ```ts
  <WordsPerDayChart data={getWordsPerDay(30)} />
  <TopicDistributionChart data={getTopicDistribution()} />
  ```

- [ ] **Step 1: Cài Recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Tạo `src/components/charts/WordsPerDayChart.tsx`**

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  data: { date: string; count: number }[];
}

export default function WordsPerDayChart({ data }: Props) {
  const displayData = data.map((d) => ({
    ...d,
    label: d.date.slice(5), // "MM-DD"
  }));

  // Chỉ hiện label mỗi 5 ngày để tránh chật
  const tickFormatter = (value: string, index: number) =>
    index % 5 === 0 ? value : "";

  return (
    <div>
      <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Từ học mỗi ngày (30 ngày gần nhất)
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={displayData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickFormatter={tickFormatter} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [value, "Từ"]}
            labelFormatter={(label) => `Ngày ${label}`}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Tạo `src/components/charts/TopicDistributionChart.tsx`**

```tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Props {
  data: { topic: string; count: number }[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function TopicDistributionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div>
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Phân bổ theo chủ đề
        </h3>
        <p className="text-gray-400 text-sm text-center py-8">Chưa có dữ liệu</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Phân bổ theo chủ đề
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="topic"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [value, "Từ"]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/charts/ 
git commit -m "feat: add WordsPerDay bar chart and TopicDistribution donut chart"
```

---

## Task 3: Streak Calendar Component

**Files:**
- Create: `src/components/StreakCalendar.tsx`

**Interfaces:**
- Consumes:
  ```ts
  <StreakCalendar data={getCalendarData(26)} />
  ```

- [ ] **Step 1: Tạo `src/components/StreakCalendar.tsx`**

```tsx
"use client";

const LEVEL_COLORS: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-gray-100 dark:bg-gray-800",
  1: "bg-blue-200",
  2: "bg-blue-400",
  3: "bg-blue-600",
};

interface Day {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3;
}

interface Props {
  data: Day[];
}

export default function StreakCalendar({ data }: Props) {
  // Chia data thành các cột tuần (mỗi cột 7 ngày)
  const weeks: Day[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  return (
    <div>
      <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Lịch học tập
      </h3>
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {/* Day labels column */}
          <div className="flex flex-col gap-1 mr-1">
            <div className="w-8 h-3" /> {/* spacer for month labels */}
            {DAY_LABELS.map((d) => (
              <div key={d} className="w-8 h-3 text-[10px] text-gray-400 flex items-center">
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => {
            const monthLabel =
              wi === 0 || week[0]?.date.slice(8) === "01"
                ? new Date(week[0]?.date).toLocaleDateString("vi-VN", { month: "short" })
                : "";
            return (
              <div key={wi} className="flex flex-col gap-1">
                <div className="h-3 text-[10px] text-gray-400">{monthLabel}</div>
                {week.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} từ`}
                    className={`w-3 h-3 rounded-sm ${LEVEL_COLORS[day.level]} cursor-default`}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
        <span>Ít</span>
        {([0, 1, 2, 3] as const).map((level) => (
          <div key={level} className={`w-3 h-3 rounded-sm ${LEVEL_COLORS[level]}`} />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StreakCalendar.tsx
git commit -m "feat: add GitHub-style streak calendar component"
```

---

## Task 4: Stats Page

**Files:**
- Create: `src/app/stats/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Tạo `src/app/stats/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { getWordsPerDay, getTopicDistribution, getCalendarData } from "@/lib/stats";
import WordsPerDayChart from "@/components/charts/WordsPerDayChart";
import TopicDistributionChart from "@/components/charts/TopicDistributionChart";
import StreakCalendar from "@/components/StreakCalendar";
import { getLearnedWords } from "@/lib/storage";

export default function StatsPage() {
  const [wordsPerDay, setWordsPerDay] = useState<{ date: string; count: number }[]>([]);
  const [topicDist, setTopicDist] = useState<{ topic: string; count: number }[]>([]);
  const [calendarData, setCalendarData] = useState<
    { date: string; count: number; level: 0 | 1 | 2 | 3 }[]
  >([]);
  const [totalWords, setTotalWords] = useState(0);

  useEffect(() => {
    setWordsPerDay(getWordsPerDay(30));
    setTopicDist(getTopicDistribution());
    setCalendarData(getCalendarData(26));
    setTotalWords(getLearnedWords().length);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Thống kê học tập</h1>
        <p className="text-gray-500 text-sm mt-1">Tổng cộng: {totalWords} từ đã học</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm">
        <WordsPerDayChart data={wordsPerDay} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm">
          <TopicDistributionChart data={topicDist} />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Tóm tắt</p>
          <div className="space-y-2">
            {topicDist.map((t) => (
              <div key={t.topic} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t.topic}</span>
                <span className="font-medium">{t.count} từ</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm">
        <StreakCalendar data={calendarData} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Thêm "Thống kê" vào nav trong `src/app/layout.tsx`**

```tsx
<Link href="/stats">Thống kê</Link>
```

- [ ] **Step 3: Kiểm tra thủ công**

Vào `/stats` — hiện bar chart (cột xanh theo ngày), donut chart theo chủ đề, streak calendar. Nếu chưa có dữ liệu thì chart trống là bình thường.

- [ ] **Step 4: Commit**

```bash
git add src/app/stats/page.tsx src/app/layout.tsx
git commit -m "feat: add stats page with charts and streak calendar"
```

---

## Task 5: Mastery Stars trong History

**Files:**
- Modify: `src/app/history/page.tsx`

**Interfaces:**
- Consumes: `LearnedWord.mastery: number` (0–5, default 0 nếu chưa có)

- [ ] **Step 1: Thêm mastery stars vào mỗi từ trong History**

Trong `src/app/history/page.tsx`, tìm chỗ render mỗi word entry, thêm stars:

```tsx
function MasteryStars({ mastery = 0 }: { mastery?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= mastery ? "text-amber-400" : "text-gray-200"}>
          ★
        </span>
      ))}
    </div>
  );
}

// Trong render của mỗi word:
<div className="flex items-center justify-between">
  <span className="font-semibold">{word.word}</span>
  <MasteryStars mastery={word.mastery} />
</div>
```

- [ ] **Step 2: Thêm filter "Chưa thành thạo" vào History**

```tsx
const [masteryFilter, setMasteryFilter] = useState<"all" | "weak">("all");

// Filter logic:
const filteredWords = words
  .filter((w) => selectedTopic === "all" || w.topic === selectedTopic)
  .filter((w) => masteryFilter === "all" || (w.mastery ?? 0) < 3);

// Filter button:
<button
  onClick={() => setMasteryFilter(masteryFilter === "all" ? "weak" : "all")}
  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
    masteryFilter === "weak"
      ? "bg-orange-100 border-orange-400 text-orange-700"
      : "border-gray-200 text-gray-500 hover:border-gray-400"
  }`}
>
  {masteryFilter === "weak" ? "★ Chưa thành thạo ✓" : "★ Chưa thành thạo"}
</button>
```

- [ ] **Step 3: Kiểm tra thủ công**

Vào `/history` — mỗi từ hiện 5 sao (xám nếu mastery = 0). Click filter "Chưa thành thạo" → chỉ hiện từ có mastery < 3.

- [ ] **Step 4: Commit**

```bash
git add src/app/history/page.tsx
git commit -m "feat: add mastery stars and weak-word filter in history"
```
