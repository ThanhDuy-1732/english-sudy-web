# Supabase Sync Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase as an offline-first cloud sync layer so vocabulary data persists across devices using a shared UUID sync key, with no login required.

**Architecture:** localStorage stays as the source of truth and is written to instantly on every user action. A new `sync.ts` layer runs Supabase upserts in the background (fire-and-forget). On app load, `initSync()` does a two-way merge: push local → Supabase, then pull Supabase → localStorage to catch data from other devices.

**Tech Stack:** `@supabase/supabase-js`, Next.js 14 App Router, TypeScript, Jest/jsdom

## Global Constraints

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must be set in `.env.local`
- All sync functions must be fire-and-forget — errors caught silently; offline must never break the UI
- `storage.ts`, `custom-topics.ts`, `daily-challenge.ts` interfaces (function signatures/return types) must not change
- Sync key stored under `localStorage["syncKey"]`; last sync timestamp under `localStorage["lastSyncedAt"]`
- RLS disabled on all three Supabase tables (sync key is the access control)
- `sync_key` is `UUID` in the database; human-readable alias `"ThankZ"` resolves to the fixed UUID `7468616e-6b7a-4000-8000-000000000000` inside `importSyncKey()` before any Supabase call

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/supabase.ts` | Supabase client singleton |
| Create | `src/lib/sync.ts` | All sync logic: getSyncKey, initSync, push\*, deleteWord, importSyncKey |
| Create | `src/lib/__tests__/sync.test.ts` | Tests for sync.ts |
| Create | `src/components/SyncInitializer.tsx` | Client component that calls initSync on mount |
| Modify | `src/app/layout.tsx` | Add `<SyncInitializer />` inside ProviderContextProvider |
| Modify | `src/components/Flashcard.tsx` | Call pushWord after saveLearnedWord and updateWordReview |
| Modify | `src/components/ImportWords.tsx` | Call pushWord after saveLearnedWord |
| Modify | `src/app/history/page.tsx` | Call deleteWord after deleteLearnedWord |
| Modify | `src/components/TopicSelector.tsx` | Call pushTopic after saveCustomTopic |
| Modify | `src/app/page.tsx` | Call pushChallenge after setDailyComplete |
| Modify | `src/app/settings/page.tsx` | Add Sync section: show key, import key, last synced |
| Create | `supabase/migrations/001_initial_schema.sql` | SQL to create the 3 tables |

---

### Task 1: Install Supabase client and create the client singleton

**Files:**
- Create: `src/lib/supabase.ts`

**Interfaces:**
- Produces: `supabase` — a `SupabaseClient` singleton, imported by `sync.ts`

- [ ] **Step 1: Install the package**

```bash
npm install @supabase/supabase-js
```

Expected: package added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Add environment variables to `.env.local`**

Open `.env.local` and add:

```
NEXT_PUBLIC_SUPABASE_URL=https://qmxsdqyrjmitwdwpjifn.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

- [ ] **Step 3: Create the Supabase client file**

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.ts package.json package-lock.json .env.local
git commit -m "feat: add Supabase client singleton"
```

Note: `.env.local` is gitignored by default in Next.js — confirm it's not being committed (`git status` should not show it).

---

### Task 2: Create Supabase tables

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Interfaces:**
- Produces: tables `learned_words`, `custom_topics`, `daily_challenges` in Supabase

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS learned_words (
  sync_key        UUID        NOT NULL,
  word            TEXT        NOT NULL,
  meaning         TEXT,
  example         TEXT,
  topic           TEXT,
  learned_at      TIMESTAMPTZ NOT NULL,
  next_review_at  TIMESTAMPTZ,
  review_interval INT         DEFAULT 1,
  mastery         INT         DEFAULT 0,
  synonyms        TEXT[],
  antonyms        TEXT[],
  PRIMARY KEY (sync_key, word)
);

CREATE TABLE IF NOT EXISTS custom_topics (
  sync_key  UUID NOT NULL,
  topic     TEXT NOT NULL,
  PRIMARY KEY (sync_key, topic)
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  sync_key   UUID    NOT NULL,
  date       DATE    NOT NULL,
  words      TEXT[],
  completed  BOOLEAN DEFAULT false,
  PRIMARY KEY (sync_key, date)
);

ALTER TABLE learned_words  DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_topics  DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges DISABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Run the SQL in the Supabase dashboard**

Open your Supabase project → SQL Editor → paste the contents of `001_initial_schema.sql` → Run.

Expected: 3 tables created, no errors.

- [ ] **Step 3: Verify tables exist**

In Supabase → Table Editor, confirm `learned_words`, `custom_topics`, `daily_challenges` all appear.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add Supabase schema migration for sync tables"
```

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
  - `pushWord(entry: LearnedWord): Promise<void>`
  - `deleteWord(word: string): Promise<void>`
  - `pushTopic(topic: string): Promise<void>`
  - `pushChallenge(record: DailyChallenge): Promise<void>`
  - `initSync(): Promise<void>`
  - `importSyncKey(key: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/sync.test.ts`:

