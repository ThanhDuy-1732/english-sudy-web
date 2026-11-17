export interface LearnedWord {
  word: string;
  meaning: string;
  example: string;
  topic: string;
  learnedAt: string;
  updatedAt?: string;
  nextReviewAt?: string;
  reviewInterval?: number;
  mastery?: number;
  synonyms?: string[];
  antonyms?: string[];
  // FSRS memory state (src/lib/srs.ts)
  stability?: number;          // days until recall drops to 90%
  difficulty?: number;         // 1–10
  lastReviewedAt?: string;     // ISO
  // Legacy SM-2 fields, read once to convert old cards to FSRS
  easiness?: number;
  repetitions?: number;
}

/** Set updatedAt to now on a word object (use on every user-initiated mutation). */
export function touch<T extends { updatedAt?: string }>(obj: T): T {
  return { ...obj, updatedAt: new Date().toISOString() };
}

const KEY = "learnedWords";

export function getLearnedWords(): LearnedWord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LearnedWord[]) : [];
  } catch {
    return [];
  }
}

export function saveLearnedWord(entry: LearnedWord): boolean {
  const words = getLearnedWords();
  if (words.some((w) => w.word.toLowerCase() === entry.word.toLowerCase())) return false;

  const withDefaults: LearnedWord = touch({
    reviewInterval: 1,
    mastery: 0,
    nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
    ...entry,
  });
  localStorage.setItem(KEY, JSON.stringify([...words, withDefaults]));
  return true;
}

export function deleteLearnedWord(word: string): void {
  const words = getLearnedWords().filter((entry) => entry.word !== word);
  localStorage.setItem(KEY, JSON.stringify(words));
}

/**
 * Records a review with FSRS. quality: 0 = Quên, 3 = Khó, 4 = Được, 5 = Dễ.
 * Cards scheduled by the old SM-2 code are converted on their first FSRS review.
 */
export function reviewWord(word: string, quality: 0 | 3 | 4 | 5, now = new Date()): void {
  // Lazy import keeps storage.ts free of a circular import with srs.ts (which imports the LearnedWord type).
  const { fsrs, fsrsStateOf, stabilityToMastery } = require("./srs") as typeof import("./srs");
  const words = getLearnedWords().map((w) => {
    if (w.word !== word) return w;
    const next = fsrs(fsrsStateOf(w), quality, now);
    return touch({
      ...w,
      stability: next.stability,
      difficulty: next.difficulty,
      lastReviewedAt: next.lastReviewedAt,
      reviewInterval: next.intervalDays,
      nextReviewAt: next.nextReviewAt,
      mastery: stabilityToMastery(next.stability),
    });
  });
  localStorage.setItem(KEY, JSON.stringify(words));
}

export function getWordsForReview(): LearnedWord[] {
  const now = new Date().toISOString();
  return getLearnedWords().filter((w) => (w.nextReviewAt ?? now) <= now);
}
