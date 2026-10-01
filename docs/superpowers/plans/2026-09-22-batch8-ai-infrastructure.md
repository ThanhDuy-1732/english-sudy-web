# Batch 8: AI Infrastructure v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a task-aware AI routing layer, add per-provider metrics (latency / success / fallback), and centralize prompts in a typed registry — without breaking any existing API routes.

**Architecture:** `src/lib/ai-tasks.ts` defines AI task types and a task router; API routes call `callTask(taskName, input)` instead of `callWithFallback` directly. `src/lib/ai-metrics.ts` records per-call metrics to localStorage. `src/lib/ai-prompts.ts` is the prompt registry. All existing routes continue to work during migration — each route is updated independently.

**Tech Stack:** Next.js 14 App Router, TypeScript, Jest (jsdom), localStorage (metrics)

**Spec:** `docs/requirement/DEVELOPMENT_DIRECTION.md` §16 (AI Infrastructure v2), Batch 8 in §18

## Global Constraints

- No new npm dependencies.
- All AI calls remain server-side — none of these modules are imported on the client.
- Existing routes must not break during migration — routes can be migrated one at a time.
- Do not log raw essay or transcript content in metrics (privacy).
- Prompt registry entries must have `taskName`, `version`, and `schema` (Zod or inline type).
- `npm test && npm run lint && npm run build` must pass after every task.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/ai-tasks.ts` | Task type enum + `callTask` wrapper |
| Create | `src/lib/__tests__/ai-tasks.test.ts` | Unit tests (mocked providers) |
| Create | `src/lib/ai-metrics.ts` | Record + read per-task metrics |
| Create | `src/lib/__tests__/ai-metrics.test.ts` | Unit tests |
| Create | `src/lib/ai-prompts.ts` | Prompt registry with typed entries |
| Modify | `src/app/api/generate-words/route.ts` | Migrate to `callTask("word-generation", ...)` |
| Modify | `src/app/api/exam/generate-item/route.ts` | Migrate to `callTask("exam-generation", ...)` |
| Modify | `src/app/api/speech/grade/route.ts` | Migrate to `callTask("speaking-grade", ...)` |
| Modify | `src/app/api/write/grade/route.ts` | Migrate to `callTask("writing-grade", ...)` |
| Create | `src/app/api/admin/metrics/route.ts` | GET `/api/admin/metrics` — aggregated metrics |

---

## Task 1: AI Task types and task router

**Files:**
- Create: `src/lib/ai-tasks.ts`
- Create: `src/lib/__tests__/ai-tasks.test.ts`

**Interfaces — Produces (used by Tasks 3–4):**
```ts
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
  outputType?: "text" | "json";
  schema?: import("zod").ZodTypeAny;
}
```

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/ai-tasks.test.ts
import { callTask, getTaskProviderMap } from "../ai-tasks";

// Mock callWithFallback
jest.mock("../providers/provider-utils", () => ({
  callWithFallback: jest.fn().mockResolvedValue("mock response"),
}));

test("callTask calls callWithFallback with correct params", async () => {
  const { callWithFallback } = require("../providers/provider-utils");
  await callTask({ task: "word-generation", prompt: "generate 10 words about business" });
  expect(callWithFallback).toHaveBeenCalledWith(
    expect.objectContaining({ prompt: "generate 10 words about business" })
  );
});

test("getTaskProviderMap returns a map with all task names", () => {
  const map = getTaskProviderMap();
  expect(map["word-generation"]).toBeDefined();
  expect(map["speaking-grade"]).toBeDefined();
  expect(map["writing-grade"]).toBeDefined();
});
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="ai-tasks" --no-coverage
```

- [ ] **Step 3: Implement `src/lib/ai-tasks.ts`**

```ts
import { callWithFallback } from "./providers/provider-utils";
import { recordMetric } from "./ai-metrics";

// Task → preferred provider (empty string = use default fallback chain)
// ponytail: static map for now; make this a settings-driven config if A/B needed
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

export async function callTask(opts: CallTaskOptions): Promise<string> {
  const preferred = TASK_PROVIDER_MAP[opts.task];
  const start = Date.now();
  let usedFallback = false;
  let success = false;

  try {
    const result = await callWithFallback({
      prompt: opts.prompt,
      provider: opts.provider ?? (preferred || undefined),
      disabledProviders: opts.disabledProviders,
      outputType: opts.outputType ?? "text",
      schema: opts.schema,
    });
    success = true;
    return result as string;
  } catch (err) {
    usedFallback = true;
    throw err;
  } finally {
    recordMetric({
      task: opts.task,
      latencyMs: Date.now() - start,
      success,
      usedFallback,
    });
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="ai-tasks" --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-tasks.ts src/lib/__tests__/ai-tasks.test.ts
git commit -m "feat: add AI task router (batch8)"
```

---

## Task 2: Provider Metrics

**Files:**
- Create: `src/lib/ai-metrics.ts`
- Create: `src/lib/__tests__/ai-metrics.test.ts`

