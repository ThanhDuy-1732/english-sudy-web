import { render, screen } from "@testing-library/react";
import WritingResultPage from "../result/[id]/page";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

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

beforeEach(() => localStorage.clear());

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
