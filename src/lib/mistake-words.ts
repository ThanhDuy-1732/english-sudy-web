// Words from a mistake that are worth putting into spaced-repetition review.
import { getExamBank } from "./exam/exam-storage";
import { getLearnedWords, saveLearnedWord } from "./storage";
import type { UnifiedMistake } from "./mistakes";

const MAX_WORDS = 4;

/** Exam mistakes offer the question's key vocabulary; other mistakes offer the correct answer when it is a word or short phrase. */
export function wordsForMistake(mistake: UnifiedMistake): string[] {
  const words: string[] = [];
  if (mistake.exam) {
    const item = Object.values(getExamBank()).flat().find((i) => i.id === mistake.exam!.itemId);
    const question = item?.questions.find((q) => q.id === mistake.exam!.questionId);
    words.push(...(question?.keyVocabulary ?? []));
  }
  const answer = mistake.correctAnswer.trim();
  if (words.length === 0 && answer && answer.split(/\s+/).length <= 3 && !/[.?!]$/.test(answer)) words.push(answer);
  const known = new Set(getLearnedWords().map((w) => w.word.toLowerCase()));
  return [...new Set(words.map((w) => w.trim()).filter(Boolean))].filter((w) => !known.has(w.toLowerCase())).slice(0, MAX_WORDS);
}

/** Saves the word as a new card due tomorrow; the mistake's explanation stands in for the meaning. */
export function addMistakeWord(word: string, mistake: UnifiedMistake): boolean {
  return saveLearnedWord({
    word,
    meaning: mistake.explanation.slice(0, 160),
    example: mistake.exam?.prompt ?? "",
    topic: mistake.exam ? `Sổ lỗi: ${mistake.exam.part}` : "Sổ lỗi",
    learnedAt: new Date().toISOString(),
  });
}
