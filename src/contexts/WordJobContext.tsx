"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useApiFetch } from "@/lib/useApiFetch";
import { addBankWords, addConcepts, countAvailable, isEnglishOnly, pickExcludeSample, WORD_BANK_KEY, type Concept } from "@/lib/word-bank";
import type { LearnLang } from "@/lib/languages";
import {
  clearJob,
  createRateWindow,
  getJob,
  isLockStale,
  isSameRunningJob,
  makeJob,
  reconcileFollowedJob,
  saveJob,
  WORD_JOB_KEY,
  type WordJob,
} from "@/lib/word-job";
import { runWordJob, type JobRunReason, type JobWord } from "@/lib/word-job-runner";


/** Words (English job) or complete concepts (several languages) available for a job's topic. */
function jobCount(job: { topic: string; langs?: LearnLang[] }): number {
  return countAvailable(job.topic, job.langs ?? ["en"]);
}

export interface WordJobContextValue {
  job: WordJob | null;
  count: number;
  wordsPerMinute: number;
  /** This tab may control the job (it holds the lock, or the job is not running). */
  isOwner: boolean;
  startJob(topic: string, target: number, langs?: LearnLang[]): void;
  pauseJob(): void;
  resumeJob(): void;
  cancelJob(): void;
}

const WordJobContext = createContext<WordJobContextValue | null>(null);

const STORAGE_ERROR =
  "Không lưu được vào bộ nhớ trình duyệt. Job đã dừng; từ vừa tạo vẫn dùng được trong phiên này.";
const EXHAUSTED_ERROR = "Chủ đề này đã cạn từ mới. Thử chủ đề khác hoặc tạo job mới.";
const GENERIC_ERROR = "Không sinh được thêm từ. Job đã dừng, tiến trình được giữ.";

function newTabId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Per-tab id that survives a reload (sessionStorage), so a reloaded tab recognises its own lock. */
function tabIdForThisTab(): string {
  try {
    const existing = sessionStorage.getItem("wordJobTabId");
    if (existing) return existing;
    const id = newTabId();
    sessionStorage.setItem("wordJobTabId", id);
    return id;
  } catch {
    return newTabId();
  }
}

