export interface LearnedWord {
  word: string;
  meaning: string;
  example: string;
  topic: string;
  learnedAt: string;
  nextReviewAt?: string;
  reviewInterval?: number;
  mastery?: number;
  synonyms?: string[];
  antonyms?: string[];
}

const KEY = "learnedWords";

export function getLearnedWords(): LearnedWord[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LearnedWord[]) : [];
  } catch {
    return [];
  }
}

export function saveLearnedWord(entry: LearnedWord): boolean {
  const words = getLearnedWords();
  if (words.some((w) => w.word.toLowerCase() === entry.word.toLowerCase())) return false;

  const withDefaults: LearnedWord = {
    reviewInterval: 1,
    mastery: 0,
    nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
    ...entry,
  };
  localStorage.setItem(KEY, JSON.stringify([...words, withDefaults]));
  return true;
}

export function deleteLearnedWord(word: string): void {
  const words = getLearnedWords().filter((entry) => entry.word !== word);
  localStorage.setItem(KEY, JSON.stringify(words));
}

export function updateWordReview(word: string, remembered: boolean): void {
  const words = getLearnedWords().map((w) => {
    if (w.word !== word) return w;
    const newInterval = remembered ? Math.min((w.reviewInterval ?? 1) * 2, 30) : 1;
    const newMastery = remembered
      ? Math.min((w.mastery ?? 0) + 1, 5)
      : Math.max((w.mastery ?? 0) - 1, 0);
    const nextReviewAt = new Date(Date.now() + newInterval * 86400000).toISOString();
    return { ...w, reviewInterval: newInterval, mastery: newMastery, nextReviewAt };
  });
  localStorage.setItem(KEY, JSON.stringify(words));
}

export function getWordsForReview(): LearnedWord[] {
  const now = new Date().toISOString();
  return getLearnedWords().filter((w) => (w.nextReviewAt ?? now) <= now);
}
