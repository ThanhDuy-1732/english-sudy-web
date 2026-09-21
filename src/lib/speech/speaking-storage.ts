import type { SpeakingFeedback } from "./types";
import { createSupabase } from "@/lib/supabase";
import { getSyncKey } from "@/lib/sync";

export interface SpeakingRecord {
  id: string;
  mode: "ielts_p1" | "ielts_p2" | "ielts_p3" | "roleplay" | "shadowing";
  prompt: string;
  transcript: string;
  durationSec: number;
  feedback: SpeakingFeedback;
  audioId?: string;
  createdAt: string;
  updatedAt?: string;
}

const KEY = "speakingSessions";
const MAX = 200;

export function getSpeaking(): SpeakingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SpeakingRecord[]) : [];
  } catch { return []; }
}

export function saveSpeaking(r: SpeakingRecord): void {
  if (typeof window === "undefined") return;
  const updated: SpeakingRecord = { ...r, updatedAt: new Date().toISOString() };
  const all = getSpeaking().filter((x) => x.id !== r.id);
  all.unshift(updated);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  localStorage.setItem("lastSpeakingAt", r.createdAt);
  void pushSpeaking(updated);
}

export async function pushSpeaking(r: SpeakingRecord): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await supabase.from("speaking_sessions").upsert({
      id: r.id,
      sync_key: syncKey,
      mode: r.mode,
      payload: r,
      overall: r.feedback.overall,
      created_at: r.createdAt,
      updated_at: r.updatedAt ?? r.createdAt,
    }, { onConflict: "id" });
  } catch { /* fire-and-forget */ }
}
