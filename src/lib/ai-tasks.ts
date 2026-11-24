import { callWithFallback, streamWithFallback } from "./providers";
import { recordMetric } from "./ai-metrics";
import { logEventAfter } from "./db-events";
import { blockedProviderIds } from "./provider-lock";

export type AITaskName =
  | "word-generation"
  | "sentence-generation"
  | "grammar-generation"
  | "grammar-explanation"
  | "exam-generation"
  | "exam-explanation"
  | "speaking-roleplay"
  | "speaking-grade"
  | "writing-grade"
  | "writing-feedback"
  | "vocab-context"
  | "vocab-batch"
  | "vocab-exercise"
  | "reading-generation"
  | "sentence-grade"
  | "grammar-exercise"
  | "exam-grade"
  | "translation";

export interface CallTaskOptions {
  task: AITaskName;
  prompt: string;
  provider?: string;
  disabledProviders?: string[];
  temperature?: number;
  /** True when this call re-asks the model after its JSON failed the schema. */
  repair?: boolean;
}

// ponytail: static map; make settings-driven if per-task provider pinning is needed
const TASK_PROVIDER_MAP: Record<AITaskName, string> = {
  "word-generation": "",
  "sentence-generation": "",
  "grammar-generation": "",
  "grammar-explanation": "",
  "exam-generation": "",
  "exam-explanation": "",
  "speaking-roleplay": "",
  "speaking-grade": process.env.GRADING_PROVIDER ?? "",
  "writing-grade": process.env.GRADING_PROVIDER ?? "",
  "writing-feedback": "",
  "vocab-context": "",
  "vocab-batch": "",
  "vocab-exercise": "",
  "reading-generation": "",
  "sentence-grade": "",
  "grammar-exercise": "",
  "exam-grade": "",
  // Groq: ~40% faster than opencode on 3-tone translations (≈2.5 s vs 4.3 s, measured Nov 2026); opencode stays the fallback.
  translation: process.env.TRANSLATE_PROVIDER ?? "groq",
};

// Per-provider timeout before the fallback chain moves on. Short tasks answer in 1–3 s (p95 ~6 s),
// so a stuck call should not hold the learner for the 25 s default. Writing grading runs 14–20 s.
const SHORT_TIMEOUT_MS = 10_000;
const TASK_TIMEOUT_MS: Partial<Record<AITaskName, number>> = {
  "sentence-generation": SHORT_TIMEOUT_MS,
  "vocab-exercise": SHORT_TIMEOUT_MS,
  "sentence-grade": SHORT_TIMEOUT_MS,
  "grammar-exercise": SHORT_TIMEOUT_MS,
  "grammar-explanation": SHORT_TIMEOUT_MS,
  "exam-explanation": SHORT_TIMEOUT_MS,
  "exam-grade": SHORT_TIMEOUT_MS,
  // Long phrase, three tones on opencode (the fallback behind Groq) measured up to 8.9 s.
  translation: 15_000,
  "vocab-context": SHORT_TIMEOUT_MS,
  "speaking-roleplay": SHORT_TIMEOUT_MS,
  "writing-grade": 40_000,
};

// Tasks where a quick answer matters more than deep reasoning. Groq's gpt-oss at "low" effort measured
// 2.5 s → 1.1 s (one tone) and 4.9 s → 2.3 s (three tones) with ~50% fewer tokens (Nov 2026).
// Grading thinks "low" by default: the writing score appeared after 5.5 s instead of 2.3 s and finished in 7.5 s instead of 12.5 s,
// with the same bands on 3 samples (Nov 2026). GRADING_EFFORT=none is faster still; any other value restores the model's default thinking.
const GRADING_EFFORT = (process.env.GRADING_EFFORT ?? "low") === "low" ? "low" : process.env.GRADING_EFFORT === "none" ? "none" : undefined;
const TASK_EFFORT: Partial<Record<AITaskName, "low" | "none">> = {
  translation: "low",
  ...(GRADING_EFFORT && { "writing-grade": GRADING_EFFORT, "speaking-grade": GRADING_EFFORT }),
};

