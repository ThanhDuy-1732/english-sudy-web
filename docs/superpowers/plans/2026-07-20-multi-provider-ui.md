# Multi-Provider Integration & Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new AI providers (OpenRouter, Mistral, Cohere, Replicate) to the provider registry, allow toggling providers on/off from Settings, and add a per-provider Test connection button.

**Architecture:** `OpenAICompatProvider` already exists for OpenAI-compatible APIs — OpenRouter, Mistral, and Cohere slot straight in. Replicate needs a custom polling class. `callWithFallback` gains a third `disabledIds` param; the client sends this array in every request body alongside the existing `provider` field (same pattern already used). Settings page gains a toggle switch column and a Test button column.

**Tech Stack:** Next.js 14 App Router, TypeScript, Jest + `@testing-library/react`, React context, localStorage

## Global Constraints

- All API keys must stay server-side (never in `NEXT_PUBLIC_` vars)
- `src/lib/providers/` is the only place that constructs AI providers
- `callWithFallback` is the only export callers use for LLM generation
- Tests use Jest with `jest.mock()` for SDK/fetch; follow existing file patterns
- Fallback order in registry: Gemini → Groq → OpenRouter → Mistral → Cohere → HuggingFace → Replicate

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/providers/replicate.ts` | Create | Replicate REST polling provider |
| `src/lib/providers/__tests__/replicate.test.ts` | Create | Unit tests for ReplicateProvider |
| `src/lib/providers/index.ts` | Modify | Add 4 providers to registry; add `disabledIds` param to `callWithFallback`; export `getProviderById` |
| `src/lib/providers/__tests__/index.test.ts` | Modify | Add tests for `disabledIds` filtering and `getProviderById` |
| `src/app/api/providers/test/route.ts` | Create | POST handler that pings a single provider |
| `src/app/api/__tests__/providers-test.test.ts` | Create | Unit tests for the test route |
| `src/contexts/ProviderContext.tsx` | Modify | Add `disabledProviders` state + `toggleProvider` action |
| `src/contexts/__tests__/ProviderContext.test.tsx` | Modify | Add tests for toggle behavior |
| `src/lib/useApiFetch.ts` | Modify | Include `disabledProviders` in every request body |
| `src/lib/__tests__/useApiFetch.test.ts` | Modify | Add test: `disabledProviders` appears in body |
| `src/app/api/generate-words/route.ts` | Modify | Read + pass `disabledProviders` to `callWithFallback` |
| `src/app/api/generate-sentence/route.ts` | Modify | Same pattern |
| `src/app/api/generate-batch/route.ts` | Modify | Same pattern |
| `src/app/api/generate-fillblank/route.ts` | Modify | Same pattern |
| `src/app/api/generate-reading/route.ts` | Modify | Same pattern |
| `src/app/api/generate-synonyms/route.ts` | Modify | Same pattern |
| `src/app/api/grade-sentence/route.ts` | Modify | Same pattern |
| `src/app/settings/page.tsx` | Modify | 7-provider table, toggle column, test column |
| `.env.local` | Modify | Add 6 API keys (read from `docs/key/api-key.md`) |
| `.env.local.example` | Modify | Add placeholder entries for the 6 new keys |

---

## Task 1: ReplicateProvider

**Files:**
- Create: `src/lib/providers/replicate.ts`
- Create: `src/lib/providers/__tests__/replicate.test.ts`

**Interfaces:**
- Produces: `ReplicateProvider` implementing `AIProvider` (from `./types`); constructor `(apiKey: string, model: string, sleep?: (ms: number) => Promise<void>)`
- The optional `sleep` param is injectable for testing (no real delays in tests)

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/providers/__tests__/replicate.test.ts
const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

const noopSleep = () => Promise.resolve();

import { ReplicateProvider } from "../replicate";

beforeEach(() => mockFetch.mockReset());

const provider = new ReplicateProvider(
  "test-key",
  "meta/llama-4-scout-17b-16e-instruct",
  noopSleep
);

test("provider has correct metadata", () => {
  expect(provider.id).toBe("replicate");
  expect(provider.name).toBe("Replicate");
  expect(provider.model).toBe("meta/llama-4-scout-17b-16e-instruct");
});

test("generateContent returns immediately when initial status is succeeded", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: "p1", status: "succeeded", output: ["hello", " world"] }),
  });
  expect(await provider.generateContent("hi")).toBe("hello world");
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test("generateContent polls until succeeded", async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "starting" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "processing" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "succeeded", output: ["done"] }),
    });
  expect(await provider.generateContent("test")).toBe("done");
  expect(mockFetch).toHaveBeenCalledTimes(3);
});

test("generateContent throws when prediction fails", async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "starting" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "failed", error: "GPU OOM" }),
    });
  await expect(provider.generateContent("test")).rejects.toThrow("GPU OOM");
});

test("generateContent throws with { status } on non-2xx create response", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
  await expect(provider.generateContent("test")).rejects.toMatchObject({ status: 429 });
});

test("generateContent throws with { status } on non-2xx poll response", async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "starting" }),
    })
    .mockResolvedValueOnce({ ok: false, status: 503 });
  await expect(provider.generateContent("test")).rejects.toMatchObject({ status: 503 });
});

test("generateContent throws timeout after 20 polls", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: "p1", status: "starting" }),
  });
  for (let i = 0; i < 20; i++) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "p1", status: "processing" }),
    });
  }
  await expect(provider.generateContent("test")).rejects.toThrow("timed out");
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=replicate
```
Expected: "Cannot find module '../replicate'"

