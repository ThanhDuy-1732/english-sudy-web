import { fireEvent, render, screen } from "@testing-library/react";
import MistakesPage from "../mistakes/page";
import ExamPage from "../page";
import { addMistake, getMistakes } from "@/lib/mistakes";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const input = {
  skill: "reading" as const,
  category: "incomplete_sentence",
  source: "exam:RC5:q1",
  userAnswer: "A",
  correctAnswer: "B",
  explanation: "because B",
  exam: { itemId: "i1", questionId: "q1", part: "RC5" as const, type: "incomplete_sentence" as const, prompt: "Which one?" },
};

beforeEach(() => localStorage.clear());

test("lists unified exam mistakes with an occurrence badge, and resolve updates the shared entity", () => {
  addMistake(input);
  addMistake(input);
  render(<MistakesPage />);
  expect(screen.getByText("Which one?")).toBeInTheDocument();
  expect(screen.getByText("sai 2 lần")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "✓ Đánh dấu xử lý" }));
  expect(getMistakes()[0].status).toBe("resolved");
  expect(screen.getByText("Không có lỗi chưa giải quyết.")).toBeInTheDocument();
});

test("migrates a legacy mistakeLog on first load so old mistakes are not lost", () => {
  localStorage.setItem(
    "mistakeLog",
    JSON.stringify([
      {
        id: "l1", questionId: "q7", itemId: "i7", type: "incomplete_sentence", part: "RC5",
        prompt: "Legacy prompt", userAnswer: "A", correctAnswer: "B", explanation: "e",
        createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", resolved: false,
      },
    ])
  );
  render(<MistakesPage />);
  expect(screen.getByText("Legacy prompt")).toBeInTheDocument();
});

test("/exam shows the unresolved exam mistake count from unified", () => {
  addMistake(input);
  render(<ExamPage />);
  expect(screen.getByText("1 chưa xong")).toBeInTheDocument();
});
