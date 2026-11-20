import { fireEvent, render, screen } from "@testing-library/react";
import DictationMode from "../DictationMode";

jest.mock("@/lib/useVoiceSettings", () => ({
  useVoiceSettings: () => ({
    settings: { voiceURI: null, rate: 0.9, pitch: 1.0, volume: 1.0 },
    update: jest.fn(),
  }),
}));

test("shows dictation comparison after checking", () => {
  render(<DictationMode sentence="We negotiate terms." />);
  fireEvent.change(screen.getByPlaceholderText("Gõ lại câu bạn vừa nghe..."), { target: { value: "We negotiate terms extra." } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  expect(screen.getByText("Câu đúng: We negotiate terms.")).toBeInTheDocument();
  expect(screen.getByText("extra.")).toHaveClass("text-margin");
});

test("DictationMode marks a correct Chinese sentence typed without punctuation as all correct", () => {
  render(<DictationMode sentence="我是学生。" lang="zh" />);
  fireEvent.change(screen.getByPlaceholderText("Gõ lại câu bạn vừa nghe..."), { target: { value: "我是 学生" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  for (const ch of ["我", "是", "学", "生"]) expect(screen.getByText(ch)).toHaveClass("text-ok");
});

test("DictationMode marks a wrong Chinese character", () => {
  render(<DictationMode sentence="我是学生" lang="zh" />);
  fireEvent.change(screen.getByPlaceholderText("Gõ lại câu bạn vừa nghe..."), { target: { value: "我是老生" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  expect(screen.getByText("学")).toHaveClass("text-margin");
  expect(screen.getByText("生")).toHaveClass("text-ok");
});

test("DictationMode speaks with zh-CN", () => {
  const speak = jest.fn();
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => [], speak, cancel: jest.fn() } });
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class { lang = ""; text: string; constructor(t: string) { this.text = t; } };
  render(<DictationMode sentence="我是学生" lang="zh" />);
  fireEvent.click(screen.getByRole("button", { name: "▶ Nghe câu" }));
  expect(speak.mock.calls[0][0].lang).toBe("zh-CN");
});

test("playing without a Chinese voice shows how to add one", () => {
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => [{ voiceURI: "en", lang: "en-US" }], speak: jest.fn(), cancel: jest.fn() } });
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class { constructor(public text: string) {} };
  render(<DictationMode sentence="我是学生。" lang="zh" />);
  fireEvent.click(screen.getByRole("button", { name: "▶ Nghe câu" }));
  expect(screen.getByRole("status")).toHaveTextContent("Máy này chưa có giọng đọc Tiếng Trung.");
});
