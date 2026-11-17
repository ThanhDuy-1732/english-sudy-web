import { addMistakeWord, wordsForMistake } from "../mistake-words";
import type { UnifiedMistake } from "../mistakes";

const base: UnifiedMistake = {
  id: "m1", skill: "vocabulary", category: "meaning", source: "quiz", userAnswer: "borrow", correctAnswer: "lend",
  explanation: "lend = cho mượn", occurrenceCount: 1, status: "new", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z",
};

beforeEach(() => localStorage.clear());

test("offers the exam question's key vocabulary, else a short correct answer, skipping known words", () => {
  localStorage.setItem("examBank", JSON.stringify({ "TOEIC:RC5:3": [{ id: "item", questions: [{ id: "q1", keyVocabulary: ["invoice", "deadline"] }] }] }));
  const exam = { ...base, exam: { itemId: "item", questionId: "q1", part: "RC5" as const, type: "incomplete_sentence" as const, prompt: "The ___ is due." } };
  expect(wordsForMistake(exam)).toEqual(["invoice", "deadline"]);
  expect(wordsForMistake(base)).toEqual(["lend"]);
  expect(wordsForMistake({ ...base, correctAnswer: "She has lived here since 2010." })).toEqual([]);

  expect(addMistakeWord("invoice", exam)).toBe(true);
  expect(wordsForMistake(exam)).toEqual(["deadline"]);
  const saved = JSON.parse(localStorage.getItem("learnedWords")!)[0];
  expect(saved).toMatchObject({ word: "invoice", example: "The ___ is due.", topic: "Sổ lỗi: RC5", mastery: 0 });
});
