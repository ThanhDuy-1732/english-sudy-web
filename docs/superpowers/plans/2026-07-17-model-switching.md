# Model Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm khả năng tự động và thủ công switch giữa các AI provider (Gemini, Groq, HuggingFace) khi API key vượt ngưỡng quota.

**Architecture:** Client-driven: client giữ `currentProvider` trong React context, gửi kèm mỗi API request. Server có provider registry + `callWithFallback` tự động thử provider tiếp theo khi gặp 429/503, trả về header `X-Provider-Used` để client đồng bộ. Provider không có API key bị bỏ qua hoàn toàn.

**Tech Stack:** `@google/generative-ai` (Gemini), `openai` package (Groq + HuggingFace via OpenAI-compat API), Next.js App Router, React Context, Tailwind CSS, Jest + React Testing Library.

## Global Constraints

- Tất cả API keys chỉ tồn tại server-side (`process.env.*`) — không bao giờ gửi về client.
- Provider không có key trong `.env.local` bị bỏ qua hoàn toàn, không gây lỗi runtime.
- Không thêm database — tất cả session state lưu trong `localStorage` client-side.
- Theo đúng style TypeScript strict của codebase hiện tại.
- Test framework: Jest + `jsdom`, path alias `@/` = `src/`.

---

## File Structure

### Tạo mới
```
src/lib/providers/
  types.ts                       ← AIProvider interface + ProviderInfo type
  gemini.ts                      ← GeminiProvider class (wraps @google/generative-ai)
  openai-compat.ts               ← OpenAICompatProvider class (dùng openai package)
  index.ts                       ← registry + callWithFallback + getRegisteredProviders
  __tests__/
    gemini.test.ts
    openai-compat.test.ts
    index.test.ts

src/app/api/providers/route.ts   ← GET endpoint trả về danh sách active providers
src/contexts/ProviderContext.tsx  ← React context: currentProvider, setProvider, availableProviders
src/lib/useApiFetch.ts           ← Hook bọc fetch: inject provider + sync X-Provider-Used header
src/components/ProviderBadge.tsx ← Badge trên header, dropdown switch + link settings
src/app/settings/page.tsx        ← Trang cài đặt hiển thị tất cả providers
```

### Sửa đổi
```
src/lib/gemini.ts                ← Bỏ internal model calls; tất cả hàm nhận generateContentFn param
src/lib/__tests__/gemini.test.ts ← Update tests theo signature mới (không cần mock @google/generative-ai)
src/app/api/generate-words/route.ts     ─┐
src/app/api/generate-sentence/route.ts  │
src/app/api/generate-synonyms/route.ts  │ Mỗi route: nhận provider? từ body,
src/app/api/grade-sentence/route.ts     │ dùng callWithFallback, set X-Provider-Used header
src/app/api/generate-batch/route.ts     │
src/app/api/generate-fillblank/route.ts │
src/app/api/generate-reading/route.ts  ─┘
src/app/layout.tsx               ← Thêm ProviderContextProvider + ProviderBadge + link Settings
```

---

## Task 1: Provider types + GeminiProvider adapter

**Files:**
- Create: `src/lib/providers/types.ts`
- Create: `src/lib/providers/gemini.ts`
- Create: `src/lib/providers/__tests__/gemini.test.ts`

**Interfaces:**
- Produces: `AIProvider`, `ProviderInfo` (dùng ở Task 2, 3, 5, 6)
- Produces: `GeminiProvider` class (dùng ở Task 3)

- [ ] **Step 1: Tạo types.ts**

```ts
// src/lib/providers/types.ts
export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
}

export interface AIProvider extends ProviderInfo {
  generateContent(prompt: string): Promise<string>;
}
```

- [ ] **Step 2: Tạo providers/gemini.ts**

```ts
// src/lib/providers/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider } from "./types";

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly name: string;
  readonly model: string;
  private client: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]>;

  constructor(apiKey: string, model: string) {
    this.model = model;
    this.name = "Gemini Flash";
    const genAI = new GoogleGenerativeAI(apiKey);
    this.client = genAI.getGenerativeModel({ model });
  }

  async generateContent(prompt: string): Promise<string> {
    try {
      const result = await this.client.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 429 || status === 500 || status === 503) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const result = await this.client.generateContent(prompt);
        return result.response.text();
      }
      throw error;
    }
  }
}
```

- [ ] **Step 3: Viết failing tests**

```ts
// src/lib/providers/__tests__/gemini.test.ts
const mockGenerateContent = jest.fn();
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({ generateContent: mockGenerateContent }),
  })),
}));

import { GeminiProvider } from "../gemini";

beforeEach(() => mockGenerateContent.mockReset());

const provider = new GeminiProvider("test-key", "gemini-flash-latest");

test("generateContent returns response text", async () => {
  mockGenerateContent.mockResolvedValue({ response: { text: () => "hello" } });
  expect(await provider.generateContent("test prompt")).toBe("hello");
  expect(mockGenerateContent).toHaveBeenCalledTimes(1);
});

test("generateContent retries once on 429", async () => {
  mockGenerateContent
    .mockRejectedValueOnce({ status: 429 })
    .mockResolvedValueOnce({ response: { text: () => "hello after retry" } });
  expect(await provider.generateContent("test")).toBe("hello after retry");
  expect(mockGenerateContent).toHaveBeenCalledTimes(2);
});

test("generateContent throws immediately on 401", async () => {
  mockGenerateContent.mockRejectedValue({ status: 401 });
  await expect(provider.generateContent("test")).rejects.toMatchObject({ status: 401 });
  expect(mockGenerateContent).toHaveBeenCalledTimes(1);
});

test("provider has correct metadata", () => {
  expect(provider.id).toBe("gemini");
  expect(provider.model).toBe("gemini-flash-latest");
});
```

