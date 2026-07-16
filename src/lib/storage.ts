export interface LearnedWord {
  word: string;
  meaning: string;
  example: string;
  topic: string;
  learnedAt: string;
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

  localStorage.setItem(KEY, JSON.stringify([...words, entry]));
  return true;
}

export function deleteLearnedWord(word: string): void {
  const words = getLearnedWords().filter((entry) => entry.word !== word);
  localStorage.setItem(KEY, JSON.stringify(words));
}
