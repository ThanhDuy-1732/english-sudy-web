import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RoleplayPage from "../roleplay/[id]/page";
import IeltsSpeakingPage from "../ielts/[part]/page";
import { getSessions } from "@/lib/sessions";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), useParams: () => ({ id: "hotel", part: "p1" }) }));
jest.mock("@/lib/speech/recorder", () => ({ createRecorder: () => ({ start: jest.fn(), stop: jest.fn(), dispose: jest.fn() }) }));

beforeEach(() => localStorage.clear());

test("roleplay finishes on End and cancels on early exit", () => {
  const early = render(<RoleplayPage />);
  expect(getSessions()[0]).toMatchObject({ type: "speaking", metadata: { mode: "roleplay", scenarioId: "hotel" } });
  early.unmount();
  expect(getSessions()).toEqual([]);

  const completed = render(<RoleplayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Kết thúc" }));
  expect(getSessions()[0].finishedAt).toBeDefined();
  expect(getSessions()[0].totalItems).toBeUndefined();
  completed.unmount();
  expect(getSessions()).toHaveLength(1);
});

test("IELTS speaking finishes after feedback and cancels on early exit", async () => {
  const early = render(<IeltsSpeakingPage />);
  expect(getSessions()[0]).toMatchObject({ type: "speaking", metadata: { mode: "ielts", part: "p1" } });
  early.unmount();
  expect(getSessions()).toEqual([]);

  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
    bands: { fluency: 6, lexical: 6, grammar: 6 }, overall: 6,
    durationSec: 10, wordsPerMinute: 120, fillerCount: 0,
    strengths: [], improvements: [], transcript: "Hello there", upgradedVersion: "Hello there",
    newVocabulary: [],
  }) });
  const completed = render(<IeltsSpeakingPage />);
  fireEvent.click(screen.getByRole("button", { name: "⌨️ Nhập text" }));
  fireEvent.change(screen.getByPlaceholderText("Nhập câu trả lời của bạn bằng tiếng Anh…"), { target: { value: "Hello there" } });
  fireEvent.click(screen.getByRole("button", { name: "📤 Nộp bài" }));
  await waitFor(() => expect(getSessions()[0].finishedAt).toBeDefined());
  expect(getSessions()[0].totalItems).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(getSessions()).toHaveLength(2);
  expect(getSessions()[0].finishedAt).toBeUndefined();
  completed.unmount();
  expect(getSessions()).toHaveLength(1);
});

test("roleplay shows an error turn instead of an empty bubble when the API fails", async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: "boom" }) });
  const previous = global.fetch;
  global.fetch = fetcher;
  try {
    render(<RoleplayPage />);
    fireEvent.change(screen.getByPlaceholderText(/Nhập tin nhắn/), { target: { value: "Hello" } });
    fireEvent.keyDown(screen.getByPlaceholderText(/Nhập tin nhắn/), { key: "Enter" });
    expect(await screen.findByText("(Lỗi kết nối, thử lại.)")).toBeInTheDocument();
  } finally {
    global.fetch = previous;
  }
});