**Note:** Metrics are recorded server-side during API route execution but stored in-memory per server instance. For a stateless server (Firebase/Vercel), persist to a lightweight localStorage-like store on the client via a metrics endpoint. For v1, store in-memory and expose via `/api/admin/metrics`.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/ai-metrics.test.ts
import { recordMetric, getMetrics, clearMetrics } from "../ai-metrics";

beforeEach(() => { clearMetrics(); });

test("recordMetric stores a metric entry", () => {
  recordMetric({ task: "word-generation", latencyMs: 450, success: true, usedFallback: false });
  expect(getMetrics()).toHaveLength(1);
});

test("getMetrics returns all recorded metrics", () => {
  recordMetric({ task: "exam-generation", latencyMs: 1200, success: true, usedFallback: false });
  recordMetric({ task: "speaking-grade", latencyMs: 3000, success: false, usedFallback: true });
  expect(getMetrics()).toHaveLength(2);
});

test("metrics cap at 1000 entries", () => {
  for (let i = 0; i < 1100; i++) {
    recordMetric({ task: "word-generation", latencyMs: 100, success: true, usedFallback: false });
  }
  expect(getMetrics().length).toBeLessThanOrEqual(1000);
});
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="ai-metrics" --no-coverage
```

- [ ] **Step 3: Implement `src/lib/ai-metrics.ts`**

```ts
const MAX = 1000;

export interface MetricEntry {
  task: AITaskName;
  latencyMs: number;
  success: boolean;
  usedFallback: boolean;
  provider?: string;
  at: string;
}

// ponytail: in-memory store per server instance; for multi-instance deployments use a persistent store
const metrics: MetricEntry[] = [];

export function recordMetric(entry: Omit<MetricEntry, "at">): void {
  metrics.unshift({ ...entry, at: new Date().toISOString() });
  if (metrics.length > MAX) metrics.splice(MAX);
}

export function getMetrics(): MetricEntry[] {
  return [...metrics];
}

export function clearMetrics(): void {
  metrics.length = 0;
}

export function getAggregatedMetrics(): Record<string, {
  count: number; avgLatencyMs: number; successRate: number; fallbackRate: number;
}> {
  const agg: Record<string, { total: number; latency: number; success: number; fallback: number }> = {};
  for (const m of metrics) {
    const k = m.task;
    if (!agg[k]) agg[k] = { total: 0, latency: 0, success: 0, fallback: 0 };
    agg[k].total++;
    agg[k].latency += m.latencyMs;
    if (m.success) agg[k].success++;
    if (m.usedFallback) agg[k].fallback++;
  }
  return Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, {
    count: v.total,
    avgLatencyMs: Math.round(v.latency / v.total),
    successRate: Math.round((v.success / v.total) * 100),
    fallbackRate: Math.round((v.fallback / v.total) * 100),
  }]));
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/thankz/Code/study && npm test -- --testPathPattern="ai-metrics" --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-metrics.ts src/lib/__tests__/ai-metrics.test.ts
git commit -m "feat: add AI provider metrics (batch8)"
```

---

## Task 3: Prompt Registry

**Files:**
- Create: `src/lib/ai-prompts.ts`

A typed object mapping each task name to its prompt template and expected output schema description.

- [ ] **Step 1: Create `src/lib/ai-prompts.ts`**

```ts
export interface PromptDefinition {
  task: AITaskName;
  version: string;
  description: string;
  buildPrompt: (input: Record<string, unknown>) => string;
  outputDescription: string;
}

