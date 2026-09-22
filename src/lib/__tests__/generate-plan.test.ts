import { generatePlan, type PlanContext } from "../plan/generate-plan";
import type { SkillMastery } from "../mastery";
import type { UnifiedMistake } from "../mistakes";

const BASE_MASTERY: SkillMastery[] = [
  {
    skill: "grammar",
    overallMastery: 44,
    categories: [
      {
        category: "prepositions",
        mastery: 44,
        confidence: 0.9,
        attempts: 12,
        trend: "down",
        lastPracticedAt: "2026-09-15T10:00:00Z",
      },
    ],
    lastUpdatedAt: "",
  },
  { skill: "vocabulary", overallMastery: 75, categories: [], lastUpdatedAt: "" },
];

const BASE_CTX: PlanContext = {
  dueWords: 5,
  unifiedMistakes: [],
  skillMastery: BASE_MASTERY,
  attempts: [],
  settings: { primaryExam: "TOEIC", level: 2, listeningRate: 1, autoAdvance: false },
  availableMin: 30,
};

test("grammar block appears when mastery < 50", () => {
  const blocks = generatePlan(BASE_CTX);
  const grammarBlock = blocks.find((b) => b.kind === "grammar");
  expect(grammarBlock).toBeDefined();
  expect(grammarBlock?.reason).toContain("44");
});

test("srs block appears when dueWords > 0", () => {
  const blocks = generatePlan(BASE_CTX);
  expect(blocks.find((b) => b.kind === "srs_review")).toBeDefined();
});

test("total time does not exceed availableMin", () => {
  const blocks = generatePlan(BASE_CTX);
  const total = blocks.reduce((s, b) => s + b.estimatedMin, 0);
  expect(total).toBeLessThanOrEqual(BASE_CTX.availableMin);
});

test("unified mistakes block appears when >= 5 unresolved", () => {
  const mistakes: UnifiedMistake[] = Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    skill: "grammar" as const,
    category: "tenses",
    source: "exam:RC5",
    userAnswer: "go",
    correctAnswer: "went",
    explanation: "x",
    occurrenceCount: 1,
    status: "new" as const,
    createdAt: "",
    updatedAt: "",
  }));
  const blocks = generatePlan({ ...BASE_CTX, unifiedMistakes: mistakes, dueWords: 0 });
  expect(blocks.find((b) => b.kind === "mistakes")).toBeDefined();
});

test("no mistakes block when < 5 unresolved", () => {
  const mistakes: UnifiedMistake[] = Array.from({ length: 4 }, (_, i) => ({
    id: String(i),
    skill: "grammar" as const,
    category: "tenses",
    source: `exam:q${i}`,
    userAnswer: "go",
    correctAnswer: "went",
    explanation: "x",
    occurrenceCount: 1,
    status: "new" as const,
    createdAt: "",
    updatedAt: "",
  }));
  const blocks = generatePlan({ ...BASE_CTX, unifiedMistakes: mistakes });
  expect(blocks.find((b) => b.kind === "mistakes")).toBeUndefined();
});

test("no grammar block when mastery >= 60", () => {
  const highMastery: SkillMastery[] = [
    { skill: "grammar", overallMastery: 70, categories: [], lastUpdatedAt: "" },
  ];
  const blocks = generatePlan({ ...BASE_CTX, skillMastery: highMastery });
  expect(blocks.find((b) => b.kind === "grammar")).toBeUndefined();
});
