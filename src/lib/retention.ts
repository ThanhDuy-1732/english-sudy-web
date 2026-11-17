// Data older than RETENTION_DAYS is deleted automatically: generated exam questions, learning-session history and
// speaking recordings. Saved words, mistakes, essays and speaking scores are kept.
import { readStored } from "./safe-json";
import { localDateKey } from "./date";
import { getUnresolvedExamMistakes } from "./mistakes";
import type { ExamItem } from "./exam/types";
import type { LearningSession } from "./sessions";
import type { SpeakingRecord } from "./speech/speaking-storage";

export const RETENTION_DAYS = 90;
const RAN_ON_KEY = "retentionRanOn";

function isOld(iso: string | undefined, cutoff: number): boolean {
  const time = Date.parse(iso ?? "");
  return !Number.isNaN(time) && time < cutoff;
}

/** Removes old sessions and exam items from localStorage; returns the audio ids whose recordings are now expired. */
export function pruneOldData(now = new Date()): { sessions: number; examItems: number; audioIds: string[] } {
  const cutoff = now.getTime() - RETENTION_DAYS * 86_400_000;

  const sessions = readStored<LearningSession[]>("learningSessions", []);
  const keptSessions = sessions.filter((s) => !isOld(s.startedAt, cutoff));
  if (keptSessions.length !== sessions.length) localStorage.setItem("learningSessions", JSON.stringify(keptSessions));

  // Questions behind an unresolved mistake stay so "làm lại" still works.
  const pinned = new Set(getUnresolvedExamMistakes().map((m) => m.exam.itemId));
  const bank = readStored<Record<string, ExamItem[]>>("examBank", {});
  let examItems = 0;
  for (const key of Object.keys(bank)) {
    if (!Array.isArray(bank[key])) continue;
    const kept = bank[key].filter((item) => pinned.has(item.id) || !isOld(item.createdAt, cutoff));
    examItems += bank[key].length - kept.length;
    if (kept.length) bank[key] = kept;
    else delete bank[key];
  }
  if (examItems) localStorage.setItem("examBank", JSON.stringify(bank));

  // The score and transcript stay; only the recording goes, so the record no longer offers playback.
  const records = readStored<SpeakingRecord[]>("speakingSessions", []);
  const audioIds: string[] = [];
  const updated = records.map((r) => {
    if (!r.audioId || !isOld(r.createdAt, cutoff)) return r;
    audioIds.push(r.audioId);
    const { audioId: _removed, ...rest } = r;
    return rest;
  });
  if (audioIds.length) localStorage.setItem("speakingSessions", JSON.stringify(updated));

  return { sessions: sessions.length - keptSessions.length, examItems, audioIds };
}

/** Runs at most once per local day. Never throws: storage may be blocked or full. */
export async function runRetention(now = new Date()): Promise<void> {
  try {
    const today = localDateKey(now);
    if (localStorage.getItem(RAN_ON_KEY) === today) return;
    const { audioIds } = pruneOldData(now);
    if (audioIds.length) {
      const { deleteAudio } = await import("./speech/audio-store");
      await deleteAudio(audioIds);
    }
    localStorage.setItem(RAN_ON_KEY, today);
  } catch {
    // Try again next visit.
  }
}
