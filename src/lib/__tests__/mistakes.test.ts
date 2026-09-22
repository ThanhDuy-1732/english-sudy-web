import {
  getMistakes,
  addMistake,
  resolveMistake,
  setMistakeStatus,
  getMistakesBySkill,
  getMistakesByStatus,
  getTopCategories,
} from "../mistakes";

beforeEach(() => {
  localStorage.clear();
});

const base = {
  skill: "grammar" as const,
  category: "subject-verb-agreement",
  source: "exam:q1",
  userAnswer: "He go",
  correctAnswer: "He goes",
  explanation: "Third-person singular",
};

test("getMistakes returns empty array initially", () => {
  expect(getMistakes()).toEqual([]);
});

test("addMistake creates a new entry", () => {
  const m = addMistake(base);
  expect(m.id).toBeTruthy();
  expect(m.occurrenceCount).toBe(1);
  expect(m.status).toBe("new");
  expect(getMistakes()).toHaveLength(1);
});

test("addMistake deduplicates by source+category", () => {
  addMistake(base);
  const m2 = addMistake({ ...base, userAnswer: "He going" });
  expect(getMistakes()).toHaveLength(1);
  expect(m2.occurrenceCount).toBe(2);
  expect(m2.userAnswer).toBe("He going");
});

test("addMistake does NOT dedup when status is resolved", () => {
  const m = addMistake(base);
  resolveMistake(m.id);
  addMistake(base);
  expect(getMistakes()).toHaveLength(2);
});

test("resolveMistake sets status to resolved and sets reviewedAt", () => {
  const m = addMistake(base);
  resolveMistake(m.id);
  const updated = getMistakes().find((x) => x.id === m.id)!;
  expect(updated.status).toBe("resolved");
  expect(updated.reviewedAt).toBeTruthy();
});

test("setMistakeStatus changes status", () => {
  const m = addMistake(base);
  setMistakeStatus(m.id, "reviewing");
  const updated = getMistakes().find((x) => x.id === m.id)!;
  expect(updated.status).toBe("reviewing");
});

test("getMistakesBySkill filters correctly", () => {
  addMistake(base);
  addMistake({ ...base, skill: "vocabulary", source: "vocab:w1", category: "spelling" });
  expect(getMistakesBySkill("grammar")).toHaveLength(1);
  expect(getMistakesBySkill("vocabulary")).toHaveLength(1);
  expect(getMistakesBySkill("reading")).toHaveLength(0);
});

test("getMistakesByStatus filters correctly", () => {
  const m = addMistake(base);
  addMistake({ ...base, source: "exam:q2" });
  resolveMistake(m.id);
  expect(getMistakesByStatus("new")).toHaveLength(1);
  expect(getMistakesByStatus("resolved")).toHaveLength(1);
});

test("getTopCategories returns top categories sorted by count", () => {
  addMistake(base);
  addMistake({ ...base, source: "exam:q2" }); // same category, dedup -> occurrenceCount=2
  addMistake({ ...base, source: "exam:q3", category: "tense" });
  const top = getTopCategories("grammar");
  expect(top[0].category).toBe("subject-verb-agreement");
  expect(top[0].count).toBe(2);
  expect(top[1].category).toBe("tense");
});

test("getTopCategories without skill arg returns all skills", () => {
  addMistake(base);
  addMistake({ ...base, skill: "vocabulary", source: "vocab:w1", category: "spelling" });
  const top = getTopCategories();
  expect(top).toHaveLength(2);
});
