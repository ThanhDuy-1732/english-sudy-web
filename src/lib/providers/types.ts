// src/lib/providers/types.ts
export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
}

export interface GenerateOpts {
  temperature?: number;
}

export interface AIProvider extends ProviderInfo {
  generateContent(prompt: string, opts?: GenerateOpts): Promise<string>;
}
