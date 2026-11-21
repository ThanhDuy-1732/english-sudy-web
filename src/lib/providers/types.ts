// src/lib/providers/types.ts
export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
}

export interface GenerateOpts {
  temperature?: number;
  /** Asks reasoning models for little thinking: faster and ~half the tokens. Ignored by providers without the knob. */
  effort?: "low";
  /** Aborted by the fallback chain when the provider runs past its timeout. */
  signal?: AbortSignal;
}

export interface AIProvider extends ProviderInfo {
  generateContent(prompt: string, opts?: GenerateOpts): Promise<string>;
}

export interface ImageInput {
  mimeType: string;
  base64: string;
}

/** A provider that can read an image along with the prompt. Only Gemini implements it. */
export interface VisionProvider extends ProviderInfo {
  generateWithImage(prompt: string, image: ImageInput, opts?: GenerateOpts): Promise<string>;
}
