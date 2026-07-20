export interface VoiceSettings {
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceURI: null,
  rate: 0.9,
  pitch: 1.0,
  volume: 1.0,
};

const KEY = "voiceSettings";

export function getVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_VOICE_SETTINGS };

  const raw = localStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT_VOICE_SETTINGS };

  try {
    return { ...DEFAULT_VOICE_SETTINGS, ...(JSON.parse(raw) as Partial<VoiceSettings>) };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}
