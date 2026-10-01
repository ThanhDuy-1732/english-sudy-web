# Batch 6: Reliability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fire-and-forget Supabase writes with a persistent offline mutation queue that retries on reconnect, add a sync status indicator, and formalize per-entity conflict strategies — making sync reliable without requiring a login.

**Architecture:** `src/lib/sync-queue.ts` stores pending mutations in localStorage; a `SyncQueueManager` class drains the queue on `online` events and page load. `SyncStatusBadge` reads queue state reactively. Existing push functions (`pushMistake`, `pushAttempt`, etc.) enqueue instead of calling Supabase directly; the queue processor calls Supabase. Conflict strategies are centralized in `sync-merge.ts`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest (jsdom), localStorage, Supabase JS client

**Spec:** `docs/requirement/DEVELOPMENT_DIRECTION.md` §11 (Offline & Sync Reliability), Batch 6 in §18

## Global Constraints

- No new npm dependencies.
- Queue entries must survive page refresh (localStorage persistence).
- Queue drains in FIFO order; failed entries increment `retryCount` and re-queue at back.
- `retryCount` max = 5; entries exceeding max are moved to `failedQueue` (not deleted — for debug).
- Audio data stays local-only (IndexedDB) — never enqueued for Supabase.
- SSR guard on all queue operations.
- `npm test && npm run lint && npm run build` must pass after every task.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/sync-queue.ts` | Mutation queue: enqueue, dequeue, retry logic |
| Create | `src/lib/__tests__/sync-queue.test.ts` | Unit tests |
| Modify | `src/lib/sync.ts` | Replace direct pushes with `enqueue()` |
| Modify | `src/lib/speech/speaking-storage.ts` | Replace `pushSpeaking` with enqueue |
| Modify | `src/lib/write/writing-storage.ts` | Replace `pushWriting` with enqueue |
| Modify | `src/lib/exam/exam-storage.ts` | Replace push functions with enqueue |
| Create | `src/components/SyncStatusBadge.tsx` | UI badge: Synced / Syncing / Offline / Pending / Failed |
| Modify | `src/app/layout.tsx` | Mount SyncQueueManager + render SyncStatusBadge |
| Modify | `src/lib/sync-merge.ts` | Add entity-specific conflict strategy annotations |

---

## Task 1: Mutation queue core

**Files:**
- Create: `src/lib/sync-queue.ts`
- Create: `src/lib/__tests__/sync-queue.test.ts`

**Interfaces — Produces (used by Tasks 2–3):**
```ts
export type QueueOpType = "upsert" | "delete";
export type QueueEntity =
  | "learnedWords" | "learningSessions" | "examAttempts" | "mistakeLog"
  | "unifiedMistakes" | "grammarAttempts" | "speakingSessions" | "writingSubmissions"
  | "dailyChallenges" | "grammarTopics" | "voiceSettings";

export interface QueueEntry {
  id: string;
  entity: QueueEntity;
  entityId: string;
  op: QueueOpType;
  payload: unknown;
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
}
```

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/sync-queue.test.ts
import { enqueue, dequeue, peekQueue, markFailed, getQueueLength } from "../sync-queue";

beforeEach(() => { localStorage.clear(); });

test("enqueue adds entry to queue", () => {
  enqueue({ entity: "learnedWords", entityId: "test-word", op: "upsert", payload: { word: "test" } });
  expect(getQueueLength()).toBe(1);
});

test("dequeue returns and removes first entry (FIFO)", () => {
  enqueue({ entity: "learnedWords", entityId: "a", op: "upsert", payload: { word: "a" } });
  enqueue({ entity: "learnedWords", entityId: "b", op: "upsert", payload: { word: "b" } });
  const entry = dequeue();
  expect(entry?.entityId).toBe("a");
  expect(getQueueLength()).toBe(1);
});

test("peekQueue returns all entries without removing", () => {
  enqueue({ entity: "learnedWords", entityId: "x", op: "upsert", payload: {} });
  enqueue({ entity: "examAttempts", entityId: "y", op: "upsert", payload: {} });
  expect(peekQueue()).toHaveLength(2);
  expect(getQueueLength()).toBe(2);
});

test("markFailed increments retryCount and re-queues if below max", () => {
  enqueue({ entity: "learnedWords", entityId: "a", op: "upsert", payload: {} });
  const entry = dequeue()!;
  markFailed(entry);
  expect(getQueueLength()).toBe(1);
  expect(peekQueue()[0].retryCount).toBe(1);
});

test("markFailed moves to failedQueue after max retries", () => {
  enqueue({ entity: "learnedWords", entityId: "a", op: "upsert", payload: {} });
  let entry = dequeue()!;
  for (let i = 0; i < 5; i++) {
    entry = { ...entry, retryCount: i };
    markFailed(entry);
    if (i < 4) entry = dequeue()!;
  }
  expect(getQueueLength()).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="sync-queue" --no-coverage
```

