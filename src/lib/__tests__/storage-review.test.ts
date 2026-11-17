import {
  getLearnedWords,
  saveLearnedWord,
  getWordsForReview,
  reviewWord,
  type LearnedWord,
} from "../storage";

const baseWord: LearnedWord = {
  word: "negotiate",
  meaning: "đàm phán",
  example: "We need to negotiate.",
  topic: "TOEIC",
  learnedAt: "2026-07-16T00:00:00.000Z",
  nextReviewAt: "2026-07-17T00:00:00.000Z",
  reviewInterval: 1,
  mastery: 0,
};

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

test("saveLearnedWord sets defaults for new spaced repetition fields", () => {
  const wordWithoutSR = { ...baseWord };
  saveLearnedWord(wordWithoutSR);
  const [saved] = getLearnedWords();
  expect(saved.reviewInterval).toBe(1);
  expect(saved.mastery).toBe(0);
});

test("getWordsForReview returns words where nextReviewAt <= now", () => {
  const dueWord: LearnedWord = {
    ...baseWord,
    word: "due",
    nextReviewAt: "2026-07-16T10:00:00.000Z",
  };
  const futureWord: LearnedWord = {
    ...baseWord,
    word: "future",
    nextReviewAt: "2026-07-18T00:00:00.000Z",
  };
  saveLearnedWord(dueWord);
  saveLearnedWord(futureWord);
  const review = getWordsForReview();
  expect(review.map((w) => w.word)).toEqual(["due"]);
});

test("reviewWord schedules with FSRS and stores the memory state", () => {
  saveLearnedWord(baseWord);
  const now = new Date("2026-07-16T12:00:00.000Z");
  reviewWord("negotiate", 4, now);
  const [updated] = getLearnedWords();
  expect(updated.nextReviewAt).toBe("2026-07-20T12:00:00.000Z");
  expect(updated.reviewInterval).toBe(4);
  expect(updated.stability).toBeCloseTo(3.7145, 4);
  expect(updated.lastReviewedAt).toBe(now.toISOString());
  expect(updated.mastery).toBe(2);
});