- [ ] **Step 4: Chạy tests để xác nhận fail**

```bash
npm test -- --testPathPattern=providers/gemini
```

Expected: FAIL vì file chưa tồn tại (nhưng sau step 2 thì pass — chạy lại để confirm pass).

- [ ] **Step 5: Chạy test pass**

```bash
npm test -- --testPathPattern=providers/gemini
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/providers/types.ts src/lib/providers/gemini.ts src/lib/providers/__tests__/gemini.test.ts
git commit -m "feat: add AIProvider types and GeminiProvider adapter"
```

---

## Task 2: OpenAI-compat adapter

**Files:**
- Install: `openai` package
- Create: `src/lib/providers/openai-compat.ts`
- Create: `src/lib/providers/__tests__/openai-compat.test.ts`

**Interfaces:**
- Consumes: `AIProvider` từ `./types`
- Produces: `OpenAICompatProvider` class (dùng ở Task 3)

- [ ] **Step 1: Cài openai package**

```bash
npm install openai
```

- [ ] **Step 2: Tạo openai-compat.ts**

```ts
// src/lib/providers/openai-compat.ts
import OpenAI from "openai";
import type { AIProvider } from "./types";

interface OpenAICompatConfig {
  id: string;
  name: string;
  apiKey: string;
  model: string;
  baseURL: string;
}

export class OpenAICompatProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  private client: OpenAI;

  constructor(config: OpenAICompatConfig) {
    this.id = config.id;
    this.name = config.name;
    this.model = config.model;
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  }

  async generateContent(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
    });
    return response.choices[0]?.message?.content ?? "";
  }
}
```

- [ ] **Step 3: Viết tests**

```ts
// src/lib/providers/__tests__/openai-compat.test.ts
const mockCreate = jest.fn();
jest.mock("openai", () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }))
);

import { OpenAICompatProvider } from "../openai-compat";

beforeEach(() => mockCreate.mockReset());

const provider = new OpenAICompatProvider({
  id: "groq",
  name: "Groq",
  apiKey: "test-key",
  model: "llama-3.3-70b-versatile",
  baseURL: "https://api.groq.com/openai/v1",
});

test("generateContent returns message content", async () => {
  mockCreate.mockResolvedValue({ choices: [{ message: { content: "hello from groq" } }] });
  expect(await provider.generateContent("test prompt")).toBe("hello from groq");
  expect(mockCreate).toHaveBeenCalledWith({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: "test prompt" }],
  });
});

test("generateContent returns empty string when content is null", async () => {
  mockCreate.mockResolvedValue({ choices: [{ message: { content: null } }] });
  expect(await provider.generateContent("test")).toBe("");
});

test("provider has correct metadata", () => {
  expect(provider.id).toBe("groq");
  expect(provider.name).toBe("Groq");
  expect(provider.model).toBe("llama-3.3-70b-versatile");
});
```

- [ ] **Step 4: Chạy tests**

```bash
npm test -- --testPathPattern=providers/openai-compat
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/openai-compat.ts src/lib/providers/__tests__/openai-compat.test.ts package.json package-lock.json
git commit -m "feat: add OpenAICompatProvider for Groq and HuggingFace"
```

---

## Task 3: Provider Registry + callWithFallback

**Files:**
- Create: `src/lib/providers/index.ts`
- Create: `src/lib/providers/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `GeminiProvider` từ `./gemini`, `OpenAICompatProvider` từ `./openai-compat`, `AIProvider`, `ProviderInfo` từ `./types`
- Produces:
  - `getRegisteredProviders(): ProviderInfo[]` (dùng ở Task 5 — GET /api/providers)
  - `callWithFallback(prompt: string, preferredId?: string): Promise<{ text: string; providerId: string }>` (dùng ở Task 5 — routes)

- [ ] **Step 1: Viết failing tests trước**

```ts
// src/lib/providers/__tests__/index.test.ts
const mockGenA = jest.fn<Promise<string>, [string]>();
const mockGenB = jest.fn<Promise<string>, [string]>();

const providerA = { id: "a", name: "Provider A", model: "model-a", generateContent: mockGenA };
const providerB = { id: "b", name: "Provider B", model: "model-b", generateContent: mockGenB };

// Override registry for tests
jest.mock("../index", () => {
  const actual = jest.requireActual("../index") as typeof import("../index");
  return actual;
});

// We test callWithFallback by injecting providers via env mocking
// Since registry is built at module load, we test the exported functions directly
// using a testable version

import { callWithFallback, getRegisteredProviders } from "../index";

beforeEach(() => {
  mockGenA.mockReset();
  mockGenB.mockReset();
});