export function WordJobProvider({ children }: { children: ReactNode }) {
  const { fetchWithProvider } = useApiFetch();
  const [job, setJob] = useState<WordJob | null>(null);
  const [count, setCount] = useState(0);
  const [wordsPerMinute, setWordsPerMinute] = useState(0);

  const tabId = useRef(tabIdForThisTab());
  const runToken = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const stopRun = useCallback(() => {
    runToken.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const persist = useCallback((next: WordJob) => {
    const saved = saveJob(next);
    setJob(next);
    return saved;
  }, []);

  const run = useCallback(
    (initial: WordJob) => {
      stopRun();
      const token = runToken.current;
      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = Date.now();
      const rate = createRateWindow(40, 60_000);

      const finish = (reason: JobRunReason) => {
        if (token !== runToken.current) return;
        const current = getJob();
        if (!current || current.id !== initial.id || reason === "cancelled") return;
        const status: WordJob["status"] =
          reason === "done" ? "done" : reason === "error" || reason === "storage" ? "error" : "paused";
        const lastError =
          reason === "storage"
            ? STORAGE_ERROR
            : reason === "exhausted"
              ? EXHAUSTED_ERROR
              : reason === "error"
                ? GENERIC_ERROR
                : undefined;
        const next: WordJob = {
          ...current,
          status,
          lastError,
          lock: undefined,
          updatedAt: new Date().toISOString(),
        };
        persist(next);
        setCount(jobCount(current));
      };

      const heartbeat = window.setInterval(() => {
        if (token !== runToken.current) return;
        const current = getJob();
        if (!current || current.id !== initial.id || current.status !== "running") return;
        saveJob({
          ...current,
          updatedAt: new Date().toISOString(),
          lock: { tabId: tabId.current, heartbeatAt: new Date().toISOString() },
        });
      }, 5000);

      const langs = initial.langs ?? ["en"];
      // A failed response: keep throttling visible so the runner cools down instead of retrying blind.
      const failure = (res: Response) => {
        const retryAfter = Number(res.headers.get("Retry-After"));
        return {
          ok: false as const,
          status: res.status,
          retryAfterSec: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
        };
      };
      const common = {
        topic: initial.topic,
        target: initial.target,
        countBank: () => jobCount(initial),
        wait: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
        shouldContinue: () => token === runToken.current && isSameRunningJob(getJob(), initial.id),
        onProgress: ({ count: next, added }: { count: number; added: number }) => {
          setCount(next);
          const minutes = (Date.now() - startedAt) / 60_000;
          if (minutes > 0.01) setWordsPerMinute(Math.round(added / minutes));
          // Refresh the lock on every batch: background tabs throttle timers, which
          // would otherwise make a live owner look stale.
          const current = getJob();
          if (current?.id === initial.id && current.status === "running") {
            saveJob({
              ...current,
              updatedAt: new Date().toISOString(),
              lock: { tabId: tabId.current, heartbeatAt: new Date().toISOString() },
            });
          }
        },
        rateWindow: rate,
      };

      const running = isEnglishOnly(langs)
        ? runWordJob({
            ...common,
            fetchBatch: async ({ exclude, count: size, knownCount }) => {
              try {
                const res = await fetchWithProvider(
                  "/api/generate-words",
                  { topic: initial.topic, exclude, count: size, knownCount },
                  { signal: controller.signal }
                );
                if (!res.ok) return failure(res);
                const data = (await res.json()) as unknown;
                if (!Array.isArray(data)) return { ok: false as const, status: 502 };
                const words: JobWord[] = data
                  .filter((entry): entry is { word: string; meaning?: unknown } =>
                    Boolean(entry) && typeof (entry as { word?: unknown }).word === "string"
                  )
                  .map((entry) => ({
                    word: entry.word,
                    meaning: typeof entry.meaning === "string" ? entry.meaning : "",
                  }));
                return { ok: true as const, words };
              } catch {
                return { ok: false as const };
              }
            },
            addWords: (words) =>
              addBankWords(
                words.map((word) => ({
                  ...word,
                  topic: initial.topic,
                  createdAt: new Date().toISOString(),
                }))
              ),
            pickExclude: () => pickExcludeSample(initial.topic),
          })
        : runWordJob<Omit<Concept, "conceptId">, Partial<Record<LearnLang, string[]>>>({
            ...common,
            fetchBatch: async ({ exclude, count: size, knownCount }) => {
              try {
                const res = await fetchWithProvider(
                  "/api/generate-words",
                  { topic: initial.topic, langs, exclude, count: size, knownCount },
                  { signal: controller.signal }
                );
                if (!res.ok) return failure(res);
                const data = (await res.json()) as { concepts?: unknown };
                if (!Array.isArray(data.concepts)) return { ok: false as const, status: 502 };
                return { ok: true as const, words: data.concepts as Omit<Concept, "conceptId">[] };
              } catch {
                return { ok: false as const };
              }
            },
            addWords: (concepts) => addConcepts(initial.topic, concepts),
            pickExclude: () => Object.fromEntries(langs.map((lang) => [lang, pickExcludeSample(initial.topic, 200, lang)])),
          });

      void running
        .then((result) => finish(result.reason))
        .catch(() => finish("error"))
        .finally(() => {
          window.clearInterval(heartbeat);
          if (token === runToken.current) abortRef.current = null;
        });
    },
    [fetchWithProvider, persist, stopRun]
  );

  const startJob = useCallback(
    (topic: string, target: number, langs?: LearnLang[]) => {
      const current = getJob();
      if (current && current.status === "running" && !isLockStale(current.lock)) return;
      const next: WordJob = {
        ...makeJob(topic, target, new Date(), langs && !isEnglishOnly(langs) ? langs : undefined),
        lock: { tabId: tabId.current, heartbeatAt: new Date().toISOString() },
      };
      setWordsPerMinute(0);
      if (!persist(next)) {
        setJob({ ...next, status: "error", lastError: STORAGE_ERROR, lock: undefined });
        setCount(0);
        return;
      }
      setCount(countAvailable(topic, langs ?? ["en"]));
      run(next);
    },
    [persist, run]
  );

  const pauseJob = useCallback(() => {
    const current = getJob();
    if (!current || current.status !== "running") return;
    stopRun();
    persist({
      ...current,
      status: "paused",
      lock: undefined,
      updatedAt: new Date().toISOString(),
    });
  }, [persist, stopRun]);

  const resumeJob = useCallback(() => {
    const current = getJob();
    if (!current || current.status === "done") return;
    if (current.status === "running" && !isLockStale(current.lock)) return;
    const next: WordJob = {
      ...current,
      status: "running",
      lastError: undefined,
      updatedAt: new Date().toISOString(),
      lock: { tabId: tabId.current, heartbeatAt: new Date().toISOString() },
    };
    setWordsPerMinute(0);
    if (!persist(next)) {
      setJob({ ...next, status: "error", lastError: STORAGE_ERROR, lock: undefined });
      return;
    }
    run(next);
  }, [persist, run]);

  const cancelJob = useCallback(() => {
    stopRun();
    clearJob();
    setJob(null);
    setCount(0);
    setWordsPerMinute(0);
  }, [stopRun]);

  // Restore a job left behind by a previous visit. A live lock owned by another tab
  // means that tab is still running it; our own lock (same tab, page reloaded) or a
  // stale one means the loop is gone, so it comes back paused.
  useEffect(() => {
    const existing = getJob();
    if (!existing) return;
    const mine = existing.lock?.tabId === tabId.current;
    if (existing.status === "running" && (mine || isLockStale(existing.lock))) {
      const next: WordJob = {
        ...existing,
        status: "paused",
        lock: undefined,
        updatedAt: new Date().toISOString(),
      };
      saveJob(next);
      setJob(next);
    } else {
      setJob(existing);
    }
    setCount(jobCount(existing));
  }, []);

  // Follow a job run by another tab; take it over once its owner is gone.
  const activeId = job?.id;
  const activeTopic = job?.topic;
  useEffect(() => {
    if (!activeId || activeTopic === undefined) return;
    const timer = window.setInterval(() => {
      const stored = getJob();
      if (!stored) return; // storage may be blocked; keep an in-memory error visible
      const next = reconcileFollowedJob(stored, tabId.current);
      if (next !== stored && next) saveJob(next);
      setJob(next);
      setCount(next ? jobCount(next) : activeTopic ? countAvailable(activeTopic, ["en"]) : 0);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeId, activeTopic]);

  // A tab that is already open must learn about a job started elsewhere.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== WORD_JOB_KEY && event.key !== WORD_BANK_KEY) return;
      if (event.key === WORD_JOB_KEY && event.newValue === null) {
        setJob(null);
        setCount(0);
        return;
      }
      const stored = getJob();
      if (!stored) return;
      const next = reconcileFollowedJob(stored, tabId.current);
      if (next !== stored && next) saveJob(next);
      setJob(next);
      setCount(next?.topic ? jobCount(next) : 0);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Closing the tab pauses the job (pagehide fires on close, unlike React unmount).
  // The unmount cleanup still covers Fast Refresh and client-side unmounts.
  const pauseOwnJob = useCallback(() => {
    const current = getJob();
    if (current?.status === "running" && current.lock?.tabId === tabId.current) {
      saveJob({
        ...current,
        status: "paused",
        lock: undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", pauseOwnJob);
    return () => {
      window.removeEventListener("pagehide", pauseOwnJob);
      pauseOwnJob();
      stopRun();
    };
  }, [pauseOwnJob, stopRun]);

  const isOwner = !job || job.status !== "running" || job.lock?.tabId === tabId.current;

  return (
    <WordJobContext.Provider
      value={{ job, count, wordsPerMinute, isOwner, startJob, pauseJob, resumeJob, cancelJob }}
    >
      {children}
    </WordJobContext.Provider>
  );
}

export function useWordJob(): WordJobContextValue {
  const value = useContext(WordJobContext);
  if (!value) throw new Error("useWordJob must be used inside WordJobProvider");
  return value;
}