```typescript
// Mock env vars before importing sync
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

// Mock supabase — must be called before importing sync
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      delete: jest.fn(() => ({
        match: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
      select: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  },
}));

import { getSyncKey, getLastSyncedAt, initSync, importSyncKey } from "../sync";

beforeEach(() => {
  localStorage.clear();
  // Simulate online
  Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
});

test("getSyncKey generates a UUID on first call", () => {
  const key = getSyncKey();
  expect(key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

test("getSyncKey returns the same key on subsequent calls", () => {
  const first = getSyncKey();
  const second = getSyncKey();
  expect(first).toBe(second);
});

test("getSyncKey persists the key in localStorage", () => {
  const key = getSyncKey();
  expect(localStorage.getItem("syncKey")).toBe(key);
});

test("getLastSyncedAt returns null before first sync", () => {
  expect(getLastSyncedAt()).toBeNull();
});

test("initSync does nothing when offline", async () => {
  Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
  // Should not throw
  await expect(initSync()).resolves.toBeUndefined();
  expect(getLastSyncedAt()).toBeNull();
});

test("initSync sets lastSyncedAt after running", async () => {
  await initSync();
  expect(getLastSyncedAt()).not.toBeNull();
});

test("importSyncKey replaces the stored sync key", async () => {
  const originalKey = getSyncKey();
  const newKey = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  await importSyncKey(newKey);
  expect(localStorage.getItem("syncKey")).toBe(newKey);
  expect(localStorage.getItem("syncKey")).not.toBe(originalKey);
});

test("importSyncKey clears learnedWords from localStorage", async () => {
  localStorage.setItem("learnedWords", JSON.stringify([{ word: "test" }]));
  await importSyncKey("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  expect(localStorage.getItem("learnedWords")).toBeNull();
});

test('importSyncKey resolves "ThankZ" alias to fixed UUID', async () => {
  await importSyncKey("ThankZ");
  expect(localStorage.getItem("syncKey")).toBe("7468616e-6b7a-4000-8000-000000000000");
});

test('importSyncKey resolves "ThankZ" case-insensitively', async () => {
  await importSyncKey("thankz");
  expect(localStorage.getItem("syncKey")).toBe("7468616e-6b7a-4000-8000-000000000000");
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
import { type LearnedWord, getLearnedWords } from "./storage";
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
    // --- Push phase ---
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

    // --- Pull phase ---
    const { data: remoteWords } = await supabase
      .from("learned_words")
      .select("*")
      .eq("sync_key", syncKey);

    if (remoteWords && remoteWords.length > 0) {
      const wordMap = new Map(localWords.map((w) => [w.word.toLowerCase(), w]));
      for (const row of remoteWords) {
        const existing = wordMap.get(row.word.toLowerCase());
        if (!existing || new Date(row.learned_at) > new Date(existing.learnedAt)) {
          wordMap.set(row.word.toLowerCase(), {
            word: row.word,
            meaning: row.meaning ?? "",
            example: row.example ?? "",
            topic: row.topic ?? "",
            learnedAt: row.learned_at,
            nextReviewAt: row.next_review_at ?? undefined,
            reviewInterval: row.review_interval ?? 1,
            mastery: row.mastery ?? 0,
            synonyms: row.synonyms ?? undefined,
            antonyms: row.antonyms ?? undefined,
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

export async function importSyncKey(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  const trimmed = key.trim();
  const resolved = KEY_ALIASES[trimmed.toLowerCase()] ?? trimmed;
  localStorage.setItem(SYNC_KEY_LS, resolved);
  localStorage.removeItem("learnedWords");
  localStorage.removeItem("customTopics");
  localStorage.removeItem("dailyChallenge");
  await initSync();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=sync
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync.ts src/lib/__tests__/sync.test.ts
git commit -m "feat: add sync.ts with Supabase offline-first sync layer"
```

---

### Task 4: Wire `initSync` into app layout

