# S1 — Fix Sync LWW Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a data-loss bug where SM-2 review progress is silently overwritten during multi-device sync, by switching from `learnedAt`-based merge to LWW (`updatedAt`) with pull-before-push ordering.

**Architecture:** Add `updatedAt` to `LearnedWord` (set on every mutation, NOT on `migrateToSm2`). Extract a pure `mergeLww` function to `src/lib/sync-merge.ts`. Rewrite `initSync` to pull first, merge, then push only the diff. Add Supabase migration for new columns.

**Tech Stack:** TypeScript, Supabase (supabase-js), Jest

**Spec:** `docs/requirement/PLAN_PHASE_6_7_COMPLETION.md` — section S1

## Global Constraints

- Next.js 14 App Router, TypeScript strict
- `localStorage` remains primary storage
- Client must never import `src/lib/providers/`
- No new npm dependencies
- `migrateToSm2` must NOT set `updatedAt` (migration ≠ user action)
- `npm test && npm run lint && npm run build` must pass after every commit

---

### Task 1: Supabase migration — add SM-2 + updatedAt columns

**Files:**
- Create: `supabase/migrations/20260921_sm2_updated_at.sql`

**Interfaces:**
- Produces: `learned_words` table gains columns `easiness`, `repetitions`, `review_interval`, `next_review_at`, `mastery`, `updated_at`

- [ ] **Step 1: Write migration SQL**

```sql
-- supabase/migrations/20260921_sm2_updated_at.sql
alter table learned_words add column if not exists easiness      numeric default 2.5;
alter table learned_words add column if not exists repetitions   int     default 0;
alter table learned_words add column if not exists review_interval int;
alter table learned_words add column if not exists next_review_at timestamptz;
alter table learned_words add column if not exists mastery       int;
alter table learned_words add column if not exists updated_at    timestamptz;

update learned_words
  set updated_at = coalesce(updated_at, (learned_at::text)::timestamptz)
  where updated_at is null;
```

- [ ] **Step 2: Verify file exists**

```bash
ls supabase/migrations/20260921_sm2_updated_at.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260921_sm2_updated_at.sql
git commit -m "feat(sync): add SM-2 + updatedAt columns to learned_words"
```

---

### Task 2: Add `updatedAt` to `LearnedWord` + `touch()` helper

**Files:**
- Modify: `src/lib/storage.ts`

**Interfaces:**
- Produces: `LearnedWord.updatedAt?: string`, `touch<T>(x: T): T` exported from `src/lib/storage.ts`
- Consumes: nothing new

- [ ] **Step 1: Write failing test**

```ts
// src/lib/__tests__/storage.test.ts — add inside existing describe or new describe
import { updateWordReviewSm2, saveLearnedWord, getLearnedWords } from '../storage';

it('updateWordReviewSm2 sets updatedAt', () => {
  localStorage.clear();
  saveLearnedWord({ word: 'test', meaning: 'm', example: 'e', topic: 't', learnedAt: '2026-01-01T00:00:00.000Z' });
  updateWordReviewSm2('test', 4);
  const words = getLearnedWords();
  expect(words[0].updatedAt).toBeDefined();
  expect(new Date(words[0].updatedAt!).getFullYear()).toBe(2026);
});

it('migrateToSm2 does NOT set updatedAt', () => {
  const { migrateToSm2 } = require('../srs');
  const word = { word: 'w', meaning: 'm', example: 'e', topic: 't', learnedAt: '2026-01-01T00:00:00.000Z' };
  const migrated = migrateToSm2(word);
  expect((migrated as any).updatedAt).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=storage
```
Expected: FAIL — `updatedAt` undefined

- [ ] **Step 3: Add `updatedAt` to interface and `touch()` helper**

In `src/lib/storage.ts`, update the `LearnedWord` interface:

```ts
export interface LearnedWord {
  word: string;
  meaning: string;
  example: string;
  topic: string;
  learnedAt: string;
  nextReviewAt?: string;
  reviewInterval?: number;
  mastery?: number;
  synonyms?: string[];
  antonyms?: string[];
  easiness?: number;
  repetitions?: number;
  updatedAt?: string;   // set on every mutation; NOT set by migrateToSm2
}

/** Stamps updatedAt = now. Call on every user-initiated write. */
export function touch<T extends { updatedAt?: string }>(x: T): T {
  return { ...x, updatedAt: new Date().toISOString() };
}
```

- [ ] **Step 4: Apply `touch()` in `updateWordReviewSm2`**

In `src/lib/storage.ts`, at the end of the `updateWordReviewSm2` map callback, wrap the returned object:

```ts
// Replace the final return inside the .map callback:
return touch({
  ...migrated,
  easiness: next.easiness,
  repetitions: next.repetitions,
  reviewInterval: next.interval,
  nextReviewAt: next.nextReviewAt,
  mastery: repetitionsToMastery(next.repetitions),
});
```

