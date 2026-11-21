import { callWithFallback } from "./providers";
import { recordMetric } from "./ai-metrics";
import { logEventAfter } from "./db-events";

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
  translation: SHORT_TIMEOUT_MS,
  "vocab-context": SHORT_TIMEOUT_MS,
  "speaking-roleplay": SHORT_TIMEOUT_MS,
  "writing-grade": 40_000,
};

export function getTaskProviderMap(): Record<AITaskName, string> {
  return { ...TASK_PROVIDER_MAP };
}

export async function callTask(opts: CallTaskOptions): Promise<{ text: string; providerId: string }> {
  const preferred = opts.provider ?? (TASK_PROVIDER_MAP[opts.task] || undefined);
  const start = Date.now();
  let success = false;
  let providerId = "";
  let outChars = 0;
  const failed: string[] = [];

  try {
    const timeoutMs = TASK_TIMEOUT_MS[opts.task];
    const callOpts = {
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      ...(timeoutMs !== undefined && { timeoutMs }),
    };
    const result = await callWithFallback(opts.prompt, preferred, opts.disabledProviders, callOpts, (id, err) => {
      const status = (err as { status?: number }).status;
      failed.push(status ? `${id}:${status}` : id);
    });
    success = true;
    providerId = result.providerId;
    outChars = result.text.length;
    return result;
  } finally {
    const latencyMs = Date.now() - start;
    const repair = opts.repair ?? false;
    recordMetric({ task: opts.task, latencyMs, success, usedFallback: failed.length > 0, provider: providerId || undefined, attempts: failed.length + (success ? 1 : 0), outChars, repair });
    logEventAfter({ kind: "ai", name: opts.task, ms: latencyMs, ok: success, provider: providerId || null, fallback: failed.length > 0, repair });
    // One JSON line per AI call so Vercel logs can be filtered/aggregated (`evt:"ai_call"`).
    // ponytail: output size in chars (≈ tokens × 4); read usage.completion_tokens from the providers if exact counts matter.
    const line = JSON.stringify({ evt: "ai_call", task: opts.task, provider: providerId || null, ms: latencyMs, ok: success, failed, outChars, promptChars: opts.prompt.length, repair });
    if (process.env.NODE_ENV !== "test") (success ? console.info : console.warn)(line);
  }
}
