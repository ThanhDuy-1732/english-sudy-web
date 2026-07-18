# Supabase Sync v2 — pullFromKey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Supabase sync integration with the revised `pullFromKey` design: device identity (home key) is permanent, and importing another device's data merges it in with local-wins conflict resolution.

**Architecture:** `src/lib/sync.ts` exports fire-and-forget push functions, `initSync()` for app-load two-way sync under the home key, and a new `pullFromKey(key): Promise<number>` for user-initiated cross-device data pull. All push functions are fire-and-forget; `pullFromKey` throws on error since it is user-initiated. The home key (UUID in `localStorage["syncKey"]`) never changes — `pullFromKey` resolves aliases and fetches from an external key without touching it.

**Tech Stack:** `@supabase/supabase-js` v2, Next.js 14 App Router, TypeScript, Jest/jsdom

## Global Constraints

- Tasks 1 and 2 are already complete — do NOT redo them
- `sync_key` column type in all tables is `UUID NOT NULL` — all keys passed to Supabase must be valid UUIDs
- `"ThankZ"` (case-insensitive) resolves to `7468616e-6b7a-4000-8000-000000000000` via `KEY_ALIASES` in `sync.ts`; the alias map is the ONLY place this resolution happens
- `localStorage["syncKey"]` = home key, never overwritten by `pullFromKey`
- All push functions (`pushWord`, `deleteWord`, `pushTopic`, `pushChallenge`) are fire-and-forget — errors caught silently
- `pullFromKey` is NOT fire-and-forget — it throws on Supabase error so the Settings UI can show the user an error message
- `storage.ts`, `custom-topics.ts`, `daily-challenge.ts` function signatures must not change
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are already in `.env.local` — do NOT commit `.env.local`
- RLS is disabled on all Supabase tables — do NOT apply `supabase/migrations/002_rls_and_updated_at.sql`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| ✅ Done | `src/lib/supabase.ts` | Supabase client singleton |
| ✅ Done | `supabase/migrations/001_initial_schema.sql` | 3 tables, RLS disabled |
| Create | `src/lib/sync.ts` | getSyncKey, initSync, push\*, deleteWord, pullFromKey |
| Create | `src/lib/__tests__/sync.test.ts` | Tests for sync.ts |
| Create | `src/components/SyncInitializer.tsx` | Client component that calls initSync on mount |
| Modify | `src/app/layout.tsx` | Add `<SyncInitializer />` after `<ServiceWorkerRegistration />` |
| Modify | `src/components/Flashcard.tsx` | pushWord after saveLearnedWord; pushWord after updateWordReview |
| Modify | `src/components/ImportWords.tsx` | pushWord after saveLearnedWord |
| Modify | `src/app/history/page.tsx` | deleteWord after deleteLearnedWord |
| Modify | `src/components/TopicSelector.tsx` | pushTopic after saveCustomTopic |
| Modify | `src/app/page.tsx` | pushChallenge after setDailyComplete |
| Modify | `src/app/settings/page.tsx` | Add Sync section with pullFromKey UI |

---

### Task 3: Build `src/lib/sync.ts`

**Files:**
- Create: `src/lib/sync.ts`
- Test: `src/lib/__tests__/sync.test.ts`

**Interfaces:**
- Consumes: `supabase` from `./supabase`; `LearnedWord`, `getLearnedWords`, `saveLearnedWord` from `./storage`; `DailyChallenge` from `./daily-challenge`; `getCustomTopics`, `saveCustomTopic` from `./custom-topics`
- Produces:
  - `getSyncKey(): string`
  - `getLastSyncedAt(): string | null`
  - `pushWord(entry: LearnedWord): Promise<void>` — fire-and-forget
  - `deleteWord(word: string): Promise<void>` — fire-and-forget
  - `pushTopic(topic: string): Promise<void>` — fire-and-forget
  - `pushChallenge(record: DailyChallenge): Promise<void>` — fire-and-forget
  - `initSync(): Promise<void>` — fire-and-forget, called on app load
  - `pullFromKey(key: string): Promise<number>` — throws on error, returns count of new words added

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/sync.test.ts`:

```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

import { supabase } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

import {
  getSyncKey,
  getLastSyncedAt,
  initSync,
  pullFromKey,
} from "../sync";

const mockFrom = supabase.from as jest.Mock;

