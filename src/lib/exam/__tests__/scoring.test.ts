import { toeicScaled, ieltsBand, isCompletionCorrect, computeScore, withJudgementOptions } from "../scoring";
import type { AnswerRecord, ExamPart, ExamQuestion, QuestionType } from "../types";

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

describe("computeScore", () => {
  const answer = (
    part: ExamPart,
    type: QuestionType,
    correct: boolean,
    questionId = "q"
  ): AnswerRecord => ({
    itemId: "i1",
    questionId,
    type,
    part,
    userAnswer: "A",
    correct,
    timeSpentSec: 10,
  });

  it("aggregates raw, byPart and byType", () => {
    const result = computeScore(
      [
        answer("RC5", "incomplete_sentence", true, "q1"),
        answer("RC5", "incomplete_sentence", false, "q2"),
        answer("LC1", "photo_description", true, "q3"),
      ],
      "TOEIC",
      []
    );

    expect(result.raw).toEqual({ correct: 2, total: 3 });
    expect(result.byPart.RC5).toEqual({ correct: 1, total: 2 });
    expect(result.byPart.LC1).toEqual({ correct: 1, total: 1 });
    expect(result.byType.incomplete_sentence).toEqual({ correct: 1, total: 2 });
    expect(result.byType.photo_description).toEqual({ correct: 1, total: 1 });
  });

  it("returns only raw stats for an empty attempt", () => {
    const result = computeScore([], "TOEIC", []);
    expect(result.raw).toEqual({ correct: 0, total: 0 });
    expect(result.toeic).toBeUndefined();
    expect(result.byPart).toEqual({});
  });

  it("computes TOEIC listening and reading when both sections are present", () => {
    const answers = [
      ...Array.from({ length: 10 }, (_, i) =>
        answer("LC1", "photo_description", i < 5, `lc${i}`)
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        answer("RC5", "incomplete_sentence", i < 8, `rc${i}`)
      ),
    ];

    const result = computeScore(answers, "TOEIC", []);

    expect(result.toeic).toEqual({
      listening: toeicScaled(5, 10, "LC"),
      reading: toeicScaled(8, 10, "RC"),
      total: toeicScaled(5, 10, "LC") + toeicScaled(8, 10, "RC"),
    });
  });

  it("computes TOEIC listening only when there are no reading answers", () => {
    const result = computeScore(
      Array.from({ length: 10 }, (_, i) => answer("LC2", "question_response", i < 4, `lc${i}`)),
      "TOEIC",
      []
    );

    expect(result.toeic).toEqual({
      listening: toeicScaled(4, 10, "LC"),
      reading: 0,
      total: toeicScaled(4, 10, "LC"),
    });
  });

  it("computes TOEIC reading only when there are no listening answers", () => {
    const result = computeScore(
      Array.from({ length: 10 }, (_, i) => answer("RC7", "single_passage", i < 6, `rc${i}`)),
      "TOEIC",
      []
    );

    expect(result.toeic).toEqual({
      listening: 0,
      reading: toeicScaled(6, 10, "RC"),
      total: toeicScaled(6, 10, "RC"),
    });
  });

  it("computes IELTS bands for listening and reading", () => {
    const answers = [
      ...Array.from({ length: 10 }, (_, i) => answer("LISTEN_S1", "form_completion", i < 6, `l${i}`)),
      ...Array.from({ length: 10 }, (_, i) => answer("READ_P1", "true_false_ng", i < 4, `r${i}`)),
    ];

    const result = computeScore(answers, "IELTS", []);

    expect(result.ielts).toEqual({
      listening: ieltsBand(6, 10, "listening"),
      reading: ieltsBand(4, 10, "reading"),
    });
    expect(result.toeic).toBeUndefined();
  });

  it("computes only the IELTS skill that has answers", () => {
    const result = computeScore(
      Array.from({ length: 10 }, (_, i) => answer("LISTEN_S2", "mcq", i < 8, `l${i}`)),
      "IELTS",
      []
    );

    expect(result.ielts).toEqual({ listening: ieltsBand(8, 10, "listening") });
    expect(result.ielts?.reading).toBeUndefined();
  });
});

describe("scoring edge cases", () => {
  it("toeicScaled returns floor score when there are no questions", () => {
    expect(toeicScaled(0, 0, "LC")).toBe(5);
  });

  it("normalizes repeated whitespace in completion answers", () => {
    const q: ExamQuestion = {
      id: "q1",
      type: "sentence_completion",
      prompt: "test",
      answer: "project manager",
      explanation: "test",
    };
    expect(isCompletionCorrect("  Project   Manager  ", q)).toBe(true);
  });

  it("does not strip articles inside the answer", () => {
    const q: ExamQuestion = {
      id: "q1",
      type: "sentence_completion",
      prompt: "test",
      answer: "award",
      explanation: "test",
    };
    expect(isCompletionCorrect("the award", q)).toBe(true);
    expect(isCompletionCorrect("award", q)).toBe(true);
  });
});

describe("withJudgementOptions", () => {
  it("turns True/False/Not Given questions into three choices with a matching answer", () => {
    const item = withJudgementOptions({ questions: [
      { id: "q1", type: "true_false_ng", prompt: "s", answer: "not given", explanation: "" },
      { id: "q2", type: "mcq", prompt: "s", options: ["a", "b"], answer: "a", explanation: "" },
    ] });
    expect(item.questions[0]).toMatchObject({ options: ["True", "False", "Not Given"], answer: "Not Given" });
    expect(item.questions[1].options).toEqual(["a", "b"]);
  });
});