// Test callWithFallback logic via a factory function that accepts providers
// Import the internal helper for testing
```

Note: vì registry được build tại module load từ env, cần test `callWithFallback` với cách inject khác. Refactor `index.ts` để expose `createCallWithFallback` cho testing:

- [ ] **Step 2: Tạo providers/index.ts**

```ts
// src/lib/providers/index.ts
import { GeminiProvider } from "./gemini";
import { OpenAICompatProvider } from "./openai-compat";
import type { AIProvider, ProviderInfo } from "./types";

function isRetryableError(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  return status === 429 || status === 503;
}

export function createCallWithFallback(providers: AIProvider[]) {
  return async function callWithFallback(
    prompt: string,
    preferredId?: string
  ): Promise<{ text: string; providerId: string }> {
    const ordered = preferredId
      ? [
          ...providers.filter((p) => p.id === preferredId),
          ...providers.filter((p) => p.id !== preferredId),
        ]
      : providers;

    if (ordered.length === 0) {
      throw new Error("No AI providers configured");
    }

    let lastError: unknown;
    for (const provider of ordered) {
      try {
        const text = await provider.generateContent(prompt);
        return { text, providerId: provider.id };
      } catch (error) {
        if (!isRetryableError(error)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  };
}

function buildRegistry(): AIProvider[] {
  const providers: AIProvider[] = [];

  if (process.env.GEMINI_API_KEY) {
    providers.push(
      new GeminiProvider(
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_MODEL ?? "gemini-flash-latest"
      )
    );
  }

  if (process.env.GROQ_API_KEY) {
    providers.push(
      new OpenAICompatProvider({
        id: "groq",
        name: "Groq",
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        baseURL: "https://api.groq.com/openai/v1",
      })
    );
  }

  if (process.env.HUGGINGFACE_API_KEY) {
    providers.push(
      new OpenAICompatProvider({
        id: "huggingface",
        name: "HuggingFace",
        apiKey: process.env.HUGGINGFACE_API_KEY,
        model: process.env.HUGGINGFACE_MODEL ?? "mistralai/Mistral-7B-v0.1",
        baseURL: "https://api-inference.huggingface.co/v1",
      })
    );
  }

  return providers;
}

const registry = buildRegistry();

export const callWithFallback = createCallWithFallback(registry);

export function getRegisteredProviders(): ProviderInfo[] {
  return registry.map(({ id, name, model }) => ({ id, name, model }));
}
```

- [ ] **Step 3: Viết tests dùng createCallWithFallback**

```ts
// src/lib/providers/__tests__/index.test.ts
import { createCallWithFallback, getRegisteredProviders } from "../index";
import type { AIProvider } from "../types";

const makeProvider = (id: string, fn: jest.Mock): AIProvider => ({
  id,
  name: `Provider ${id}`,
  model: `model-${id}`,
  generateContent: fn,
});

test("callWithFallback returns text and providerId from first provider", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-a");
  const fn = createCallWithFallback([makeProvider("a", mockA)]);
  const result = await fn("hello");
  expect(result).toEqual({ text: "result-a", providerId: "a" });
});

test("callWithFallback prefers provider matching preferredId", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-a");
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-b");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  const result = await fn("hello", "b");
  expect(result).toEqual({ text: "result-b", providerId: "b" });
  expect(mockA).not.toHaveBeenCalled();
});

test("callWithFallback falls back on 429", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 429 });
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-b");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  const result = await fn("hello");
  expect(result).toEqual({ text: "result-b", providerId: "b" });
});

test("callWithFallback falls back on 503", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 503 });
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("ok");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  const result = await fn("hello");
  expect(result.providerId).toBe("b");
});

test("callWithFallback throws immediately on 401", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 401 });
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("ok");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  await expect(fn("hello")).rejects.toMatchObject({ status: 401 });
  expect(mockB).not.toHaveBeenCalled();
});

test("callWithFallback throws when all providers fail with 429", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 429 });
  const mockB = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 429 });
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  await expect(fn("hello")).rejects.toMatchObject({ status: 429 });
});

test("callWithFallback throws when no providers configured", async () => {
  const fn = createCallWithFallback([]);
  await expect(fn("hello")).rejects.toThrow("No AI providers configured");
});

test("getRegisteredProviders returns only safe fields", () => {
  const providers = getRegisteredProviders();
  providers.forEach((p) => {
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("name");
    expect(p).toHaveProperty("model");
    expect(p).not.toHaveProperty("generateContent");
  });
});
```

- [ ] **Step 4: Chạy tests**

```bash
npm test -- --testPathPattern=providers/index
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/index.ts src/lib/providers/__tests__/index.test.ts
git commit -m "feat: add provider registry and callWithFallback with auto-fallback"
```

---

## Task 4: Refactor gemini.ts + update tests

**Files:**
- Modify: `src/lib/gemini.ts`
- Modify: `src/lib/__tests__/gemini.test.ts`

**Interfaces:**
- Produces (updated signatures):
  - `generateWords(topic: string, generateContentFn: (p: string) => Promise<string>): Promise<GeneratedWord[]>`
  - `generateSentence(word: string, generateContentFn: ...): Promise<string>`
  - `generateSynonyms(word: string, generateContentFn: ...): Promise<{ synonyms: string[]; antonyms: string[] }>`
  - `gradeSentence(word: string, sentence: string, generateContentFn: ...): Promise<{ score: number; feedback: string; corrected: string }>`
  - `generateFillBlank(word: string, generateContentFn: ...): Promise<{ sentence: string }>`
  - `generateWordsBatch(words: string[], generateContentFn: ...): Promise<BatchGeneratedWord[]>`
  - `generateReading(words: string[], generateContentFn: ...): Promise<{ passage: string; questions: ReadingQuestion[] }>`

- [ ] **Step 1: Thay thế toàn bộ nội dung gemini.ts**

```ts
// src/lib/gemini.ts
export interface GeneratedWord {
  word: string;
  meaning: string;
}

