const QUEUE_KEY = "syncQueue";
const FAILED_KEY = "syncFailedQueue";
const MAX_RETRIES = 5;

export type QueueOpType = "upsert" | "delete";
export type QueueEntity =
  | "learnedWords" | "learningSessions" | "examAttempts" | "mistakeLog"
  | "unifiedMistakes" | "grammarAttempts" | "speakingSessions" | "writingSubmissions"
  | "dailyChallenges" | "grammarTopics" | "voiceSettings" | "customTopics" | "examItems";

export interface QueueEntry {
  id: string;
  entity: QueueEntity;
  entityId: string;
  op: QueueOpType;
  payload: unknown;
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
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
  const updated = {
    ...entry, retryCount: entry.retryCount + 1, lastAttemptAt: new Date().toISOString(),
    nextRetryAt: new Date(Date.now() + Math.min(300_000, 15_000 * 2 ** entry.retryCount)).toISOString(),
  };
  const queue = peekQueue().filter((item) => item.id !== entry.id);
  if (updated.retryCount >= MAX_RETRIES) {
    const failed = ls<QueueEntry>(FAILED_KEY);
    save(FAILED_KEY, [...failed, updated]);
    save(QUEUE_KEY, queue);
  } else {
    save(QUEUE_KEY, [updated, ...queue]);
  }
}

export async function retryFailedQueue(): Promise<void> {
  const failed = ls<QueueEntry>(FAILED_KEY);
  save(QUEUE_KEY, [...failed.map((entry) => ({ ...entry, retryCount: 0, nextRetryAt: undefined })), ...peekQueue()]);
  save(FAILED_KEY, []);
  await drainQueue();
}

export function clearQueue(): void {
  if (typeof window !== "undefined") localStorage.removeItem(QUEUE_KEY);
}

export type SyncStatus = "synced" | "syncing" | "pending" | "offline" | "failed";
let initializationFailed = false;

export function setSyncInitializationFailed(failed: boolean): void {
  initializationFailed = failed;
}

export function getSyncStatus(): SyncStatus {
  if (typeof window === "undefined") return "synced";
  if (!navigator.onLine) return "offline";
  if (draining) return "syncing";
  const qLen = getQueueLength();
  const fLen = ls<QueueEntry>(FAILED_KEY).length;
  if (fLen > 0 || initializationFailed) return "failed";
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
    for (const entry of peekQueue()) {
      if (!navigator.onLine || (entry.nextRetryAt && Date.parse(entry.nextRetryAt) > Date.now())) break;
      const processor = processors.get(entry.entity);
      if (!processor) break;
      try {
        await processor(entry);
      } catch {
        markFailed(entry);
        break;
      }
      // A closed tab must leave in-flight work available for the next launch.
      save(QUEUE_KEY, peekQueue().filter((item) => item.id !== entry.id));
    }
  } finally {
    draining = false;
  }
}

export function initSyncQueueManager(onDrained?: () => Promise<void>): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    const hadWork = getQueueLength() > 0;
    void drainQueue().then(() => {
      if (hadWork && getQueueLength() === 0) void onDrained?.();
    });
  };
  const visible = () => { if (document.visibilityState === "visible") handler(); };
  window.addEventListener("online", handler);
  document.addEventListener("visibilitychange", visible);
  const interval = setInterval(handler, 15_000);
  if (navigator.onLine) handler();
  return () => {
    window.removeEventListener("online", handler);
    document.removeEventListener("visibilitychange", visible);
    clearInterval(interval);
  };
}
