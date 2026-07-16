import {
  deleteLearnedWord,
  getLearnedWords,
  type LearnedWord,
  saveLearnedWord,
} from "../storage";

const mockWord: LearnedWord = {
  word: "greet",
  meaning: "chào hỏi",
  example: "I greet my neighbors every morning.",
  topic: "Daily Communication",
  learnedAt: "2026-07-16T00:00:00.000Z",
};

beforeEach(() => {
  localStorage.clear();
});

test("getLearnedWords returns empty array when nothing saved", () => {
  expect(getLearnedWords()).toEqual([]);
});

test("saveLearnedWord persists a word", () => {
  saveLearnedWord(mockWord);
  expect(getLearnedWords()).toEqual([mockWord]);
});

test("saveLearnedWord does not save duplicate words", () => {
  saveLearnedWord(mockWord);
  saveLearnedWord(mockWord);
  expect(getLearnedWords()).toHaveLength(1);
});

test("deleteLearnedWord removes the correct word", () => {
  saveLearnedWord(mockWord);
  deleteLearnedWord("greet");
  expect(getLearnedWords()).toEqual([]);
});

test("deleteLearnedWord leaves other words intact", () => {
  const other: LearnedWord = { ...mockWord, word: "smile" };
  saveLearnedWord(mockWord);
  saveLearnedWord(other);
  deleteLearnedWord("greet");
  expect(getLearnedWords()).toEqual([other]);
});
