import { act, fireEvent, render, screen } from "@testing-library/react";
import ShadowingPage from "../page";

jest.mock("@/lib/speech/recorder", () => ({
  createRecorder: () => ({ start: async () => {}, stop: async () => new Blob(["a"], { type: "audio/webm" }), isRecording: () => false, dispose: () => {} }),
  audioFilename: () => "shadowing.webm",
}));
jest.mock("@/lib/speech/speaking-storage", () => ({ saveSpeaking: jest.fn() }));

beforeEach(() => localStorage.clear());

test("english only: no language selector", () => {
  render(<ShadowingPage />);
  expect(screen.queryByRole("radiogroup", { name: "Ngôn ngữ" })).toBeNull();
  expect(screen.getByText(/The meeting has been postponed/)).toBeInTheDocument();
});

test("similarity tolerates an empty or foreign transcript, and sends the language", async () => {
  localStorage.setItem("learningLanguages", JSON.stringify(["en", "zh"]));
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "Hello" }) });
  global.fetch = fetchMock;
  render(<ShadowingPage />);
  fireEvent.click(await screen.findByRole("radio", { name: "中文" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ghi âm" })); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Dừng ghi âm/ })); });
  expect((fetchMock.mock.calls[0][1].body as FormData).get("language")).toBe("zh");
  expect(await screen.findByText(/0\s*%/)).toBeInTheDocument();
});
