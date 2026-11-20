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
}

export class OpenAICompatProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  private client: OpenAI;

  constructor(config: OpenAICompatConfig) {
    const testFetch = process.env.NODE_ENV === "test" && typeof globalThis.fetch === "undefined"
      ? (async () => { throw new Error("fetch is unavailable in test environment"); }) as typeof fetch
      : undefined;

    this.id = config.id;
    this.name = config.name;
    this.model = config.model;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      ...(config.defaultHeaders && { defaultHeaders: config.defaultHeaders }),
      // SDK default is 2 hidden retries with backoff; the provider fallback chain already retries elsewhere.
      maxRetries: Number(process.env.AI_MAX_RETRIES ?? 1),
      dangerouslyAllowBrowser: process.env.NODE_ENV === "test",
      fetch: testFetch,
    });
  }

  async generateContent(prompt: string, opts?: GenerateOpts): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      ...(opts?.temperature !== undefined && { temperature: opts.temperature }),
    });
    return response.choices[0]?.message?.content ?? "";
  }
}
