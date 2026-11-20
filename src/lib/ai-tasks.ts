import { callWithFallback } from "./providers";
import { recordMetric } from "./ai-metrics";

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
  translation: "",
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
    const callOpts = opts.temperature !== undefined ? { temperature: opts.temperature } : {};
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
    // One JSON line per AI call so Vercel logs can be filtered/aggregated (`evt:"ai_call"`).
    // ponytail: output size in chars (≈ tokens × 4); read usage.completion_tokens from the providers if exact counts matter.
    const line = JSON.stringify({ evt: "ai_call", task: opts.task, provider: providerId || null, ms: latencyMs, ok: success, failed, outChars, promptChars: opts.prompt.length, repair });
    if (process.env.NODE_ENV !== "test") (success ? console.info : console.warn)(line);
  }
}
