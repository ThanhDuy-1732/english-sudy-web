// src/lib/providers/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider, GenerateOpts } from "./types";

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

  async generateContent(prompt: string, opts?: GenerateOpts): Promise<string> {
    const req = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: opts?.temperature ?? 0.7 },
    };
    try {
      const result = await this.client.generateContent(req);
      return result.response.text();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 429 || status === 500 || status === 503) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const result = await this.client.generateContent(req);
        return result.response.text();
      }
      throw error;
    }
  }
}
