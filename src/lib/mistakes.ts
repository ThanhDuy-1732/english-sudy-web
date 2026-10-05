import { pushUnifiedMistake } from "./sync";
import { asArray } from "./safe-json";
import type { ExamPart, QuestionType } from "./exam/types";

export type MistakeSkill =
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "speaking"
  | "writing";

export type MistakeStatus = "new" | "reviewing" | "resolved";

export interface ExamMistakeMeta {
  itemId: string;
  questionId: string;
  part: ExamPart;
  type: QuestionType;
  prompt: string;
}

export interface UnifiedMistake {
  id: string;
  skill: MistakeSkill;
  category: string;
  source: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  occurrenceCount: number;
  status: MistakeStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  /** Present for mistakes recorded by the exam engine (drives /exam/mistakes and bank pinning). */
  exam?: ExamMistakeMeta;
}

export type ExamMistake = UnifiedMistake & { exam: ExamMistakeMeta };

export function examPartToSkill(part: string): MistakeSkill {
  if (part.startsWith("LC") || part.startsWith("LISTEN")) return "listening";
  return "reading";
}

const KEY = "unifiedMistakes";
const MAX = 1000;

function ls(): UnifiedMistake[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? asArray<UnifiedMistake>(JSON.parse(r)) : [];
  } catch {
    return [];
  }
}

function save(items: UnifiedMistake[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
}

export function getMistakes(): UnifiedMistake[] {
  return ls();
}

/** Replaces the whole local store, e.g. after a sync merge. Does not push. */
export function saveMistakes(items: UnifiedMistake[]): void {
  save(items);
}

export function addMistake(input: {
  skill: MistakeSkill;
  category: string;
  source: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  exam?: ExamMistakeMeta;
}): UnifiedMistake {
  const all = ls();
  const existing = all.find(
    (m) =>
      m.source === input.source &&
      m.category === input.category &&
      m.status !== "resolved"
  );
  const now = new Date().toISOString();
  if (existing) {
    const updated: UnifiedMistake = {
      ...existing,
      occurrenceCount: existing.occurrenceCount + 1,
      userAnswer: input.userAnswer,
      explanation: input.explanation,
      exam: input.exam ?? existing.exam,
      updatedAt: now,
    };
    save(all.map((m) => (m.id === existing.id ? updated : m)));
    void pushUnifiedMistake(updated);
    return updated;
  }
  const m: UnifiedMistake = {
    ...input,
    id: crypto.randomUUID(),
    occurrenceCount: 1,
    status: "new",
    createdAt: now,
    updatedAt: now,
  };
  save([m, ...all]);
  void pushUnifiedMistake(m);
  return m;
}

export function resolveMistake(id: string): void {
  const now = new Date().toISOString();
  let resolved: UnifiedMistake | undefined;
  save(
    ls().map((m) => {
      if (m.id !== id) return m;
      resolved = { ...m, status: "resolved" as MistakeStatus, reviewedAt: now, updatedAt: now };
      return resolved;
    })
  );
  if (resolved) void pushUnifiedMistake(resolved);
}

export function setMistakeStatus(id: string, status: MistakeStatus): void {
  const now = new Date().toISOString();
  let updated: UnifiedMistake | undefined;
  save(
    ls().map((m) => {
      if (m.id !== id) return m;
      updated = { ...m, status, updatedAt: now };
      return updated;
    })
  );
  if (updated) void pushUnifiedMistake(updated);
}

export function getMistakesBySkill(skill: MistakeSkill): UnifiedMistake[] {
  return ls().filter((m) => m.skill === skill);
}

export function getMistakesByStatus(status: MistakeStatus): UnifiedMistake[] {
  return ls().filter((m) => m.status === status);
}

const hasExam = (m: UnifiedMistake): m is ExamMistake => !!m.exam;

export function getExamMistakes(): ExamMistake[] {
  return ls().filter(hasExam);
}

export function getUnresolvedExamMistakes(): ExamMistake[] {
  return getExamMistakes().filter((m) => m.status !== "resolved");
}

export function getTopCategories(
  skill?: MistakeSkill,
  limit = 5
): { category: string; count: number; skill: MistakeSkill }[] {
  const items = skill ? getMistakesBySkill(skill) : ls();
  const counts = new Map<string, { count: number; skill: MistakeSkill }>();
  for (const m of items) {
    const key = `${m.skill}:${m.category}`;
    const entry = counts.get(key) ?? { count: 0, skill: m.skill };
    counts.set(key, { ...entry, count: entry.count + m.occurrenceCount });
  }
  return Array.from(counts.entries())
    .map(([key, v]) => ({ category: key.split(":")[1], ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