- [ ] **Step 5: Apply `touch()` in `saveLearnedWord`**

```ts
// In saveLearnedWord, update withDefaults:
const withDefaults: LearnedWord = touch({
  reviewInterval: 1,
  mastery: 0,
  nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
  ...entry,
});
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=storage
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage.ts src/lib/__tests__/storage.test.ts
git commit -m "feat(sync): add updatedAt to LearnedWord + touch() helper"
```

---

### Task 3: Extract `mergeLww` to `src/lib/sync-merge.ts`

**Files:**
- Create: `src/lib/sync-merge.ts`
- Create: `src/lib/__tests__/sync-merge.test.ts`

**Interfaces:**
- Produces: `mergeLww<T>(local: T[], remote: T[], keyOf: (t: T) => string): { merged: T[]; toPush: T[] }`
- Produces: `stamp(x: { updatedAt?: string; learnedAt?: string; createdAt?: string }): string`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/sync-merge.test.ts
import { mergeLww, stamp } from '../sync-merge';

type W = { word: string; updatedAt?: string; learnedAt?: string };
const key = (w: W) => w.word.toLowerCase();

describe('stamp', () => {
  it('prefers updatedAt over learnedAt', () => {
    expect(stamp({ updatedAt: '2026-02-01', learnedAt: '2026-01-01' })).toBe('2026-02-01');
  });
  it('falls back to learnedAt when no updatedAt', () => {
    expect(stamp({ learnedAt: '2026-01-15' })).toBe('2026-01-15');
  });
  it('returns empty string when all undefined', () => {
    expect(stamp({})).toBe('');
  });
});