export function getTaskProviderMap(): Record<AITaskName, string> {
  return { ...TASK_PROVIDER_MAP };
}

/** Provider preference, per-call options and the locked-provider filter shared by callTask and streamTask. */
async function prepare(opts: CallTaskOptions) {
  const preferred = opts.provider ?? (TASK_PROVIDER_MAP[opts.task] || undefined);
  const timeoutMs = TASK_TIMEOUT_MS[opts.task];
  const callOpts = {
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(timeoutMs !== undefined && { timeoutMs }),
    ...(TASK_EFFORT[opts.task] && { effort: TASK_EFFORT[opts.task] }),
  };
  // Locked providers are dropped here, so no route can reach them without the unlock cookie.
  const blocked = await blockedProviderIds();
  const disabled = blocked.length ? [...(opts.disabledProviders ?? []), ...blocked] : opts.disabledProviders;
  return { preferred, callOpts, disabled };
}

function record(opts: CallTaskOptions, r: { start: number; success: boolean; providerId: string; outChars: number; failed: string[] }) {
  const latencyMs = Date.now() - r.start;
  const repair = opts.repair ?? false;
  recordMetric({ task: opts.task, latencyMs, success: r.success, usedFallback: r.failed.length > 0, provider: r.providerId || undefined, attempts: r.failed.length + (r.success ? 1 : 0), outChars: r.outChars, repair });
  logEventAfter({ kind: "ai", name: opts.task, ms: latencyMs, ok: r.success, provider: r.providerId || null, fallback: r.failed.length > 0, repair });
  // One JSON line per AI call so Vercel logs can be filtered/aggregated (`evt:"ai_call"`).
  // ponytail: output size in chars (≈ tokens × 4); read usage.completion_tokens from the providers if exact counts matter.
  const line = JSON.stringify({ evt: "ai_call", task: opts.task, provider: r.providerId || null, ms: latencyMs, ok: r.success, failed: r.failed, outChars: r.outChars, promptChars: opts.prompt.length, repair });
  if (process.env.NODE_ENV !== "test") (r.success ? console.info : console.warn)(line);
}

function failRecorder(failed: string[]) {
  return (id: string, err: unknown) => {
    const status = (err as { status?: number }).status;
    failed.push(status ? `${id}:${status}` : id);
  };
}

export async function callTask(opts: CallTaskOptions): Promise<{ text: string; providerId: string }> {
  const start = Date.now();
  let success = false;
  let providerId = "";
  let outChars = 0;
  const failed: string[] = [];

  try {
    const { preferred, callOpts, disabled } = await prepare(opts);
    const result = await callWithFallback(opts.prompt, preferred, disabled, callOpts, failRecorder(failed));
    success = true;
    providerId = result.providerId;
    outChars = result.text.length;
    return result;
  } finally {
    record(opts, { start, success, providerId, outChars, failed });
  }
}

/**
 * callTask that hands back the text as it is written. Resolves once the first chunk has arrived (so a failing
 * provider still falls back); the metric is recorded when the stream ends or breaks.
 */
export async function streamTask(opts: CallTaskOptions): Promise<{ stream: AsyncGenerator<string>; providerId: string }> {
  const start = Date.now();
  const failed: string[] = [];
  let source: Awaited<ReturnType<typeof streamWithFallback>>;
  try {
    const { preferred, callOpts, disabled } = await prepare(opts);
    source = await streamWithFallback(opts.prompt, preferred, disabled, callOpts, failRecorder(failed));
  } catch (error) {
    record(opts, { start, success: false, providerId: "", outChars: 0, failed });
    throw error;
  }
  const { providerId } = source;
  const stream = (async function* () {
    let outChars = 0;
    let success = false;
    try {
      for await (const chunk of source.stream) {
        outChars += chunk.length;
        yield chunk;
      }
      success = true;
    } finally {
      record(opts, { start, success, providerId, outChars, failed });
    }
  })();
  return { stream, providerId };
}
