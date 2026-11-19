import { LANG_INFO, type LearnLang } from "./languages";

export interface SpeechSettings {
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
}

const normalized = (code: string) => code.toLowerCase().replace("_", "-");

/** Voices for a language: those whose lang starts with its 2-letter code (ko-KR, ko_KR…). Only decides whether the device can speak it. */
export function voicesFor(lang: LearnLang): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const prefix = LANG_INFO[lang].voice.slice(0, 2).toLowerCase();
  return window.speechSynthesis.getVoices().filter((voice) => normalized(voice.lang).startsWith(prefix));
}

/**
 * The saved voice if it speaks this language, else an exact match (en-US, zh-CN — never zh-HK Cantonese for Mandarin),
 * else null: the browser then picks its own default for utterance.lang.
 */
export function pickVoice(lang: LearnLang, savedVoiceURI: string | null): SpeechSynthesisVoice | null {
  const candidates = voicesFor(lang);
  const exact = normalized(LANG_INFO[lang].voice);
  return (
    candidates.find((voice) => voice.voiceURI === savedVoiceURI) ??
    candidates.find((voice) => normalized(voice.lang) === exact) ??
    null
  );
}

/** Reads text aloud in a language with the learner's voice settings. False when the browser can't speak. */
export function speakText(text: string, lang: LearnLang, settings: SpeechSettings): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel?.();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang, settings.voiceURI);
  if (voice) utterance.voice = voice;
  utterance.lang = LANG_INFO[lang].voice;
  utterance.rate = settings.rate;
  utterance.pitch = settings.pitch;
  utterance.volume = settings.volume;
  window.speechSynthesis.speak(utterance);
  return true;
}
