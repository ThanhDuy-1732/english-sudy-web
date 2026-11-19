import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VocabQuizPage from "../page";

jest.mock("@/lib/sessions", () => ({ startSession: jest.fn(() => "s1"), finishSession: jest.fn() }));

const w = (word: string, meaning: string, lang?: string) => ({ word, meaning, example: "", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z", ...(lang ? { lang } : {}) });
const en = [w("apple", "táo"), w("pear", "lê"), w("plum", "mận"), w("grape", "nho")];
const zh = [w("苹果", "quả táo", "zh"), w("梨", "quả lê", "zh"), w("李子", "quả mận", "zh"), w("葡萄", "quả nho", "zh")];

beforeEach(() => localStorage.clear());

test("english only: no language selector", async () => {
  localStorage.setItem("learnedWords", JSON.stringify(en));
  render(<VocabQuizPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeEnabled());
  expect(screen.queryByRole("radiogroup", { name: "Ngôn ngữ" })).toBeNull();
});

test("choosing 中文 quizzes Chinese words", async () => {
  localStorage.setItem("learningLanguages", JSON.stringify(["en", "zh"]));
  localStorage.setItem("learnedWords", JSON.stringify([...en, ...zh]));
  render(<VocabQuizPage />);
  fireEvent.click(await screen.findByRole("radio", { name: "中文" }));
  fireEvent.click(screen.getByRole("button", { name: "5" }));
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  const word = await screen.findByText(/^(苹果|梨|李子|葡萄)$/);
  expect(word).toHaveAttribute("lang", "zh-CN");
  const options = screen.getAllByRole("button").map((b) => b.textContent).filter((t) => t?.startsWith("quả "));
  expect(options).toHaveLength(4);
});
