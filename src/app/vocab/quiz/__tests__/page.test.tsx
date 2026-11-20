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

test("Chinese fill mode shows the sentence reading and translation and accepts the answer", async () => {
  localStorage.setItem("learningLanguages", JSON.stringify(["zh"]));
  localStorage.setItem("learnedWords", JSON.stringify(zh));
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    json: async () => ({ sentence: "我爱吃_____。", reading: "wǒ ài chī _____.", translation: "Tôi thích ăn trái cây." }),
  }) as unknown as typeof fetch;
  try {
    render(<VocabQuizPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Điền vào chỗ trống" }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(await screen.findByText("wǒ ài chī _____.")).toBeInTheDocument();
    expect(screen.getByText("Tôi thích ăn trái cây.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nhập từ...")).toHaveAttribute("lang", "zh-CN");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Japanese fill mode accepts the kana reading", async () => {
  localStorage.setItem("learningLanguages", JSON.stringify(["ja"]));
  const ja = [["学生", "がくせい"], ["先生", "せんせい"], ["学校", "がっこう"], ["友達", "ともだち"]].map(([word, reading]) => ({ ...w(word, "nghĩa " + word, "ja"), reading, example: `${reading}：${word}。` }));
  localStorage.setItem("learnedWords", JSON.stringify(ja));
  render(<VocabQuizPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Điền vào chỗ trống" }));
  fireEvent.click(screen.getByRole("button", { name: "5" }));
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  // Each sentence starts with its word's reading, so the asked word is known from the blanked sentence.
  const sentence = await screen.findByText(/：______。$/);
  const reading = sentence.textContent!.split("：")[0];
  fireEvent.change(screen.getByPlaceholderText("Nhập từ..."), { target: { value: reading } });
  fireEvent.keyDown(screen.getByPlaceholderText("Nhập từ..."), { key: "Enter" });
  expect(await screen.findByText("Đúng!")).toBeInTheDocument();
});
