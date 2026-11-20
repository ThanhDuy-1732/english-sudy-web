// src/lib/providers/gemini.ts
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import type { AIProvider, GenerateOpts, ImageInput, VisionProvider } from "./types";

export class GeminiProvider implements AIProvider, VisionProvider {
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

  // Text calls get no retry of their own: the fallback chain moves on to the next provider.
  generateContent(prompt: string, opts?: GenerateOpts): Promise<string> {
    return this.send([{ text: prompt }], opts, false);
  }

  // Photo translation has no other provider to fall back to, so it keeps one retry.
  generateWithImage(prompt: string, image: ImageInput, opts?: GenerateOpts): Promise<string> {
    return this.send([{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.base64 } }], opts, true);
  }

  private async send(parts: Part[], opts: GenerateOpts | undefined, retry: boolean): Promise<string> {
    const req = {
      contents: [{ role: "user", parts }],
      ...(opts?.temperature !== undefined && { generationConfig: { temperature: opts.temperature } }),
    };
    const requestOpts = opts?.signal ? { signal: opts.signal } : undefined;
    try {
      const result = await this.client.generateContent(req, requestOpts);
      return result.response.text();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (retry && (status === 429 || status === 500 || status === 503)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const result = await this.client.generateContent(req, requestOpts);
        return result.response.text();
      }
      throw error;
    }
  }
}
