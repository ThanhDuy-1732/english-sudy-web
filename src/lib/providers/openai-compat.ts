// src/lib/providers/openai-compat.ts
import OpenAI from "openai";
import type { AIProvider, GenerateOpts } from "./types";

export interface OpenAICompatConfig {
  id: string;
  name: string;
  apiKey: string;
  model: string;
  baseURL: string;
  defaultHeaders?: Record<string, string>;
  /** The model accepts `reasoning_effort` (Groq's gpt-oss); other providers could reject the unknown field. */
  supportsEffort?: boolean;
}

export class OpenAICompatProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  private client: OpenAI;
  private supportsEffort: boolean;

  constructor(config: OpenAICompatConfig) {
    const testFetch = process.env.NODE_ENV === "test" && typeof globalThis.fetch === "undefined"
      ? (async () => { throw new Error("fetch is unavailable in test environment"); }) as typeof fetch
      : undefined;

    this.id = config.id;
    this.name = config.name;
    this.model = config.model;
    this.supportsEffort = config.supportsEffort ?? false;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      ...(config.defaultHeaders && { defaultHeaders: config.defaultHeaders }),
      // No hidden SDK retries: the fallback chain is the retry, and the SDK would honour an uncapped
      // retry-after (a 429 with retry-after: 20 eats the whole timeout).
      maxRetries: Number(process.env.AI_MAX_RETRIES ?? 0),
      dangerouslyAllowBrowser: process.env.NODE_ENV === "test",
      fetch: testFetch,
    });
  }

  async generateContent(prompt: string, opts?: GenerateOpts): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      ...(opts?.temperature !== undefined && { temperature: opts.temperature }),
      ...(opts?.effort && this.supportsEffort && { reasoning_effort: opts.effort }),
    }, { signal: opts?.signal });
    return response.choices[0]?.message?.content ?? "";
  }

  async *streamContent(prompt: string, opts?: GenerateOpts): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      ...(opts?.temperature !== undefined && { temperature: opts.temperature }),
      ...(opts?.effort && this.supportsEffort && { reasoning_effort: opts.effort }),
    }, { signal: opts?.signal });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
