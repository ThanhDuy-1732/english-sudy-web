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
  // SM-2 fields (added by migrateToSm2 in srs.ts)
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
 * SM-2 variant — quality: 0=forgot, 3=hard, 4=good, 5=easy.
 * Updates mastery stars from repetitions for display consistency.
 */
export function updateWordReviewSm2(
  word: string,
  quality: 0 | 1 | 2 | 3 | 4 | 5
): void {
  // Lazy import to keep storage.ts free of circular deps
  const { sm2, migrateToSm2, repetitionsToMastery } = require("./srs") as typeof import("./srs");
  const words = getLearnedWords().map((w) => {
    if (w.word !== word) return w;
    const migrated = migrateToSm2(w);
    const next = sm2(
      {
        easiness: (migrated as any).easiness ?? 2.5,
        interval: migrated.reviewInterval ?? 1,
        repetitions: (migrated as any).repetitions ?? 0,
        nextReviewAt: migrated.nextReviewAt ?? new Date().toISOString(),
      },
      quality
    );
    return touch({
      ...migrated,
      easiness: next.easiness,
      repetitions: next.repetitions,
      reviewInterval: next.interval,
      nextReviewAt: next.nextReviewAt,
      mastery: repetitionsToMastery(next.repetitions),
    });
  });
  localStorage.setItem(KEY, JSON.stringify(words));
}

export function getWordsForReview(): LearnedWord[] {
  const now = new Date().toISOString();
  return getLearnedWords().filter((w) => (w.nextReviewAt ?? now) <= now);
}
