import { fireEvent, render, screen } from "@testing-library/react";
import { TranslationCard } from "../TranslationCard";
import type { TranslationResult } from "@/lib/translate";

const result: TranslationResult = {
  tone: "polite",
  text: "您好",
  reading: "nín hǎo",
  note: "Lịch sự hằng ngày.",
};

let writeText: jest.Mock;

beforeEach(() => {
  localStorage.clear();
  writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

test("hiện sắc thái, câu dịch, cách đọc và ghi chú", () => {
  render(<TranslationCard result={result} to="zh" vietnamese="Xin chào" />);
  expect(screen.getByText("Lịch sự")).toBeInTheDocument();
  expect(screen.getByText("您好")).toHaveAttribute("lang", "zh-CN");
  expect(screen.getByText("nín hǎo")).toBeInTheDocument();
  expect(screen.getByText("Lịch sự hằng ngày.")).toBeInTheDocument();
});

test("chép thất bại hiện thông báo thay vì im lặng", async () => {
  writeText.mockRejectedValueOnce(new Error("denied"));
  render(<TranslationCard result={result} to="zh" vietnamese="Xin chào" />);
  fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
  expect(await screen.findByText("Không chép được")).toBeInTheDocument();
});

test("chép thành công hiện Đã chép", async () => {
  render(<TranslationCard result={result} to="zh" vietnamese="Xin chào" />);
  fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
  expect(await screen.findByText("Đã chép")).toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith("您好");
});

test("chỉ gieo vào vườn khi đích là ngôn ngữ học", () => {
  const { rerender } = render(<TranslationCard result={result} to="zh" vietnamese="Xin chào" />);
  expect(screen.getByRole("button", { name: "Gieo vào vườn" })).toBeInTheDocument();

  rerender(<TranslationCard result={result} to="vi" vietnamese="Xin chào" />);
  expect(screen.queryByRole("button", { name: "Gieo vào vườn" })).not.toBeInTheDocument();
});

test("gieo vào vườn lưu câu với lang, cách đọc và nghĩa tiếng Việt", () => {
  render(<TranslationCard result={result} to="zh" vietnamese="Xin chào" />);
  fireEvent.click(screen.getByRole("button", { name: "Gieo vào vườn" }));

  const words = JSON.parse(localStorage.getItem("learnedWords") ?? "[]");
  expect(words).toHaveLength(1);
  expect(words[0]).toMatchObject({
    word: "您好",
    meaning: "Xin chào",
    lang: "zh",
    reading: "nín hǎo",
    topic: "Dịch",
  });
  expect(screen.getByText("Đã gieo")).toBeInTheDocument();
});

test("🔊 đọc câu dịch bằng giọng của ngôn ngữ đích", () => {
  const speak = jest.fn();
  class FakeUtterance {
    text: string;
    lang = "";
    voice: unknown = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { getVoices: () => [{ voiceURI: "zh", lang: "zh-CN" }], speak, cancel: jest.fn() },
  });
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;

  render(<TranslationCard result={result} to="zh" vietnamese="Xin chào" />);
  fireEvent.click(screen.getByRole("button", { name: "Đọc to" }));

  expect(speak).toHaveBeenCalledTimes(1);
  const utterance = speak.mock.calls[0][0];
  expect(utterance.lang).toBe("zh-CN");
  expect(utterance.text).toBe("您好");
});

test("sau khi gieo, nút chuyển thành Đã gieo và khoá lại", () => {
  render(<TranslationCard result={result} to="zh" vietnamese="Xin chào" />);
  fireEvent.click(screen.getByRole("button", { name: "Gieo vào vườn" }));
  expect(screen.getByRole("button", { name: "Đã gieo" })).toBeDisabled();
  expect(JSON.parse(localStorage.getItem("learnedWords") ?? "[]")).toHaveLength(1);
});

test("câu đã có trong vườn thì báo Đã có trong vườn", () => {
  localStorage.setItem("learnedWords", JSON.stringify([{ word: "您好", meaning: "x", example: "", topic: "t", learnedAt: "", lang: "zh" }]));
  render(<TranslationCard result={result} to="zh" vietnamese="Xin chào" />);
  fireEvent.click(screen.getByRole("button", { name: "Gieo vào vườn" }));
  expect(screen.getByRole("button", { name: "Đã có trong vườn" })).toBeDisabled();
});

test("lưu thất bại thì báo lỗi và cho thử lại", () => {
  const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("QuotaExceeded");
  });
  render(<TranslationCard result={result} to="zh" vietnamese="Xin chào" />);
  fireEvent.click(screen.getByRole("button", { name: "Gieo vào vườn" }));
  setItem.mockRestore();
  expect(screen.getByRole("status")).toHaveTextContent("Không lưu được");
  expect(screen.getByRole("button", { name: "Gieo vào vườn" })).toBeEnabled();
});