function makeFromImpl(words: unknown[] = [], topics: unknown[] = [], challenges: unknown[] = [], error: unknown = null) {
  return (table: string) => {
    const data = table === "learned_words" ? words
               : table === "custom_topics" ? topics
               : challenges;
    return {
      upsert: jest.fn().mockResolvedValue({ data: null, error }),
      delete: jest.fn(() => ({
        match: jest.fn().mockResolvedValue({ data: null, error }),
      })),
      select: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: error ? null : data, error }),
      })),
    };
  };
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });
  mockFrom.mockImplementation(makeFromImpl());
});

// --- getSyncKey ---

test("getSyncKey generates a UUID on first call", () => {
  const key = getSyncKey();
  expect(key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

test("getSyncKey returns the same key on subsequent calls", () => {
  expect(getSyncKey()).toBe(getSyncKey());
});

test("getSyncKey persists the key in localStorage", () => {
  const key = getSyncKey();
  expect(localStorage.getItem("syncKey")).toBe(key);
});

// --- getLastSyncedAt ---

test("getLastSyncedAt returns null before first sync", () => {
  expect(getLastSyncedAt()).toBeNull();
});

// --- initSync ---

test("initSync does nothing when offline", async () => {
  Object.defineProperty(navigator, "onLine", {
    value: false,
    writable: true,
    configurable: true,
  });
  await expect(initSync()).resolves.toBeUndefined();
  expect(getLastSyncedAt()).toBeNull();
});

test("initSync sets lastSyncedAt after running", async () => {
  await initSync();
  expect(getLastSyncedAt()).not.toBeNull();
});

// --- pullFromKey ---

test("pullFromKey does not change the device home key", async () => {
  const homeKey = getSyncKey();
  await pullFromKey("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  expect(localStorage.getItem("syncKey")).toBe(homeKey);
});

test("pullFromKey adds new words from external key and returns count", async () => {
  mockFrom.mockImplementation(
    makeFromImpl(
      [
        {
          word: "apple",
          meaning: "quả táo",
          example: "I eat an apple.",
          topic: "Food",
          learned_at: "2026-07-01T00:00:00.000Z",
          next_review_at: null,
          review_interval: 1,
          mastery: 0,
          synonyms: null,
          antonyms: null,
        },
      ],
      [],
      []
    )
  );
  const count = await pullFromKey("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  expect(count).toBe(1);
  const words = JSON.parse(localStorage.getItem("learnedWords") ?? "[]") as { word: string }[];
  expect(words.some((w) => w.word === "apple")).toBe(true);
});

test("pullFromKey does not overwrite existing local words (local wins)", async () => {
  localStorage.setItem(
    "learnedWords",
    JSON.stringify([
      {
        word: "apple",
        meaning: "local meaning",
        example: "local example",
        topic: "Local",
        learnedAt: "2026-07-10T00:00:00.000Z",
      },
    ])
  );
  mockFrom.mockImplementation(
    makeFromImpl(
      [
        {
          word: "apple",
          meaning: "remote meaning",
          example: "remote example",
          topic: "Remote",
          learned_at: "2026-07-15T00:00:00.000Z",
          next_review_at: null,
          review_interval: 1,
          mastery: 0,
          synonyms: null,
          antonyms: null,
        },
      ],
      [],
      []
    )
  );
  const count = await pullFromKey("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  expect(count).toBe(0);
  const words = JSON.parse(localStorage.getItem("learnedWords") ?? "[]") as { word: string; meaning: string }[];
  expect(words[0].meaning).toBe("local meaning");
});

test('pullFromKey resolves "ThankZ" alias to fixed UUID and keeps home key', async () => {
  const homeKey = getSyncKey();
  await pullFromKey("ThankZ");
  expect(localStorage.getItem("syncKey")).toBe(homeKey);
  expect(localStorage.getItem("syncKey")).not.toBe("7468616e-6b7a-4000-8000-000000000000");
  // Verify it fetched using the ThankZ UUID (not the literal string)
  expect(mockFrom).toHaveBeenCalledWith("learned_words");
  const selectCall = mockFrom.mock.results[0].value.select.mock.results[0].value;
  expect(selectCall.eq).toHaveBeenCalledWith("sync_key", "7468616e-6b7a-4000-8000-000000000000");
});

test('pullFromKey resolves "thankz" (lowercase) to the same fixed UUID', async () => {
  await pullFromKey("thankz");
  const selectCall = mockFrom.mock.results[0].value.select.mock.results[0].value;
  expect(selectCall.eq).toHaveBeenCalledWith("sync_key", "7468616e-6b7a-4000-8000-000000000000");
});

test("pullFromKey throws when Supabase returns an error", async () => {
  mockFrom.mockImplementation(makeFromImpl([], [], [], { message: "network error" }));
  await expect(pullFromKey("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).rejects.toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=sync
```

Expected: FAIL — `Cannot find module '../sync'`

- [ ] **Step 3: Implement `src/lib/sync.ts`**

Create `src/lib/sync.ts`:

```typescript
import { supabase } from "./supabase";
import { type LearnedWord, getLearnedWords, saveLearnedWord } from "./storage";
import { type DailyChallenge } from "./daily-challenge";
import { getCustomTopics, saveCustomTopic } from "./custom-topics";

const SYNC_KEY_LS = "syncKey";
const LAST_SYNCED_LS = "lastSyncedAt";

const KEY_ALIASES: Record<string, string> = {
  thankz: "7468616e-6b7a-4000-8000-000000000000",
};

export function getSyncKey(): string {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(SYNC_KEY_LS);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(SYNC_KEY_LS, key);
  }
  return key;
}

export function getLastSyncedAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNCED_LS);
}

function setLastSyncedAt() {
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_SYNCED_LS, new Date().toISOString());
  }
}

export async function pushWord(entry: LearnedWord): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  try {
    await supabase.from("learned_words").upsert({
      sync_key: syncKey,
      word: entry.word,
      meaning: entry.meaning ?? null,
      example: entry.example ?? null,
      topic: entry.topic ?? null,
      learned_at: entry.learnedAt,
      next_review_at: entry.nextReviewAt ?? null,
      review_interval: entry.reviewInterval ?? 1,
      mastery: entry.mastery ?? 0,
      synonyms: entry.synonyms ?? null,
      antonyms: entry.antonyms ?? null,
    });
  } catch { /* fire-and-forget */ }
}

export async function deleteWord(word: string): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  try {
    await supabase.from("learned_words").delete().match({ sync_key: syncKey, word });
  } catch { /* fire-and-forget */ }
}

export async function pushTopic(topic: string): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  try {
    await supabase.from("custom_topics").upsert({ sync_key: syncKey, topic });
  } catch { /* fire-and-forget */ }
}

export async function pushChallenge(record: DailyChallenge): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  try {
    await supabase.from("daily_challenges").upsert({
      sync_key: syncKey,
      date: record.date,
      words: record.words,
      completed: record.completed,
    });
  } catch { /* fire-and-forget */ }
}

export async function initSync(): Promise<void> {
  if (typeof window === "undefined" || !navigator.onLine) return;
  const syncKey = getSyncKey();

  try {
    const localWords = getLearnedWords();
    if (localWords.length > 0) {
      await supabase.from("learned_words").upsert(
        localWords.map((w) => ({
          sync_key: syncKey,
          word: w.word,
          meaning: w.meaning ?? null,
          example: w.example ?? null,
          topic: w.topic ?? null,
          learned_at: w.learnedAt,
          next_review_at: w.nextReviewAt ?? null,
          review_interval: w.reviewInterval ?? 1,
          mastery: w.mastery ?? 0,
          synonyms: w.synonyms ?? null,
          antonyms: w.antonyms ?? null,
        }))
      );
    }

    const localTopics = getCustomTopics();
    if (localTopics.length > 0) {
      await supabase
        .from("custom_topics")
        .upsert(localTopics.map((t) => ({ sync_key: syncKey, topic: t })));
    }

    const rawChallenges = localStorage.getItem("dailyChallenge");
    const localChallenges: DailyChallenge[] = rawChallenges
      ? (JSON.parse(rawChallenges) as DailyChallenge[])
      : [];
    if (localChallenges.length > 0) {
      await supabase.from("daily_challenges").upsert(
        localChallenges.map((c) => ({
          sync_key: syncKey,
          date: c.date,
          words: c.words,
          completed: c.completed,
        }))
      );
    }

    const { data: remoteWords } = await supabase
      .from("learned_words")
      .select("*")
      .eq("sync_key", syncKey);

    if (remoteWords && remoteWords.length > 0) {
      const wordMap = new Map(localWords.map((w) => [w.word.toLowerCase(), w]));
      for (const row of remoteWords) {
        const existing = wordMap.get((row.word as string).toLowerCase());
        if (!existing || new Date(row.learned_at as string) > new Date(existing.learnedAt)) {
          wordMap.set((row.word as string).toLowerCase(), {
            word: row.word as string,
            meaning: (row.meaning as string) ?? "",
            example: (row.example as string) ?? "",
            topic: (row.topic as string) ?? "",
            learnedAt: row.learned_at as string,
            nextReviewAt: (row.next_review_at as string | null) ?? undefined,
            reviewInterval: (row.review_interval as number) ?? 1,
            mastery: (row.mastery as number) ?? 0,
            synonyms: (row.synonyms as string[] | null) ?? undefined,
            antonyms: (row.antonyms as string[] | null) ?? undefined,
          });
        }
      }
      localStorage.setItem("learnedWords", JSON.stringify(Array.from(wordMap.values())));
    }

    const { data: remoteTopics } = await supabase
      .from("custom_topics")
      .select("topic")
      .eq("sync_key", syncKey);

    if (remoteTopics) {
      remoteTopics.forEach((row) => saveCustomTopic(row.topic as string));
    }

    const { data: remoteChallenges } = await supabase
      .from("daily_challenges")
      .select("*")
      .eq("sync_key", syncKey);

    if (remoteChallenges && remoteChallenges.length > 0) {
      const challengeMap = new Map(localChallenges.map((c) => [c.date, c]));
      for (const row of remoteChallenges) {
        if (!challengeMap.has(row.date as string) || (row.completed as boolean)) {
          challengeMap.set(row.date as string, {
            date: row.date as string,
            words: row.words as string[],
            completed: row.completed as boolean,
          });
        }
      }
      localStorage.setItem(
        "dailyChallenge",
        JSON.stringify(Array.from(challengeMap.values()))
      );
    }

    setLastSyncedAt();
  } catch { /* fire-and-forget */ }
}

export async function pullFromKey(key: string): Promise<number> {
  if (typeof window === "undefined") return 0;
  const trimmed = key.trim();
  const resolved = KEY_ALIASES[trimmed.toLowerCase()] ?? trimmed;

  const [wordsResult, topicsResult, challengesResult] = await Promise.all([
    supabase.from("learned_words").select("*").eq("sync_key", resolved),
    supabase.from("custom_topics").select("topic").eq("sync_key", resolved),
    supabase.from("daily_challenges").select("*").eq("sync_key", resolved),
  ]);

  if (wordsResult.error) throw wordsResult.error;
  if (topicsResult.error) throw topicsResult.error;
  if (challengesResult.error) throw challengesResult.error;

  let newWordsCount = 0;

  if (wordsResult.data) {
    const localWords = getLearnedWords();
    const localWordSet = new Set(localWords.map((w) => w.word.toLowerCase()));
    for (const row of wordsResult.data) {
      if (!localWordSet.has((row.word as string).toLowerCase())) {
        saveLearnedWord({
          word: row.word as string,
          meaning: (row.meaning as string) ?? "",
          example: (row.example as string) ?? "",
          topic: (row.topic as string) ?? "",
          learnedAt: row.learned_at as string,
          nextReviewAt: (row.next_review_at as string | null) ?? undefined,
          reviewInterval: (row.review_interval as number) ?? 1,
          mastery: (row.mastery as number) ?? 0,
          synonyms: (row.synonyms as string[] | null) ?? undefined,
          antonyms: (row.antonyms as string[] | null) ?? undefined,
        });
        newWordsCount++;
      }
    }
  }

  if (topicsResult.data) {
    topicsResult.data.forEach((row) => saveCustomTopic(row.topic as string));
  }

  if (challengesResult.data && challengesResult.data.length > 0) {
    const rawChallenges = localStorage.getItem("dailyChallenge");
    const localChallenges: DailyChallenge[] = rawChallenges
      ? (JSON.parse(rawChallenges) as DailyChallenge[])
      : [];
    const localDates = new Set(localChallenges.map((c) => c.date));
    const newChallenges = challengesResult.data
      .filter((row) => !localDates.has(row.date as string))
      .map((row) => ({
        date: row.date as string,
        words: row.words as string[],
        completed: row.completed as boolean,
      }));
    if (newChallenges.length > 0) {
      localStorage.setItem(
        "dailyChallenge",
        JSON.stringify([...localChallenges, ...newChallenges])
      );
    }
  }

  return newWordsCount;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=sync
```

Expected: all 12 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync.ts src/lib/__tests__/sync.test.ts
git commit -m "feat: add sync.ts with initSync, push functions, and pullFromKey"
```

---

### Task 4: Wire `initSync` into app layout

**Files:**
- Create: `src/components/SyncInitializer.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `initSync` from `@/lib/sync`
- Produces: `SyncInitializer` — client component that fires `initSync` on mount

- [ ] **Step 1: Create `SyncInitializer.tsx`**

Create `src/components/SyncInitializer.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { initSync } from "@/lib/sync";

export function SyncInitializer() {
  useEffect(() => {
    void initSync();
  }, []);
  return null;
}
```

- [ ] **Step 2: Add `<SyncInitializer />` to `src/app/layout.tsx`**

Add the import at line 4, after the existing component imports:

```typescript
import { SyncInitializer } from "@/components/SyncInitializer";
```

Then in the JSX, add `<SyncInitializer />` directly after the existing `<ServiceWorkerRegistration />` at line 95:

```tsx
          <ServiceWorkerRegistration />
          <SyncInitializer />
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SyncInitializer.tsx src/app/layout.tsx
git commit -m "feat: call initSync on app load via SyncInitializer"
```

---

### Task 5: Wire push calls at storage call sites

**Files:**
- Modify: `src/components/Flashcard.tsx`
- Modify: `src/components/ImportWords.tsx`
- Modify: `src/app/history/page.tsx`
- Modify: `src/components/TopicSelector.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `pushWord`, `deleteWord`, `pushTopic`, `pushChallenge` from `@/lib/sync`

- [ ] **Step 1: Update `src/components/Flashcard.tsx`**

Add `pushWord` and `getLearnedWords` to the existing storage import, and add the sync import at line 4:

```typescript
import { saveLearnedWord, updateWordReview, getLearnedWords } from "@/lib/storage";
import { pushWord } from "@/lib/sync";
```

In `handleSave` (around line 120), change the `if (didSave) setSaved(true);` line to:

```typescript
    if (didSave) {
      setSaved(true);
      void pushWord({
        word,
        meaning,
        example,
        topic,
        learnedAt: new Date().toISOString(),
        synonyms: synonymData?.synonyms,
        antonyms: synonymData?.antonyms,
      });
    }
```

In the "Nhớ tốt" button `onClick` (around line 216), change to:

```typescript
                onClick={(e) => {
                  e.stopPropagation();
                  updateWordReview(word, true);
                  const updated = getLearnedWords().find((w) => w.word === word);
                  if (updated) void pushWord(updated);
                  onReviewed?.();
                }}
```

In the "Quên" button `onClick` (around line 228), change to:

```typescript
                onClick={(e) => {
                  e.stopPropagation();
                  updateWordReview(word, false);
                  const updated = getLearnedWords().find((w) => w.word === word);
                  if (updated) void pushWord(updated);
                  onReviewed?.();
                }}
```

- [ ] **Step 2: Update `src/components/ImportWords.tsx`**

Add sync import at line 4, after existing imports:

```typescript
import { pushWord } from "@/lib/sync";
```

In `saveSelected` (around line 33), change the `if (saveLearnedWord(entry)) count += 1;` line to:

```typescript
      if (saveLearnedWord(entry)) {
        count += 1;
        void pushWord(entry);
      }
```

- [ ] **Step 3: Update `src/app/history/page.tsx`**

Add sync import after the existing storage import at line 4:

```typescript
import { deleteWord } from "@/lib/sync";
```

In `handleDelete` (around line 19), add `void deleteWord(word);` immediately after `deleteLearnedWord(word);`:

```typescript
  function handleDelete(word: string) {
    deleteLearnedWord(word);
    void deleteWord(word);
    const nextWords = words.filter((w) => w.word !== word);
    setWords(nextWords);
    if (filter !== "Tất cả" && !nextWords.some((entry) => entry.topic === filter)) {
      setFilter("Tất cả");
    }
  }
```

- [ ] **Step 4: Update `src/components/TopicSelector.tsx`**

Add sync import after the existing custom-topics import at line 4:

```typescript
import { pushTopic } from "@/lib/sync";
```

In `addTopic` (around line 19), add `void pushTopic(topic);` after `saveCustomTopic(topic);`:

```typescript
  function addTopic() {
    const topic = inputValue.trim();
    if (!topic) return;
    saveCustomTopic(topic);
    void pushTopic(topic);
    setCustomTopics(getCustomTopics());
    onChange(topic);
    setInputValue("");
  }
```

- [ ] **Step 5: Update `src/app/page.tsx`**

Add sync import after the existing daily-challenge import at line 8:

```typescript
import { pushChallenge } from "@/lib/sync";
```

In `completeDailyChallenge` (around line 96), change to:

```typescript
  function completeDailyChallenge() {
    if (words.length === 0 || flippedCount < words.length || dailyCompleted) return;
    const wordList = words.map((w) => w.word);
    setDailyComplete(wordList);
    void pushChallenge({ date: new Date().toISOString().slice(0, 10), words: wordList, completed: true });
    setDailyCompleted(true);
    setStreak(getStreak());
  }
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/Flashcard.tsx src/components/ImportWords.tsx src/app/history/page.tsx src/components/TopicSelector.tsx src/app/page.tsx
git commit -m "feat: wire Supabase push calls at all storage write sites"
```

---

### Task 6: Add Sync section to Settings page

**Files:**
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `getSyncKey`, `getLastSyncedAt`, `pullFromKey` from `@/lib/sync`

- [ ] **Step 1: Replace `src/app/settings/page.tsx`**

Replace the entire file contents with:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useProvider } from "@/contexts/ProviderContext";
import { getSyncKey, getLastSyncedAt, pullFromKey } from "@/lib/sync";

const ALL_PROVIDERS = [
  { id: "gemini", name: "Gemini Flash", model: "gemini-flash-latest", envKey: "GEMINI_API_KEY" },
  { id: "groq", name: "Groq", model: "llama-3.3-70b-versatile", envKey: "GROQ_API_KEY" },
  { id: "huggingface", name: "HuggingFace", model: "mistralai/Mistral-7B-v0.1", envKey: "HUGGINGFACE_API_KEY" },
];

export default function SettingsPage() {
  const { currentProvider, availableProviders, setProvider } = useProvider();
  const [syncKey, setSyncKey] = useState("");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [pullInput, setPullInput] = useState("");
  const [pulling, setPulling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pullSuccess, setPullSuccess] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);

  useEffect(() => {
    setSyncKey(getSyncKey());
    setLastSynced(getLastSyncedAt());
  }, []);

  const isActive = (id: string) => availableProviders.some((p) => p.id === id);

  function handleCopy() {
    navigator.clipboard.writeText(syncKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handlePull() {
    const trimmed = pullInput.trim();
    if (!trimmed) return;
    setPulling(true);
    setPullSuccess(null);
    setPullError(null);
    try {
      const count = await pullFromKey(trimmed);
      setPullSuccess(
        count > 0 ? `${count} từ mới được thêm vào thiết bị này.` : "Đồng bộ xong. Không có từ mới."
      );
      setPullInput("");
    } catch {
      setPullError("Không thể kết nối. Kiểm tra kết nối mạng và thử lại.");
    } finally {
      setPulling(false);
    }
  }

  function formatSynced(iso: string | null) {
    if (!iso) return "Chưa đồng bộ";
    const d = new Date(iso);
    return `Đã đồng bộ lúc ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-10">
      <div>
        <h1 className="mb-2 font-display text-3xl font-bold text-[#d9ecff]">Cài đặt</h1>
        <p className="mb-8 text-sm text-[#b0b0d1]">
          Quản lý AI provider. Provider được kích hoạt khi có API key trong{" "}
          <code className="rounded bg-white/10 px-1">.env.local</code>.
        </p>

        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left">
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Provider</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Model</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {ALL_PROVIDERS.map((p) => {
                const active = isActive(p.id);
                const isCurrent = p.id === currentProvider;
                return (
                  <tr key={p.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-4 font-medium text-white">{p.name}</td>
                    <td className="px-4 py-4 font-mono text-xs text-[#b0b0d1]">
                      {active ? (availableProviders.find((ap) => ap.id === p.id)?.model ?? p.model) : p.model}
                    </td>
                    <td className="px-4 py-4">
                      {active ? (
                        <span className="inline-flex items-center gap-1 text-green-400">✅ Active</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-yellow-400">⚠️ Chưa cấu hình</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {active ? (
                        isCurrent ? (
                          <span className="text-[#d9ecff]">✓ Đang dùng</span>
                        ) : (
                          <button
                            onClick={() => setProvider(p.id)}
                            className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
                          >
                            Dùng cái này
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-[#b0b0d1]">
                          Thêm <code className="rounded bg-white/5 px-1">{p.envKey}</code> vào .env.local
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sync section */}
      <div>
        <h2 className="mb-2 font-display text-xl font-bold text-[#d9ecff]">Đồng bộ dữ liệu</h2>
        <p className="mb-6 text-sm text-[#b0b0d1]">
          Dùng sync key để backup và đồng bộ dữ liệu giữa các thiết bị. Không cần đăng nhập.
        </p>

        <div className="space-y-6 rounded-xl border border-white/10 p-6">
          {/* Home key display */}
          <div>
            <p className="mb-2 text-sm font-medium text-[#d9ecff]">Sync Key của thiết bị này</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-[#b0b0d1] overflow-hidden text-ellipsis">
                {syncKey ? `${syncKey.slice(0, 8)}••••••••••••••••••••••••••••` : "Đang tải..."}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20"
              >
                {copied ? "Đã copy!" : "Copy full key"}
              </button>
            </div>
            <p className="mt-1 text-xs text-[#b0b0d1]">{formatSynced(lastSynced)}</p>
          </div>

          {/* Pull from another device */}
          <div>
            <p className="mb-2 text-sm font-medium text-[#d9ecff]">Lấy dữ liệu từ thiết bị khác</p>
            <p className="mb-3 text-xs text-[#b0b0d1]">
              Nhập sync key của thiết bị khác để thêm từ vựng của thiết bị đó vào đây.
              Dữ liệu hiện tại trên thiết bị này sẽ không bị mất.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={pullInput}
                onChange={(e) => setPullInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handlePull(); }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx hoặc ThankZ"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder-[#b0b0d1] focus:border-white/30 focus:outline-none"
              />
              <button
                onClick={() => void handlePull()}
                disabled={pulling || !pullInput.trim()}
                className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20 disabled:opacity-50"
              >
                {pulling ? "Đang lấy..." : "Pull data"}
              </button>
            </div>
            {pullSuccess && (
              <p className="mt-2 text-sm font-medium text-green-400">{pullSuccess}</p>
            )}
            {pullError && (
              <p className="mt-2 text-sm font-medium text-red-400">{pullError}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add Sync section to Settings page with pullFromKey UI"
```

---

## Self-Review

**Spec coverage:**
- ✅ Home key (UUID) never changes — `getSyncKey()` only generates if absent, never overwritten
- ✅ `pullFromKey` resolves "ThankZ" alias → UUID, fetches from that UUID — `KEY_ALIASES` in sync.ts
- ✅ Local wins on merge — `pullFromKey` skips words already in `localWordSet`
- ✅ `pullFromKey` throws on Supabase error — Settings UI shows `pullError` message
- ✅ `pullFromKey` returns count of new words — displayed in `pullSuccess` message
- ✅ All push functions fire-and-forget — try/catch with empty catch blocks
- ✅ `initSync` skips when offline — `!navigator.onLine` guard
- ✅ `initSync` two-way merge under home key — push then pull phases
- ✅ Settings: show home key (truncated) + copy button — `syncKey.slice(0, 8)` + clipboard
- ✅ Settings: last synced timestamp — `formatSynced(lastSynced)`
- ✅ Push wired at all write sites — Flashcard (save + review), ImportWords, history, TopicSelector, page.tsx

**Type consistency:**
- `pullFromKey(key: string): Promise<number>` — Settings calls it, awaits number, shows in `pullSuccess`
- `pushWord(entry: LearnedWord)` — all call sites pass full `LearnedWord` shape
- `pushChallenge(record: DailyChallenge)` — page.tsx constructs `{ date, words, completed }` matching `DailyChallenge`
- `deleteWord(word: string)` — history/page.tsx passes `word` string from `handleDelete(word: string)`
