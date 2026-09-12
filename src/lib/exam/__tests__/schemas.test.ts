import { ExamItemSchema, ExamQuestionSchema } from "../schemas";

describe("ExamQuestionSchema", () => {
  const validQ = {
    type: "incomplete_sentence",
    prompt: "She ___ to the store.",
    options: ["go", "goes", "went", "gone"],
    answer: "went",
    explanation: "Past simple is used here.",
  };

  it("parses valid question", () => {
    const q = ExamQuestionSchema.parse(validQ);
    expect(q.answer).toBe("went");
  });

  it("rejects when answer not in options", () => {
    expect(() =>
      ExamQuestionSchema.parse({ ...validQ, answer: "run" })
    ).toThrow("answer phải trùng đúng một option");
  });

  it("rejects missing explanation", () => {
    const { explanation: _, ...rest } = validQ;
    expect(() => ExamQuestionSchema.parse(rest)).toThrow();
  });

  it("allows question without options (completion type)", () => {
    const q = ExamQuestionSchema.parse({
      type: "sentence_completion",
      prompt: "Complete the sentence.",
      answer: "manager",
      explanation: "The text says the manager decided...",
    });
    expect(q.options).toBeUndefined();
  });
});

describe("ExamItemSchema", () => {
  const validItem = {
    kind: "TOEIC",
    part: "RC5",
    level: 3,
    questions: [
      {
        type: "incomplete_sentence",
        prompt: "She ___ to the store.",
        options: ["go", "goes", "went", "gone"],
        answer: "went",
        explanation: "Past simple is used here.",
      },
    ],
  };

  it("parses valid item and adds defaults", () => {
    const item = ExamItemSchema.parse(validItem);
    expect(item.kind).toBe("TOEIC");
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();
  });

  it("rejects unknown kind", () => {
    expect(() => ExamItemSchema.parse({ ...validItem, kind: "SAT" })).toThrow();
  });

  it("rejects empty questions", () => {
    expect(() => ExamItemSchema.parse({ ...validItem, questions: [] })).toThrow();
  });
});
