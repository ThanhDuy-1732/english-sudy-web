jest.mock("@/lib/sync", () => ({
  pushAttempt: jest.fn().mockResolvedValue(undefined),
  pushMistake: jest.fn().mockResolvedValue(undefined),
}));

import {
  pruneBank,
  bankKey,
  getExamBank,
  addItemToBank,
  getItemsFromBank,
  getAttempts,
  saveAttempt,
  getMistakes,
  addMistake,
  resolveMistake,
  getExamSettings,
  saveExamSettings,
} from "../exam-storage";
import type { ExamItem, ExamAttempt, MistakeEntry } from "../types";

// Mock localStorage
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

function makeItem(overrides: Partial<ExamItem> = {}): ExamItem {
  return {
    id: "test-id",
    kind: "TOEIC",
    part: "RC5",
    level: 3,
    questions: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("pruneBank", () => {
  it("keeps at most 30 newest items per key", () => {
    const items: ExamItem[] = Array.from({ length: 35 }, (_, i) =>
      makeItem({ id: `id-${i}`, createdAt: new Date(1000 + i).toISOString() })
    );
    const bank = { "TOEIC:RC5:3": items };
    const pruned = pruneBank(bank);
    expect(pruned["TOEIC:RC5:3"]).toHaveLength(30);
    // newest 30 survive
    expect(pruned["TOEIC:RC5:3"][0].id).toBe("id-34");
  });
});

describe("bankKey", () => {
  it("formats correctly", () => {
    expect(bankKey("TOEIC", "RC5", 3)).toBe("TOEIC:RC5:3");
  });
});

describe("exam bank storage", () => {
  it("adds and retrieves items", () => {
    const item = makeItem({ id: "abc" });
    addItemToBank(item);
    expect(getItemsFromBank("TOEIC", "RC5", 3)).toHaveLength(1);
    expect(getItemsFromBank("TOEIC", "RC5", 3)[0].id).toBe("abc");
  });
});

describe("attempts", () => {
  it("saves and retrieves attempts", () => {
    const attempt: ExamAttempt = {
      id: "a1",
      kind: "TOEIC",
      mode: "drill",
      parts: ["RC5"],
      startedAt: new Date().toISOString(),
      answers: [],
    };
    saveAttempt(attempt);
    expect(getAttempts()[0].id).toBe("a1");
  });
});

describe("mistakes", () => {
  it("adds and resolves mistakes", () => {
    const m: MistakeEntry = {
      id: "m1",
      questionId: "q1",
      itemId: "i1",
      type: "incomplete_sentence",
      part: "RC5",
      prompt: "test?",
      userAnswer: "A",
      correctAnswer: "B",
      explanation: "because B",
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    addMistake(m);
    expect(getMistakes()[0].resolved).toBe(false);
    resolveMistake("m1");
    expect(getMistakes()[0].resolved).toBe(true);
  });
});

describe("exam settings", () => {
  it("returns defaults", () => {
    const s = getExamSettings();
    expect(s.primaryExam).toBe("TOEIC");
    expect(s.level).toBe(3);
    expect(s.listeningRate).toBe(1.0);
  });

  it("merges partial updates", () => {
    saveExamSettings({ level: 5, primaryExam: "IELTS" });
    const s = getExamSettings();
    expect(s.level).toBe(5);
    expect(s.primaryExam).toBe("IELTS");
    expect(s.listeningRate).toBe(1.0); // default preserved
  });
});