export interface BatchGeneratedWord extends GeneratedWord {
  example: string;
}

export interface ReadingQuestion {
  question: string;
  options: string[];
  answer: string;
}

type GenerateFn = (prompt: string) => Promise<string>;

function stripJsonCodeFence(text: string) {
  return text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
}

export async function generateWords(
  topic: string,
  generateContentFn: GenerateFn
): Promise<GeneratedWord[]> {
  const prompt = `Generate 5 English vocabulary words for the topic "${topic}". For each word, provide the Vietnamese meaning. Return ONLY a JSON array with no markdown: [{"word": "...", "meaning": "..."}]`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as GeneratedWord[];
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 100)}`);
  }
}

export async function generateSentence(
  word: string,
  generateContentFn: GenerateFn
): Promise<string> {
  const prompt = `Write one natural English example sentence using the word "${word}". Return only the sentence, nothing else.`;
  return (await generateContentFn(prompt)).trim();
}

export async function generateSynonyms(
  word: string,
  generateContentFn: GenerateFn
): Promise<{ synonyms: string[]; antonyms: string[] }> {
  const prompt = `For the English word "${word}", provide:\n- 2-3 synonyms\n- 1-2 antonyms\nReturn JSON only: {"synonyms": ["word1", "word2"], "antonyms": ["word1"]}`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as { synonyms: string[]; antonyms: string[] };
  } catch {
    return { synonyms: [], antonyms: [] };
  }
}

export async function gradeSentence(
  word: string,
  sentence: string,
  generateContentFn: GenerateFn
): Promise<{ score: number; feedback: string; corrected: string }> {
  const prompt = `Grade this English sentence that uses the word "${word}":\n"${sentence}"\n\nReturn JSON only:\n{"score": <number from 1 to 10>, "feedback": "<short Vietnamese feedback, one sentence>", "corrected": "<corrected sentence, same as input if no errors>"}`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as { score: number; feedback: string; corrected: string };
  } catch {
    throw new Error(`Gemini returned invalid JSON for gradeSentence: ${text.slice(0, 100)}`);
  }
}

export async function generateFillBlank(
  word: string,
  generateContentFn: GenerateFn
): Promise<{ sentence: string }> {
  const prompt = `Write one natural English sentence using the word "${word}". Replace the word "${word}" with "_____".\nReturn JSON only: {"sentence": "The sentence with _____ here."}`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as { sentence: string };
  } catch {
    throw new Error(`Gemini returned invalid JSON for generateFillBlank: ${text.slice(0, 100)}`);
  }
}

export async function generateWordsBatch(
  words: string[],
  generateContentFn: GenerateFn
): Promise<BatchGeneratedWord[]> {
  const wordList = words.slice(0, 20).join(", ");
  const prompt = `For each of these English words: ${wordList}\nProvide a concise Vietnamese meaning and one natural English example sentence.\nReturn JSON array only: [{"word":"...","meaning":"...","example":"..."}]`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as BatchGeneratedWord[];
  } catch {
    throw new Error(`Gemini returned invalid JSON for generateWordsBatch: ${text.slice(0, 100)}`);
  }
}

export async function generateReading(
  words: string[],
  generateContentFn: GenerateFn
): Promise<{ passage: string; questions: ReadingQuestion[] }> {
  const prompt = `Write a short English paragraph (80-100 words) that naturally uses all of these words: ${words.join(", ")}.\nThen write 2 comprehension questions, each with 3 multiple choice options (A, B, C).\nReturn JSON only: {"passage":"...","questions":[{"question":"...","options":["A. ...","B. ...","C. ..."],"answer":"A"}]}`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as { passage: string; questions: ReadingQuestion[] };
  } catch {
    throw new Error(`Gemini returned invalid JSON for generateReading: ${text.slice(0, 100)}`);
  }
}
```

- [ ] **Step 2: Thay thế toàn bộ gemini.test.ts**

Tests không còn cần mock `@google/generative-ai` — chỉ pass mock function trực tiếp:

