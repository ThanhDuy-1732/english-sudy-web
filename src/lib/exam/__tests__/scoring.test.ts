import { toeicScaled, ieltsBand, isCompletionCorrect } from "../scoring";
import type { ExamQuestion } from "../types";

describe("toeicScaled", () => {
  it("returns 5 for 0 correct", () => {
    expect(toeicScaled(0, 100, "LC")).toBe(5);
    expect(toeicScaled(0, 100, "RC")).toBe(5);
  });

  it("returns 495 for perfect score", () => {
    expect(toeicScaled(100, 100, "LC")).toBe(495);
    expect(toeicScaled(100, 100, "RC")).toBe(495);
  });

  it("rounds to nearest 5", () => {
    const score = toeicScaled(60, 100, "LC");
    expect(score % 5).toBe(0);
  });

  it("LC and RC give different scores for same raw", () => {
    // LC tends to be more lenient
    const lc = toeicScaled(50, 100, "LC");
    const rc = toeicScaled(50, 100, "RC");
    expect(lc).not.toBe(rc);
  });

  it("handles partial test (scaled from fewer questions)", () => {
    // 6 correct out of 10 questions = 60%
    const score = toeicScaled(6, 10, "RC");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(495);
  });
});

describe("ieltsBand", () => {
  it("returns 9 for perfect score", () => {
    expect(ieltsBand(40, 40, "reading")).toBe(9);
    expect(ieltsBand(40, 40, "listening")).toBe(9);
  });

  it("returns 2.5 for 0 correct", () => {
    expect(ieltsBand(0, 40, "reading")).toBe(2.5);
  });

  it("returns band 6 at threshold for reading", () => {
    // Reading: 23/40 = band 6
    expect(ieltsBand(23, 40, "reading")).toBe(6);
  });

  it("handles scaled input correctly", () => {
    // 15 out of 20 = 75% → scaled40 = 30 → band 7 listening
    expect(ieltsBand(15, 20, "listening")).toBe(7);
  });
});

describe("isCompletionCorrect", () => {
  const makeQ = (answer: string, acceptableAnswers?: string[]): ExamQuestion => ({
    id: "q1",
    type: "sentence_completion",
    prompt: "test",
    answer,
    acceptableAnswers,
    explanation: "test",
  });

  it("matches exact answer", () => {
    expect(isCompletionCorrect("manager", makeQ("manager"))).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isCompletionCorrect("Manager", makeQ("manager"))).toBe(true);
    expect(isCompletionCorrect("THE MANAGER", makeQ("manager"))).toBe(true);
  });

  it("strips articles", () => {
    expect(isCompletionCorrect("the manager", makeQ("manager"))).toBe(true);
    expect(isCompletionCorrect("a manager", makeQ("manager"))).toBe(true);
  });

  it("strips punctuation", () => {
    expect(isCompletionCorrect("manager.", makeQ("manager"))).toBe(true);
  });

  it("accepts acceptable answers", () => {
    expect(isCompletionCorrect("mgr", makeQ("manager", ["mgr", "management"]))).toBe(true);
  });

  it("rejects wrong answer", () => {
    expect(isCompletionCorrect("director", makeQ("manager"))).toBe(false);
  });

  it("handles empty user answer", () => {
    expect(isCompletionCorrect("", makeQ("manager"))).toBe(false);
  });
});
