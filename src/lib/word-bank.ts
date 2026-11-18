import { readStored } from "./safe-json";
import { getLearnedWords } from "./storage";

export interface BankWord {
  word: string;
  meaning: string;
  topic: string;
  createdAt: string;
  seenAt?: string;
}

export const WORD_BANK_KEY = "wordBank";
export const WORD_BANK_LIMIT = 5000;

const RECENT_EXCLUDE_COUNT = 120;
const DEFAULT_EXCLUDE_MAX = 200;

// A failed write keeps the full snapshot here so the current session can still use
// (and display) words the learner already paid for. The next successful write clears it.
let overlay: BankWord[] | null = null;

export function normalizeWord(word: string): string {
  return word.trim().replace(/\s+/g, " ").toLowerCase();
}

function isValidEntry(entry: unknown): entry is BankWord {
  return Boolean(entry) && typeof (entry as BankWord).word === "string";
}

/** Stored bank plus the in-memory overlay; later entries win, first position kept. */
export function getBank(): BankWord[] {
  const stored = readStored<BankWord[]>(WORD_BANK_KEY, []).filter(isValidEntry);
  const merged = new Map<string, BankWord>();
  for (const entry of [...stored, ...(overlay ?? [])]) {
    if (!isValidEntry(entry)) continue;
    const key = normalizeWord(entry.word);
    if (!key) continue;
    merged.set(key, entry);
  }
  return [...merged.values()];
}

function learnedNormalized(): Set<string> {
  return new Set(getLearnedWords().map((entry) => normalizeWord(entry.word)));
}

export function getKnownWordSet(): Set<string> {
  const known = new Set(getBank().map((entry) => normalizeWord(entry.word)));
  for (const word of learnedNormalized()) known.add(word);
  return known;
}

export function addBankWords(entries: BankWord[]): { added: number; persisted: boolean } {
  const bank = getBank();
  const known = new Set(bank.map((entry) => normalizeWord(entry.word)));
  for (const word of learnedNormalized()) known.add(word);

  const fresh: BankWord[] = [];
  for (const entry of entries) {
    if (!isValidEntry(entry)) continue;
    const word = entry.word.trim();
    const key = normalizeWord(word);
    if (!key || known.has(key)) continue;
    known.add(key);
    fresh.push({ ...entry, word });
  }

  if (fresh.length === 0) return { added: 0, persisted: true };

  const next = [...bank, ...fresh].slice(-WORD_BANK_LIMIT);
  try {
    localStorage.setItem(WORD_BANK_KEY, JSON.stringify(next));
    overlay = null;
    return { added: fresh.length, persisted: true };
  } catch {
    overlay = next;
    return { added: fresh.length, persisted: false };
  }
}

export function getUnseen(topic: string, limit: number): BankWord[] {
  const learned = learnedNormalized();
  return getBank()
    .filter(
      (entry) =>
        !entry.seenAt && entry.topic === topic && !learned.has(normalizeWord(entry.word))
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(0, limit);
}

export function markBankWordsSeen(words: string[]): void {
  if (words.length === 0) return;
  const keys = new Set(words.map(normalizeWord));
  const now = new Date().toISOString();
  const next = getBank().map((entry) =>
    !entry.seenAt && keys.has(normalizeWord(entry.word)) ? { ...entry, seenAt: now } : entry
  );
  try {
    localStorage.setItem(WORD_BANK_KEY, JSON.stringify(next));
    overlay = null;
  } catch {
    overlay = next;
  }
}

export function takeUnseen(topic: string, limit: number): BankWord[] {
  const picked = getUnseen(topic, limit);
  markBankWordsSeen(picked.map((entry) => entry.word));
  return picked;
}

export function countBank(topic?: string): number {
  const learned = learnedNormalized();
  return getBank().filter(
    (entry) =>
      !entry.seenAt &&
      (!topic || entry.topic === topic) &&
      !learned.has(normalizeWord(entry.word))
  ).length;
}

/**
 * Bounded sample for the model: the topic's newest words first (so repeats are
 * avoided immediately), then a random slice of older bank words and learned words.
 */
export function pickExcludeSample(topic: string, max = DEFAULT_EXCLUDE_MAX): string[] {
  const topicWords = getBank()
    .filter((entry) => entry.topic === topic)
    .map((entry) => entry.word);
  const recentCount = Math.min(RECENT_EXCLUDE_COUNT, topicWords.length);
  const recent = topicWords.slice(topicWords.length - recentCount);
  const older = topicWords.slice(0, topicWords.length - recentCount);

  const used = new Set(recent.map(normalizeWord));
  const rest: string[] = [];
  for (const word of [...older, ...getLearnedWords().map((entry) => entry.word)]) {
    const key = normalizeWord(word);
    if (!key || used.has(key)) continue;
    used.add(key);
    rest.push(word);
  }

  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  return [...recent, ...rest].slice(0, max);
}
