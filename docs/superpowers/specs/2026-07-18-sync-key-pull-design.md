# Sync Key Pull Design

**Date:** 2026-07-18  
**Status:** Approved  
**Supersedes:** Section "Identity: Sync Key" and `importSyncKey` in `2026-07-17-supabase-sync-design.md`

## Overview

Revises the sync key import behavior. Instead of replacing a device's identity when entering another device's key, the new behavior pulls/merges data from the other key without changing the device's own sync key.

## Identity Model

Each device has a permanent **home key** — a UUID generated on first load and stored in `localStorage["syncKey"]`. The home key never changes. It is the sole identity used for all Supabase pushes.

```
Device B
  ├── home key = UUID-B  (permanent)
  ├── pushes → Supabase WHERE sync_key = UUID-B
  └── pulls from → any key (UUID-A, "ThankZ", etc.)
```

## `pullFromKey(key)` — Replaces `importSyncKey`

New function that fetches data from another sync key and merges into local state.

**Flow:**

```
pullFromKey("ThankZ") or pullFromKey("some-uuid")
  │
  ├── 1. Resolve alias: "thankz" → 7468616e-6b7a-4000-8000-000000000000
  │         (case-insensitive; unknown keys passed through as-is)
  ├── 2. Fetch from Supabase: learned_words, custom_topics, daily_challenges
  │         WHERE sync_key = resolved UUID
  ├── 3. Merge into localStorage:
  │     ├── learned_words:  add only words not already present (case-insensitive match)
  │     ├── custom_topics:  union — add topics not already present
  │     └── daily_challenges: add only dates not already present
  └── 4. localStorage["syncKey"] unchanged — Device B keeps UUID-B
```

**Conflict resolution:** Local always wins. Words/topics/challenges already on the device are never overwritten by the pull.

**After pull:** The next `initSync()` (on next page load) pushes the merged data to Supabase under UUID-B — Device B owns those words going forward.

**Device A:** Never modified. Supabase rows under key A are read-only from Device B's perspective.

## Special Key: ThankZ

`"ThankZ"` (case-insensitive) resolves via `KEY_ALIASES` to UUID `7468616e-6b7a-4000-8000-000000000000`. Pulling from ThankZ merges the vocabulary stored under that UUID into the current device — same flow as any other key.

## Settings Page

The Sync section input changes label and behavior:

| Field | Value |
|---|---|
| Label | "Pull from another device" |
| Input placeholder | "Enter sync key or ThankZ" |
| Button | "Pull data" |
| On success | Show "X new words added" |

The home key display (first 8 chars + "Copy full key") is unchanged.

## What Changes vs. Previous Design

| | Old (`importSyncKey`) | New (`pullFromKey`) |
|---|---|---|
| Device's sync key after operation | Replaced with entered key | Unchanged |
| Local data after operation | Cleared + replaced | Merged (local wins) |
| Supabase writes after operation | Under new key | Under original home key |
| Source device affected? | Source becomes this device | Source unchanged |

## Sync Layer API

Replace `importSyncKey` with `pullFromKey` in `src/lib/sync.ts`:

| Function | Description |
|---|---|
| `pullFromKey(key)` | Resolves alias → fetches Supabase rows for that key → merges into localStorage (local wins) |

All other functions (`initSync`, `pushWord`, `pushTopic`, `pushChallenge`, `getSyncKey`, `getLastSyncedAt`) are unchanged.