**Files:**
- Create: `src/components/SyncInitializer.tsx`
- Modify: `src/app/layout.tsx` — add `<SyncInitializer />` inside `ProviderContextProvider`

**Interfaces:**
- Consumes: `initSync` from `@/lib/sync`
- Produces: `SyncInitializer` — a client component that fires `initSync` on mount

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

- [ ] **Step 2: Add `<SyncInitializer />` to layout**

In `src/app/layout.tsx`, add the import and place the component inside `ProviderContextProvider`, alongside the existing `<ServiceWorkerRegistration />`:

```typescript
// Add this import after the existing imports
import { SyncInitializer } from "@/components/SyncInitializer";
```

Then inside the JSX, after `<ServiceWorkerRegistration />`:

```tsx
          <ServiceWorkerRegistration />
          <SyncInitializer />
```

The full `ProviderContextProvider` block ends up like:

```tsx
        <ProviderContextProvider>
          <nav ...>...</nav>
          {children}
          <footer ...>...</footer>
          <ServiceWorkerRegistration />
          <SyncInitializer />
        </ProviderContextProvider>
```

- [ ] **Step 3: Run TypeScript check**

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
git commit -m "feat: call initSync on app load via SyncInitializer component"
```

---

### Task 5: Wire push calls at storage call sites

**Files:**
- Modify: `src/components/Flashcard.tsx:4,123,218,230`
- Modify: `src/components/ImportWords.tsx:4,37`
- Modify: `src/app/history/page.tsx:5,20`
- Modify: `src/components/TopicSelector.tsx:4,22`
- Modify: `src/app/page.tsx:8,98`

**Interfaces:**
- Consumes: `pushWord`, `deleteWord`, `pushTopic`, `pushChallenge` from `@/lib/sync`

**Note on `updateWordReview`:** This function returns `void` and modifies the word in-place. After calling it, read the updated entry from `getLearnedWords()` and push it to Supabase.

- [ ] **Step 1: Update `Flashcard.tsx`**

Add import at the top (existing import on line 4):

```typescript
import { saveLearnedWord, updateWordReview, getLearnedWords } from "@/lib/storage";
import { pushWord } from "@/lib/sync";
```

In `handleSave` (around line 123), after `if (didSave) setSaved(true);`, add:

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

Replace the two `updateWordReview` call sites (around lines 218 and 230). The "Nhớ tốt" button's onClick:

```typescript
                onClick={(e) => {
                  e.stopPropagation();
                  updateWordReview(word, true);
                  const updated = getLearnedWords().find((w) => w.word === word);
                  if (updated) void pushWord(updated);
                  onReviewed?.();
                }}
```

The "Quên" button's onClick:

```typescript
                onClick={(e) => {
                  e.stopPropagation();
                  updateWordReview(word, false);
                  const updated = getLearnedWords().find((w) => w.word === word);
                  if (updated) void pushWord(updated);
                  onReviewed?.();
                }}
```

- [ ] **Step 2: Update `ImportWords.tsx`**

Add import (top of file, alongside existing imports):

```typescript
import { pushWord } from "@/lib/sync";
```

In `saveSelected` (around line 37), change the `saveLearnedWord` call:

```typescript
      if (saveLearnedWord(entry)) {
        count += 1;
        void pushWord(entry);
      }
```

- [ ] **Step 3: Update `history/page.tsx`**

Add import (alongside the existing `deleteLearnedWord` import):

```typescript
import { deleteWord } from "@/lib/sync";
```

In `handleDelete` (around line 20), after `deleteLearnedWord(word);`:

```typescript
    deleteLearnedWord(word);
    void deleteWord(word);
```

- [ ] **Step 4: Update `TopicSelector.tsx`**

Add import (top of file):

```typescript
import { pushTopic } from "@/lib/sync";
```

In `addTopic` (around line 22), after `saveCustomTopic(topic);`:

```typescript
    saveCustomTopic(topic);
    void pushTopic(topic);
```

- [ ] **Step 5: Update `page.tsx`**

Add sync import (top of file, alongside existing imports from daily-challenge):

```typescript
import { pushChallenge } from "@/lib/sync";
```

In `completeDailyChallenge` (around line 98), after `setDailyComplete(...)`:

```typescript
    const wordList = words.map((word) => word.word);
    setDailyComplete(wordList);
    void pushChallenge({ date: new Date().toISOString().slice(0, 10), words: wordList, completed: true });
    setDailyCompleted(true);
    setStreak(getStreak());
