import { generatePlan, weakestType } from "../generate-plan";
import type { ExamAttempt } from "@/lib/exam/types";
import type { AnswerRecord, ExamSettings } from "@/lib/exam/types";
import type { UnifiedMistake } from "@/lib/mistakes";

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
    const answers: AnswerRecord[] = Array(10).fill(null).map((_, i) => ({
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
    dueWords: 0,
    unifiedMistakes: [] as UnifiedMistake[],
    skillMastery: [],
    attempts: [] as ExamAttempt[],
    settings,
    availableMin: 60,
  };

  it("links the exam drill to the weakest type's part", () => {
    const answers: AnswerRecord[] = Array(10).fill(null).map((_, i) => ({
      itemId: "i1", questionId: `q${i}`, type: "conversation", part: "LC3",
      userAnswer: "A", correct: i < 3, timeSpentSec: 30,
    }));
    const plan = generatePlan({ ...base, attempts: [makeAttempt({ answers })] as ExamAttempt[] });
    expect(plan.find((b) => b.kind === "exam_drill")?.href).toBe("/exam/drill/LC3");
  });

  it("always puts SRS first when there are due words", () => {
    const plan = generatePlan({ ...base, dueWords: 10, unifiedMistakes: [], skillMastery: [] });
    expect(plan[0].kind).toBe("srs_review");
  });

  it("respects budget of 15 min — does not return too many blocks", () => {
    const plan = generatePlan({ ...base, dueWords: 5, availableMin: 15 });
    const totalMin = plan.reduce((s, b) => s + b.estimatedMin, 0);
    expect(totalMin).toBeLessThanOrEqual(15);
  });

  it("says never practised instead of a day count when there is no speaking history", () => {
    const plan = generatePlan({ ...base, dueWords: 0, lastSpeakingAt: undefined });
    const reason = plan.find((b) => b.kind === "speaking")?.reason;
    expect(reason).toBe("Chưa luyện nói lần nào");
    expect(reason).not.toMatch(/999/);
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
      unifiedMistakes: Array(15).fill({ status: "new" }) as UnifiedMistake[],
      availableMin: 120,
    });
    expect(plan.length).toBeLessThanOrEqual(6);
  });
});
