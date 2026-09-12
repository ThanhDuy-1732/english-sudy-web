import { sm2, migrateToSm2 } from "../srs";
import type { SrsState } from "../srs";

const base: SrsState = {
  easiness: 2.5,
  interval: 1,
  repetitions: 0,
  nextReviewAt: new Date().toISOString(),
};

describe("sm2", () => {
  it("quality < 3 resets to interval=1, repetitions=0", () => {
    const r = sm2({ ...base, repetitions: 5, interval: 30 }, 0);
    expect(r.repetitions).toBe(0);
    expect(r.interval).toBe(1);
  });

  it("first correct: interval=1", () => {
    const r = sm2(base, 4);
    expect(r.repetitions).toBe(1);
    expect(r.interval).toBe(1);
  });

  it("second correct: interval=6", () => {
    const r = sm2({ ...base, repetitions: 1, interval: 1 }, 4);
    expect(r.repetitions).toBe(2);
    expect(r.interval).toBe(6);
  });

  it("third correct: interval = round(6 * EF)", () => {
    const after2: SrsState = { easiness: 2.5, interval: 6, repetitions: 2, nextReviewAt: "" };
    const r = sm2(after2, 4);
    expect(r.repetitions).toBe(3);
    expect(r.interval).toBe(Math.round(6 * after2.easiness));
  });

  it("quality=5 increases EF, quality=3 decreases it", () => {
    const r5 = sm2(base, 5);
    const r3 = sm2(base, 3);
    expect(r5.easiness).toBeGreaterThan(base.easiness);
    expect(r3.easiness).toBeLessThan(base.easiness);
  });

  it("EF never drops below 1.3", () => {
    let state = { ...base };
    for (let i = 0; i < 20; i++) {
      state = sm2(state, 0); // worst quality
    }
    expect(state.easiness).toBeGreaterThanOrEqual(1.3);
  });

  it("five consecutive quality=5 gives increasing intervals", () => {
    let state = { ...base };
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      state = sm2(state, 5);
      intervals.push(state.interval);
    }
    // Each interval should be >= previous
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
  });

  it("nextReviewAt is in the future", () => {
    const r = sm2(base, 4);
    expect(new Date(r.nextReviewAt).getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});

describe("migrateToSm2", () => {
  it("adds SM-2 fields to old words", () => {
    const oldWord = {
      word: "test",
      meaning: "test",
      example: "test",
      topic: "test",
      learnedAt: new Date().toISOString(),
      mastery: 3,
      reviewInterval: 8,
      nextReviewAt: "2026-10-01T00:00:00.000Z",
    };
    const migrated = migrateToSm2(oldWord);
    expect((migrated as any).easiness).toBe(2.5);
    expect((migrated as any).repetitions).toBe(2); // mastery-1 = 3-1 = 2
    // nextReviewAt must be preserved
    expect(migrated.nextReviewAt).toBe("2026-10-01T00:00:00.000Z");
  });

  it("does not touch words that already have easiness", () => {
    const word = {
      word: "test",
      meaning: "test",
      example: "test",
      topic: "test",
      learnedAt: new Date().toISOString(),
      easiness: 1.8,
      repetitions: 5,
      interval: 30,
      nextReviewAt: "2026-10-01",
    };
    const result = migrateToSm2(word as any);
    expect((result as any).easiness).toBe(1.8);
  });
});
