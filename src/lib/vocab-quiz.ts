import { LEARN_LANGS, langOf, type LearnLang } from "./languages";
import type { LearnedWord } from "./storage";

export interface MCQQuestion { type: "mcq"; word: string; meaning: string; options: string[]; answer: string }

/** A quiz runs in one language: questions and distractors all come from that language's saved words. */
export function quizWords(words: LearnedWord[], lang: LearnLang = "en"): LearnedWord[] {
  return words.filter((w) => langOf(w) === lang);
}

/** Learning languages with enough saved words (4: one answer and three distractors) to run a quiz, in app order. */
export function quizLanguages(words: LearnedWord[], learning: LearnLang[]): LearnLang[] {
  return LEARN_LANGS.filter((lang) => learning.includes(lang) && quizWords(words, lang).length >= 4);
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
