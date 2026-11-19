import { act, fireEvent, render, screen } from "@testing-library/react";
import PronunciationButton from "../PronunciationButton";

type Voice = { voiceURI: string; lang: string };
let voices: Voice[] = [];
const speak = jest.fn();

class FakeUtterance {
  text: string; lang = ""; voice: Voice | null = null; rate = 1; pitch = 1; volume = 1;
  constructor(text: string) { this.text = text; }
}

beforeEach(() => {
  speak.mockReset();
  voices = [{ voiceURI: "en", lang: "en-US" }, { voiceURI: "ko", lang: "ko-KR" }];
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { getVoices: () => voices, speak, cancel: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() },
  });
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;
});

test("uses the language voice code", () => {
  render(<PronunciationButton word="물" lang="ko" />);
  fireEvent.click(screen.getByRole("button", { name: "Nghe phát âm 물" }));
  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak.mock.calls[0][0].lang).toBe("ko-KR");
  expect(speak.mock.calls[0][0].voice.voiceURI).toBe("ko");
});

test("disabled when no voice matches the language", async () => {
  render(<PronunciationButton word="水" lang="ja" />);
  await act(async () => {});
  const button = screen.getByRole("button", { name: "Nghe phát âm 水" });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("title", "Thiết bị chưa có giọng đọc Tiếng Nhật");
});

test("english default keeps en-US", () => {
  render(<PronunciationButton word="apple" />);
  fireEvent.click(screen.getByRole("button", { name: "Nghe phát âm apple" }));
  expect(speak.mock.calls[0][0].lang).toBe("en-US");
});
