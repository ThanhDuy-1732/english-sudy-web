import { syncRequest } from "@/lib/sync-request";
import { createSupabase } from "@/lib/supabase";
import { enqueue } from "@/lib/sync-queue";
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

export interface WritingDraft {
  version: number;
  content: string;
  wordCount: number;
  feedback: WritingFeedbackShape;
  createdAt: string;
}

export interface WritingRecord {
  id: string;
  /** Writing task the record came from (e.g. "task1-line"); missing on older records. */
  taskId?: string;
  kind: WritingKind;
  prompt: string;
  chartData?: unknown;
  content: string;
  wordCount: number;
  feedback: WritingFeedbackShape;
  versions?: WritingDraft[];
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

export function addWritingVersion(id: string, draft: Omit<WritingDraft, "version">): void {
  if (typeof window === "undefined") return;
  const all = getWriting();
  const record = all.find((r) => r.id === id);
  if (!record) return;
  const versions = record.versions ?? [];
  const updated: WritingRecord = {
    ...record,
    content: draft.content,
    wordCount: draft.wordCount,
    feedback: draft.feedback,
    updatedAt: new Date().toISOString(),
    versions: [...versions, { ...draft, version: versions.length + 1 }],
  };
  const rest = all.filter((r) => r.id !== id);
  rest.unshift(updated);
  localStorage.setItem(KEY, JSON.stringify(rest.slice(0, MAX)));
  void pushWriting(updated);
}

export async function pushWriting(r: WritingRecord, queueOnFailure = true): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await syncRequest(supabase.from("writing_submissions").upsert({
      id: r.id,
      sync_key: syncKey,
      kind: r.kind,
      payload: r,
      overall: r.feedback.overall,
      created_at: r.createdAt,
      updated_at: r.updatedAt ?? r.createdAt,
    }, { onConflict: "id" }));
  } catch (error) {
    if (!queueOnFailure) throw error;
    enqueue({ entity: "writingSubmissions", entityId: r.id, op: "upsert", payload: r });
  }
}
