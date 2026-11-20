import { answerTokens, answersMatch, missingTokens, normalizeAnswer, similarityPct } from "../answer-match";

test("answersMatch ignores spaces and CJK punctuation for zh/ja", () => {
  expect(answersMatch("我 是 学生。", "我是学生", "zh")).toBe(true);
  expect(answersMatch("わたし は がくせい！", "わたしはがくせい", "ja")).toBe(true);
  expect(answersMatch("我是老师", "我是学生", "zh")).toBe(false);
});

test("korean keeps spaces as word boundaries", () => {
  expect(answerTokens("저는 학생입니다", "ko")).toEqual(["저는", "학생입니다"]);
  expect(answersMatch(" 저는  학생입니다. ", "저는 학생입니다", "ko")).toBe(true);
});

test("english unchanged", () => {
  expect(answersMatch(" Greet ", "greet", "en")).toBe(true);
  expect(normalizeAnswer("Hello, World!", "en")).toBe("hello world");
  expect(answerTokens("I greet them.", "en")).toEqual(["i", "greet", "them"]);
});

test("similarityPct by characters for zh", () => {
  expect(similarityPct("我是学生", "我是老师", "zh")).toBe(50);
  expect(similarityPct("The meeting starts now.", "the meeting now", "en")).toBe(75);
});

test("similarityPct handles empty spoken", () => {
  expect(similarityPct("我是学生", "", "zh")).toBe(0);
  expect(similarityPct("", "anything", "en")).toBe(0);
});

test("repeated characters count once each", () => {
  expect(similarityPct("谢谢", "谢", "zh")).toBe(50);
});

test("missingTokens lists target characters not spoken (zh), each counted once", () => {
  expect(missingTokens("我是学生", "我是老师", "zh")).toEqual(["学", "生"]);
  expect(missingTokens("谢谢", "谢", "zh")).toEqual(["谢"]);
  expect(missingTokens("저는 학생입니다", "저는", "ko")).toEqual(["학생입니다"]);
});

test("full-width ． and the wave dash 〜 are ignored", () => {
  expect(answersMatch("学生．", "学生", "zh")).toBe(true);
  expect(answersMatch("〜です", "です", "ja")).toBe(true);
  expect(answersMatch("ｈｅｌｌｏ", "hello", "en")).toBe(true);
});

test("a Japanese word accepts its kana reading, hiragana or katakana", () => {
  expect(answersMatch("がくせい", "学生", "ja", "がくせい")).toBe(true);
  expect(answersMatch("ガクセイ", "学生", "ja", "がくせい")).toBe(true);
  expect(answersMatch("がくせい", "学生", "ja")).toBe(false);
  expect(answersMatch("せんせい", "学生", "ja", "がくせい")).toBe(false);
  expect(answersMatch("xuésheng", "学生", "zh", "xuésheng")).toBe(false);
});
