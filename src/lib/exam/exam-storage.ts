import type {
  ExamItem,
  ExamAttempt,
  MistakeEntry,
  ExamSettings,
  ExamKind,
  ExamPart,
} from "./types";
import { pushAttempt, pushMistake } from "@/lib/sync";

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

export function pruneBank(bank: Record<string, ExamItem[]>): Record<string, ExamItem[]> {
  const pinnedIds = new Set(getUnresolvedMistakes().map((m) => m.itemId));
  const result: Record<string, ExamItem[]> = {};
  for (const key of Object.keys(bank)) {
    const sorted = bank[key].slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pinned = sorted.filter((item) => pinnedIds.has(item.id));
    const unpinned = sorted.filter((item) => !pinnedIds.has(item.id));
    result[key] = [...pinned, ...unpinned].slice(0, BANK_MAX_ITEMS_PER_KEY);
  }
  return result;
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
  const stamped = { ...attempt, updatedAt: new Date().toISOString() };
  const attempts = [stamped, ...getAttempts()].slice(0, MAX_ATTEMPTS);
  lsSet(ATTEMPTS_KEY, attempts);
  pushAttempt(stamped);
}

export function getAttemptById(id: string): ExamAttempt | undefined {
  return getAttempts().find((a) => a.id === id);
}

// ─── Mistake Log ─────────────────────────────────────────────────────────────
export function getMistakes(): MistakeEntry[] {
  return ls<MistakeEntry[]>(MISTAKES_KEY, []);
}

export function addMistake(entry: MistakeEntry) {
  const now = new Date().toISOString();
  const stamped = { ...entry, updatedAt: entry.updatedAt ?? now };
  const mistakes = [stamped, ...getMistakes()];
  lsSet(MISTAKES_KEY, mistakes);
  pushMistake(stamped);
}

export function resolveMistake(id: string) {
  const now = new Date().toISOString();
  const mistakes = getMistakes().map((m) =>
    m.id === id ? { ...m, resolved: true, reviewedAt: now, updatedAt: now } : m
  );
  lsSet(MISTAKES_KEY, mistakes);
  const updated = mistakes.find((m) => m.id === id);
  if (updated) pushMistake(updated);
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
