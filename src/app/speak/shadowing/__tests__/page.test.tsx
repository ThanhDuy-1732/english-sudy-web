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

test("the language selector hides while recording, and missed Chinese characters are listed", async () => {
  localStorage.setItem("learningLanguages", JSON.stringify(["en", "zh"]));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "你好" }) });
  render(<ShadowingPage />);
  fireEvent.click(await screen.findByRole("radio", { name: "中文" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ghi âm" })); });
  expect(screen.queryByRole("radiogroup", { name: "Ngôn ngữ" })).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Dừng ghi âm/ })); });
  expect(await screen.findByText("Từ còn thiếu:")).toBeInTheDocument();
  expect(screen.getByText("很")).toBeInTheDocument();
  expect(screen.getByRole("radiogroup", { name: "Ngôn ngữ" })).toBeInTheDocument();
});