```

- [ ] **Step 6: Run TypeScript check**

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
- Consumes: `getSyncKey`, `getLastSyncedAt`, `importSyncKey` from `@/lib/sync`

- [ ] **Step 1: Update `settings/page.tsx`**

Replace the full contents of `src/app/settings/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useProvider } from "@/contexts/ProviderContext";
import { getSyncKey, getLastSyncedAt, importSyncKey } from "@/lib/sync";

const ALL_PROVIDERS = [
  { id: "gemini", name: "Gemini Flash", model: "gemini-flash-latest", envKey: "GEMINI_API_KEY" },
  { id: "groq", name: "Groq", model: "llama-3.3-70b-versatile", envKey: "GROQ_API_KEY" },
  { id: "huggingface", name: "HuggingFace", model: "mistralai/Mistral-7B-v0.1", envKey: "HUGGINGFACE_API_KEY" },
];

export default function SettingsPage() {
  const { currentProvider, availableProviders, setProvider } = useProvider();
  const [syncKey, setSyncKey] = useState("");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [importValue, setImportValue] = useState("");
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

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

  async function handleImport() {
    const trimmed = importValue.trim();
    if (!trimmed) return;
    setImporting(true);
    await importSyncKey(trimmed);
    setSyncKey(getSyncKey());
    setLastSynced(getLastSyncedAt());
    setImportValue("");
    setImporting(false);
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

        <div className="space-y-4 rounded-xl border border-white/10 p-6">
          {/* Current key display */}
          <div>
            <p className="mb-2 text-sm font-medium text-[#d9ecff]">Sync Key của thiết bị này</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-[#b0b0d1]">
                {syncKey ? `${syncKey.slice(0, 8)}••••••••••••••••••••••••••••` : "Đang tải..."}
              </code>
              <button
                onClick={handleCopy}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20"
              >
                {copied ? "Đã copy!" : "Copy full key"}
              </button>
            </div>
            <p className="mt-1 text-xs text-[#b0b0d1]">{formatSynced(lastSynced)}</p>
          </div>

          {/* Import key */}
          <div>
            <p className="mb-2 text-sm font-medium text-[#d9ecff]">Liên kết thiết bị mới</p>
            <p className="mb-3 text-xs text-[#b0b0d1]">
              Dán sync key từ thiết bị khác để đồng bộ toàn bộ dữ liệu về đây.
              <strong className="text-yellow-400"> Lưu ý: dữ liệu hiện tại trên thiết bị này sẽ bị thay thế.</strong>
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder-[#b0b0d1] focus:border-white/30 focus:outline-none"
              />
              <button
                onClick={handleImport}
                disabled={importing || !importValue.trim()}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20 disabled:opacity-50"
              >
                {importing ? "Đang đồng bộ..." : "Liên kết"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

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
git commit -m "feat: add Sync section to Settings page with key display and import"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Sync key generated as UUID, stored in localStorage — Task 1 + Task 3 (`getSyncKey`)
- ✅ `initSync()` two-way merge (push then pull) — Task 3
- ✅ `learned_words` merge: later `learned_at` wins — Task 3 `initSync` pull phase
- ✅ `daily_challenges` merge: Supabase wins for completed records — Task 3 `initSync` pull phase
- ✅ `custom_topics` merge: union — Task 3 (`saveCustomTopic` is idempotent so union is automatic)
- ✅ All push functions are fire-and-forget — Task 3 (try/catch silently)
- ✅ `saveLearnedWord` → `pushWord` — Task 5 (Flashcard, ImportWords)
- ✅ `updateWordReview` → `pushWord` — Task 5 (Flashcard)
- ✅ `deleteLearnedWord` → `deleteWord` — Task 5 (history/page)
- ✅ `saveCustomTopic` → `pushTopic` — Task 5 (TopicSelector)
- ✅ `setDailyComplete` → `pushChallenge` — Task 5 (page.tsx)
- ✅ `initSync()` called on app load — Task 4 (SyncInitializer)
- ✅ Settings: show sync key, import key, last synced — Task 6
- ✅ `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env vars — Task 1
- ✅ Storage function interfaces unchanged — Tasks 3–5 (only callers modified)

**Type consistency:** `pushChallenge` takes `DailyChallenge` which is `{ date: string; words: string[]; completed: boolean }` — the call in Task 5 `page.tsx` constructs this correctly. `pushWord` takes `LearnedWord` — all call sites pass the full `LearnedWord` shape.