- [ ] **Step 3: Implement `src/lib/sync-queue.ts`**

```ts
const QUEUE_KEY = "syncQueue";
const FAILED_KEY = "syncFailedQueue";
const MAX_RETRIES = 5;

function ls<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(key);
    return r ? (JSON.parse(r) as T[]) : [];
  } catch { return []; }
}

function save(key: string, items: unknown[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(items));
}

export function enqueue(input: {
  entity: QueueEntity;
  entityId: string;
  op: QueueOpType;
  payload: unknown;
}): void {
  const queue = ls<QueueEntry>(QUEUE_KEY);
  const entry: QueueEntry = {
    ...input,
    id: crypto.randomUUID(),
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  save(QUEUE_KEY, [...queue, entry]);
}

export function dequeue(): QueueEntry | null {
  const queue = ls<QueueEntry>(QUEUE_KEY);
  if (queue.length === 0) return null;
  const [first, ...rest] = queue;
  save(QUEUE_KEY, rest);
  return first;
}

export function peekQueue(): QueueEntry[] {
  return ls<QueueEntry>(QUEUE_KEY);
}

export function getQueueLength(): number {
  return ls<QueueEntry>(QUEUE_KEY).length;
}

export function markFailed(entry: QueueEntry): void {
  const updated = { ...entry, retryCount: entry.retryCount + 1, lastAttemptAt: new Date().toISOString() };
  if (updated.retryCount >= MAX_RETRIES) {
    const failed = ls<QueueEntry>(FAILED_KEY);
    save(FAILED_KEY, [...failed, updated].slice(-100));
  } else {
    const queue = ls<QueueEntry>(QUEUE_KEY);
    save(QUEUE_KEY, [...queue, updated]);
  }
}

export function clearQueue(): void {
  if (typeof window !== "undefined") localStorage.removeItem(QUEUE_KEY);
}

/** Status for UI badge */
export type SyncStatus = "synced" | "syncing" | "pending" | "offline" | "failed";

export function getSyncStatus(): SyncStatus {
  if (typeof window === "undefined") return "synced";
  if (!navigator.onLine) return "offline";
  const qLen = getQueueLength();
  const fLen = ls<QueueEntry>(FAILED_KEY).length;
  if (fLen > 0) return "failed";
  if (qLen > 0) return "pending";
  return "synced";
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="sync-queue" --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync-queue.ts src/lib/__tests__/sync-queue.test.ts
git commit -m "feat: add offline mutation queue core (batch6)"
```

---

## Task 2: SyncQueueManager — drain queue on online event

**Files:**
- Modify: `src/lib/sync-queue.ts` (add `SyncQueueManager`)
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add `SyncQueueManager` to sync-queue.ts**

```ts
// Add to sync-queue.ts:

type Processor = (entry: QueueEntry) => Promise<void>;

const processors = new Map<QueueEntity, Processor>();

export function registerProcessor(entity: QueueEntity, fn: Processor): void {
  processors.set(entity, fn);
}

let draining = false;

export async function drainQueue(): Promise<void> {
  if (draining || typeof window === "undefined" || !navigator.onLine) return;
  draining = true;
  try {
    let entry = dequeue();
    while (entry) {
      const processor = processors.get(entry.entity);
      if (processor) {
        try {
          await processor(entry);
        } catch {
          markFailed(entry);
        }
      }
      entry = dequeue();
    }
  } finally {
    draining = false;
  }
}

export function initSyncQueueManager(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => { void drainQueue(); };
  window.addEventListener("online", handler);
  // Drain on init if online
  if (navigator.onLine) void drainQueue();
  return () => window.removeEventListener("online", handler);
}
```

- [ ] **Step 2: Register entity processors in `sync.ts`**

The existing `sync.ts` already has per-entity Supabase push functions. Wrap each in a registered processor and replace direct calls with `enqueue()`:

```ts
// At the bottom of src/lib/sync.ts, add:
import { registerProcessor, enqueue, type QueueEntry } from "./sync-queue";

// Register processors (called once at app init)
export function registerSyncProcessors() {
  registerProcessor("learnedWords", async (entry) => {
    const supabase = createSupabase(getSyncKey());
    const word = entry.payload as LearnedWord;
    await supabase.from("learned_words").upsert(wordToRow(getSyncKey(), word), { onConflict: "id" });
  });
  // ... similar for other entities
}
```

- [ ] **Step 3: Mount in layout**

In `src/app/layout.tsx`, add a client component that calls `initSyncQueueManager` and `registerSyncProcessors` on mount:

```tsx
// src/components/SyncInit.tsx
"use client";
import { useEffect } from "react";
import { initSyncQueueManager } from "@/lib/sync-queue";
import { registerSyncProcessors } from "@/lib/sync";

export function SyncInit() {
  useEffect(() => {
    registerSyncProcessors();
    const cleanup = initSyncQueueManager();
    return cleanup;
  }, []);
  return null;
}
```

