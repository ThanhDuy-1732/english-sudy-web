import { GeminiProvider } from "./gemini";
import { OpenAICompatProvider } from "./openai-compat";
import type { AIProvider, GenerateOpts, ProviderInfo, VisionProvider } from "./types";

const PROVIDER_TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 25_000;

// OpenCode Go needs a stable session id on every request so the gateway can route it
// consistently and reuse its prompt cache. One id per server process is enough here.
const OPENCODE_SESSION_ID =
  process.env.OPENCODE_SESSION_ID ??
  `ses_${(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9]/gi, "")}`;

class ProviderTimeoutError extends Error {
  status = 503;
  constructor(id: string) {
    super(`${id} timed out after ${PROVIDER_TIMEOUT_MS}ms`);
  }
}

// Rate limits, outages, a retired model (404), a provider that needs billing (402)
// and network failures (no status) should fall through to the next provider.
function isRetryableError(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  if (status === undefined) return true;
  return status === 402 || status === 404 || status === 408 || status === 429 || status >= 500;
}

// ponytail: the losing request is not aborted, only abandoned; add AbortSignal support in the providers if it matters.
function withTimeout<T>(promise: Promise<T>, id: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProviderTimeoutError(id)), PROVIDER_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function createCallWithFallback(providers: AIProvider[]) {
  return async function callWithFallback(
    prompt: string,
    preferredId?: string,
    disabledIds?: string[],
    opts: GenerateOpts = {}
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
        const text = await withTimeout(provider.generateContent(prompt, opts), provider.id);
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

  if (process.env.GEMINI_API_KEY) {
    providers.push(
      new GeminiProvider(
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest"
      )
    );
  }

  if (process.env.GROQ_API_KEY) {
    providers.push(
      new OpenAICompatProvider({
        id: "groq",
        name: "Groq",
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
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
        model: process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free",
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

  // HuggingFace provider removed: Inference Providers requires paid credits; this
  // account has none and every call returns 402. Re-add the block if credits are bought.

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

/** The provider that can read images (Gemini), when its key is configured. */
export function getVisionProvider(): VisionProvider | undefined {
  return registry.find((p): p is GeminiProvider => p instanceof GeminiProvider);
}
