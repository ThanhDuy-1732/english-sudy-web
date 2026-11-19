import { buildMCQ, quizLanguages, quizWords } from "../vocab-quiz";

const w = (word: string, meaning: string, lang?: "en" | "zh") => ({ word, meaning, example: "", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z", ...(lang ? { lang } : {}) });

test("quizWords filters by language (English by default)", () => {
  const all = [w("student", "học sinh"), w("学生", "học sinh", "zh"), w("apple", "táo", "en")];
  expect(quizWords(all).map((x) => x.word)).toEqual(["student", "apple"]);
  expect(quizWords(all, "zh").map((x) => x.word)).toEqual(["学生"]);
});

test("quizLanguages needs 4 words in a learning language (languages without saved words are not offered)", () => {
  const zh = ["一", "二", "三", "四"].map((x) => w(x, x, "zh"));
  const en = ["a", "b", "c"].map((x) => w(x, x));
  expect(quizLanguages([...zh, ...en], ["en", "zh", "ja"])).toEqual(["zh"]);
  expect(quizLanguages([...zh, ...en, w("d", "d")], ["en", "zh"])).toEqual(["en", "zh"]);
});

test("buildMCQ never offers the answer's meaning twice", () => {
  const all = [w("student", "học sinh"), w("pupil", "học sinh"), w("apple", "táo"), w("pear", "lê"), w("plum", "mận")];
  for (let i = 0; i < 20; i++) {
    const q = buildMCQ(all[0], all);
    expect(q.options.filter((o) => o === "học sinh")).toHaveLength(1);
    expect(new Set(q.options).size).toBe(q.options.length);
  }
});
