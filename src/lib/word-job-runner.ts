import {
  classifyFailure,
  createRateWindow,
  nextBackoffMs,
  shouldStopJob,
  type RateWindow,
} from "./word-job";

export interface JobWord {
  word: string;
  meaning: string;
}

export type JobBatch = JobWord[];

/** Items are words (English) or concepts (several languages); exclude is a word list or one per language. */
export interface JobRunnerDeps<T = JobWord, X = string[]> {
  topic: string;
  target: number;
  countBank(): number;
  fetchBatch(args: {
    exclude: X;
    count: number;
    knownCount: number;
  }): Promise<{ ok: true; words: T[] } | { ok: false; status?: number; retryAfterSec?: number }>;
  addWords(words: T[]): { added: number; persisted: boolean };
  pickExclude(): X;
  wait(ms: number): Promise<void>;
  shouldContinue(): boolean;
  onProgress?(state: { count: number; added: number }): void;
  rateWindow?: RateWindow;
  maxFailures?: number;
  maxEmptyBatches?: number;
}

export type JobRunReason = "done" | "exhausted" | "error" | "cancelled" | "storage";

export const JOB_BATCH_SIZE = 20;
const MAX_COOLDOWNS = 5;

export async function runWordJob<T = JobWord, X = string[]>(
  deps: JobRunnerDeps<T, X>
): Promise<{ reason: JobRunReason; wordsAdded: number }> {
  const rate = deps.rateWindow ?? createRateWindow(40, 60_000);
  let wordsAdded = 0;
  let emptyStreak = 0;
  let failures = 0;
  let cooldowns = 0;

  while (deps.shouldContinue()) {
    const stop = shouldStopJob({
      count: deps.countBank(),
      target: deps.target,
      emptyStreak,
      failures,
      maxFailures: deps.maxFailures,
      maxEmptyBatches: deps.maxEmptyBatches,
    });
    if (stop) return { reason: stop, wordsAdded };

    const waitMs = rate.waitMs(Date.now());
    if (waitMs > 0) await deps.wait(waitMs);
    rate.record(Date.now());

    const result = await deps.fetchBatch({
      exclude: deps.pickExclude(),
      count: JOB_BATCH_SIZE,
      knownCount: deps.countBank(),
    });

    if (!result.ok) {
      const kind = classifyFailure(result.status);
      if (kind === "cooldown") {
        // A permanently throttled IP must not loop forever; give up after a few waits.
        cooldowns += 1;
        if (cooldowns >= MAX_COOLDOWNS) return { reason: "error", wordsAdded };
        await deps.wait((result.retryAfterSec ?? 30) * 1000);
        continue;
      }
      failures += 1;
      await deps.wait(nextBackoffMs(failures));
      continue;
    }

    failures = 0;
    cooldowns = 0;
    const added = deps.addWords(result.words);
    wordsAdded += added.added;
    if (!added.persisted) return { reason: "storage", wordsAdded };
    emptyStreak = added.added === 0 ? emptyStreak + 1 : 0;
    deps.onProgress?.({ count: deps.countBank(), added: wordsAdded });
  }

  return { reason: "cancelled", wordsAdded };
}
