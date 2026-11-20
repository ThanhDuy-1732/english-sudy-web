import { readStored } from "../safe-json";
import type {
  ExamItem,
  ExamAttempt,
  MistakeEntry,
  ExamSettings,
  ExamKind,
  ExamPart,
} from "./types";
import {
  addMistake as addUnifiedMistake,
  examPartToSkill,
  getUnresolvedExamMistakes,
} from "@/lib/mistakes";

// ─── Keys ───────────────────────────────────────────────────────────────────
const BANK_KEY = "examBank";
const ATTEMPTS_KEY = "examAttempts";
const SETTINGS_KEY = "examSettings";

const BANK_MAX_ITEMS_PER_KEY = 30;
const MAX_ATTEMPTS = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ls<T>(key: string, fallback: T): T {
  return readStored(key, fallback);
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
  const pinnedIds = new Set(getUnresolvedExamMistakes().map((m) => m.exam.itemId));
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

/** Drops an item from every bank key, e.g. after the learner reports one of its questions as wrong. */
export function removeItemFromBank(itemId: string) {
  const bank = getExamBank();
  let changed = false;
  for (const key of Object.keys(bank)) {
    const kept = bank[key].filter((item) => item.id !== itemId);
    if (kept.length !== bank[key].length) {
      bank[key] = kept;
      changed = true;
    }
  }
  if (changed) lsSet(BANK_KEY, bank);
}

export function addItemToBank(item: ExamItem) {
  const bank = getExamBank();
  const k = bankKey(item.kind, item.part as ExamPart, item.level);
  bank[k] = [...(bank[k] ?? []), item];
  lsSet(BANK_KEY, pruneBank(bank));
}

/** A banked item the learner has not answered in any saved attempt yet. */
export function takeUnseenBankItem(kind: ExamKind, part: ExamPart, level: number): ExamItem | undefined {
  const seen = new Set(getAttempts().flatMap((a) => a.answers.map((r) => r.itemId)));
  return getItemsFromBank(kind, part, level).find((item) => !seen.has(item.id));
}

// ─── Attempts ────────────────────────────────────────────────────────────────
export function getAttempts(): ExamAttempt[] {
  return ls<ExamAttempt[]>(ATTEMPTS_KEY, []);
}

export function saveAttempt(attempt: ExamAttempt) {
  const stamped = { ...attempt, updatedAt: new Date().toISOString() };
  const attempts = [stamped, ...getAttempts()].slice(0, MAX_ATTEMPTS);
  lsSet(ATTEMPTS_KEY, attempts);
}

export function getAttemptById(id: string): ExamAttempt | undefined {
  return getAttempts().find((a) => a.id === id);
}

// ─── Mistakes ────────────────────────────────────────────────────────────────
/**
 * @deprecated Compatibility adapter for ExamRunner. Writes only to unifiedMistakes;
 * new code should call `addMistake` from "@/lib/mistakes" directly.
 */
export function addMistake(entry: MistakeEntry) {
  try {
    addUnifiedMistake({
      skill: examPartToSkill(entry.part),
      category: entry.type,
      source: `exam:${entry.part}:${entry.questionId}`,
      userAnswer: entry.userAnswer,
      correctAnswer: entry.correctAnswer,
      explanation: entry.explanation,
      exam: {
        itemId: entry.itemId,
        questionId: entry.questionId,
        part: entry.part,
        type: entry.type,
        prompt: entry.prompt,
      },
    });
  } catch {
    // don't disrupt the exam flow on storage failure
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS: ExamSettings = {
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