- [ ] **Step 3: Implement ReplicateProvider**

```typescript
// src/lib/providers/replicate.ts
import type { AIProvider } from "./types";

export class ReplicateProvider implements AIProvider {
  readonly id = "replicate";
  readonly name = "Replicate";
  readonly model: string;
  private apiKey: string;
  private owner: string;
  private modelName: string;
  private sleep: (ms: number) => Promise<void>;

  constructor(
    apiKey: string,
    model: string,
    sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms))
  ) {
    this.model = model;
    this.apiKey = apiKey;
    const slash = model.indexOf("/");
    this.owner = model.slice(0, slash);
    this.modelName = model.slice(slash + 1);
    this.sleep = sleep;
  }

  async generateContent(prompt: string): Promise<string> {
    const createRes = await fetch(
      `https://api.replicate.com/v1/models/${this.owner}/${this.modelName}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: { prompt } }),
      }
    );

    if (!createRes.ok) {
      throw { status: createRes.status };
    }

    const prediction = (await createRes.json()) as {
      id: string;
      status: string;
      output?: string[];
      error?: string;
    };

    if (prediction.status === "succeeded") {
      return Array.isArray(prediction.output) ? prediction.output.join("") : "";
    }

    for (let i = 0; i < 20; i++) {
      await this.sleep(500);
      const pollRes = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } }
      );
      if (!pollRes.ok) throw { status: pollRes.status };
      const polled = (await pollRes.json()) as {
        status: string;
        output?: string[];
        error?: string;
      };
      if (polled.status === "succeeded") {
        return Array.isArray(polled.output) ? polled.output.join("") : "";
      }
      if (polled.status === "failed") {
        throw new Error(polled.error ?? "Replicate prediction failed");
      }
    }
    throw new Error("Replicate prediction timed out");
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=replicate
```
Expected: 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/replicate.ts src/lib/providers/__tests__/replicate.test.ts
git commit -m "feat: add ReplicateProvider with async polling"
```

---

## Task 2: Extend Provider Registry

**Files:**
- Modify: `src/lib/providers/index.ts`
- Modify: `src/lib/providers/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `ReplicateProvider` from `./replicate` (Task 1)
- Produces:
  - `callWithFallback(prompt: string, preferredId?: string, disabledIds?: string[])`
  - `getProviderById(id: string): AIProvider | undefined`
  - `getRegisteredProviders(): ProviderInfo[]` (unchanged)

- [ ] **Step 1: Write failing tests for new behavior**

Append these tests to `src/lib/providers/__tests__/index.test.ts` (keep all existing tests):

```typescript
test("callWithFallback skips disabled providers", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-a");
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-b");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  const result = await fn("hello", undefined, ["a"]);
  expect(result).toEqual({ text: "result-b", providerId: "b" });
  expect(mockA).not.toHaveBeenCalled();
});

test("callWithFallback throws when all providers are disabled", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-a");
  const fn = createCallWithFallback([makeProvider("a", mockA)]);
  await expect(fn("hello", undefined, ["a"])).rejects.toThrow("No AI providers configured");
});

