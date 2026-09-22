jest.mock("@/lib/mastery", () => ({
  computeSkillMastery: jest.fn().mockReturnValue({ skill: "grammar", overallMastery: 0, categories: [], lastUpdatedAt: "" }),
  getCachedMastery: jest.fn().mockReturnValue([]),
  saveMasteryCache: jest.fn(),
}));

import {
  recordGrammarAttempt,
  getGrammarProgress,
  getTopicProgress,
  getWeakSubRules,
} from "../grammar-progress";

const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.defineProperty(global, "localStorage", {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => Object.keys(store).forEach((k) => delete store[k]),
    },
    writable: true,
  });
});

test("recordGrammarAttempt stores an attempt", () => {
  recordGrammarAttempt({ topicId: "conditionals", subRuleId: "zero", correct: true });
  const progress = getGrammarProgress("conditionals", "zero");
  expect(progress).not.toBeNull();
  expect(progress!.attempts).toBe(1);
  expect(progress!.correct).toBe(1);
  expect(progress!.accuracy).toBe(100);
});

test("accuracy updates after wrong attempt", () => {
  recordGrammarAttempt({ topicId: "tenses", subRuleId: "past_simple", correct: true });
  recordGrammarAttempt({ topicId: "tenses", subRuleId: "past_simple", correct: false });
  const p = getGrammarProgress("tenses", "past_simple")!;
  expect(p.accuracy).toBe(50);
});

test("getTopicProgress aggregates all subrules", () => {
  recordGrammarAttempt({ topicId: "articles", subRuleId: "definite", correct: true });
  recordGrammarAttempt({ topicId: "articles", subRuleId: "indefinite", correct: false });
  const all = getTopicProgress("articles");
  expect(all).toHaveLength(2);
});

test("getWeakSubRules returns subrules with accuracy < threshold", () => {
  // Need at least 3 attempts for getWeakSubRules to include
  recordGrammarAttempt({ topicId: "conditionals", subRuleId: "second", correct: false });
  recordGrammarAttempt({ topicId: "conditionals", subRuleId: "second", correct: false });
  recordGrammarAttempt({ topicId: "conditionals", subRuleId: "second", correct: false });
  recordGrammarAttempt({ topicId: "conditionals", subRuleId: "first", correct: true });
  recordGrammarAttempt({ topicId: "conditionals", subRuleId: "first", correct: true });
  recordGrammarAttempt({ topicId: "conditionals", subRuleId: "first", correct: true });
  const weak = getWeakSubRules(70);
  expect(weak.some((w) => w.subRuleId === "second")).toBe(true);
  expect(weak.some((w) => w.subRuleId === "first")).toBe(false);
});
