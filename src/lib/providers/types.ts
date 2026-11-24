// src/lib/providers/types.ts
export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
  /** Needs OPENCODE_LOCK_PASSWORD before requests may use it. */
  locked?: boolean;
}

export interface GenerateOpts {
  temperature?: number;
  /** Asks reasoning models for little ("low") or no ("none") thinking: faster and fewer tokens. Ignored by providers without the knob. */
  effort?: "low" | "none";
  /** Aborted by the fallback chain when the provider runs past its timeout. */
  signal?: AbortSignal;
}

export interface AIProvider extends ProviderInfo {
  generateContent(prompt: string, opts?: GenerateOpts): Promise<string>;
  /** Text chunks as the model writes them. Providers without it are read whole (one chunk). */
  streamContent?(prompt: string, opts?: GenerateOpts): AsyncIterable<string>;
}

export interface ImageInput {
  mimeType: string;
  base64: string;
}

/** A provider that can read an image along with the prompt. Only Gemini implements it. */
export interface VisionProvider extends ProviderInfo {
  generateWithImage(prompt: string, image: ImageInput, opts?: GenerateOpts): Promise<string>;
}
