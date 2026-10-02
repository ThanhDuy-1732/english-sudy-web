import { fireEvent, render, screen } from "@testing-library/react";
import WritingResultPage from "../result/[id]/page";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const record = (kind: string) => ({
  id: "r1",
  kind,
  prompt: "Prompt text",
  content: "My essay",
  wordCount: 2,
  feedback: {
    bands: { task: 7, coherence: 7, lexical: 7, grammar: 7 },
    overall: 7,
    wordCount: 2,
    annotations: [],
    modelAnswer: "Model",
    nextFocus: "Grammar",
  },
  createdAt: "2026-09-01T00:00:00.000Z",
});

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
});

test.each([
  ["ielts_task1", "IELTS Task 1"],
  ["ielts_task2", "IELTS Task 2"],
  ["toeic_email", "TOEIC Writing – Business Email"],
])("shows a readable title for %s instead of the raw kind", (kind, title) => {
  localStorage.setItem("writingSubmissions", JSON.stringify([record(kind)]));
  render(<WritingResultPage params={{ id: "r1" }} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
  expect(screen.queryByText(kind)).not.toBeInTheDocument();
});

test("Viết lại goes back to the task the record came from, or to the task list for older records", () => {
  localStorage.setItem("writingSubmissions", JSON.stringify([{ ...record("ielts_task1"), taskId: "task1-line" }]));
  const view = render(<WritingResultPage params={{ id: "r1" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Viết lại" }));
  expect(push).toHaveBeenCalledWith("/write/task/task1-line");
  view.unmount();

  localStorage.setItem("writingSubmissions", JSON.stringify([record("ielts_task1")]));
  render(<WritingResultPage params={{ id: "r1" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Viết lại" }));
  expect(push).toHaveBeenLastCalledWith("/write");
});