```ts
// src/lib/__tests__/gemini.test.ts
import {
  generateWords,
  generateSentence,
  generateSynonyms,
  gradeSentence,
  generateFillBlank,
  generateWordsBatch,
  generateReading,
} from "../gemini";

const mockFn = jest.fn<Promise<string>, [string]>();

beforeEach(() => mockFn.mockReset());

// generateWords
test("generateWords returns parsed word array", async () => {
  const payload = [{ word: "negotiate", meaning: "đàm phán" }];
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await generateWords("TOEIC", mockFn)).toEqual(payload);
  expect(mockFn).toHaveBeenCalledTimes(1);
});

test("generateWords strips JSON code fence", async () => {
  const payload = [{ word: "negotiate", meaning: "đàm phán" }];
  mockFn.mockResolvedValue("```json\n" + JSON.stringify(payload) + "\n```");
  expect(await generateWords("TOEIC", mockFn)).toEqual(payload);
});

test("generateWords throws on malformed JSON", async () => {
  mockFn.mockResolvedValue("not json");
  await expect(generateWords("TOEIC", mockFn)).rejects.toThrow("Gemini returned invalid JSON");
});

// generateSentence
test("generateSentence returns trimmed text", async () => {
  mockFn.mockResolvedValue("  We need to negotiate.  ");
  expect(await generateSentence("negotiate", mockFn)).toBe("We need to negotiate.");
});

// generateSynonyms
test("generateSynonyms returns parsed result", async () => {
  const payload = { synonyms: ["discuss"], antonyms: ["avoid"] };
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await generateSynonyms("negotiate", mockFn)).toEqual(payload);
});

test("generateSynonyms returns empty arrays on parse failure", async () => {
  mockFn.mockResolvedValue("bad json");
  expect(await generateSynonyms("negotiate", mockFn)).toEqual({ synonyms: [], antonyms: [] });
});

// gradeSentence
test("gradeSentence returns parsed result", async () => {
  const payload = { score: 8, feedback: "Tốt", corrected: "We negotiate daily." };
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await gradeSentence("negotiate", "We negotiate daily.", mockFn)).toEqual(payload);
});

test("gradeSentence throws on malformed JSON", async () => {
  mockFn.mockResolvedValue("bad");
  await expect(gradeSentence("negotiate", "We negotiate.", mockFn)).rejects.toThrow(
    "Gemini returned invalid JSON for gradeSentence"
  );
});

// generateFillBlank
test("generateFillBlank returns sentence with blank", async () => {
  const payload = { sentence: "We need to _____ the deal." };
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await generateFillBlank("negotiate", mockFn)).toEqual(payload);
});

// generateWordsBatch
test("generateWordsBatch returns parsed array", async () => {
  const payload = [{ word: "negotiate", meaning: "đàm phán", example: "They negotiate." }];
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await generateWordsBatch(["negotiate"], mockFn)).toEqual(payload);
});

// generateReading
test("generateReading returns passage and questions", async () => {
  const payload = {
    passage: "They negotiate terms...",
    questions: [{ question: "What?", options: ["A. X", "B. Y", "C. Z"], answer: "A" }],
  };
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await generateReading(["negotiate"], mockFn)).toEqual(payload);
});
```

- [ ] **Step 3: Chạy tests**

```bash
npm test -- --testPathPattern=lib/__tests__/gemini
```

