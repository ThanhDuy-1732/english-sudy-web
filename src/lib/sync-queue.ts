const QUEUE_KEY = "syncQueue";
const FAILED_KEY = "syncFailedQueue";
const MAX_RETRIES = 5;

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

// --- SyncQueueManager ---

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
  if (navigator.onLine) void drainQueue();
  return () => window.removeEventListener("online", handler);
}
