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
