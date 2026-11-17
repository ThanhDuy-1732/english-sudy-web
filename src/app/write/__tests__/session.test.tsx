import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WritingTaskPage from "../task/[id]/page";
import { getSessions } from "@/lib/sessions";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }), useParams: () => ({ id: "toeic-email" }) }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockPush.mockClear();
});

test("starts once, cancels on early exit, and finishes after saving feedback", async () => {
  const early = render(<WritingTaskPage />);
  expect(getSessions()[0]).toMatchObject({ type: "writing", metadata: { taskId: "toeic-email" } });
  early.rerender(<WritingTaskPage />);
  expect(getSessions()).toHaveLength(1);
  early.unmount();
  expect(getSessions()).toEqual([]);

  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ overall: 7, bands: { task: 7, coherence: 7, lexical: 7, grammar: 7 }, annotations: [], modelAnswer: "Example", nextFocus: "Grammar", wordCount: 100 }) });
  const completed = render(<WritingTaskPage />);
  fireEvent.click(screen.getByRole("button", { name: /Bắt đầu viết/ }));
  fireEvent.change(screen.getByPlaceholderText("Bắt đầu viết bài của bạn ở đây…"), {
    target: { value: Array(100).fill("word").join(" ") },
  });
  fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/write\/result\/[a-f0-9-]+$/)));
  const recordId = JSON.parse(localStorage.getItem("writingSubmissions")!)[0].id;
  expect(JSON.parse(localStorage.getItem("writingSubmissions")!)[0].feedback.overall).toBe(7);
  expect(recordId).toBeTruthy();
  expect(localStorage.getItem("writingTaskDraft:toeic-email")).toBeNull();
  expect(getSessions()[0].finishedAt).toBeDefined();
  expect(getSessions()[0].totalItems).toBeUndefined();
  completed.unmount();
  expect(getSessions()).toHaveLength(1);
});

test("restores an unfinished essay after remount", () => {
  const view = render(<WritingTaskPage />);
  fireEvent.click(screen.getByRole("button", { name: /Bắt đầu viết/ }));
  fireEvent.change(screen.getByPlaceholderText("Bắt đầu viết bài của bạn ở đây…"), { target: { value: "Dear team, please review the new deadline." } });
  view.unmount();
  render(<WritingTaskPage />);
  expect(screen.getByPlaceholderText("Bắt đầu viết bài của bạn ở đây…")).toHaveValue("Dear team, please review the new deadline.");
});

test("an expired draft shows time is up and can be discarded to start over", () => {
  localStorage.setItem(
    "writingTaskDraft:toeic-email",
    JSON.stringify({ content: "Old draft from yesterday", deadline: Date.now() - 60_000 })
  );
  render(<WritingTaskPage />);
  expect(screen.getByPlaceholderText("Bắt đầu viết bài của bạn ở đây…")).toHaveValue("Old draft from yesterday");
  expect(screen.getByText(/Đã hết giờ/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Làm lại từ đầu" }));
  expect(localStorage.getItem("writingTaskDraft:toeic-email")).toBeNull();
  expect(screen.getByRole("button", { name: /Bắt đầu viết/ })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Bắt đầu viết/ }));
  expect(screen.getByPlaceholderText("Bắt đầu viết bài của bạn ở đây…")).toHaveValue("");
  expect(screen.queryByText(/Đã hết giờ/)).not.toBeInTheDocument();
});
