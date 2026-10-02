import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ShadowingPage from "../shadowing/page";
import { getSessions } from "@/lib/sessions";

jest.mock("@/lib/speech/recorder", () => ({
  audioFilename: () => "shadowing.webm",
  createRecorder: () => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(new Blob(["a"], { type: "audio/webm" })),
    dispose: jest.fn(),
    isRecording: () => false,
  }),
}));
jest.mock("@/lib/speech/speaking-storage", () => ({ saveSpeaking: jest.fn() }));

beforeEach(() => {
  localStorage.clear();
  window.alert = jest.fn();
});

async function record() {
  fireEvent.click(screen.getByRole("button", { name: /Ghi âm/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Dừng ghi âm/ }));
}

test("a failed transcription cancels its session and a retry does not leave an orphan", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  render(<ShadowingPage />);

  await record();
  await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(1));
  expect(getSessions()).toEqual([]);

  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "The meeting has been postponed" }) });
  await record();
  await waitFor(() => expect(getSessions()[0]?.finishedAt).toBeDefined());
  expect(getSessions()).toHaveLength(1);
});
