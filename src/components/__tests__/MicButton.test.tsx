import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MicButton } from "../MicButton";

const start = jest.fn();
const stop = jest.fn();
const dispose = jest.fn();

jest.mock("@/lib/speech/recorder", () => ({
  createRecorder: () => ({ start, stop, dispose, isRecording: () => false }),
  audioFilename: () => "speech.webm",
}));

const originalFetch = global.fetch;

function mockTranscript(body: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
}

beforeEach(() => {
  start.mockReset().mockResolvedValue(undefined);
  stop.mockReset().mockResolvedValue(new Blob(["a"], { type: "audio/webm" }));
  dispose.mockReset();
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

test("tap to record, tap to stop, sends audio with the language", async () => {
  mockTranscript({ text: " 你好 ", lang: "zh" });
  const onText = jest.fn();
  render(<MicButton language="zh" onText={onText} onError={jest.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Nói" }));
  fireEvent.click(await screen.findByRole("button", { name: "Dừng" }));

  await waitFor(() => expect(onText).toHaveBeenCalledWith("你好", "zh"));
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe("/api/speech/transcribe");
  expect((init.body as FormData).get("language")).toBe("zh");
  expect(screen.getByRole("button", { name: "Nói" })).toBeEnabled();
});

test("stops by itself after 60 seconds", async () => {
  jest.useFakeTimers();
  mockTranscript({ text: "xin chào", lang: "vi" });
  const onText = jest.fn();
  render(<MicButton language="vi" onText={onText} onError={jest.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Nói" }));
  await screen.findByRole("button", { name: "Dừng" });
  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });

  expect(stop).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(onText).toHaveBeenCalledWith("xin chào", "vi"));
});

test("mic permission denied shows an alert and resets", async () => {
  start.mockRejectedValueOnce(new Error("Permission denied"));
  const onError = jest.fn();
  render(<MicButton language="vi" onText={jest.fn()} onError={onError} />);

  fireEvent.click(screen.getByRole("button", { name: "Nói" }));

  await waitFor(() => expect(onError).toHaveBeenCalledWith("Permission denied"));
  expect(screen.getByRole("button", { name: "Nói" })).toBeEnabled();
});

test("empty transcript reports instead of calling onText", async () => {
  mockTranscript({ text: "   ", lang: null });
  const onText = jest.fn();
  const onError = jest.fn();
  render(<MicButton language="auto" onText={onText} onError={onError} />);

  fireEvent.click(screen.getByRole("button", { name: "Nói" }));
  fireEvent.click(await screen.findByRole("button", { name: "Dừng" }));

  await waitFor(() => expect(onError).toHaveBeenCalledWith("Không nghe rõ, nói lại nhé."));
  expect(onText).not.toHaveBeenCalled();
});

test("transcription failure reports an error", async () => {
  mockTranscript({ error: "x" }, false);
  const onError = jest.fn();
  render(<MicButton language="vi" onText={jest.fn()} onError={onError} />);

  fireEvent.click(screen.getByRole("button", { name: "Nói" }));
  fireEvent.click(await screen.findByRole("button", { name: "Dừng" }));

  await waitFor(() => expect(onError).toHaveBeenCalledWith("Không nhận được giọng nói. Vui lòng thử lại."));
});

test("reports when it starts and stops being active", async () => {
  mockTranscript({ text: "xin chào", lang: "vi" });
  const onActiveChange = jest.fn();
  render(<MicButton language="vi" onText={jest.fn()} onError={jest.fn()} onActiveChange={onActiveChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Nói" }));
  await screen.findByRole("button", { name: "Dừng" });
  expect(onActiveChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Dừng" }));
  await waitFor(() => expect(onActiveChange).toHaveBeenLastCalledWith(false));
});