describe('mergeLww', () => {
  it('remote review newer than local wins', () => {
    const local: W[] = [{ word: 'cat', learnedAt: '2026-01-01', updatedAt: '2026-01-10' }];
    const remote: W[] = [{ word: 'cat', learnedAt: '2026-01-01', updatedAt: '2026-01-20' }];
    const { merged } = mergeLww(local, remote, key);
    expect(merged[0].updatedAt).toBe('2026-01-20');
  });

  it('local newer → included in toPush', () => {
    const local: W[] = [{ word: 'dog', updatedAt: '2026-03-01' }];
    const remote: W[] = [{ word: 'dog', updatedAt: '2026-02-01' }];
    const { toPush } = mergeLww(local, remote, key);
    expect(toPush).toHaveLength(1);
    expect(toPush[0].word).toBe('dog');
  });

  it('tie → keep local, do not push', () => {
    const ts = '2026-01-05';
    const local: W[] = [{ word: 'fox', updatedAt: ts }];
    const remote: W[] = [{ word: 'fox', updatedAt: ts }];
    const { merged, toPush } = mergeLww(local, remote, key);
    expect(merged).toHaveLength(1);
    expect(toPush).toHaveLength(0);
  });

  it('word only on remote → added to merged, not in toPush', () => {
    const local: W[] = [];
    const remote: W[] = [{ word: 'owl', updatedAt: '2026-01-01' }];
    const { merged, toPush } = mergeLww(local, remote, key);
    expect(merged).toHaveLength(1);
    expect(toPush).toHaveLength(0);
  });

  it('word only on local → in merged and in toPush', () => {
    const local: W[] = [{ word: 'ant', updatedAt: '2026-01-01' }];
    const remote: W[] = [];
    const { merged, toPush } = mergeLww(local, remote, key);
    expect(merged).toHaveLength(1);
    expect(toPush).toHaveLength(1);
  });

  it('falls back to learnedAt when updatedAt missing', () => {
    const local: W[] = [{ word: 'bee', learnedAt: '2026-01-01' }];
    const remote: W[] = [{ word: 'bee', learnedAt: '2026-02-01' }];
    const { merged } = mergeLww(local, remote, key);
    expect(merged[0].learnedAt).toBe('2026-02-01');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=sync-merge
```

- [ ] **Step 3: Implement `sync-merge.ts`**

```ts
// src/lib/sync-merge.ts
export function stamp(x: { updatedAt?: string; learnedAt?: string; createdAt?: string }): string {
  return x.updatedAt ?? x.learnedAt ?? x.createdAt ?? '';
}

/** Last-write-wins by updatedAt (falls back to learnedAt/createdAt). Tie → keep local. */
export function mergeLww<T extends { updatedAt?: string }>(
  local: T[],
  remote: T[],
  keyOf: (t: T) => string,
): { merged: T[]; toPush: T[] } {
  const map = new Map<string, T>();
  for (const l of local) map.set(keyOf(l), l);

  for (const r of remote) {
    const k = keyOf(r);
    const l = map.get(k);
    if (!l || stamp(r) > stamp(l)) map.set(k, r);
  }

  const remoteByKey = new Map(remote.map(r => [keyOf(r), r]));
  const merged = [...map.values()];
  const toPush = merged.filter(m => {
    const r = remoteByKey.get(keyOf(m));
    return !r || stamp(m) > stamp(r);
  });
  return { merged, toPush };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=sync-merge
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync-merge.ts src/lib/__tests__/sync-merge.test.ts
git commit -m "feat(sync): extract mergeLww — LWW merge by updatedAt"
```

---

### Task 4: Rewrite `initSync` — pull-before-push with LWW merge

**Files:**
- Modify: `src/lib/sync.ts`

**Interfaces:**
- Consumes: `mergeLww` from `src/lib/sync-merge.ts`, `touch` from `src/lib/storage.ts`
- Produces: updated `initSync()`, updated `pushWord()` (adds SM-2 fields), updated `wordToRow`/`rowToWord` helpers

- [ ] **Step 1: Add `wordToRow` and `rowToWord` helpers to `sync.ts`**

Replace the inline upsert objects in `pushWord` and `initSync` with these helpers:

```ts
// src/lib/sync.ts — add near the top after imports
import { mergeLww } from './sync-merge';
import { migrateToSm2 } from './srs';

function wordToRow(w: LearnedWord, syncKey: string) {
  return {
    sync_key: syncKey,
    word: w.word,
    meaning: w.meaning ?? null,
    example: w.example ?? null,
    topic: w.topic ?? null,
    learned_at: w.learnedAt,
    next_review_at: w.nextReviewAt ?? null,
    review_interval: w.reviewInterval ?? null,
    mastery: w.mastery ?? null,
    easiness: w.easiness ?? 2.5,
    repetitions: w.repetitions ?? 0,
    synonyms: w.synonyms ?? null,
    antonyms: w.antonyms ?? null,
    updated_at: w.updatedAt ?? w.learnedAt,
  };
}

function rowToWord(r: Record<string, unknown>): LearnedWord {
  return {
    word: r.word as string,
    meaning: (r.meaning as string) ?? '',
    example: (r.example as string) ?? '',
    topic: (r.topic as string) ?? '',
    learnedAt: r.learned_at as string,
    nextReviewAt: (r.next_review_at as string | null) ?? undefined,
    reviewInterval: (r.review_interval as number | null) ?? undefined,
    mastery: (r.mastery as number | null) ?? undefined,
    easiness: r.easiness != null ? Number(r.easiness) : undefined,
    repetitions: (r.repetitions as number | null) ?? undefined,
    synonyms: (r.synonyms as string[] | null) ?? undefined,
    antonyms: (r.antonyms as string[] | null) ?? undefined,
    updatedAt: (r.updated_at as string | null) ?? undefined,
  };
}
```

- [ ] **Step 2: Update `pushWord` to send SM-2 fields**

```ts
export async function pushWord(entry: LearnedWord): Promise<void> {
  if (typeof window === 'undefined') return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await supabase.from('learned_words').upsert(wordToRow(entry, syncKey), {
      onConflict: 'sync_key,word',
    });
  } catch { /* fire-and-forget */ }
}
```

- [ ] **Step 3: Replace the `learnedWords` block of `initSync` with pull→merge→push**

Find the section in `initSync` that handles `learned_words` (the big block that starts with `const localWords = getLearnedWords()`) and replace it entirely:

```ts
// Inside initSync(), replace the learned_words handling:
const localWords = getLearnedWords().map(w => migrateToSm2(w) as LearnedWord);

const { data: remoteRows, error: pullError } = await supabase
  .from('learned_words')
  .select('*')
  .eq('sync_key', syncKey);

if (!pullError && remoteRows) {
  const remote = remoteRows.map(r => rowToWord(r as Record<string, unknown>));
  const { merged, toPush } = mergeLww(localWords, remote, w => w.word.toLowerCase());
  localStorage.setItem('learnedWords', JSON.stringify(merged));
  if (toPush.length > 0) {
    await supabase.from('learned_words').upsert(
      toPush.map(w => wordToRow(w, syncKey)),
      { onConflict: 'sync_key,word' },
    );
  }
}
```

Remove the old separate `localWords.length > 0` push block and the old `remoteWords` pull block — they are replaced by the code above.

- [ ] **Step 4: Run full test suite**

```bash
npm test && npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.ts src/lib/srs.ts
git commit -m "fix(sync): LWW merge by updatedAt, pull-before-push, sync SM-2 fields"
```

---

### Task 5: Run check script to verify S1 complete

- [ ] **Step 1: Run S0 check for S1**

```bash
./scripts/check-phase-6-7.sh 2>&1 | grep -A4 "S1"
```

Expected: all three S1 checks ✅

- [ ] **Step 2: Manual smoke test (optional but recommended)**

Open the app, review one word, check `localStorage.learnedWords` in DevTools — the reviewed word should have `updatedAt` set.
