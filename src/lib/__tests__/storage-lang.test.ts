import { deleteLearnedWord, getLearnedWords, getWordsForReview, reviewWord, saveLearnedWord, wordKey, type LearnedWord } from "../storage";

const entry = (word: string, lang?: "en" | "zh" | "ja" | "ko"): LearnedWord => ({
  word, meaning: "học sinh", example: "", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z", ...(lang ? { lang } : {}),
});

beforeEach(() => localStorage.clear());

test("wordKey combines language and normalized word", () => {
  expect(wordKey("zh", " 学生 ")).toBe("zh:学生");
  expect(wordKey("en", "Apple")).toBe("en:apple");
});

test("saveLearnedWord keeps 学生 in zh and ja apart", () => {
  expect(saveLearnedWord(entry("学生", "zh"))).toBe(true);
  expect(saveLearnedWord(entry("学生", "ja"))).toBe(true);
  expect(saveLearnedWord(entry("学生", "zh"))).toBe(false);
  expect(getLearnedWords()).toHaveLength(2);
});

test("reviewWord only touches the given language", () => {
  saveLearnedWord(entry("学生", "zh"));
  saveLearnedWord(entry("学生", "ja"));
  const before = getLearnedWords().find((w) => w.lang === "zh")!.nextReviewAt;
  reviewWord("学生", 4, new Date("2026-11-20T00:00:00.000Z"), "ja");
  const after = getLearnedWords();
  expect(after.find((w) => w.lang === "zh")!.nextReviewAt).toBe(before);
  expect(after.find((w) => w.lang === "ja")!.lastReviewedAt).toBe("2026-11-20T00:00:00.000Z");
});

test("deleteLearnedWord removes one language", () => {
  saveLearnedWord(entry("学生", "zh"));
  saveLearnedWord(entry("学生", "ja"));
  deleteLearnedWord("学生", "zh");
  expect(getLearnedWords().map((w) => w.lang)).toEqual(["ja"]);
});

test("words without lang are English", () => {
  localStorage.setItem("learnedWords", JSON.stringify([{ ...entry("apple"), nextReviewAt: "2020-01-01T00:00:00.000Z" }]));
  expect(getWordsForReview(["en"]).map((w) => w.word)).toEqual(["apple"]);
  expect(getWordsForReview(["zh"])).toEqual([]);
  expect(getWordsForReview()).toHaveLength(1);
  deleteLearnedWord("apple");
  expect(getLearnedWords()).toEqual([]);
});

test("review and delete find a word however its case or spacing was typed", () => {
  localStorage.clear();
  saveLearnedWord(entry("Invoice"));
  reviewWord("  invoice ", 5);
  expect(getLearnedWords()[0].lastReviewedAt).toBeDefined();
  deleteLearnedWord("INVOICE");
  expect(getLearnedWords()).toHaveLength(0);
});
