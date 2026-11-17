import { fsrs, fsrsStateOf, intervalDays, retrievability, stabilityToMastery, type FsrsState } from "../srs";
import type { LearnedWord } from "../storage";

const now = new Date("2026-11-17T12:00:00.000Z");
const DAY = 86_400_000;
const at = (days: number) => new Date(now.getTime() + days * DAY);

describe("FSRS basics", () => {
  it("recall is 90% after exactly one stability period, and the interval equals the stability", () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 6);
    expect(intervalDays(10)).toBe(10);
    expect(intervalDays(0.2)).toBe(1);
  });

  it("first review: easier answers give longer intervals; forgetting comes back tomorrow", () => {
    const [again, hard, good, easy] = ([0, 3, 4, 5] as const).map((q) => fsrs(undefined, q, now));
    expect(again.intervalDays).toBe(1);
    expect(good.intervalDays).toBe(4);
    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
    expect(again.difficulty).toBeGreaterThan(easy.difficulty);
    expect(good.nextReviewAt).toBe(at(4).toISOString());
  });

  it("reviewing on time grows stability; forgetting shrinks it and raises difficulty", () => {
    const first = fsrs(undefined, 4, now);
    const state: FsrsState = first;
    const good = fsrs(state, 4, at(first.intervalDays));
    const again = fsrs(state, 0, at(first.intervalDays));
    expect(good.stability).toBeGreaterThan(state.stability * 2);
    expect(again.stability).toBeLessThan(state.stability);
    expect(again.difficulty).toBeGreaterThan(state.difficulty);
    expect(again.intervalDays).toBe(1);
  });
});

describe("converting SM-2 cards", () => {
  const base: LearnedWord = { word: "w", meaning: "", example: "", topic: "", learnedAt: "2026-10-01T00:00:00.000Z" };

  it("uses the last interval as stability and the easiness factor for difficulty", () => {
    const state = fsrsStateOf({ ...base, easiness: 2.5, repetitions: 3, reviewInterval: 6, nextReviewAt: at(2).toISOString() });
    expect(state).toEqual({ stability: 6, difficulty: 4, lastReviewedAt: at(-4).toISOString() });
    expect(fsrsStateOf({ ...base, easiness: 1.3, repetitions: 1, reviewInterval: 1, nextReviewAt: now.toISOString() })?.difficulty).toBe(10);
  });

  it("treats never-reviewed cards as new and keeps FSRS cards as they are", () => {
    expect(fsrsStateOf({ ...base, reviewInterval: 1, mastery: 0 })).toBeUndefined();
    const fsrsCard = { ...base, stability: 12, difficulty: 5, lastReviewedAt: now.toISOString() };
    expect(fsrsStateOf(fsrsCard)).toEqual({ stability: 12, difficulty: 5, lastReviewedAt: now.toISOString() });
  });

  it("maps stability to 0–5 stars", () => {
    expect([0.5, 2, 5, 10, 30, 100].map(stabilityToMastery)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
