jest.mock("../sync", () => ({ pushUnifiedMistake: jest.fn().mockResolvedValue(undefined) }));

import {
  getMistakes,
  addMistake,
  resolveMistake,
  setMistakeStatus,
  getMistakesBySkill,
  getMistakesByStatus,
  getTopCategories,
  getExamMistakes,
  getUnresolvedExamMistakes,
  examPartToSkill,
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

const exam = {
  itemId: "i1",
  questionId: "q1",
  part: "RC5" as const,
  type: "incomplete_sentence" as const,
  prompt: "Which?",
};

test("addMistake stores exam meta and getExamMistakes returns only exam entries", () => {
  addMistake({ ...base, source: "exam:RC5:q1", exam });
  addMistake({ ...base, source: "grammar:t1" });
  expect(getMistakes()).toHaveLength(2);
  expect(getExamMistakes()).toHaveLength(1);
  expect(getExamMistakes()[0].exam.prompt).toBe("Which?");
});

test("dedupe keeps the latest exam meta and increments occurrenceCount", () => {
  addMistake({ ...base, source: "exam:RC5:q1", exam });
  const m2 = addMistake({
    ...base,
    source: "exam:RC5:q1",
    exam: { ...exam, itemId: "i2" },
  });
  expect(getExamMistakes()).toHaveLength(1);
  expect(m2.occurrenceCount).toBe(2);
  expect(getExamMistakes()[0].exam.itemId).toBe("i2");
});

test("getUnresolvedExamMistakes excludes resolved; a new wrong answer after resolve creates a new entry", () => {
  const m = addMistake({ ...base, source: "exam:RC5:q1", exam });
  resolveMistake(m.id);
  expect(getUnresolvedExamMistakes()).toHaveLength(0);
  addMistake({ ...base, source: "exam:RC5:q1", exam });
  expect(getExamMistakes()).toHaveLength(2);
  expect(getUnresolvedExamMistakes()).toHaveLength(1);
});

test("examPartToSkill maps listening parts and defaults to reading", () => {
  expect(examPartToSkill("LC2")).toBe("listening");
  expect(examPartToSkill("LISTEN_S1")).toBe("listening");
  expect(examPartToSkill("RC5")).toBe("reading");
  expect(examPartToSkill("READ_P3")).toBe("reading");
});
