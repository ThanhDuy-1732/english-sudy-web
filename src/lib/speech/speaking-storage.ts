import { asArray } from "../safe-json";
import type { LearnLang } from "../languages";
import type { SpeakingFeedback } from "./types";

export interface SpeakingRecord {
  lang?: LearnLang;          // language practised; missing = English
  id: string;
  mode: "ielts_p1" | "ielts_p2" | "ielts_p3" | "roleplay" | "shadowing";
  prompt: string;
  transcript: string;
  durationSec: number;
  feedback: SpeakingFeedback;
  audioId?: string;
  retryOfId?: string;
  createdAt: string;
  updatedAt?: string;
}

const KEY = "speakingSessions";
const MAX = 200;

export function getSpeaking(): SpeakingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? asArray<SpeakingRecord>(JSON.parse(raw)) : [];
  } catch { return []; }
}

export function saveSpeaking(r: SpeakingRecord): void {
  if (typeof window === "undefined") return;
  const updated: SpeakingRecord = { ...r, updatedAt: new Date().toISOString() };
  const all = getSpeaking().filter((x) => x.id !== r.id);
  all.unshift(updated);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  localStorage.setItem("lastSpeakingAt", r.createdAt);
}
