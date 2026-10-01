# Batch 7: Personalization & UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a learning profile (goal / level / daily time / target score), a dynamic learning path page derived from mastery + weakness, a global `/library` search, dark mode support, and keyboard shortcuts for flashcard and exam — without blocking existing users with onboarding.

**Architecture:** Learning profile lives in `src/lib/profile.ts` (localStorage). Dynamic path derives from Batch 1 mastery cache and Batch 1 mistake data — no AI. Global search is client-side text search across localStorage keys. Dark mode uses CSS `[data-theme]` variables matching Next.js conventions. Keyboard shortcuts use `useEffect` event listeners, disable-able via profile settings.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest (jsdom), localStorage

**Spec:** `docs/requirement/DEVELOPMENT_DIRECTION.md` §13 (Learning Profile), §14 (Dynamic Learning Path), §12 (Search/Library), §15 (UX Improvements), Batch 7 in §18

## Global Constraints

- No new npm dependencies.
- Existing users must NOT be redirected to any onboarding — profile is optional and defaults gracefully.
- Dark mode: respect `data-theme` attribute (set by Next.js theme toggle if present, else CSS media query).
- Keyboard shortcuts default to enabled; can be disabled in settings.
- All localStorage reads SSR-guarded.
- `npm test && npm run lint && npm run build` must pass after every task.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/profile.ts` | LearningProfile type + CRUD |
| Create | `src/lib/__tests__/profile.test.ts` | Unit tests |
| Modify | `src/app/settings/page.tsx` | Add "Profile" tab with goal/level/time/target fields |
| Create | `src/app/path/page.tsx` | `/path` — dynamic learning path derived from mastery + goals |
| Create | `src/app/library/page.tsx` | `/library` — global search across all knowledge |
| Modify | `src/app/page.tsx` | Add keyboard shortcuts (Space/1/2/3/4/Enter) |
| Modify | `src/app/exam/drill/[part]/page.tsx` | Add keyboard shortcuts (1–4/Enter) |
| Modify | `src/app/layout.tsx` | Wire up dark mode CSS variables |

---

## Task 1: Learning Profile

**Files:**
- Create: `src/lib/profile.ts`
- Create: `src/lib/__tests__/profile.test.ts`

**Interfaces — Produces (used by Tasks 2–3):**
```ts
export type LearningGoal = "communication" | "toeic" | "ielts" | "vocabulary" | "mixed";

export interface LearningProfile {
  goal: LearningGoal;
  currentLevel: 1 | 2 | 3 | 4 | 5;          // 1=Beginner … 5=Advanced
  dailyStudyMinutes: number;                   // 15/30/45/60/90
  targetToeicScore?: number;                   // if goal === "toeic"
  targetIeltsScore?: number;                   // if goal === "ielts"
  targetDate?: string;                         // ISO date
  shortcutsEnabled: boolean;
}

const DEFAULTS: LearningProfile = {
  goal: "mixed",
  currentLevel: 2,
  dailyStudyMinutes: 30,
  shortcutsEnabled: true,
};
```

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/profile.test.ts
import { getProfile, saveProfile, updateProfile } from "../profile";

beforeEach(() => { localStorage.clear(); });

test("getProfile returns defaults when nothing saved", () => {
  const p = getProfile();
  expect(p.goal).toBe("mixed");
  expect(p.dailyStudyMinutes).toBe(30);
  expect(p.shortcutsEnabled).toBe(true);
});

test("saveProfile persists and retrieves", () => {
  saveProfile({ ...getProfile(), goal: "toeic", targetToeicScore: 750 });
  expect(getProfile().goal).toBe("toeic");
  expect(getProfile().targetToeicScore).toBe(750);
});

test("updateProfile merges partial updates", () => {
  updateProfile({ dailyStudyMinutes: 60 });
  expect(getProfile().dailyStudyMinutes).toBe(60);
  expect(getProfile().goal).toBe("mixed"); // unchanged
});
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="profile" --no-coverage
```

- [ ] **Step 3: Implement `src/lib/profile.ts`**

```ts
const KEY = "learningProfile";

const DEFAULTS: LearningProfile = {
  goal: "mixed",
  currentLevel: 2,
  dailyStudyMinutes: 30,
  shortcutsEnabled: true,
};

export function getProfile(): LearningProfile {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LearningProfile>) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

export function saveProfile(profile: LearningProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(profile));
}

export function updateProfile(partial: Partial<LearningProfile>): void {
  saveProfile({ ...getProfile(), ...partial });
}
```

