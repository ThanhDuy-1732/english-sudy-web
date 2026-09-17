# Batch 1 / T6: /activity Page + CONTEXT.md Update

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `/activity` — a page showing all completed learning sessions grouped by local date, with type badges, duration, and accuracy. Update CONTEXT.md and pass the Batch 1 milestone gate.

**Architecture:** Client component reads `getSessions()` on mount, filters to `finishedAt` sessions, groups by local date string. No API calls, no AI.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-09-17-development-roadmap-design.md` — Batch 1

**Requires:** T1–T5 complete

**Previous task:** `docs/superpowers/plans/batch1/t5-writing-session.md`

**This is the final task of Batch 1.**

## Global Constraints

- No new npm dependencies.
- Local date grouping — not UTC.
- `npm test && npm run lint && npm run build` must all pass — this is the Batch 1 milestone gate.
- CONTEXT.md must be updated before the final commit.

---

## Files

| Action | File |
|---|---|
| Create | `src/app/activity/page.tsx` |
| Modify | `src/app/layout.tsx` or nav component (wherever nav links live) |
| Update | `CONTEXT.md` |

## Interfaces Consumed (from T1)

```ts
import { getSessions, type LearningSession, type LearningActivityType } from "@/lib/sessions";

getSessions(): LearningSession[]
```

---

- [ ] **Step 1: Find where the nav links are**

```bash
grep -rn "href=\"/stats\"" src/ --include="*.tsx" -l
```

Open that file to understand the nav pattern before adding the `/activity` link.

- [ ] **Step 2: Create `src/app/activity/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSessions, type LearningSession, type LearningActivityType } from "@/lib/sessions";

function localDateStr(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function SessionRow({ session }: { session: LearningSession }) {
  const accuracy =
    session.totalItems && session.correctItems !== undefined
      ? Math.round((session.correctItems / session.totalItems) * 100)
      : null;

  return (
    <div className="flex items-center justify-between py-3 border-b border-[#e8e0f7] last:border-0">
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${TYPE_COLORS[session.type]}`}>
          {TYPE_LABELS[session.type]}
        </span>
        <span className="text-sm text-[#6b6384]">{formatTime(session.startedAt)}</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {accuracy !== null && (
          <span className="text-[#6b6384]">{accuracy}%</span>
        )}
        {session.totalItems !== undefined && (
          <span className="text-[#6b6384]">{session.totalItems} mục</span>
        )}
        <span className="font-medium text-[#2c1f4a]">{formatDuration(session.durationSeconds)}</span>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [grouped, setGrouped] = useState<[string, LearningSession[]][]>([]);

  useEffect(() => {
    const sessions = getSessions().filter((s) => s.finishedAt);
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

- [ ] **Step 3: Add `/activity` link to navigation**

Open the nav file found in Step 1. Add a link near the stats/diary links:

```tsx
<Link href="/activity">Hoạt động</Link>
```

Follow the exact same className/pattern as existing nav links in that file.

- [ ] **Step 4: Update `CONTEXT.md`**

In the **Pages & Routes** table, add:

```
| `/activity` | `src/app/activity/page.tsx` | Learning activity history — completed sessions grouped by local date, type badge, duration, accuracy |
```

In the **localStorage Keys** table, add:

```
| `learningSessions` | `LearningSession[]` | All learning sessions, capped at 500, newest first. Written by review/exam/speaking/writing flows. |
```

- [ ] **Step 5: Batch 1 milestone gate — all three must pass**

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

If any fails, fix before committing.

- [ ] **Step 6: Final Batch 1 commit**

```bash
git add src/app/activity/page.tsx CONTEXT.md
# Also add the nav file modified in Step 3
git add src/app/layout.tsx   # or whatever file was modified
git commit -m "feat(activity): add /activity page — Batch 1 milestone complete

- Sessions grouped by local date, newest first
- Type badges, duration, accuracy per session  
- Empty state with CTA
- CONTEXT.md updated with new route and localStorage key

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

**Batch 1 is done. Next: Batch 2 — Unified Mistake Notebook.**  
Plan location: `docs/superpowers/plans/` (to be written).
