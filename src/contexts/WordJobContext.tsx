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
import { addBankWords, countBank, pickExcludeSample } from "@/lib/word-bank";
import {
  clearJob,
  createRateWindow,
  getJob,
  isLockStale,
  makeJob,
  saveJob,
  type WordJob,
} from "@/lib/word-job";
import { runWordJob, type JobRunReason, type JobWord } from "@/lib/word-job-runner";

export interface WordJobContextValue {
  job: WordJob | null;
  count: number;
  wordsPerMinute: number;
  /** This tab may control the job (it holds the lock, or the job is not running). */
  isOwner: boolean;
  startJob(topic: string, target: number): void;
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

export function WordJobProvider({ children }: { children: ReactNode }) {
  const { fetchWithProvider } = useApiFetch();
  const [job, setJob] = useState<WordJob | null>(null);
  const [count, setCount] = useState(0);
  const [wordsPerMinute, setWordsPerMinute] = useState(0);

  const tabId = useRef(newTabId());
  const runToken = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const stopRun = useCallback(() => {
    runToken.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const persist = useCallback((next: WordJob) => {
    saveJob(next);
    setJob(next);
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
        if (!current || reason === "cancelled") return;
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
        setCount(countBank(current.topic));
      };

      const heartbeat = window.setInterval(() => {
        if (token !== runToken.current) return;
        const current = getJob();
        if (!current || current.status !== "running") return;
        saveJob({
          ...current,
          updatedAt: new Date().toISOString(),
          lock: { tabId: tabId.current, heartbeatAt: new Date().toISOString() },
        });
      }, 5000);

      void runWordJob({
        topic: initial.topic,
        target: initial.target,
        countBank: () => countBank(initial.topic),
        fetchBatch: async ({ exclude, count: size, knownCount }) => {
          try {
            const res = await fetchWithProvider(
              "/api/generate-words",
              { topic: initial.topic, exclude, count: size, knownCount },
              { signal: controller.signal }
            );
            if (!res.ok) {
              const retryAfter = Number(res.headers.get("Retry-After"));
              return {
                ok: false as const,
                status: res.status,
                retryAfterSec: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
              };
            }
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
        wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        shouldContinue: () =>
          token === runToken.current && getJob()?.status === "running",
        onProgress: ({ count: next, added }) => {
          setCount(next);
          const minutes = (Date.now() - startedAt) / 60_000;
          if (minutes > 0.01) setWordsPerMinute(Math.round(added / minutes));
        },
        rateWindow: rate,
      })
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
    (topic: string, target: number) => {
      const current = getJob();
      if (current && current.status === "running" && !isLockStale(current.lock)) return;
      const next: WordJob = {
        ...makeJob(topic, target),
        lock: { tabId: tabId.current, heartbeatAt: new Date().toISOString() },
      };
      persist(next);
      setCount(countBank(topic));
      setWordsPerMinute(0);
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
    persist(next);
    run(next);
  }, [persist, run]);

  const cancelJob = useCallback(() => {
    stopRun();
    clearJob();
    setJob(null);
    setCount(0);
    setWordsPerMinute(0);
  }, [stopRun]);

  // Restore a job left behind by a previous visit: a live lock belongs to another tab,
  // a stale one means the tab that ran it is gone, so it comes back paused.
  useEffect(() => {
    const existing = getJob();
    if (!existing) return;
    if (existing.status === "running" && isLockStale(existing.lock)) {
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
    setCount(countBank(existing.topic));
  }, []);

  // Follow a job run by another tab.
  const activeId = job?.id;
  const activeTopic = job?.topic;
  useEffect(() => {
    if (!activeId || activeTopic === undefined) return;
    const timer = window.setInterval(() => {
      const stored = getJob();
      setJob(stored);
      setCount(countBank(stored?.topic ?? activeTopic));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeId, activeTopic]);

  // Leaving the page stops the loop; the checkpoint stays, so the next visit can resume.
  useEffect(
    () => () => {
      const current = getJob();
      if (current?.status === "running" && current.lock?.tabId === tabId.current) {
        saveJob({
          ...current,
          status: "paused",
          lock: undefined,
          updatedAt: new Date().toISOString(),
        });
      }
      stopRun();
    },
    [stopRun]
  );

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
