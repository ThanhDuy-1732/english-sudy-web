export type MistakeSkill =
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "speaking"
  | "writing";

export type MistakeStatus = "new" | "reviewing" | "resolved";

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
}

const KEY = "unifiedMistakes";
const MAX = 1000;

function ls(): UnifiedMistake[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as UnifiedMistake[]) : [];
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

export function addMistake(input: {
  skill: MistakeSkill;
  category: string;
  source: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
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
      updatedAt: now,
    };
    save(all.map((m) => (m.id === existing.id ? updated : m)));
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
  return m;
}

export function resolveMistake(id: string): void {
  const now = new Date().toISOString();
  save(
    ls().map((m) =>
      m.id === id
        ? { ...m, status: "resolved" as MistakeStatus, reviewedAt: now, updatedAt: now }
        : m
    )
  );
}

export function setMistakeStatus(id: string, status: MistakeStatus): void {
  const now = new Date().toISOString();
  save(ls().map((m) => (m.id === id ? { ...m, status, updatedAt: now } : m)));
}

export function getMistakesBySkill(skill: MistakeSkill): UnifiedMistake[] {
  return ls().filter((m) => m.skill === skill);
}

export function getMistakesByStatus(status: MistakeStatus): UnifiedMistake[] {
  return ls().filter((m) => m.status === status);
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
