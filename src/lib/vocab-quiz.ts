import { langOf } from "./languages";
import type { LearnedWord } from "./storage";

export interface MCQQuestion { type: "mcq"; word: string; meaning: string; options: string[]; answer: string }

/** The vocabulary quiz is English-only until per-language quizzes (phase 2): its prompts and fill mode assume English. */
export function quizWords(words: LearnedWord[]): LearnedWord[] {
  return words.filter((w) => langOf(w) === "en");
}

/** Meaning question with up to 3 distractors; each option appears once, so a word sharing the answer's meaning can't be a second right answer. */
export function buildMCQ(word: LearnedWord, allWords: LearnedWord[]): MCQQuestion {
  const seen = new Set([word.meaning]);
  const distractors: string[] = [];
  for (const w of [...allWords].sort(() => Math.random() - 0.5)) {
    if (w.word === word.word || !w.meaning || seen.has(w.meaning)) continue;
    seen.add(w.meaning);
    distractors.push(w.meaning);
    if (distractors.length === 3) break;
  }
  const options = [...distractors, word.meaning].sort(() => Math.random() - 0.5);
  return { type: "mcq", word: word.word, meaning: word.meaning, options, answer: word.meaning };
}
