import {
  getLearnedWords,
  saveLearnedWord,
  updateWordReview,
  getWordsForReview,
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

test("updateWordReview remembered=true doubles interval and increments mastery", () => {
  saveLearnedWord(baseWord);
  updateWordReview("negotiate", true);
  const [updated] = getLearnedWords();
  expect(updated.reviewInterval).toBe(2);
  expect(updated.mastery).toBe(1);
});

test("updateWordReview remembered=false resets interval to 1 and decrements mastery", () => {
  saveLearnedWord({ ...baseWord, reviewInterval: 8, mastery: 3 });
  updateWordReview("negotiate", false);
  const [updated] = getLearnedWords();
  expect(updated.reviewInterval).toBe(1);
  expect(updated.mastery).toBe(2);
});

test("updateWordReview caps reviewInterval at 30", () => {
  saveLearnedWord({ ...baseWord, reviewInterval: 16, mastery: 4 });
  updateWordReview("negotiate", true);
  const [updated] = getLearnedWords();
  expect(updated.reviewInterval).toBe(30);
});

test("updateWordReview caps mastery at 5", () => {
  saveLearnedWord({ ...baseWord, mastery: 5 });
  updateWordReview("negotiate", true);
  const [updated] = getLearnedWords();
  expect(updated.mastery).toBe(5);
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