test("callWithFallback preferred provider still respects disabledIds", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-a");
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-b");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  // prefer "a" but "a" is disabled → should use "b"
  const result = await fn("hello", "a", ["a"]);
  expect(result).toEqual({ text: "result-b", providerId: "b" });
  expect(mockA).not.toHaveBeenCalled();
});
```

Also add this import/test for `getProviderById` (needs to be imported at the top of the test file — add to the existing import line):

```typescript
// Change line 2 from:
import { createCallWithFallback, getRegisteredProviders } from "../index";
// To:
import { createCallWithFallback, getRegisteredProviders, getProviderById } from "../index";
```

And add this test:

```typescript
test("getProviderById returns undefined for unknown id", () => {
  expect(getProviderById("nonexistent")).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npm test -- --testPathPattern=providers/__tests__/index
```
Expected: existing tests pass, 4 new ones fail (type errors or "not a function")

- [ ] **Step 3: Replace `src/lib/providers/index.ts` with the full updated version**

```typescript
// src/lib/providers/index.ts
import { GeminiProvider } from "./gemini";
import { OpenAICompatProvider } from "./openai-compat";
import { ReplicateProvider } from "./replicate";
import type { AIProvider, ProviderInfo } from "./types";

function isRetryableError(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  return status === 429 || status === 503;
}

export function createCallWithFallback(providers: AIProvider[]) {
  return async function callWithFallback(
    prompt: string,
    preferredId?: string,
    disabledIds?: string[]
  ): Promise<{ text: string; providerId: string }> {
    const active = disabledIds?.length
      ? providers.filter((p) => !disabledIds.includes(p.id))
      : providers;

    const ordered = preferredId
      ? [
          ...active.filter((p) => p.id === preferredId),
          ...active.filter((p) => p.id !== preferredId),
        ]
      : active;

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

  if (process.env.OPENROUTER_API_KEY) {
    providers.push(
      new OpenAICompatProvider({
        id: "openrouter",
        name: "OpenRouter",
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.1-8b-instruct:free",
        baseURL: "https://openrouter.ai/api/v1",
      })
    );
  }

  if (process.env.MISTRAL_API_KEY) {
    providers.push(
      new OpenAICompatProvider({
        id: "mistral",
        name: "Mistral",
        apiKey: process.env.MISTRAL_API_KEY,
        model: process.env.MISTRAL_MODEL ?? "mistral-small-latest",
        baseURL: "https://api.mistral.ai/v1",
      })
    );
  }

  if (process.env.COHERE_API_KEY) {
    providers.push(
      new OpenAICompatProvider({
        id: "cohere",
        name: "Cohere",
        apiKey: process.env.COHERE_API_KEY,
        model: process.env.COHERE_MODEL ?? "command-r7b-12-2024",
        baseURL: "https://api.cohere.com/compatibility/v1",
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

  if (process.env.REPLICATE_API_KEY) {
    providers.push(
      new ReplicateProvider(
        process.env.REPLICATE_API_KEY,
        process.env.REPLICATE_MODEL ?? "meta/llama-4-scout-17b-16e-instruct"
      )
    );
  }

  return providers;
}

const registry = buildRegistry();

export const callWithFallback = createCallWithFallback(registry);

export function getRegisteredProviders(): ProviderInfo[] {
  return registry.map(({ id, name, model }) => ({ id, name, model }));
}

export function getProviderById(id: string): AIProvider | undefined {
  return registry.find((p) => p.id === id);
}
```

- [ ] **Step 4: Run all provider tests**

```bash
npm test -- --testPathPattern=providers
```
Expected: all tests passing (replicate + index + openai-compat + gemini)

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/index.ts src/lib/providers/__tests__/index.test.ts
git commit -m "feat: add OpenRouter/Mistral/Cohere/Replicate providers; add disabledIds to callWithFallback"
```

---

## Task 3: Provider Test API Route

**Files:**
- Create: `src/app/api/providers/test/route.ts`
- Create: `src/app/api/__tests__/providers-test.test.ts`

**Interfaces:**
- Consumes: `getProviderById(id: string): AIProvider | undefined` from `@/lib/providers` (Task 2)
- Produces: `POST /api/providers/test` → `{ ok: boolean, latency: number, error?: string }`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/__tests__/providers-test.test.ts
/**
 * @jest-environment node
 */

jest.mock("@/lib/providers", () => ({
  getProviderById: jest.fn(),
}));

import { POST } from "../providers/test/route";
import { getProviderById } from "@/lib/providers";
import { NextRequest } from "next/server";

const mockGetProviderById = getProviderById as jest.Mock;

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/providers/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => mockGetProviderById.mockReset());

test("returns 400 when providerId is missing", async () => {
  const res = await POST(makeReq({}));
  expect(res.status).toBe(400);
  const data = await res.json();
  expect(data.error).toMatch(/providerId/);
});

test("returns 404 when provider not found in registry", async () => {
  mockGetProviderById.mockReturnValue(undefined);
  const res = await POST(makeReq({ providerId: "unknown" }));
  expect(res.status).toBe(404);
});

test("returns { ok: true, latency: number } on success", async () => {
  mockGetProviderById.mockReturnValue({
    generateContent: jest.fn().mockResolvedValue("OK"),
  });
  const res = await POST(makeReq({ providerId: "gemini" }));
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.ok).toBe(true);
  expect(typeof data.latency).toBe("number");
});

test("returns { ok: false, error, latency } on provider error", async () => {
  mockGetProviderById.mockReturnValue({
    generateContent: jest.fn().mockRejectedValue(new Error("rate limited")),
  });
  const res = await POST(makeReq({ providerId: "groq" }));
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.ok).toBe(false);
  expect(data.error).toBe("rate limited");
  expect(typeof data.latency).toBe("number");
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=providers-test
```
Expected: "Cannot find module '../providers/test/route'"

- [ ] **Step 3: Create the route**

```typescript
// src/app/api/providers/test/route.ts
import { getProviderById } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { providerId } = (await req.json()) as { providerId?: string };

  if (!providerId) {
    return NextResponse.json({ error: "providerId is required" }, { status: 400 });
  }

  const provider = getProviderById(providerId);
  if (!provider) {
    return NextResponse.json({ error: "Provider not found or not configured" }, { status: 404 });
  }

  const start = Date.now();
  try {
    await Promise.race([
      provider.generateContent("Reply with just: OK"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10_000)
      ),
    ]);
    return NextResponse.json({ ok: true, latency: Date.now() - start });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message, latency: Date.now() - start });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=providers-test
```
Expected: 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/app/api/providers/test/route.ts src/app/api/__tests__/providers-test.test.ts
git commit -m "feat: add POST /api/providers/test for connection health checks"
```

---

## Task 4: ProviderContext — Toggle State

**Files:**
- Modify: `src/contexts/ProviderContext.tsx`
- Modify: `src/contexts/__tests__/ProviderContext.test.tsx`

**Interfaces:**
- Produces (additions to context value):
  - `disabledProviders: string[]`
  - `toggleProvider: (id: string) => void`

- [ ] **Step 1: Write failing tests**

Append these tests to `src/contexts/__tests__/ProviderContext.test.tsx` (keep all existing tests unchanged):

```typescript
function ToggleConsumer() {
  const { disabledProviders, toggleProvider, currentProvider } = useProvider();
  return (
    <div>
      <span data-testid="disabled">{disabledProviders.join(",")}</span>
      <span data-testid="current">{currentProvider}</span>
      <button onClick={() => toggleProvider("groq")}>Toggle Groq</button>
    </div>
  );
}

test("disabledProviders starts empty", async () => {
  render(
    <ProviderContextProvider>
      <ToggleConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getAllByTestId("current")[0].textContent).toBe("gemini"));
  expect(screen.getByTestId("disabled").textContent).toBe("");
});

test("toggleProvider disables a provider and persists to localStorage", async () => {
  render(
    <ProviderContextProvider>
      <ToggleConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getAllByTestId("current")[0].textContent).toBe("gemini"));
  act(() => screen.getByText("Toggle Groq").click());
  expect(screen.getByTestId("disabled").textContent).toBe("groq");
  expect(JSON.parse(localStorage.getItem("disabledProviders")!)).toEqual(["groq"]);
});

test("toggleProvider re-enables a disabled provider", async () => {
  localStorage.setItem("disabledProviders", JSON.stringify(["groq"]));
  render(
    <ProviderContextProvider>
      <ToggleConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getAllByTestId("current")[0].textContent).toBe("gemini"));
  await waitFor(() => expect(screen.getByTestId("disabled").textContent).toBe("groq"));
  act(() => screen.getByText("Toggle Groq").click());
  expect(screen.getByTestId("disabled").textContent).toBe("");
});

test("toggleProvider switches currentProvider when disabling the active one", async () => {
  localStorage.setItem("preferredProvider", "groq");
  render(
    <ProviderContextProvider>
      <ToggleConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getAllByTestId("current")[0].textContent).toBe("groq"));
  act(() => screen.getByText("Toggle Groq").click());
  // Should fall back to first available (gemini)
  expect(screen.getAllByTestId("current")[0].textContent).toBe("gemini");
  expect(localStorage.getItem("preferredProvider")).toBe("gemini");
});

test("restores disabledProviders from localStorage on mount", async () => {
  localStorage.setItem("disabledProviders", JSON.stringify(["gemini", "groq"]));
  render(
    <ProviderContextProvider>
      <ToggleConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getByTestId("disabled").textContent).toBe("gemini,groq"));
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npm test -- --testPathPattern=ProviderContext
```
Expected: existing 3 tests pass, 5 new ones fail (property undefined or missing)

- [ ] **Step 3: Replace `src/contexts/ProviderContext.tsx` with updated version**

```typescript
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
  disabledProviders: string[];
  toggleProvider: (id: string) => void;
}

const ProviderContext = createContext<ProviderContextValue>({
  currentProvider: "",
  availableProviders: [],
  setProvider: () => {},
  disabledProviders: [],
  toggleProvider: () => {},
});

export function ProviderContextProvider({ children }: { children: React.ReactNode }) {
  const [availableProviders, setAvailableProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState("");
  const [disabledProviders, setDisabledProviders] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("disabledProviders");
      if (stored) setDisabledProviders(JSON.parse(stored) as string[]);
    } catch {}
  }, []);

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

  const toggleProvider = (id: string) => {
    const isDisabling = !disabledProviders.includes(id);
    const next = isDisabling
      ? [...disabledProviders, id]
      : disabledProviders.filter((d) => d !== id);

    setDisabledProviders(next);
    localStorage.setItem("disabledProviders", JSON.stringify(next));

    if (isDisabling && currentProvider === id) {
      const firstAvailable = availableProviders.find((p) => !next.includes(p.id));
      if (firstAvailable) {
        setCurrentProvider(firstAvailable.id);
        localStorage.setItem("preferredProvider", firstAvailable.id);
      }
    }
  };

  return (
    <ProviderContext.Provider
      value={{ currentProvider, availableProviders, setProvider, disabledProviders, toggleProvider }}
    >
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  return useContext(ProviderContext);
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npm test -- --testPathPattern=ProviderContext
```
Expected: 8 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/contexts/ProviderContext.tsx src/contexts/__tests__/ProviderContext.test.tsx
git commit -m "feat: add disabledProviders and toggleProvider to ProviderContext"
```

---

## Task 5: Propagate disabledProviders Through API Layer

**Files:**
- Modify: `src/lib/useApiFetch.ts`
- Modify: `src/lib/__tests__/useApiFetch.test.ts`
- Modify: `src/app/api/generate-words/route.ts`
- Modify: `src/app/api/generate-sentence/route.ts`
- Modify: `src/app/api/generate-batch/route.ts`
- Modify: `src/app/api/generate-fillblank/route.ts`
- Modify: `src/app/api/generate-reading/route.ts`
- Modify: `src/app/api/generate-synonyms/route.ts`
- Modify: `src/app/api/grade-sentence/route.ts`

**Interfaces:**
- Consumes: `disabledProviders` from `ProviderContext` (Task 4); `callWithFallback(..., disabledIds)` (Task 2)

- [ ] **Step 1: Write failing test for useApiFetch**

Append this test to `src/lib/__tests__/useApiFetch.test.ts` (keep all existing tests):

```typescript
test("fetchWithProvider includes disabledProviders in request body", async () => {
  localStorage.setItem("disabledProviders", JSON.stringify(["groq"]));

  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
    headers: makeHeaders({}),
  });

  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProviders),
      headers: makeHeaders({}),
    })
    .mockImplementation(mockFetch);

  const { result } = renderHook(() => useApiFetch(), { wrapper });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await act(async () => {
    await result.current.fetchWithProvider("/api/generate-words", { topic: "TOEIC" });
  });

  const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
  expect(calledBody.disabledProviders).toEqual(["groq"]);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=useApiFetch
```
Expected: 3 existing pass, new test fails (disabledProviders undefined or missing)

- [ ] **Step 3: Update useApiFetch to send disabledProviders**

Replace `src/lib/useApiFetch.ts` entirely:

```typescript
// src/lib/useApiFetch.ts
"use client";

import { useCallback } from "react";
import { useProvider } from "@/contexts/ProviderContext";

export function useApiFetch() {
  const { currentProvider, setProvider, disabledProviders } = useProvider();

  const fetchWithProvider = useCallback(
    async (url: string, body: Record<string, unknown>): Promise<Response> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, provider: currentProvider, disabledProviders }),
      });
      const usedProvider = res.headers.get("X-Provider-Used");
      if (usedProvider && usedProvider !== currentProvider) {
        setProvider(usedProvider);
      }
      return res;
    },
    [currentProvider, setProvider, disabledProviders]
  );

  return { fetchWithProvider };
}
```

- [ ] **Step 4: Run tests to confirm useApiFetch tests all pass**

```bash
npm test -- --testPathPattern=useApiFetch
```
Expected: 4 tests passing

- [ ] **Step 5: Update all 7 API routes to read and pass disabledProviders**

Replace each file in full. The pattern is the same for all: add `disabledProviders?: string[]` to the destructured/typed body, then pass it as the third argument to `callWithFallback`.

**`src/app/api/generate-words/route.ts`:**
```typescript
import { generateWords } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { topic, provider, disabledProviders } = (await req.json()) as {
    topic?: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, provider, disabledProviders);
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

