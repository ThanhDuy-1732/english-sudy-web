import { GeminiProvider } from "./gemini";
import { OpenAICompatProvider } from "./openai-compat";
import type { AIProvider, GenerateOpts, ProviderInfo, VisionProvider } from "./types";
import { LOCKED_PROVIDER_IDS } from "../provider-lock";

const PROVIDER_TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 25_000;

// OpenCode Go needs a stable session id on every request so the gateway can route it
// consistently and reuse its prompt cache. One id per server process is enough here.
const OPENCODE_SESSION_ID =
  process.env.OPENCODE_SESSION_ID ??
  `ses_${(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9]/gi, "")}`;

class ProviderTimeoutError extends Error {
  status = 503;
  constructor(id: string, ms: number) {
    super(`${id} timed out after ${ms}ms`);
  }
}

// Rate limits, outages, a retired model (404), a provider that needs billing (402)
// and network failures (no status) should fall through to the next provider.
function isRetryableError(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  if (status === undefined) return true;
  return status === 402 || status === 404 || status === 408 || status === 429 || status >= 500;
}

// Aborts the provider call on timeout so an abandoned request stops (and stops retrying) instead of running on.
function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, id: string, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError(id, ms));
    }, ms);
  });
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

export function createCallWithFallback(providers: AIProvider[]) {
  return async function callWithFallback(
    prompt: string,
    preferredId?: string,
    disabledIds?: string[],
    opts: GenerateOpts & { timeoutMs?: number } = {},
    onFail?: (providerId: string, error: unknown) => void
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

    const { timeoutMs = PROVIDER_TIMEOUT_MS, ...genOpts } = opts;
    let lastError: unknown;
    for (const provider of ordered) {
      try {
        const text = await withTimeout((signal) => provider.generateContent(prompt, { ...genOpts, signal }), provider.id, timeoutMs);
        return { text, providerId: provider.id };
      } catch (error) {
        onFail?.(provider.id, error);
        if (!isRetryableError(error)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  };
}

function buildRegistry(): AIProvider[] {
  const providers: AIProvider[] = [];

  // Fallback order = measured speed for a short prompt (p50, Nov 2026): groq ~0.9 s, cohere ~0.5 s
  // (fast, but a small model), openrouter ~1.4 s (free models, slow on longer output),
  // gemini ~7 s (queue on the free tier; it stays registered mainly for photo translation),
  // mistral last (402 on this account until billing is set up).

  if (process.env.OPENCODE_API_KEY) {
    providers.push(
      new OpenAICompatProvider({
        id: "opencode",
        name: "OpenCode Go",
        apiKey: process.env.OPENCODE_API_KEY,
        model: process.env.OPENCODE_MODEL ?? "glm-5.3-flash",
        baseURL: process.env.OPENCODE_BASE_URL ?? "https://opencode.ai/inference/go/openai/v1",
        defaultHeaders: { "x-opencode-session": OPENCODE_SESSION_ID },
      })
    );
  }

  if (process.env.GROQ_API_KEY) {
    const groqModel = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
    providers.push(
      new OpenAICompatProvider({
        id: "groq",
        name: "Groq",
        apiKey: process.env.GROQ_API_KEY,
        model: groqModel,
        baseURL: "https://api.groq.com/openai/v1",
        supportsEffort: /gpt-oss/.test(groqModel),
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

  if (process.env.OPENROUTER_API_KEY) {
    providers.push(
      new OpenAICompatProvider({
        id: "openrouter",
        name: "OpenRouter",
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free",
        baseURL: "https://openrouter.ai/api/v1",
      })
    );
  }

  if (process.env.GEMINI_API_KEY) {
    providers.push(
      new GeminiProvider(
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest"
      )
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

  // More OpenCode Go models on the same key, last so they never change the default fallback order.
  // GPT-6 Luna and Claude Haiku 5.5 are locked behind OPENCODE_LOCK_PASSWORD (see provider-lock.ts) and are
  // only registered when it is set. Benchmarks: docs/opencode-go-models-2026-11-23.md.
  if (process.env.OPENCODE_API_KEY) {
    const extra = [
      { id: "opencode-glm53", name: "OpenCode GLM-5.3", model: "glm-5.3" },
      { id: "opencode-gpt6", name: "OpenCode GPT-6 Luna", model: "gpt-6-luna" },
      { id: "opencode-haiku", name: "OpenCode Claude Haiku 5.5", model: "claude-haiku-5-5" },
    ];
    for (const p of extra) {
      if (LOCKED_PROVIDER_IDS.includes(p.id) && !process.env.OPENCODE_LOCK_PASSWORD) continue;
      providers.push(
        new OpenAICompatProvider({
          ...p,
          apiKey: process.env.OPENCODE_API_KEY,
          baseURL: process.env.OPENCODE_BASE_URL ?? "https://opencode.ai/inference/go/openai/v1",
          defaultHeaders: { "x-opencode-session": OPENCODE_SESSION_ID },
        })
      );
    }
  }

  // HuggingFace provider removed: Inference Providers requires paid credits; this
  // account has none and every call returns 402. Re-add the block if credits are bought.

  return providers;
}

const registry = buildRegistry();

export const callWithFallback = createCallWithFallback(registry);

export function getRegisteredProviders(): ProviderInfo[] {
  return registry.map(({ id, name, model }) => ({ id, name, model, ...(LOCKED_PROVIDER_IDS.includes(id) && { locked: true }) }));
}

export function getProviderById(id: string): AIProvider | undefined {
  return registry.find((p) => p.id === id);
}

/** The provider that can read images (Gemini), when its key is configured. */
export function getVisionProvider(): VisionProvider | undefined {
  return registry.find((p): p is GeminiProvider => p instanceof GeminiProvider);
}
