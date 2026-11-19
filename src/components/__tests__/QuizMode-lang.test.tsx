import { render, screen } from "@testing-library/react";
import QuizMode from "../QuizMode";
import ReadingMode from "../ReadingMode";

beforeEach(() => localStorage.clear());

test("options come from the question's own language, never English history", () => {
  localStorage.setItem("learnedWords", JSON.stringify(["apple", "pear", "plum", "grape"].map((word) => ({ word, meaning: word, example: "", topic: "T", learnedAt: "2026-11-01T00:00:00.000Z" }))));
  render(<QuizMode words={[{ word: "苹果", meaning: "quả táo", lang: "zh" }, { word: "梨", meaning: "quả lê", lang: "zh" }, { word: "李子", meaning: "quả mận", lang: "zh" }]} onClose={() => {}} />);
  const options = screen.getAllByRole("button").map((b) => b.textContent ?? "").filter((t) => t && t !== "✕");
  expect(options.length).toBeGreaterThan(1);
  expect(options.every((t) => /^[一-鿿]+$/.test(t))).toBe(true);
});

test("english quiz never shows CJK distractors from history", () => {
  localStorage.setItem("learnedWords", JSON.stringify([{ word: "学生", lang: "zh", meaning: "học sinh", example: "", topic: "T", learnedAt: "2026-11-01T00:00:00.000Z" }]));
  render(<QuizMode words={[{ word: "apple", meaning: "táo" }, { word: "pear", meaning: "lê" }]} onClose={() => {}} />);
  expect(screen.queryByText("学生")).toBeNull();
});

test("ReadingMode highlights Chinese words and shows the translation", () => {
  render(<ReadingMode passage="我是学生。" questions={[]} highlightWords={["学生"]} lang="zh" translation="Tôi là học sinh." onClose={() => {}} />);
  expect(screen.getByText("学生").tagName).toBe("MARK");
  expect(screen.getByText("Tôi là học sinh.")).toBeInTheDocument();
});

test("ReadingMode highlights Korean words, even with a particle attached", () => {
  render(<ReadingMode passage="저는 학생은 아닙니다." questions={[]} highlightWords={["학생"]} lang="ko" onClose={() => {}} />);
  expect(screen.getByText("학생").tagName).toBe("MARK");
});