**`src/app/api/generate-sentence/route.ts`:**
```typescript
import { generateSentence } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { word, provider, disabledProviders } = (await req.json()) as {
    word?: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, provider, disabledProviders);
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

**`src/app/api/generate-batch/route.ts`:**
```typescript
import { generateWordsBatch } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    words?: unknown;
    provider?: string;
    disabledProviders?: string[];
  };

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
      const result = await callWithFallback(prompt, body.provider, body.disabledProviders);
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

**`src/app/api/generate-fillblank/route.ts`:**
```typescript
import { generateFillBlank } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    word?: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!body.word?.trim()) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, body.provider, body.disabledProviders);
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

**`src/app/api/generate-reading/route.ts`:**
```typescript
import { generateReading } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    words?: unknown;
    provider?: string;
    disabledProviders?: string[];
  };

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
      const result = await callWithFallback(prompt, body.provider, body.disabledProviders);
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

**`src/app/api/generate-synonyms/route.ts`:**
```typescript
import { generateSynonyms } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { word, provider, disabledProviders } = (await req.json()) as {
    word?: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, provider, disabledProviders);
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

**`src/app/api/grade-sentence/route.ts`:**
```typescript
import { gradeSentence } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    word?: string;
    sentence?: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!body.word?.trim() || !body.sentence?.trim()) {
    return NextResponse.json({ error: "Missing word or sentence" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, body.provider, body.disabledProviders);
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

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: all tests pass (no regressions from route changes)

- [ ] **Step 7: Commit**

```bash
git add src/lib/useApiFetch.ts src/lib/__tests__/useApiFetch.test.ts \
  src/app/api/generate-words/route.ts \
  src/app/api/generate-sentence/route.ts \
  src/app/api/generate-batch/route.ts \
  src/app/api/generate-fillblank/route.ts \
  src/app/api/generate-reading/route.ts \
  src/app/api/generate-synonyms/route.ts \
  src/app/api/grade-sentence/route.ts
git commit -m "feat: propagate disabledProviders through API layer"
```

---

## Task 6: Settings Page UI

**Files:**
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `toggleProvider`, `disabledProviders` from `useProvider()` (Task 4); `POST /api/providers/test` (Task 3)

No new test file — the Settings page has no existing tests and UI interaction testing is out of scope.

- [ ] **Step 1: Replace `src/app/settings/page.tsx` entirely**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useProvider } from "@/contexts/ProviderContext";
import { getSyncKey, getLastSyncedAt, pullFromKey } from "@/lib/sync";

const ALL_PROVIDERS = [
  { id: "gemini",     name: "Gemini Flash", model: "gemini-flash-latest",                          envKey: "GEMINI_API_KEY" },
  { id: "groq",       name: "Groq",         model: "llama-3.3-70b-versatile",                      envKey: "GROQ_API_KEY" },
  { id: "openrouter", name: "OpenRouter",   model: "meta-llama/llama-3.1-8b-instruct:free",        envKey: "OPENROUTER_API_KEY" },
  { id: "mistral",    name: "Mistral",      model: "mistral-small-latest",                          envKey: "MISTRAL_API_KEY" },
  { id: "cohere",     name: "Cohere",       model: "command-r7b-12-2024",                           envKey: "COHERE_API_KEY" },
  { id: "huggingface",name: "HuggingFace",  model: "mistralai/Mistral-7B-v0.1",                    envKey: "HUGGINGFACE_API_KEY" },
  { id: "replicate",  name: "Replicate",    model: "meta/llama-4-scout-17b-16e-instruct",           envKey: "REPLICATE_API_KEY" },
];

type TestResult = "loading" | { ok: boolean; latency?: number; error?: string };

export default function SettingsPage() {
  const { currentProvider, availableProviders, setProvider, disabledProviders, toggleProvider } =
    useProvider();
  const [syncKey, setSyncKey] = useState("");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [pullInput, setPullInput] = useState("");
  const [pulling, setPulling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pullSuccess, setPullSuccess] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    setSyncKey(getSyncKey());
    setLastSynced(getLastSyncedAt());
  }, []);

  const isActive = (id: string) => availableProviders.some((p) => p.id === id);
  const isDisabled = (id: string) => disabledProviders.includes(id);

  function handleCopy() {
    navigator.clipboard.writeText(syncKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  async function handlePull() {
    const trimmed = pullInput.trim();
    if (!trimmed) return;
    setPulling(true);
    setPullSuccess(null);
    setPullError(null);
    try {
      const count = await pullFromKey(trimmed);
      setPullSuccess(
        count > 0 ? `${count} từ mới được thêm vào thiết bị này.` : "Đồng bộ xong. Không có từ mới."
      );
      setPullInput("");
    } catch {
      setPullError("Không thể kết nối. Kiểm tra kết nối mạng và thử lại.");
    } finally {
      setPulling(false);
    }
  }

  async function handleTest(id: string) {
    setTestResults((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: id }),
      });
      const data = (await res.json()) as { ok: boolean; latency: number; error?: string };
      setTestResults((prev) => ({ ...prev, [id]: data }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: "Network error" } }));
    }
    setTimeout(() => {
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 5000);
  }

  function formatSynced(iso: string | null) {
    if (!iso) return "Chưa đồng bộ";
    const d = new Date(iso);
    return `Đã đồng bộ lúc ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  function renderTestResult(id: string) {
    const result = testResults[id];
    if (!result) return null;
    if (result === "loading") return <span className="text-xs text-[#b0b0d1]">Testing…</span>;
    if (result.ok) return <span className="text-xs text-green-400">✅ {result.latency}ms</span>;
    return <span className="text-xs text-red-400">❌ {result.error ?? "Error"}</span>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-10">
      <div>
        <h1 className="mb-2 font-display text-3xl font-bold text-[#d9ecff]">Cài đặt</h1>
        <p className="mb-8 text-sm text-[#b0b0d1]">
          Quản lý AI provider. Provider được kích hoạt khi có API key trong{" "}
          <code className="rounded bg-white/10 px-1">.env.local</code>.
        </p>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left">
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Provider</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Model</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Bật/Tắt</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Test</th>
                <th className="px-4 py-3 font-semibold text-[#d9ecff]">Ưu tiên</th>
              </tr>
            </thead>
            <tbody>
              {ALL_PROVIDERS.map((p) => {
                const active = isActive(p.id);
                const disabled = isDisabled(p.id);
                const isCurrent = p.id === currentProvider;
                const testResult = testResults[p.id];

                return (
                  <tr key={p.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-4 font-medium text-white">{p.name}</td>
                    <td className="px-4 py-4 font-mono text-xs text-[#b0b0d1]">
                      {active
                        ? (availableProviders.find((ap) => ap.id === p.id)?.model ?? p.model)
                        : p.model}
                    </td>
                    <td className="px-4 py-4">
                      {active ? (
                        <span className="inline-flex items-center gap-1 text-green-400">
                          ✅ Active
                        </span>
                      ) : (
                        <span className="text-xs text-[#b0b0d1]">
                          <code className="rounded bg-white/5 px-1">{p.envKey}</code>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => active && toggleProvider(p.id)}
                        disabled={!active}
                        title={active ? (disabled ? "Bật provider này" : "Tắt provider này") : "Chưa cấu hình"}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                          !active
                            ? "cursor-not-allowed opacity-30 bg-white/10"
                            : disabled
                            ? "bg-white/20"
                            : "bg-green-600 hover:bg-green-500"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                            !disabled ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {active && !testResult && (
                          <button
                            onClick={() => void handleTest(p.id)}
                            className="rounded-lg bg-white/10 px-2 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
                          >
                            Test
                          </button>
                        )}
                        {renderTestResult(p.id)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {active && !disabled ? (
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
                        <span className="text-xs text-[#b0b0d1]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sync section — unchanged */}
      <div>
        <h2 className="mb-2 font-display text-xl font-bold text-[#d9ecff]">Đồng bộ dữ liệu</h2>
        <p className="mb-6 text-sm text-[#b0b0d1]">
          Dùng sync key để backup và đồng bộ dữ liệu giữa các thiết bị. Không cần đăng nhập.
        </p>

        <div className="space-y-6 rounded-xl border border-white/10 p-6">
          <div>
            <p className="mb-2 text-sm font-medium text-[#d9ecff]">Sync Key của thiết bị này</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-[#b0b0d1] overflow-hidden">
                {syncKey ? `${syncKey.slice(0, 8)}••••••••••••••••••••••••••••` : "Đang tải..."}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20"
              >
                {copied ? "Đã copy!" : "Copy full key"}
              </button>
            </div>
            <p className="mt-1 text-xs text-[#b0b0d1]">{formatSynced(lastSynced)}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[#d9ecff]">Lấy dữ liệu từ thiết bị khác</p>
            <p className="mb-3 text-xs text-[#b0b0d1]">
              Nhập sync key của thiết bị khác để thêm từ vựng của thiết bị đó vào đây.
              Dữ liệu hiện tại trên thiết bị này sẽ không bị mất.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={pullInput}
                onChange={(e) => setPullInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handlePull(); }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx hoặc ThankZ"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder-[#b0b0d1] focus:border-white/30 focus:outline-none"
              />
              <button
                onClick={() => void handlePull()}
                disabled={pulling || !pullInput.trim()}
                className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[#d9ecff] hover:bg-white/20 disabled:opacity-50"
              >
                {pulling ? "Đang lấy..." : "Pull data"}
              </button>
            </div>
            {pullSuccess && (
              <p className="mt-2 text-sm font-medium text-green-400">{pullSuccess}</p>
            )}
            {pullError && (
              <p className="mt-2 text-sm font-medium text-red-400">{pullError}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run the full test suite to check for regressions**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: update Settings page with 7 providers, toggle switch, and test button"
```

---

## Task 7: Environment Variables

**Files:**
- Modify: `.env.local`
- Modify: `.env.local.example`

**Note:** The actual API keys are in `docs/key/api-key.md`. Read that file to get the real values.

- [ ] **Step 1: Read the API keys file**

Read `docs/key/api-key.md` and map keys to env var names:
- Groq → `GROQ_API_KEY`
- Huggingface → `HUGGINGFACE_API_KEY`
- Openrouter → `OPENROUTER_API_KEY`
- Cohere → `COHERE_API_KEY`
- Mistral → `MISTRAL_API_KEY`
- Replicate → `REPLICATE_API_KEY`

- [ ] **Step 2: Append the 6 keys to `.env.local`**

Open `.env.local` (currently has `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and append the 6 new key=value pairs using the real values from step 1.

- [ ] **Step 3: Update `.env.local.example` to list all keys**

Replace `.env.local.example` with:

```
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here
COHERE_API_KEY=your_cohere_api_key_here
REPLICATE_API_KEY=your_replicate_api_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

- [ ] **Step 4: Verify the dev server picks up new providers**

```bash
npm run dev
```

Open http://localhost:3000/settings — the providers table should now show Active status for all 7 providers that have keys configured. Confirm in browser that:
1. All 7 rows appear in the table
2. Configured providers show "✅ Active" and an enabled toggle
3. The Test button works for at least one provider (click Test → see latency or error)
4. Toggling off a provider switches the current preferred if needed

- [ ] **Step 5: Commit**

```bash
git add .env.local.example
git commit -m "chore: add env vars for OpenRouter, Mistral, Cohere, Replicate, Groq, HuggingFace"
```

Note: `.env.local` is gitignored and should NOT be committed.

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - ReplicateProvider (spec §1) → Task 1
  - OpenRouter/Mistral/Cohere in registry (spec §2) → Task 2
  - `disabledIds` param (spec §2) → Tasks 2, 4, 5
  - `/api/providers/test` (spec §3) → Task 3
  - `disabledProviders` + `toggleProvider` in context (spec §4) → Task 4
  - Propagation via body (spec §5) → Task 5
  - Settings page 7 providers + Toggle + Test columns (spec §6) → Task 6
  - Env vars (spec §7) → Task 7
- [x] **No placeholders** — all code blocks contain complete, runnable content
- [x] **Type consistency** — `disabledProviders: string[]` / `disabledIds: string[]` used consistently; `getProviderById` defined in Task 2 and consumed in Task 3
