import type { MistakeEntry } from "./exam/types";
import {
  examPartToSkill,
  getMistakes,
  saveMistakes,
  type ExamMistakeMeta,
  type UnifiedMistake,
} from "./mistakes";

const sourceOf = (e: MistakeEntry) => `exam:${e.part}:${e.questionId}`;

/**
 * Converts legacy `mistakeLog` entries into UnifiedMistake entries. Pure and deterministic:
 * - groups by question + type + resolved flag; the entry id is the newest legacy id so devices converge under LWW
 * - never adds counts to a unified entry that old dual-write already counted
 * - a fully-resolved legacy question resolves its unified entry unless the unified entry is newer
 */
export function migrateLegacyMistakes(
  legacy: MistakeEntry[],
  unified: UnifiedMistake[]
): { merged: UnifiedMistake[]; changed: UnifiedMistake[] } {
  const merged = unified.map((m) => ({ ...m }));
  const changedIds = new Set<string>();

  const byId = new Map<string, MistakeEntry>();
  for (const raw of legacy) {
    const e = { ...raw, updatedAt: raw.updatedAt ?? raw.reviewedAt ?? raw.createdAt };
    const prev = byId.get(e.id);
    if (!prev || e.updatedAt >= prev.updatedAt) byId.set(e.id, e);
  }

  const groups = new Map<string, MistakeEntry[]>();
  for (const e of Array.from(byId.values())) {
    const key = `${sourceOf(e)}|${e.type}|${e.resolved ? "r" : "u"}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const unresolvedQuestions = new Set<string>();
  for (const key of Array.from(groups.keys())) {
    if (key.endsWith("|u")) unresolvedQuestions.add(key.slice(0, -2));
  }

  for (const [key, entries] of Array.from(groups).sort(([a], [b]) => a.localeCompare(b))) {
    const resolved = key.endsWith("|r");
    if (resolved && unresolvedQuestions.has(key.slice(0, -2))) continue;

    const sorted = [...entries].sort(
      (a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id)
    );
    const latest = sorted[sorted.length - 1];
    const source = sourceOf(latest);
    const exam: ExamMistakeMeta = {
      itemId: latest.itemId,
      questionId: latest.questionId,
      part: latest.part,
      type: latest.type,
      prompt: latest.prompt,
    };
    const match = merged.find(
      (m) =>
        m.source === source &&
        m.category === latest.type &&
        (resolved || m.status !== "resolved")
    );

    if (!match) {
      merged.push({
        id: latest.id,
        skill: examPartToSkill(latest.part),
        category: latest.type,
        source,
        userAnswer: latest.userAnswer,
        correctAnswer: latest.correctAnswer,
        explanation: latest.explanation,
        occurrenceCount: sorted.length,
        status: resolved ? "resolved" : "new",
        createdAt: sorted.map((e) => e.createdAt).sort()[0],
        updatedAt: latest.updatedAt,
        ...(latest.reviewedAt ? { reviewedAt: latest.reviewedAt } : {}),
        exam,
      });
      changedIds.add(latest.id);
      continue;
    }

    if (!match.exam) {
      match.exam = exam;
      changedIds.add(match.id);
    }
    if (resolved && match.status !== "resolved" && match.updatedAt <= latest.updatedAt) {
      match.status = "resolved";
      match.reviewedAt = latest.reviewedAt ?? latest.updatedAt;
      match.updatedAt = latest.updatedAt;
      changedIds.add(match.id);
    }
  }

  return { merged, changed: merged.filter((m) => changedIds.has(m.id)) };
}

const LEGACY_KEY = "mistakeLog";
const BACKUP_KEY = "mistakeLogBackup";
const LOCAL_FLAG = "mistakeLogMigrated";
const REMOTE_FLAG = "mistakeLogRemoteMigrated";

function readLegacy(): { raw: string | null; entries: MistakeEntry[] } {
  const raw = localStorage.getItem(LEGACY_KEY);
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return { raw, entries: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { raw, entries: [] };
  }
}

export function needsRemoteMistakeMigration(): boolean {
  return typeof window !== "undefined" && !localStorage.getItem(REMOTE_FLAG);
}

/**
 * One-time move of legacy `mistakeLog` into `unifiedMistakes`. Local and remote
 * (`mistake_log` table) sources have separate flags so each runs exactly once;
 * re-running would resurrect entries the user already resolved. `mistakeLog` is
 * never deleted and is backed up to `mistakeLogBackup`.
 */
/** Safe to call from effects: a blocked or full storage just skips the migration (it retries on the next load). */
export function runMistakeMigration(remote?: MistakeEntry[]): void {
  try {
    migrate(remote);
  } catch {
    // Migration is idempotent; nothing to roll back.
  }
}

function migrate(remote?: MistakeEntry[]): void {
  if (typeof window === "undefined") return;
  const runLocal = !localStorage.getItem(LOCAL_FLAG);
  const runRemote = remote !== undefined && !localStorage.getItem(REMOTE_FLAG);
  if (!runLocal && !runRemote) return;

  const { raw, entries: local } = readLegacy();
  const input: MistakeEntry[] = [];
  if (runLocal) {
    if (raw && !localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, raw);
    input.push(...local);
  }
  if (runRemote) {
    const localIds = new Set(local.map((e) => e.id));
    input.push(...remote.filter((e) => !localIds.has(e.id)));
  }

  const { merged, changed } = migrateLegacyMistakes(input, getMistakes());
  if (changed.length > 0) {
    saveMistakes(merged);
  }
  if (runLocal) localStorage.setItem(LOCAL_FLAG, "1");
  if (runRemote) localStorage.setItem(REMOTE_FLAG, "1");
}