Expected: 11 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/gemini.ts src/lib/__tests__/gemini.test.ts
git commit -m "refactor: gemini functions accept generateContentFn instead of calling model directly"
```

---

## Task 5: Update API routes + GET /api/providers

**Files:**
- Modify: `src/app/api/generate-words/route.ts`
- Modify: `src/app/api/generate-sentence/route.ts`
- Modify: `src/app/api/generate-synonyms/route.ts`
- Modify: `src/app/api/grade-sentence/route.ts`
- Modify: `src/app/api/generate-batch/route.ts`
- Modify: `src/app/api/generate-fillblank/route.ts`
- Modify: `src/app/api/generate-reading/route.ts`
- Create: `src/app/api/providers/route.ts`

**Interfaces:**
- Consumes: `callWithFallback` từ `@/lib/providers`
- Consumes: `getRegisteredProviders` từ `@/lib/providers`
- Consumes: tất cả hàm từ `@/lib/gemini` (signature mới từ Task 4)

Pattern dùng ở tất cả routes — hiểu 1 route là hiểu tất cả:
```ts
let resolvedProviderId = "";
const generateFn = async (prompt: string) => {
  const result = await callWithFallback(prompt, provider);
  resolvedProviderId = result.providerId;
  return result.text;
};
```

- [ ] **Step 1: Tạo GET /api/providers**

```ts
// src/app/api/providers/route.ts
import { getRegisteredProviders } from "@/lib/providers";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(getRegisteredProviders(), {
    headers: { "Cache-Control": "no-store" },
  });
}
```

- [ ] **Step 2: Update generate-words/route.ts**

```ts
// src/app/api/generate-words/route.ts
import { generateWords } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { topic, provider } = (await req.json()) as { topic?: string; provider?: string };

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, provider);
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const words = await generateWords(topic, generateFn);
    return NextResponse.json(words, {
      headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId },
    });
  } catch (error) {
    console.error("Failed to generate words", error);
    return NextResponse.json(
      { error: "Không thể sinh từ mới lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
```

- [ ] **Step 3: Update generate-sentence/route.ts**

```ts
// src/app/api/generate-sentence/route.ts
import { generateSentence } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { word, provider } = (await req.json()) as { word?: string; provider?: string };

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, provider);
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const sentence = await generateSentence(word, generateFn);
    return NextResponse.json({ sentence }, {
      headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId },
    });
  } catch (error) {
    console.error("Failed to generate sentence", error);
    return NextResponse.json(
      { error: "Không thể tạo câu ví dụ lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
```

- [ ] **Step 4: Update generate-synonyms/route.ts**

```ts
// src/app/api/generate-synonyms/route.ts
import { generateSynonyms } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { word, provider } = (await req.json()) as { word?: string; provider?: string };

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, provider);
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const result = await generateSynonyms(word, generateFn);
    return NextResponse.json(result, {
      headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId },
    });
  } catch (error) {
    console.error("Failed to generate synonyms", error);
    return NextResponse.json(
      { error: "Không thể sinh từ đồng/trái nghĩa lúc này." },
      { status: 503, headers: NO_STORE }
    );
  }
}
```

- [ ] **Step 5: Update grade-sentence/route.ts**

```ts
// src/app/api/grade-sentence/route.ts
import { gradeSentence } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { word?: string; sentence?: string; provider?: string };

  if (!body.word?.trim() || !body.sentence?.trim()) {
    return NextResponse.json({ error: "Missing word or sentence" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, body.provider);
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const gradeResult = await gradeSentence(body.word.trim(), body.sentence.trim(), generateFn);
    return NextResponse.json(gradeResult, {
      headers: { "X-Provider-Used": resolvedProviderId },
    });
  } catch {
    return NextResponse.json({ error: "Unable to grade sentence" }, { status: 502 });
  }
}
```

- [ ] **Step 6: Update generate-batch/route.ts**

```ts
// src/app/api/generate-batch/route.ts
import { generateWordsBatch } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { words?: unknown; provider?: string };

  if (!Array.isArray(body.words)) {
    return NextResponse.json({ error: "Missing words array" }, { status: 400 });
  }

  const words = body.words
    .filter((w): w is string => typeof w === "string")
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (words.length === 0) {
    return NextResponse.json({ error: "Missing words array" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, body.provider);
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const result = await generateWordsBatch(words, generateFn);
    return NextResponse.json(result, { headers: { "X-Provider-Used": resolvedProviderId } });
  } catch {
    return NextResponse.json({ error: "Unable to generate word list" }, { status: 502 });
  }
}
```

- [ ] **Step 7: Update generate-fillblank/route.ts**

```ts
// src/app/api/generate-fillblank/route.ts
import { generateFillBlank } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { word?: string; provider?: string };

  if (!body.word?.trim()) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, body.provider);
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const result = await generateFillBlank(body.word.trim(), generateFn);
    return NextResponse.json(result, { headers: { "X-Provider-Used": resolvedProviderId } });
  } catch {
    return NextResponse.json(
      { error: "Unable to generate fill-in-the-blank sentence" },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 8: Update generate-reading/route.ts**

```ts
// src/app/api/generate-reading/route.ts
import { generateReading } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { words?: unknown; provider?: string };

  if (!Array.isArray(body.words)) {
    return NextResponse.json({ error: "Missing words" }, { status: 400 });
  }

  const words = body.words
    .filter((w): w is string => typeof w === "string")
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (words.length === 0) {
    return NextResponse.json({ error: "Missing words" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, body.provider);
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const result = await generateReading(words, generateFn);
    return NextResponse.json(result, { headers: { "X-Provider-Used": resolvedProviderId } });
  } catch {
    return NextResponse.json({ error: "Unable to generate reading" }, { status: 502 });
  }
}
```

- [ ] **Step 9: Chạy tất cả tests**

```bash
npm test
```

Expected: tất cả tests PASS.

Lưu ý: `src/app/api/__tests__/generate-words.test.ts` và `generate-sentence.test.ts` mock `@/lib/gemini` trực tiếp (jest.mock toàn bộ hàm), nên `callWithFallback` không bao giờ được gọi trong test environment — các test này vẫn pass sau refactor. Nếu muốn bổ sung test cho behavior `X-Provider-Used` header, cần thêm mock `@/lib/providers`:

```ts
jest.mock("@/lib/providers", () => ({
  callWithFallback: jest.fn().mockResolvedValue({ text: "...", providerId: "gemini" }),
}));

// Sau đó test:
test("sets X-Provider-Used header", async () => {
  const req = new NextRequest("...", { method: "POST", body: JSON.stringify({ topic: "TOEIC" }) });
  const res = await POST(req);
  expect(res.headers.get("X-Provider-Used")).toBe("gemini");
});
```

Đây là enhancement tùy chọn, không bắt buộc để feature hoạt động.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/
git commit -m "feat: update all API routes to support multi-provider with X-Provider-Used header"
```

---

## Task 6: ProviderContext + useApiFetch hook

**Files:**
- Create: `src/contexts/ProviderContext.tsx`
- Create: `src/lib/useApiFetch.ts`
- Modify: `src/app/layout.tsx` (thêm ProviderContextProvider wrapper)

**Interfaces:**
- Produces:
  - `useProvider(): { currentProvider, availableProviders, setProvider }` (dùng ở Task 7)
  - `useApiFetch(): { fetchWithProvider }` (dùng bởi client components khi cần sync)

- [ ] **Step 1: Tạo ProviderContext.tsx**

```tsx
// src/contexts/ProviderContext.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
}

interface ProviderContextValue {
  currentProvider: string;
  availableProviders: ProviderInfo[];
  setProvider: (id: string) => void;
}

const ProviderContext = createContext<ProviderContextValue>({
  currentProvider: "",
  availableProviders: [],
  setProvider: () => {},
});

export function ProviderContextProvider({ children }: { children: React.ReactNode }) {
  const [availableProviders, setAvailableProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState("");

  useEffect(() => {
    fetch("/api/providers")
      .then((res) => res.json())
      .then((providers: ProviderInfo[]) => {
        setAvailableProviders(providers);
        const saved = localStorage.getItem("preferredProvider");
        const valid = providers.find((p) => p.id === saved);
        setCurrentProvider(valid ? saved! : (providers[0]?.id ?? ""));
      })
      .catch(() => {});
  }, []);

  const setProvider = (id: string) => {
    setCurrentProvider(id);
    localStorage.setItem("preferredProvider", id);
  };

  return (
    <ProviderContext.Provider value={{ currentProvider, availableProviders, setProvider }}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  return useContext(ProviderContext);
}
```

- [ ] **Step 2: Tạo useApiFetch.ts**

Hook này bọc `fetch` POST: tự inject `provider` vào body và sync `X-Provider-Used` header về context.

```ts
// src/lib/useApiFetch.ts
"use client";

import { useCallback } from "react";
import { useProvider } from "@/contexts/ProviderContext";

export function useApiFetch() {
  const { currentProvider, setProvider } = useProvider();

  const fetchWithProvider = useCallback(
    async (url: string, body: Record<string, unknown>): Promise<Response> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, provider: currentProvider }),
      });
      const usedProvider = res.headers.get("X-Provider-Used");
      if (usedProvider && usedProvider !== currentProvider) {
        setProvider(usedProvider);
      }
      return res;
    },
    [currentProvider, setProvider]
  );

  return { fetchWithProvider };
}
```

- [ ] **Step 3: Thêm ProviderContextProvider vào layout.tsx**

Tìm dòng `export default function RootLayout` trong `src/app/layout.tsx`, thêm import và bọc children:

```tsx
// Thêm import ở đầu file:
import { ProviderContextProvider } from "@/contexts/ProviderContext";

