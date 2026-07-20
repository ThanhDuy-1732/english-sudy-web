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
