# Supabase Sync Integration Design

**Date:** 2026-07-17  
**Status:** Approved

## Overview

Migrate data persistence from localStorage-only to an offline-first architecture where localStorage remains the source of truth and Supabase serves as a cloud sync layer. Supports backup and multi-device sync without requiring user login.

## Goals

- **Backup:** Data survives browser clear / device loss
- **Multi-device sync:** Same vocabulary data across multiple devices
- **Offline-first:** App works fully without internet; sync happens in background
- **No login:** Identity managed via a shared sync key (UUID)

## Identity: Sync Key

> **Revised:** See `2026-07-18-sync-key-pull-design.md` for the current sync key behavior. The description below reflects the original design and has been superseded.

- On first app load: generate `crypto.randomUUID()`, store in `localStorage["syncKey"]`
- The sync key is the **permanent home key** — it never changes
- To pull data from another device: enter the other device's key in Settings → app fetches and merges that key's Supabase data into local storage (local wins on conflicts)
- Security: key acts as a shared secret; acceptable risk for a single-user personal app
- **Special key:** `"ThankZ"` (case-insensitive) resolves to the fixed UUID `7468616e-6b7a-4000-8000-000000000000` via `KEY_ALIASES` in sync.ts. Used as a pull source only — never replaces the device's home key.

## Architecture

```
[User action]
     │
     ▼
localStorage (instant write) ──► UI updates immediately
     │
     │ (background, when online)
     ▼
Supabase (upsert by sync_key + primary key)
```

On new device / after sync key import:
```
Supabase (fetch all rows for sync_key)
     │
     ▼
localStorage (overwrite)
     │
     ▼
UI re-render
```

**Conflict resolution:** `initSync()` does a two-way merge on app load: it pushes all current localStorage rows to Supabase first (upsert), then pulls all Supabase rows back and merges into localStorage. For `learned_words`, the row with the later `learned_at` wins. For `daily_challenges`, Supabase wins (remote is authoritative for completed records). For `custom_topics`, union of both sets.

**No write queue:** If a write fails while offline, the next `initSync()` call pushes the full localStorage state to Supabase via upsert (idempotent).

## Supabase Schema

```sql
CREATE TABLE learned_words (
  sync_key        UUID NOT NULL,
  word            TEXT NOT NULL,
  meaning         TEXT,
  example         TEXT,
  topic           TEXT,
  learned_at      TIMESTAMPTZ NOT NULL,
  next_review_at  TIMESTAMPTZ,
  review_interval INT DEFAULT 1,
  mastery         INT DEFAULT 0,
  synonyms        TEXT[],
  antonyms        TEXT[],
  PRIMARY KEY (sync_key, word)
);

CREATE TABLE custom_topics (
  sync_key  UUID NOT NULL,
  topic     TEXT NOT NULL,
  PRIMARY KEY (sync_key, topic)
);

CREATE TABLE daily_challenges (
  sync_key   UUID NOT NULL,
  date       DATE NOT NULL,
  words      TEXT[],
  completed  BOOLEAN DEFAULT false,
  PRIMARY KEY (sync_key, date)
);
```

RLS is disabled (or set to allow all) since the sync key itself acts as the access control mechanism.

## Sync Layer: `src/lib/sync.ts`

New file — existing storage files (`storage.ts`, `custom-topics.ts`, `daily-challenge.ts`) keep their interfaces unchanged.

| Function | Description |
|---|---|
| `initSync()` | Called on app load. Fetches all Supabase rows for syncKey → writes to localStorage |
| `pushWord(entry)` | Upserts one word to Supabase. Called after `saveLearnedWord`, `updateWordReview`, `deleteLearnedWord` |
| `pushTopic(topic)` | Upserts one topic. Called after `saveCustomTopic` |
| `pushChallenge(record)` | Upserts one daily challenge. Called after `setDailyComplete` |
| `pullFromKey(key)` | Resolves alias → fetches Supabase rows for that key → merges into localStorage (local wins). Does NOT replace the device's home key. |
| `getSyncKey()` | Returns current syncKey, generating one if absent |
| `getLastSyncedAt()` | Returns timestamp string for display in Settings |

All push functions are fire-and-forget — errors are caught and silently ignored to avoid breaking offline use.

## Settings Page Changes

Add a "Sync" section to `src/app/settings/page.tsx`:

- **Sync Key display:** Show first 8 characters + "Copy full key" button
- **Pull from device:** Text input + "Pull data" button → calls `pullFromKey()` → shows "X new words added"
- **Last synced:** "Synced at HH:mm" or "Not synced yet"

## Integration Points

Storage functions that need a `push*` call added after their localStorage write:

| File | Function | Push call |
|---|---|---|
| `storage.ts` | `saveLearnedWord` | `pushWord(entry)` |
| `storage.ts` | `deleteLearnedWord` | `deleteWord(word)` — removes row from Supabase by (sync_key, word) |
| `storage.ts` | `updateWordReview` | `pushWord(updatedEntry)` |
| `custom-topics.ts` | `saveCustomTopic` | `pushTopic(topic)` |
| `daily-challenge.ts` | `setDailyComplete` | `pushChallenge(record)` |

`initSync()` is called once in `src/app/layout.tsx` (client-side, wrapped in `useEffect`).

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://qmxsdqyrjmitwdwpjifn.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<see .env.local>
```

Both are public (client-safe) since RLS is not used for access control — the sync key provides the equivalent protection. Note: Supabase newer projects use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead of the older `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Dependencies

- `@supabase/supabase-js` — official Supabase client

## Out of Scope

- Real-time sync (Supabase Realtime subscriptions)
- Conflict UI / merge resolution
- Full auth / multi-user support
- Deletion sync across devices (delete on one device does not propagate to other devices automatically)
