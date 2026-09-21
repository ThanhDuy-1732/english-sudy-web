import { createSupabase } from "@/lib/supabase";
import { getSyncKey } from "@/lib/sync";

export type WritingKind = "ielts_task1" | "ielts_task2" | "toeic_email";

export interface WritingFeedbackShape {
  bands: { task: number; coherence: number; lexical: number; grammar: number };
  overall: number;
  wordCount: number;
  annotations: { excerpt: string; issue: string; category: string; suggestion: string }[];
  modelAnswer: string;
  nextFocus: string;
}

export interface WritingRecord {
  id: string;
  kind: WritingKind;
  prompt: string;
  chartData?: unknown;
  content: string;
  wordCount: number;
  feedback: WritingFeedbackShape;
  createdAt: string;
  updatedAt?: string;
}

const KEY = "writingSubmissions";
const MAX = 100;

export function getWriting(): WritingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WritingRecord[]) : [];
  } catch { return []; }
}

export function saveWriting(r: WritingRecord): void {
  if (typeof window === "undefined") return;
  const updated: WritingRecord = { ...r, updatedAt: new Date().toISOString() };
  const all = getWriting().filter((x) => x.id !== r.id);
  all.unshift(updated);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  localStorage.setItem("lastWritingAt", r.createdAt);
  void pushWriting(updated);
}

export async function pushWriting(r: WritingRecord): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await supabase.from("writing_submissions").upsert({
      id: r.id,
      sync_key: syncKey,
      kind: r.kind,
      payload: r,
      overall: r.feedback.overall,
      created_at: r.createdAt,
      updated_at: r.updatedAt ?? r.createdAt,
    }, { onConflict: "id" });
  } catch { /* fire-and-forget */ }
}
