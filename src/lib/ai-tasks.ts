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
  | "vocab-context";

export interface CallTaskOptions {
  task: AITaskName;
  prompt: string;
  provider?: string;
  disabledProviders?: string[];
  temperature?: number;
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
};

export function getTaskProviderMap(): Record<AITaskName, string> {
  return { ...TASK_PROVIDER_MAP };
}

export async function callTask(opts: CallTaskOptions): Promise<{ text: string; providerId: string }> {
  const preferred = opts.provider ?? (TASK_PROVIDER_MAP[opts.task] || undefined);
  const start = Date.now();
  let success = false;
  let usedFallback = false;
  let providerId = "";

  try {
    const callOpts = opts.temperature !== undefined ? { temperature: opts.temperature } : {};
    const result = await callWithFallback(opts.prompt, preferred, opts.disabledProviders, callOpts);
    success = true;
    providerId = result.providerId;
    return result;
  } catch (err) {
    usedFallback = true;
    throw err;
  } finally {
    recordMetric({ task: opts.task, latencyMs: Date.now() - start, success, usedFallback, provider: providerId || undefined });
  }
}