- [ ] **Step 4: Run tests + commit**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="profile" --no-coverage
git add src/lib/profile.ts src/lib/__tests__/profile.test.ts
git commit -m "feat: add learning profile (batch7)"
```

---

## Task 2: Profile tab in Settings

**Files:**
- Modify: `src/app/settings/page.tsx`

Add a "Hồ sơ" tab (alongside existing AI Providers / Voice / Sync) with goal, level, daily time, and target score fields.

- [ ] **Step 1: Add profile tab**

In `src/app/settings/page.tsx`, import `getProfile`, `saveProfile`, and add a new tab:

```tsx
import { getProfile, saveProfile, type LearningProfile, type LearningGoal } from "@/lib/profile";

// In tabs array, add:
{ id: "profile", label: "Hồ sơ" }

// Profile tab content:
{activeTab === "profile" && (
  <ProfileSettings />
)}
```

Create a `ProfileSettings` component inside the file:

```tsx
function ProfileSettings() {
  const [profile, setProfile] = useState<LearningProfile>(getProfile());

  function update(partial: Partial<LearningProfile>) {
    const updated = { ...profile, ...partial };
    setProfile(updated);
    saveProfile(updated);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium mb-2">Mục tiêu học</p>
        <div className="flex flex-wrap gap-2">
          {([["communication","Giao tiếp"],["toeic","TOEIC"],["ielts","IELTS"],
            ["vocabulary","Từ vựng"],["mixed","Tổng hợp"]] as [LearningGoal, string][]).map(([v,l]) => (
            <button key={v} onClick={() => update({ goal: v })}
              className={`px-3 py-2 rounded text-sm ${profile.goal === v ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Trình độ hiện tại</p>
        <div className="flex gap-2">
          {([1,2,3,4,5] as const).map((n) => (
            <button key={n} onClick={() => update({ currentLevel: n })}
              className={`px-3 py-2 rounded text-sm ${profile.currentLevel === n ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
              {["Sơ cấp","Tiền trung","Trung cấp","Trung cao","Nâng cao"][n-1]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Thời gian học mỗi ngày</p>
        <div className="flex gap-2 flex-wrap">
          {[15, 30, 45, 60, 90].map((m) => (
            <button key={m} onClick={() => update({ dailyStudyMinutes: m })}
              className={`px-3 py-2 rounded text-sm ${profile.dailyStudyMinutes === m ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
              {m} phút
            </button>
          ))}
        </div>
      </div>

      {profile.goal === "toeic" && (
        <div>
          <label className="text-sm font-medium">Mục tiêu TOEIC</label>
          <input type="number" min={10} max={990} step={5}
            value={profile.targetToeicScore ?? ""}
            onChange={(e) => update({ targetToeicScore: Number(e.target.value) })}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm">Phím tắt bàn phím</p>
        <button onClick={() => update({ shortcutsEnabled: !profile.shortcutsEnabled })}
          className={`w-12 h-6 rounded-full transition-colors ${profile.shortcutsEnabled ? "bg-blue-500" : "bg-gray-300"}`}>
          <span className={`block w-5 h-5 bg-white rounded-full m-0.5 transition-transform ${profile.shortcutsEnabled ? "translate-x-6" : ""}`} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add profile settings tab (batch7)"
```

---

## Task 3: Dynamic Learning Path — `/path`

**Files:**
- Create: `src/app/path/page.tsx`

Derive path from profile goal + mastery cache + mistake top categories. No AI. Update weekly (cache with date key).

- [ ] **Step 1: Create `src/app/path/page.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getProfile } from "@/lib/profile";
import { getCachedMastery } from "@/lib/mastery";
import { getTopCategories } from "@/lib/mistakes";

interface PathItem {
  rank: number;
  title: string;
  reason: string;
  href: string;
  mastery?: number;
}

function buildPath(): PathItem[] {
  const profile = getProfile();
  const mastery = getCachedMastery();
  const topMistakes = getTopCategories(undefined, 3);

  const items: PathItem[] = [];
  let rank = 1;

  // 1. Weakest skills from mastery
  const sorted = [...mastery].sort((a, b) => a.overallMastery - b.overallMastery);
  for (const skill of sorted.slice(0, 2)) {
    items.push({
      rank: rank++,
      title: `Luyện ${skill.skill === "grammar" ? "Ngữ pháp" : skill.skill === "vocabulary" ? "Từ vựng" : skill.skill}`,
      reason: `Mastery ${skill.overallMastery}% — cần cải thiện`,
      href: skill.skill === "grammar" ? "/grammar/quiz"
        : skill.skill === "vocabulary" ? "/vocab/quiz"
        : skill.skill === "reading" ? "/exam/drill/RC5"
        : skill.skill === "listening" ? "/exam/drill/LC3"
        : "/today",
      mastery: skill.overallMastery,
    });
  }

  // 2. Top mistake category
  if (topMistakes.length > 0) {
    const top = topMistakes[0];
    items.push({
      rank: rank++,
      title: `Giải quyết lỗi: ${top.category}`,
      reason: `Lặp lại ${top.count} lần`,
      href: "/mistakes",
    });
  }

  // 3. Goal-specific focus
  if (profile.goal === "toeic" || profile.goal === "ielts") {
    items.push({
      rank: rank++,
      title: profile.goal === "toeic" ? "Luyện TOEIC RC5" : "Luyện IELTS Reading",
      reason: `Mục tiêu: ${profile.goal.toUpperCase()}`,
      href: profile.goal === "toeic" ? "/exam/drill/RC5" : "/exam/drill/READ_P3",
    });
  }

  // 4. Speaking if goal is communication or hasn't practiced recently
  const lastSpeaking = typeof window !== "undefined" ? localStorage.getItem("lastSpeakingAt") : null;
  const daysSince = lastSpeaking
    ? (Date.now() - new Date(lastSpeaking).getTime()) / 86400000 : 999;
  if (profile.goal === "communication" || daysSince > 3) {
    items.push({ rank: rank++, title: "Luyện Speaking", reason: `${Math.round(daysSince)} ngày chưa luyện nói`, href: "/speak" });
  }

  return items.slice(0, 6);
}

export default function LearningPathPage() {
  const [items, setItems] = useState<PathItem[]>([]);
  const [profile] = useState(getProfile());

  useEffect(() => { setItems(buildPath()); }, []);

  const goalLabel: Record<string, string> = {
    communication: "Giao tiếp", toeic: "TOEIC", ielts: "IELTS",
    vocabulary: "Từ vựng", mixed: "Tổng hợp",
  };

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-xl font-bold">Lộ trình học</h1>
        <Link href="/settings" className="text-sm text-gray-400">Chỉnh mục tiêu</Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">Mục tiêu: {goalLabel[profile.goal]} · {profile.dailyStudyMinutes} phút/ngày</p>

      {items.length === 0 && (
        <p className="text-gray-400 text-center py-12">Học thêm một ít để nhận gợi ý cá nhân hóa.</p>
      )}

      <ol className="space-y-3">
        {items.map((item) => (
          <li key={item.rank}>
            <Link href={item.href}
              className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              <span className="text-2xl font-bold text-gray-200 dark:text-gray-700 w-8 shrink-0 text-center">
                {item.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
                {item.mastery !== undefined && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-gray-200 rounded">
                      <div className="h-1 bg-blue-500 rounded" style={{ width: `${item.mastery}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{item.mastery}%</span>
                  </div>
                )}
              </div>
              <span className="text-gray-300 dark:text-gray-600">→</span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/path/page.tsx
git commit -m "feat: add dynamic learning path (batch7)"
```

---

## Task 4: Global Search — `/library`

**Files:**
- Create: `src/app/library/page.tsx`

Client-side text search (no AI) across: learned vocab, grammar topics, mistakes, speaking history, writing history. Debounced input, result grouped by type.

- [ ] **Step 1: Create `src/app/library/page.tsx`**

```tsx
"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { getLearnedWords } from "@/lib/storage";
import { getMistakes } from "@/lib/mistakes";
import { getSpeaking } from "@/lib/speech/speaking-storage";
import { getWriting } from "@/lib/write/writing-storage";

interface SearchResult {
  type: "vocabulary" | "mistake" | "speaking" | "writing";
  title: string;
  subtitle: string;
  href?: string;
}

function search(query: string): SearchResult[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  // Vocabulary
  for (const w of getLearnedWords()) {
    if (w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)) {
      results.push({ type: "vocabulary", title: w.word, subtitle: w.meaning });
    }
  }

  // Mistakes
  for (const m of getMistakes()) {
    if (m.category.toLowerCase().includes(q) || m.correctAnswer.toLowerCase().includes(q) ||
        m.explanation.toLowerCase().includes(q)) {
      results.push({ type: "mistake", title: m.correctAnswer,
        subtitle: `${m.skill} · ${m.category}`, href: "/mistakes" });
    }
  }

  // Speaking
  for (const r of getSpeaking()) {
    if (r.prompt.toLowerCase().includes(q) || r.transcript.toLowerCase().includes(q)) {
      results.push({ type: "speaking", title: r.prompt.slice(0, 60),
        subtitle: `Band ${r.feedback.overall.toFixed(1)} · ${new Date(r.createdAt).toLocaleDateString("vi-VN")}`,
        href: "/speak/history" });
    }
  }

  // Writing
  for (const r of getWriting()) {
    if (r.prompt.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)) {
      results.push({ type: "writing", title: r.prompt.slice(0, 60),
        subtitle: `Band ${r.feedback.overall.toFixed(1)} · ${new Date(r.createdAt).toLocaleDateString("vi-VN")}`,
        href: "/write/history" });
    }
  }

  return results.slice(0, 50);
}

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  vocabulary: "Từ vựng", mistake: "Lỗi sai", speaking: "Speaking", writing: "Writing",
};
const TYPE_COLORS: Record<SearchResult["type"], string> = {
  vocabulary: "text-blue-500", mistake: "text-red-500",
  speaking: "text-green-500", writing: "text-purple-500",
};

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => search(query), [query]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    acc[r.type] = [...(acc[r.type] ?? []), r];
    return acc;
  }, {});

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Thư viện kiến thức</h1>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border rounded-lg px-4 py-3 text-sm dark:bg-gray-900 dark:border-gray-700 mb-4"
        placeholder="Tìm từ, lỗi sai, bài nói, bài viết..."
        autoFocus
      />

      {query.length >= 2 && results.length === 0 && (
        <p className="text-gray-400 text-center py-8">Không tìm thấy kết quả.</p>
      )}

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="mb-4">
          <p className={`text-xs font-semibold mb-2 ${TYPE_COLORS[type as SearchResult["type"]]}`}>
            {TYPE_LABELS[type as SearchResult["type"]]} ({items.length})
          </p>
          <ul className="space-y-1">
            {items.slice(0, 8).map((item, i) => {
              const content = (
                <div className="px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.subtitle}</p>
                </div>
              );
              return item.href
                ? <li key={i}><Link href={item.href}>{content}</Link></li>
                : <li key={i}>{content}</li>;
            })}
          </ul>
        </div>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/library/page.tsx
git commit -m "feat: add /library global search (batch7)"
```

---

## Task 5: Keyboard Shortcuts

**Files:**
- Modify: `src/app/page.tsx` (flashcard shortcuts)
- Modify: `src/app/exam/drill/[part]/page.tsx` (exam shortcuts)

- [ ] **Step 1: Add flashcard shortcuts to main page**

In `src/app/page.tsx`, add a `useEffect` that reads `getProfile().shortcutsEnabled`:

```tsx
import { getProfile } from "@/lib/profile";

useEffect(() => {
  if (!getProfile().shortcutsEnabled) return;

  function handleKey(e: KeyboardEvent) {
    // Don't fire when typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === " ") { e.preventDefault(); handleFlip(); }         // flip card
    if (e.key === "1") handleRate("again");                           // Again
    if (e.key === "2") handleRate("hard");                            // Hard
    if (e.key === "3") handleRate("good");                            // Good
    if (e.key === "4") handleRate("easy");                            // Easy
    if (e.key === "Enter") handleSave();                              // Save word
    if (e.key === "ArrowLeft") handlePrev();                          // Previous
    if (e.key === "ArrowRight") handleNext();                         // Next
  }

  window.addEventListener("keydown", handleKey);
  return () => window.removeEventListener("keydown", handleKey);
}, [/* include handler deps */]);
```

(Adjust handler names to match actual function names in the page component.)

- [ ] **Step 2: Add exam shortcuts to drill page**

In `src/app/exam/drill/[part]/page.tsx`:

```tsx
useEffect(() => {
  if (!getProfile().shortcutsEnabled) return;

  function handleKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (["1","2","3","4"].includes(e.key)) {
      const idx = Number(e.key) - 1;
      const options = currentQuestion?.options;
      if (options?.[idx]) handleSelectOption(options[idx]);
    }
    if (e.key === "Enter") handleSubmit();
  }

  window.addEventListener("keydown", handleKey);
  return () => window.removeEventListener("keydown", handleKey);
}, [currentQuestion]);
```

- [ ] **Step 3: Full test + build + commit**

```bash
cd /Users/thankz/Code/study && npm test && npm run lint && npm run build 2>&1 | tail -10
git add src/app/page.tsx src/app/exam/drill/[part]/page.tsx src/app/settings/page.tsx
git commit -m "feat: add keyboard shortcuts (batch7)"
```

---

## Task 6: Dark Mode

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/settings/page.tsx` (theme toggle)

- [ ] **Step 1: Add CSS variable dark mode support**

In `src/app/globals.css`, add color tokens:

```css
:root {
  --bg: #f9fafb;
  --surface: #ffffff;
  --border: #e5e7eb;
  --text: #111827;
  --text-muted: #6b7280;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f172a;
    --surface: #1e293b;
    --border: #334155;
    --text: #f1f5f9;
    --text-muted: #94a3b8;
  }
}

:root[data-theme="dark"] {
  --bg: #0f172a;
  --surface: #1e293b;
  --border: #334155;
  --text: #f1f5f9;
  --text-muted: #94a3b8;
}

body {
  background-color: var(--bg);
  color: var(--text);
}
```

- [ ] **Step 2: Add theme toggle to settings**

In `src/app/settings/page.tsx`:

```tsx
function ThemeToggle() {
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as "system" | "light" | "dark") ?? "system";
  });

  function applyTheme(t: "system" | "light" | "dark") {
    setTheme(t);
    localStorage.setItem("theme", t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <div className="flex gap-2">
      {(["system", "light", "dark"] as const).map((t) => (
        <button key={t} onClick={() => applyTheme(t)}
          className={`px-3 py-2 rounded text-sm ${theme === t ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
          {t === "system" ? "Hệ thống" : t === "light" ? "Sáng" : "Tối"}
        </button>
      ))}
    </div>
  );
}
```

Add `<ThemeToggle />` to the settings page. Add a script in `layout.tsx` to restore theme on page load:

```tsx
// In <head> section of layout.tsx:
<script dangerouslySetInnerHTML={{ __html: `
  (function() {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  })();
` }} />
```

- [ ] **Step 3: Full test + commit**

```bash
cd /Users/thankz/Code/study && npm test && npm run lint && npm run build 2>&1 | tail -10
git add src/app/globals.css src/app/settings/page.tsx src/app/layout.tsx
git commit -m "feat: add dark mode support (batch7)"
```

---

## Acceptance Criteria

- [ ] `getProfile()` returns defaults for new users — no onboarding gate.
- [ ] Profile settings tab persists goal, level, daily time, shortcuts toggle.
- [ ] `/path` shows 4–6 prioritized items derived from mastery + mistakes (not hardcoded).
- [ ] `/library` searches across vocabulary, mistakes, speaking, writing; results grouped by type.
- [ ] Flashcard keyboard shortcuts (Space/1/2/3/4/Enter/←/→) work when `shortcutsEnabled: true`.
- [ ] Exam shortcuts (1–4/Enter) work in drill page.
- [ ] Dark mode follows system preference by default; manual override persists in localStorage.
- [ ] `npm test && npm run lint && npm run build` pass.

## Risks

- Flashcard handler names (`handleFlip`, `handleRate`, etc.) must match actual function names in `page.tsx` — verify before implementing shortcuts.
- `dangerouslySetInnerHTML` in layout for theme restore: keep script minimal to avoid XSS; value comes from `localStorage`, not user input.

## Dependencies

- Batch 1 (`getCachedMastery`, `getTopCategories`) for learning path.
- Batch 1 `getWeakestSkills` for path ranking.

## Out of Scope

- Per-page theme customization.
- User-created keyboard shortcut bindings.
- Multi-language UI (add when user count warrants it).
