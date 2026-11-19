import type { LearnLang } from "./languages";
export type WordJobStatus = "running" | "paused" | "done" | "error";

export interface WordJobLock {
  tabId: string;
  heartbeatAt: string;
}

export interface WordJob {
  id: string;
  topic: string;
  target: number;
  langs?: LearnLang[];          // missing = English only (jobs from before multi-language)
  status: WordJobStatus;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  lock?: WordJobLock;
}

export const WORD_JOB_KEY = "wordJob";
export const LOCK_STALE_MS = 30_000;

const STATUSES: WordJobStatus[] = ["running", "paused", "done", "error"];

export function makeJob(topic: string, target: number, now = new Date(), langs?: LearnLang[]): WordJob {
  const iso = now.toISOString();
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `job_${now.getTime()}_${Math.random().toString(36).slice(2)}`,
    topic,
    target,
    ...(langs ? { langs } : {}),
    status: "running",
    createdAt: iso,
    updatedAt: iso,
  };
}

export function getJob(): WordJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WORD_JOB_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<WordJob> | null;
    if (!value || typeof value !== "object") return null;
    if (typeof value.id !== "string" || typeof value.topic !== "string") return null;
    if (typeof value.target !== "number" || !Number.isFinite(value.target)) return null;
    if (!value.status || !STATUSES.includes(value.status)) return null;
    return value as WordJob;
  } catch {
    return null;
  }
}

export function saveJob(job: WordJob): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(WORD_JOB_KEY, JSON.stringify(job));
    return true;
  } catch {
    return false;
  }
}

export function clearJob(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WORD_JOB_KEY);
  } catch {
    // Blocked storage: nothing to clear.
  }
}

export function shouldStopJob(input: {
  count: number;
  target: number;
  emptyStreak: number;
  failures: number;
  maxFailures?: number;
  maxEmptyBatches?: number;
}): "done" | "exhausted" | "error" | null {
  if (input.count >= input.target) return "done";
  if (input.emptyStreak >= (input.maxEmptyBatches ?? 3)) return "exhausted";
  if (input.failures >= (input.maxFailures ?? 3)) return "error";
  return null;
}

export function nextBackoffMs(failures: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, failures));
}

export function classifyFailure(status?: number): "cooldown" | "retry" | "fail" {
  if (status === 429) return "cooldown";
  if (status === undefined || status >= 500) return "retry";
  return "fail";
}

export function isLockStale(
  lock: WordJob["lock"],
  now = Date.now(),
  staleMs = LOCK_STALE_MS
): boolean {
  if (!lock) return true;
  const heartbeat = Date.parse(lock.heartbeatAt);
  return Number.isNaN(heartbeat) || now - heartbeat > staleMs;
}

/** True when the stored job is still the one this loop is generating for. */
export function isSameRunningJob(stored: WordJob | null, id: string): boolean {
  return stored?.id === id && stored.status === "running";
}

/**
 * A followed job becomes resumable once its owner is gone: the lock belongs to no
 * one (the owner closed) or its heartbeat is older than the stale window.
 */
export function reconcileFollowedJob(
  stored: WordJob | null,
  tabId: string,
  now = Date.now()
): WordJob | null {
  if (!stored || stored.status !== "running") return stored;
  if (stored.lock?.tabId === tabId) return stored;
  if (!isLockStale(stored.lock, now)) return stored;
  return {
    ...stored,
    status: "paused",
    lock: undefined,
    updatedAt: new Date(now).toISOString(),
  };
}

export interface RateWindow {
  /** Milliseconds to wait before the next request is allowed (0 when a slot is free). */
  waitMs(now?: number): number;
  record(now?: number): void;
}

export function createRateWindow(limit = 40, windowMs = 60_000): RateWindow {
  let stamps: number[] = [];
  const prune = (now: number) => {
    const cutoff = now - windowMs;
    stamps = stamps.filter((stamp) => stamp > cutoff);
  };

  return {
    waitMs(now = Date.now()) {
      prune(now);
      if (stamps.length < limit) return 0;
      return Math.max(0, stamps[0] + windowMs - now);
    },
    record(now = Date.now()) {
      prune(now);
      stamps.push(now);
    },
  };
}
