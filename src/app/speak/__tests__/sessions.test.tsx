import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RoleplayPage from "../roleplay/[id]/page";
import IeltsSpeakingPage from "../ielts/[part]/page";
import { getSessions } from "@/lib/sessions";

jest.mock("react", () => ({ ...jest.requireActual("react"), use: () => ({ id: "hotel", part: "p1" }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/speech/recorder", () => ({ createRecorder: () => ({ start: jest.fn(), stop: jest.fn() }) }));

beforeEach(() => localStorage.clear());

test("roleplay finishes on End and cancels on early exit", () => {
  const early = render(<RoleplayPage params={Promise.resolve({ id: "hotel" })} />);
  expect(getSessions()[0]).toMatchObject({ type: "speaking", metadata: { mode: "roleplay", scenarioId: "hotel" } });
  early.unmount();
  expect(getSessions()).toEqual([]);

  const completed = render(<RoleplayPage params={Promise.resolve({ id: "hotel" })} />);
  fireEvent.click(screen.getByRole("button", { name: "Kết thúc" }));
  expect(getSessions()[0].finishedAt).toBeDefined();
  expect(getSessions()[0].totalItems).toBeUndefined();
  completed.unmount();
  expect(getSessions()).toHaveLength(1);
});

test("IELTS speaking finishes after feedback and cancels on early exit", async () => {
  const early = render(<IeltsSpeakingPage params={Promise.resolve({ part: "p1" })} />);
  expect(getSessions()[0]).toMatchObject({ type: "speaking", metadata: { mode: "ielts", part: "p1" } });
  early.unmount();
  expect(getSessions()).toEqual([]);

  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({
    bands: { fluency: 6, lexical: 6, grammar: 6 }, overall: 6,
    durationSec: 10, wordsPerMinute: 120, fillerCount: 0,
    strengths: [], improvements: [], transcript: "Hello there", upgradedVersion: "Hello there",
    newVocabulary: [],
  }) });
  const completed = render(<IeltsSpeakingPage params={Promise.resolve({ part: "p1" })} />);
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
