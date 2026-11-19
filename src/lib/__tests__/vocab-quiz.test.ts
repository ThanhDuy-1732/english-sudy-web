import { buildMCQ, quizWords } from "../vocab-quiz";

const w = (word: string, meaning: string, lang?: "en" | "zh") => ({ word, meaning, example: "", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z", ...(lang ? { lang } : {}) });

test("quizWords keeps only English words until per-language quizzes exist", () => {
  expect(quizWords([w("student", "học sinh"), w("学生", "học sinh", "zh"), w("apple", "táo", "en")]).map((x) => x.word)).toEqual(["student", "apple"]);
});

test("buildMCQ never offers the answer's meaning twice", () => {
  const all = [w("student", "học sinh"), w("pupil", "học sinh"), w("apple", "táo"), w("pear", "lê"), w("plum", "mận")];
  for (let i = 0; i < 20; i++) {
    const q = buildMCQ(all[0], all);
    expect(q.options.filter((o) => o === "học sinh")).toHaveLength(1);
    expect(new Set(q.options).size).toBe(q.options.length);
  }
});