Add `<SyncInit />` to `src/app/layout.tsx`.

- [ ] **Step 4: Build check + commit**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -10
git add src/lib/sync-queue.ts src/lib/sync.ts src/components/SyncInit.tsx src/app/layout.tsx
git commit -m "feat: add SyncQueueManager with drain on reconnect (batch6)"
```

---

## Task 3: SyncStatusBadge UI

**Files:**
- Create: `src/components/SyncStatusBadge.tsx`

- [ ] **Step 1: Create the badge component**

```tsx
"use client";
import { useState, useEffect } from "react";
import { getSyncStatus, type SyncStatus } from "@/lib/sync-queue";

const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string }> = {
  synced:  { label: "Đã đồng bộ", color: "text-green-500" },
  syncing: { label: "Đang đồng bộ...", color: "text-blue-500" },
  pending: { label: "Đang chờ", color: "text-yellow-500" },
  offline: { label: "Ngoại tuyến", color: "text-gray-400" },
  failed:  { label: "Lỗi đồng bộ", color: "text-red-500" },
};

export function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>("synced");

  useEffect(() => {
    function update() { setStatus(getSyncStatus()); }
    update();
    const interval = setInterval(update, 5000);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`text-xs ${cfg.color} flex items-center gap-1`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
      {cfg.label}
    </span>
  );
}
```

- [ ] **Step 2: Add to settings page or navbar**

In `src/app/settings/page.tsx` (Sync tab), add `<SyncStatusBadge />` near the sync controls.

- [ ] **Step 3: Full test + commit**

```bash
cd /Users/thankz/Code/study && npm test && npm run lint && npm run build 2>&1 | tail -10
git add src/components/SyncStatusBadge.tsx src/app/settings/page.tsx
git commit -m "feat: add SyncStatusBadge (batch6)"
```

---

## Task 4: Entity-specific conflict strategy documentation

**Files:**
- Modify: `src/lib/sync-merge.ts`

Add inline comments and a strategy registry so each entity's merge behavior is explicit.

- [ ] **Step 1: Add strategy registry to sync-merge.ts**

At the top of `src/lib/sync-merge.ts`, add:

```ts
/**
 * Per-entity conflict strategies:
 *
 * learnedWords        → LWW (last-write-wins by updatedAt)
 * learningSessions    → append (never overwrite, client id is unique)
 * examAttempts        → append
 * mistakeLog          → LWW by updatedAt
 * unifiedMistakes     → LWW by updatedAt
 * grammarAttempts     → append
 * speakingSessions    → append (audio stays local-only)
 * writingSubmissions  → LWW by updatedAt; versions array merges by version number
 * dailyChallenges     → completed wins (once completed, stays completed)
 * grammarTopics       → LWW by updatedAt
 * voiceSettings       → LWW by updatedAt
 * Audio (IndexedDB)   → local-only, never synced
 * Deletes             → tombstone: set deletedAt, filter out on read
 */
export const CONFLICT_STRATEGIES = {
  learnedWords: "lww",
  learningSessions: "append",
  examAttempts: "append",
  mistakeLog: "lww",
  unifiedMistakes: "lww",
  grammarAttempts: "append",
  speakingSessions: "append",
  writingSubmissions: "lww",
  dailyChallenges: "completed-wins",
  grammarTopics: "lww",
  voiceSettings: "lww",
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/sync-merge.ts
git commit -m "docs: formalize per-entity conflict strategies (batch6)"
```

---

## Acceptance Criteria

- [ ] `enqueue` / `dequeue` / `markFailed` work correctly with localStorage persistence.
- [ ] Failed entries after 5 retries move to `failedQueue`, not lost.
- [ ] Queue drains automatically when browser goes back online.
- [ ] `SyncStatusBadge` shows Offline when `navigator.onLine === false`.
- [ ] Existing sync behavior unchanged — all entities still reach Supabase (via queue now).
- [ ] `npm test && npm run lint && npm run build` pass.

## Risks

- **Processor registration** must happen before first `drainQueue` call — verify `SyncInit` mounts early in layout.
- `crypto.randomUUID()` is available in all modern browsers but requires HTTPS — confirmed for Firebase Hosting.
- Supabase client is created lazily per-processor call — verify `createSupabase` / `getSyncKey` are safe to call outside React context.

## Dependencies

- Existing `sync.ts`, `sync-merge.ts`, `speaking-storage.ts`, `writing-storage.ts`, `exam-storage.ts`.
- No Batch 1–5 dependencies (Batch 6 is purely infrastructure).

## Out of Scope

- Server-side queue (no backend — all client-side).
- Conflict resolution UI for the user (automatic strategies only).
- Syncing `unifiedMistakes` to a new Supabase table (requires schema migration — plan separately).
