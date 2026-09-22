import {
  computeCategoryMastery,
  computeSkillMastery,
  getWeakestSkills,
  getStrongestSkills,
} from "../mastery";
import type { MasteryInput } from "../mastery";

const BASE_INPUT: MasteryInput = {
  skill: "grammar",
  category: "articles",
  attempts: [
    { correct: true, at: "2026-09-20T10:00:00Z" },
    { correct: false, at: "2026-09-21T10:00:00Z" },
    { correct: true, at: "2026-09-22T10:00:00Z" },
  ],
};

test("computeCategoryMastery returns 0–100 value", () => {
  const result = computeCategoryMastery(BASE_INPUT);
  expect(result.mastery).toBeGreaterThanOrEqual(0);
  expect(result.mastery).toBeLessThanOrEqual(100);
  expect(result.attempts).toBe(3);
});

test("returns stable defaults for empty attempts", () => {
  const result = computeCategoryMastery({ ...BASE_INPUT, attempts: [] });
  expect(result.mastery).toBe(0);
  expect(result.confidence).toBe(0);
  expect(result.trend).toBe("stable");
});

test("low sample count gives low confidence", () => {
  const result = computeCategoryMastery({
    ...BASE_INPUT,
    attempts: [{ correct: true, at: "2026-09-22T10:00:00Z" }],
  });
  expect(result.confidence).toBeLessThan(0.5);
});

test("5+ attempts give confidence >= 0.5", () => {
  const attempts = Array.from({ length: 6 }, (_, i) => ({
    correct: i % 2 === 0,
    at: `2026-09-${10 + i}T10:00:00Z`,
  }));
  const result = computeCategoryMastery({ ...BASE_INPUT, attempts });
  expect(result.confidence).toBeGreaterThanOrEqual(0.5);
});

test("10 attempts gives max confidence 1.0", () => {
  const attempts = Array.from({ length: 10 }, (_, i) => ({
    correct: true,
    at: `2026-09-${10 + i}T10:00:00Z`,
  }));
  const result = computeCategoryMastery({ ...BASE_INPUT, attempts });
  expect(result.confidence).toBe(1);
});

test("recent trend detection — improving", () => {
  const improving = [
    { correct: false, at: "2026-09-10T10:00:00Z" },
    { correct: false, at: "2026-09-15T10:00:00Z" },
    { correct: true, at: "2026-09-20T10:00:00Z" },
    { correct: true, at: "2026-09-21T10:00:00Z" },
    { correct: true, at: "2026-09-22T10:00:00Z" },
  ];
  const result = computeCategoryMastery({ ...BASE_INPUT, attempts: improving });
  expect(result.trend).toBe("up");
});

test("computeSkillMastery aggregates categories", () => {
  const inputs: MasteryInput[] = [
    { ...BASE_INPUT, category: "articles" },
    { ...BASE_INPUT, category: "tense", attempts: [{ correct: false, at: "2026-09-22T10:00:00Z" }] },
  ];
  const result = computeSkillMastery("grammar", inputs);
  expect(result.skill).toBe("grammar");
  expect(result.overallMastery).toBeGreaterThanOrEqual(0);
  expect(result.overallMastery).toBeLessThanOrEqual(100);
  expect(result.categories).toHaveLength(2);
});

test("getWeakestSkills returns skills sorted by mastery asc", () => {
  const skills = [
    { skill: "grammar" as const, overallMastery: 44, categories: [], lastUpdatedAt: "" },
    { skill: "vocabulary" as const, overallMastery: 80, categories: [], lastUpdatedAt: "" },
    { skill: "reading" as const, overallMastery: 60, categories: [], lastUpdatedAt: "" },
  ];
  const result = getWeakestSkills(skills, 2);
  expect(result[0].skill).toBe("grammar");
  expect(result[1].skill).toBe("reading");
});

test("getStrongestSkills returns skills sorted by mastery desc", () => {
  const skills = [
    { skill: "grammar" as const, overallMastery: 44, categories: [], lastUpdatedAt: "" },
    { skill: "vocabulary" as const, overallMastery: 80, categories: [], lastUpdatedAt: "" },
  ];
  const result = getStrongestSkills(skills, 1);
  expect(result[0].skill).toBe("vocabulary");
});
