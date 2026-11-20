import { render, screen } from "@testing-library/react";
import ExamRunner from "../ExamRunner";
import { addItemToBank } from "@/lib/exam/exam-storage";
import type { ExamItem } from "@/lib/exam/types";

test("loads a cached question offline and shows an error when no question is available", async () => {
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  addItemToBank({ id: "cached", kind: "TOEIC", part: "RC5", level: 3, createdAt: "2026-10-01T00:00:00Z", questions: [{ id: "q1", prompt: "Test", type: "mcq", options: ["A", "B"], answer: "A", explanation: "Test" }] } as unknown as ExamItem);
  const view = render(<ExamRunner kind="TOEIC" parts={["RC5"]} mode="mock" level={3} />);
  expect(await screen.findByRole("button", { name: "Bắt đầu" })).toBeInTheDocument();
  view.unmount();
  localStorage.clear();
  render(<ExamRunner kind="TOEIC" parts={["RC5"]} mode="mock" level={3} />);
  expect(await screen.findByText(/Không thể tải câu hỏi/)).toBeInTheDocument();
});

test("serves an unseen banked item instantly and refills the bank in the background", async () => {
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  addItemToBank({ id: "banked", kind: "TOEIC", part: "RC5", level: 3, createdAt: "2026-10-01T00:00:00Z", questions: [{ id: "q1", prompt: "Test", type: "mcq", options: ["A", "B"], answer: "A", explanation: "Test" }] } as unknown as ExamItem);
  const fetchMock = jest.fn(() => new Promise<Response>(() => {})); // generation never finishes
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<ExamRunner kind="TOEIC" parts={["RC5"]} mode="drill" level={3} />);
  expect(await screen.findByRole("button", { name: "Bắt đầu" })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