// Trong <body>, bọc tất cả nội dung bằng ProviderContextProvider:
// Trước:
<body className="...">
  <nav>...</nav>
  {children}
  <footer>...</footer>
  <ServiceWorkerRegistration />
</body>

// Sau:
<body className="...">
  <ProviderContextProvider>
    <nav>...</nav>
    {children}
    <footer>...</footer>
    <ServiceWorkerRegistration />
  </ProviderContextProvider>
</body>
```

- [ ] **Step 4: Viết test cho ProviderContext**

```tsx
// src/contexts/__tests__/ProviderContext.test.tsx
import { render, screen, act, waitFor } from "@testing-library/react";
import { ProviderContextProvider, useProvider } from "../ProviderContext";

const mockProviders = [
  { id: "gemini", name: "Gemini Flash", model: "gemini-flash-latest" },
  { id: "groq", name: "Groq", model: "llama-3.3-70b" },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(mockProviders),
  }) as jest.Mock;
  localStorage.clear();
});

function TestConsumer() {
  const { currentProvider, availableProviders, setProvider } = useProvider();
  return (
    <div>
      <span data-testid="current">{currentProvider}</span>
      <span data-testid="count">{availableProviders.length}</span>
      <button onClick={() => setProvider("groq")}>Switch</button>
    </div>
  );
}

test("loads providers from API and sets first as default", async () => {
  render(
    <ProviderContextProvider>
      <TestConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getByTestId("current").textContent).toBe("gemini"));
  expect(screen.getByTestId("count").textContent).toBe("2");
});

test("restores provider from localStorage", async () => {
  localStorage.setItem("preferredProvider", "groq");
  render(
    <ProviderContextProvider>
      <TestConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getByTestId("current").textContent).toBe("groq"));
});

test("setProvider updates state and localStorage", async () => {
  render(
    <ProviderContextProvider>
      <TestConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getByTestId("current").textContent).toBe("gemini"));
  act(() => screen.getByText("Switch").click());
  expect(screen.getByTestId("current").textContent).toBe("groq");
  expect(localStorage.getItem("preferredProvider")).toBe("groq");
});
```

- [ ] **Step 5: Chạy tests**

```bash
npm test -- --testPathPattern=contexts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/contexts/ src/lib/useApiFetch.ts src/app/layout.tsx
git commit -m "feat: add ProviderContext for session-level provider state and useApiFetch hook"
```

---

## Task 7: ProviderBadge + Settings page

**Files:**
- Create: `src/components/ProviderBadge.tsx`
- Create: `src/app/settings/page.tsx`
- Modify: `src/app/layout.tsx` (thêm ProviderBadge vào nav + link Settings)

**Interfaces:**
- Consumes: `useProvider` từ `@/contexts/ProviderContext`

- [ ] **Step 1: Tạo ProviderBadge.tsx**

```tsx
// src/components/ProviderBadge.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useProvider } from "@/contexts/ProviderContext";

