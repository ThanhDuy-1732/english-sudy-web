import {
  pruneBank,
  bankKey,
  getExamBank,
  addItemToBank,
  removeItemFromBank,
  getItemsFromBank,
  getAttempts,
  saveAttempt,
  addMistake,
  getExamSettings,
  saveExamSettings,
} from "../exam-storage";
import { getMistakes, getUnresolvedExamMistakes, resolveMistake } from "@/lib/mistakes";
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

describe("mistakes adapter", () => {
  const entry = (o: Partial<MistakeEntry> = {}): MistakeEntry => ({
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
    updatedAt: new Date().toISOString(),
    resolved: false,
    ...o,
  });

  it("writes only to unifiedMistakes, with exam meta", () => {
    addMistake(entry());
    expect(store["mistakeLog"]).toBeUndefined();
    const [m] = getMistakes();
    expect(m).toMatchObject({
      skill: "reading",
      category: "incomplete_sentence",
      source: "exam:RC5:q1",
      exam: { itemId: "i1", questionId: "q1", part: "RC5", prompt: "test?" },
    });
  });

  it("maps listening parts to the listening skill", () => {
    addMistake(entry({ part: "LC2", type: "question_response", questionId: "q9" }));
    expect(getMistakes()[0].skill).toBe("listening");
  });

  it("repeated wrong answers increment occurrenceCount; resolve is visible everywhere", () => {
    addMistake(entry({ id: "a" }));
    addMistake(entry({ id: "b" }));
    expect(getMistakes()).toHaveLength(1);
    expect(getMistakes()[0].occurrenceCount).toBe(2);
    resolveMistake(getMistakes()[0].id);
    expect(getUnresolvedExamMistakes()).toHaveLength(0);
  });

  it("pruneBank keeps items pinned by unresolved exam mistakes even when old", () => {
    const items = Array.from({ length: 35 }, (_, i) =>
      makeItem({ id: `id-${i}`, createdAt: new Date(1000 + i).toISOString() })
    );
    addMistake(entry({ itemId: "id-0" }));
    const pruned = pruneBank({ "TOEIC:RC5:3": items });
    expect(pruned["TOEIC:RC5:3"]).toHaveLength(30);
    expect(pruned["TOEIC:RC5:3"].map((i) => i.id)).toContain("id-0");
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

describe("removeItemFromBank", () => {
  it("drops a reported item so later drills no longer pick it", () => {
    addItemToBank(makeItem({ id: "keep" }));
    addItemToBank(makeItem({ id: "bad" }));
    removeItemFromBank("bad");
    expect(Object.values(getExamBank()).flat().map((i) => i.id)).toEqual(["keep"]);
  });
});
