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

test("saveLearnedWord returns true on first save", () => {
  const result = saveLearnedWord(mockWord);
  expect(result).toBe(true);
});

test("saveLearnedWord does not save duplicate words and returns false", () => {
  saveLearnedWord(mockWord);
  const result = saveLearnedWord(mockWord);
  expect(result).toBe(false);
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

test("saveLearnedWord treats case-insensitive duplicates as duplicates", () => {
  const lowerWord: LearnedWord = { ...mockWord, word: "negotiate" };
  const capitalWord: LearnedWord = { ...mockWord, word: "Negotiate" };

  const result1 = saveLearnedWord(lowerWord);
  const result2 = saveLearnedWord(capitalWord);

  expect(result1).toBe(true);
  expect(result2).toBe(false);
  expect(getLearnedWords()).toHaveLength(1);
});