export function ProviderBadge() {
  const { currentProvider, availableProviders, setProvider } = useProvider();
  const [open, setOpen] = useState(false);

  const current = availableProviders.find((p) => p.id === currentProvider);
  if (!current) return null;

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
        aria-label="Chọn AI provider"
      >
        ⚡ {current.name}
        <span className="opacity-60">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 min-w-[180px] rounded-lg border border-white/10 bg-[#2c1f4a] shadow-xl">
            {availableProviders.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProvider(p.id);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 ${
                  p.id === currentProvider ? "font-semibold text-white" : "text-[#b0b0d1]"
                }`}
              >
                {p.id === currentProvider && "✓ "}
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}

      <Link
        href="/settings"
        className="flex items-center rounded-full p-1 text-[#b0b0d1] hover:text-white"
        title="Cài đặt provider"
        aria-label="Cài đặt provider"
      >
        ⚙️
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Tạo settings/page.tsx**

```tsx
// src/app/settings/page.tsx
"use client";

import { useProvider } from "@/contexts/ProviderContext";

const ALL_PROVIDERS = [
  {
    id: "gemini",
    name: "Gemini Flash",
    model: "gemini-flash-latest",
    envKey: "GEMINI_API_KEY",
  },
  {
    id: "groq",
    name: "Groq",
    model: "llama-3.3-70b-versatile",
    envKey: "GROQ_API_KEY",
  },
  {
    id: "huggingface",
    name: "HuggingFace",
    model: "mistralai/Mistral-7B-v0.1",
    envKey: "HUGGINGFACE_API_KEY",
  },
];

export default function SettingsPage() {
  const { currentProvider, availableProviders, setProvider } = useProvider();

  const isActive = (id: string) => availableProviders.some((p) => p.id === id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 font-display text-3xl font-bold text-[#d9ecff]">Cài đặt</h1>
      <p className="mb-8 text-sm text-[#b0b0d1]">
        Quản lý AI provider. Provider được kích hoạt khi có API key trong{" "}
        <code className="rounded bg-white/10 px-1">.env.local</code>.
      </p>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-left">
              <th className="px-4 py-3 font-semibold text-[#d9ecff]">Provider</th>
              <th className="px-4 py-3 font-semibold text-[#d9ecff]">Model</th>
              <th className="px-4 py-3 font-semibold text-[#d9ecff]">Trạng thái</th>
              <th className="px-4 py-3 font-semibold text-[#d9ecff]">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {ALL_PROVIDERS.map((p) => {
              const active = isActive(p.id);
              const isCurrent = p.id === currentProvider;
              return (
                <tr key={p.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-4 font-medium text-white">{p.name}</td>
                  <td className="px-4 py-4 font-mono text-xs text-[#b0b0d1]">{p.model}</td>
                  <td className="px-4 py-4">
                    {active ? (
                      <span className="inline-flex items-center gap-1 text-green-400">
                        ✅ Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-yellow-400">
                        ⚠️ Chưa cấu hình
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {active ? (
                      isCurrent ? (
                        <span className="text-[#d9ecff]">✓ Đang dùng</span>
                      ) : (
                        <button
                          onClick={() => setProvider(p.id)}
                          className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
                        >
                          Dùng cái này
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-[#b0b0d1]">
                        Thêm <code className="rounded bg-white/5 px-1">{p.envKey}</code> vào
                        .env.local
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Thêm ProviderBadge và link Settings vào layout.tsx**

Trong `src/app/layout.tsx`, thêm import và cập nhật `<nav>`:

```tsx
// Thêm imports:
import { ProviderBadge } from "@/components/ProviderBadge";

// Trong nav, thêm ProviderBadge và link Settings vào phần bên phải:
// Tìm div chứa các nav links và thêm:
<a
  href="/settings"
  className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white"
>
  Cài đặt
</a>
// Sau đó thêm ProviderBadge ở cuối div nav-links:
<ProviderBadge />
```

Đoạn nav sau khi sửa:
```tsx
<div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:shrink-0 sm:gap-3">
  <a href="/" className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#d9ecff] transition-colors hover:text-white">
    Học từ mới
  </a>
  <a href="/review" className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white">
    Ôn tập
  </a>
  <a href="/history" className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white">
    Lịch sử
  </a>
  <a href="/import" className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white">
    Import từ
  </a>
  <a href="/stats" className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white">
    Thống kê
  </a>
  <a href="/settings" className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white">
    Cài đặt
  </a>
  <ProviderBadge />
</div>
```

- [ ] **Step 4: Chạy toàn bộ test suite**

```bash
npm test
```

Expected: tất cả tests PASS.

- [ ] **Step 5: Khởi động dev server và kiểm tra trực quan**

```bash
npm run dev
```

Kiểm tra:
- [ ] `http://localhost:3000` — header hiển thị `⚡ Gemini Flash ▾` và icon ⚙️
- [ ] Click badge mở dropdown (chỉ 1 provider vì chỉ có Gemini key)
- [ ] Click ⚙️ dẫn tới `/settings`
- [ ] `/settings` hiển thị bảng 3 providers: Gemini ✅ Active, Groq ⚠️, HuggingFace ⚠️
- [ ] Thử generate từ mới → vẫn hoạt động bình thường

- [ ] **Step 6: Build kiểm tra production**

```bash
npm run build
```

Expected: build thành công, không có TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProviderBadge.tsx src/app/settings/page.tsx src/app/layout.tsx
git commit -m "feat: add ProviderBadge and settings page for manual provider switching"
```

---

## Kiểm tra cuối cùng

```bash
npm test && npm run lint && npm run build
```

Tất cả phải PASS. Feature hoàn chỉnh:
- ✅ Auto-switch khi provider gặp 429/503
- ✅ Manual switch qua dropdown badge trên header
- ✅ Trang Settings quản lý providers
- ✅ Provider không có key bị bỏ qua hoàn toàn
- ✅ Session state lưu trong localStorage
- ✅ API keys chỉ tồn tại server-side
