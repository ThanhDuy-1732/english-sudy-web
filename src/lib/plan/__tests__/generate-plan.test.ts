import { generatePlan, weakestType } from "../generate-plan";
import type { ExamAttempt, MistakeEntry } from "@/lib/exam/types";
import type { ExamSettings } from "@/lib/exam/types";

const settings: ExamSettings = {
  primaryExam: "TOEIC",
  level: 3,
  listeningRate: 1.0,
  autoAdvance: false,
};

function makeAttempt(overrides: Partial<ExamAttempt> = {}): ExamAttempt {
  return {
    id: "a1",
    kind: "TOEIC",
    mode: "drill",
    parts: ["RC5"],
    startedAt: new Date().toISOString(),
    answers: [],
    ...overrides,
  };
}

describe("weakestType", () => {
  it("returns null when no samples", () => {
    expect(weakestType([], { days: 14, minSamples: 10 })).toBeNull();
  });

  it("returns null when below minSamples threshold", () => {
    const attempt = makeAttempt({
      answers: Array(5).fill({
        itemId: "i1",
        questionId: "q1",
        type: "incomplete_sentence",
        part: "RC5",
        userAnswer: "A",
        correct: false,
        timeSpentSec: 30,
      }),
    });
    const result = weakestType([attempt], { days: 14, minSamples: 10 });
    expect(result).toBeNull();
  });

  it("returns weakest type when sufficient samples exist", () => {
    const answers = Array(10).fill(null).map((_, i) => ({
      itemId: "i1",
      questionId: `q${i}`,
      type: "incomplete_sentence",
      part: "RC5",
      userAnswer: "A",
      correct: i < 5, // 50% accuracy
      timeSpentSec: 30,
    }));
    const attempt = makeAttempt({ answers });
    const result = weakestType([attempt], { days: 14, minSamples: 10 });
    expect(result).not.toBeNull();
    expect(result!.type).toBe("incomplete_sentence");
    expect(result!.accuracy).toBe(50);
  });
});

describe("generatePlan", () => {
  const base = {
    mistakes: [] as MistakeEntry[],
    attempts: [] as ExamAttempt[],
    settings,
    availableMin: 60,
  };

  it("always puts SRS first when there are due words", () => {
    const plan = generatePlan({ ...base, dueWords: 10 });
    expect(plan[0].kind).toBe("srs_review");
  });

  it("respects budget of 15 min — does not return too many blocks", () => {
    const plan = generatePlan({ ...base, dueWords: 5, availableMin: 15 });
    const totalMin = plan.reduce((s, b) => s + b.estimatedMin, 0);
    expect(totalMin).toBeLessThanOrEqual(15);
  });

  it("adds speaking block when > 2 days since last speaking", () => {
    const oldDate = new Date(Date.now() - 3 * 86400000).toISOString();
    const plan = generatePlan({ ...base, dueWords: 0, lastSpeakingAt: oldDate });
    expect(plan.some((b) => b.kind === "speaking")).toBe(true);
  });

  it("does not include new_words if over budget", () => {
    // Only 5 min budget, SRS takes up all of it
    const plan = generatePlan({ ...base, dueWords: 20, availableMin: 5 });
    expect(plan.some((b) => b.kind === "new_words")).toBe(false);
  });

  it("returns at most 6 blocks", () => {
    const plan = generatePlan({
      ...base,
      dueWords: 20,
      lastSpeakingAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      lastWritingAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      mistakes: Array(15).fill({ resolved: false }) as MistakeEntry[],
      availableMin: 120,
    });
    expect(plan.length).toBeLessThanOrEqual(6);
  });
});
