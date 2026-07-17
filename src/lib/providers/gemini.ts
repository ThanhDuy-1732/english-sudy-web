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