export const PROMPTS: Partial<Record<AITaskName, PromptDefinition>> = {
  "word-generation": {
    task: "word-generation",
    version: "1.0",
    description: "Generate vocabulary words for a given topic",
    buildPrompt: ({ topic, count = 10 }) =>
      `Generate ${count} English vocabulary words for the topic: "${topic}".
Return a JSON array: [{"word": "...", "meaning": "Vietnamese meaning"}].
Only the JSON array, no explanation.`,
    outputDescription: '{"word": string, "meaning": string}[]',
  },
  "sentence-generation": {
    task: "sentence-generation",
    version: "1.0",
    description: "Generate an example sentence for a word",
    buildPrompt: ({ word }) =>
      `Write one natural English example sentence using the word "${word}".
Return only the sentence, no explanation.`,
    outputDescription: "string",
  },
  "grammar-generation": {
    task: "grammar-generation",
    version: "1.0",
    description: "Generate a grammar topic with rules and examples",
    buildPrompt: ({ request }) =>
      `Create a grammar topic about: "${request}".
Return structured JSON with title, description, and subRules array.`,
    outputDescription: "GrammarTopic JSON",
  },
  "exam-generation": {
    task: "exam-generation",
    version: "1.0",
    description: "Generate an exam question item",
    buildPrompt: ({ kind, part, level, topic }) =>
      `Generate a ${kind} ${part} Level ${level} exam question${topic ? ` about "${topic}"` : ""}.
Return valid ExamItem JSON.`,
    outputDescription: "ExamItem JSON",
  },
  "speaking-grade": {
    task: "speaking-grade",
    version: "1.0",
    description: "Grade a speaking transcript on IELTS band criteria",
    buildPrompt: ({ task, transcript, durationSec }) =>
      `Grade this ${task} speaking attempt (${durationSec}s) on IELTS criteria.
Transcript: "${transcript}"
Return SpeakingFeedback JSON with bands (fluency, lexical, grammar, pronunciation), overall, strengths, improvements.`,
    outputDescription: "SpeakingFeedback JSON",
  },
  "writing-grade": {
    task: "writing-grade",
    version: "1.0",
    description: "Grade a writing submission on IELTS/TOEIC criteria",
    buildPrompt: ({ kind, prompt: writingPrompt, content }) =>
      `Grade this ${kind} writing submission.
Task: "${writingPrompt}"
Content: [essay content — not logged]
Return WritingFeedback JSON with bands (task, coherence, lexical, grammar), overall, annotations, modelAnswer, nextFocus.`,
    outputDescription: "WritingFeedback JSON",
  },
  "vocab-context": {
    task: "vocab-context",
    version: "1.0",
    description: "Generate context text using target vocabulary words",
    buildPrompt: ({ words, format }) =>
      `Create a ${format} in English that uses ALL of these words: ${(words as string[]).join(", ")}.
Mark each target word with **bold**. Return only the text.`,
    outputDescription: "string",
  },
};

export function getPrompt(task: AITaskName): PromptDefinition | undefined {
  return PROMPTS[task];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai-prompts.ts
git commit -m "feat: add AI prompt registry (batch8)"
```

---

## Task 4: Migrate key API routes to use `callTask`

Migrate 4 routes; leave others unchanged. Each migration is one commit.

**Routes to migrate:**
1. `src/app/api/generate-words/route.ts` → `callTask("word-generation", ...)`
2. `src/app/api/speech/grade/route.ts` → `callTask("speaking-grade", ...)`
3. `src/app/api/write/grade/route.ts` → `callTask("writing-grade", ...)`
4. `src/app/api/vocab/context/route.ts` → `callTask("vocab-context", ...)`

- [ ] **Step 1: Migrate generate-words route**

In `src/app/api/generate-words/route.ts`, replace `callWithFallback(...)` with:
```ts
import { callTask } from "@/lib/ai-tasks";

// Replace:
const result = await callWithFallback({ prompt, provider, disabledProviders });
// With:
const result = await callTask({ task: "word-generation", prompt, provider, disabledProviders });
```

- [ ] **Step 2: Verify route still works**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Migrate speech/grade and write/grade similarly**

Follow the same pattern for the other two routes: import `callTask`, replace the `callWithFallback` call with `callTask({ task: "speaking-grade" | "writing-grade", ... })`.

- [ ] **Step 4: Create metrics endpoint**

```ts
// src/app/api/admin/metrics/route.ts
import { NextResponse } from "next/server";
import { getAggregatedMetrics } from "@/lib/ai-metrics";

export function GET() {
  return NextResponse.json(getAggregatedMetrics());
}
```

- [ ] **Step 5: Full test + build + commit**

```bash
cd /Users/thankz/Code/study && npm test && npm run lint && npm run build 2>&1 | tail -10
git add src/lib/ai-tasks.ts src/lib/ai-metrics.ts src/lib/ai-prompts.ts \
  src/app/api/generate-words/route.ts src/app/api/speech/grade/route.ts \
  src/app/api/write/grade/route.ts src/app/api/admin/metrics/route.ts
git commit -m "feat: migrate key routes to callTask + add metrics endpoint (batch8)"
```

---

## Acceptance Criteria

- [ ] `callTask` wraps `callWithFallback` and records a metric on every call.
- [ ] `getAggregatedMetrics()` returns count, avgLatencyMs, successRate, fallbackRate per task.
- [ ] Migrated routes (`generate-words`, `speech/grade`, `write/grade`) still return correct responses.
- [ ] `PROMPTS` registry has entries for all 7 defined tasks.
- [ ] `/api/admin/metrics` returns JSON (no auth — internal use; add auth if needed).
- [ ] No raw essay or transcript content in metrics.
- [ ] `npm test && npm run lint && npm run build` pass.

## Risks

- `callWithFallback` import path may differ from `@/lib/providers/provider-utils` — check actual path in existing routes before writing tests.
- In-memory metrics reset on each server cold start (serverless) — acceptable for v1 monitoring.
- `GRADING_PROVIDER` env var read at module load time — ensure it's available in all environments.

## Dependencies

- Existing `callWithFallback` and provider chain in `src/lib/providers/`.
- All other batches are optional dependencies (this batch is purely infrastructure).

## Out of Scope

- Persistent metrics storage (database or external service).
- A/B testing between providers.
- Dynamic prompt editing UI.
- Rate limiting or cost tracking per provider.
