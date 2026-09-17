import type {
  ExamItem,
  ExamAttempt,
  MistakeEntry,
  ExamSettings,
  ExamKind,
  ExamPart,
} from "./types";

// ─── Keys ───────────────────────────────────────────────────────────────────
const BANK_KEY = "examBank";
const ATTEMPTS_KEY = "examAttempts";
const MISTAKES_KEY = "mistakeLog";
const SETTINGS_KEY = "examSettings";

const BANK_MAX_ITEMS_PER_KEY = 30;
const MAX_ATTEMPTS = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ls<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Exam Bank ───────────────────────────────────────────────────────────────
export function bankKey(kind: ExamKind, part: ExamPart, level: number) {
  return `${kind}:${part}:${level}`;
}

export function pruneBank(bank: Record<string, ExamItem[]>) {
  for (const key of Object.keys(bank)) {
    bank[key] = bank[key]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, BANK_MAX_ITEMS_PER_KEY);
  }
  return bank;
}

export function getExamBank(): Record<string, ExamItem[]> {
  return ls<Record<string, ExamItem[]>>(BANK_KEY, {});
}

export function getItemsFromBank(
  kind: ExamKind,
  part: ExamPart,
  level: number
): ExamItem[] {
  const bank = getExamBank();
  return bank[bankKey(kind, part, level)] ?? [];
}

export function addItemToBank(item: ExamItem) {
  const bank = getExamBank();
  const k = bankKey(item.kind, item.part as ExamPart, item.level);
  bank[k] = [...(bank[k] ?? []), item];
  lsSet(BANK_KEY, pruneBank(bank));
}

// ─── Attempts ────────────────────────────────────────────────────────────────
export function getAttempts(): ExamAttempt[] {
  return ls<ExamAttempt[]>(ATTEMPTS_KEY, []);
}

export function saveAttempt(attempt: ExamAttempt) {
  const attempts = [attempt, ...getAttempts()].slice(0, MAX_ATTEMPTS);
  lsSet(ATTEMPTS_KEY, attempts);
}

export function getAttemptById(id: string): ExamAttempt | undefined {
  return getAttempts().find((a) => a.id === id);
}

// ─── Mistake Log ─────────────────────────────────────────────────────────────
export function getMistakes(): MistakeEntry[] {
  return ls<MistakeEntry[]>(MISTAKES_KEY, []);
}

export function addMistake(entry: MistakeEntry) {
  const mistakes = [entry, ...getMistakes()];
  lsSet(MISTAKES_KEY, mistakes);
}

export function resolveMistake(id: string) {
  const mistakes = getMistakes().map((m) =>
    m.id === id ? { ...m, resolved: true, reviewedAt: new Date().toISOString() } : m
  );
  lsSet(MISTAKES_KEY, mistakes);
}

export function getUnresolvedMistakes(): MistakeEntry[] {
  return getMistakes().filter((m) => !m.resolved);
}

// ─── Settings ────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: ExamSettings = {
  primaryExam: "TOEIC",
  level: 3,
  listeningRate: 1.0,
  autoAdvance: false,
};

export function getExamSettings(): ExamSettings {
  return { ...DEFAULT_SETTINGS, ...ls<Partial<ExamSettings>>(SETTINGS_KEY, {}) };
}

export function saveExamSettings(settings: Partial<ExamSettings>) {
  lsSet(SETTINGS_KEY, { ...getExamSettings(), ...settings });
}
