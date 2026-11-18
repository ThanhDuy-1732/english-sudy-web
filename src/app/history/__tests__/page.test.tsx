import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HistoryPage from "../page";

const longWord = "professionalcommunicationwithoutspaces";

beforeEach(() => {
  localStorage.clear();
});

test("uses an accessible empty state and selected filter", async () => {
  render(<HistoryPage />);

  await waitFor(() => expect(screen.getByText("Chưa có từ nào được lưu.")).toBeInTheDocument());
  expect(screen.getByRole("radio", { name: "Tất cả" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("renders long saved content with an accessible delete action", async () => {
  localStorage.setItem(
    "learnedWords",
    JSON.stringify([
      {
        word: longWord,
        meaning: "giao tiếp chuyên nghiệp trong một môi trường làm việc phân tán",
        example:
          "Clear professional communication helps every member understand the goal and complete the work confidently.",
        topic: "Daily Communication",
        learnedAt: "2026-07-16T00:00:00.000Z",
      },
    ]),
  );

  render(<HistoryPage />);

  await waitFor(() => expect(screen.getByText(longWord)).toBeInTheDocument());
  expect(screen.getByRole("button", { name: `Xóa ${longWord}` })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Daily Communication" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("shows growth stage and filters weak words", async () => {
  localStorage.setItem("learnedWords", JSON.stringify([
    { word: "weak", meaning: "yếu", example: "A sentence.", topic: "TOEIC", learnedAt: "2026-07-16T00:00:00.000Z", mastery: 1 },
    { word: "strong", meaning: "mạnh", example: "Another sentence.", topic: "TOEIC", learnedAt: "2026-07-16T00:00:00.000Z", mastery: 4 },
  ]));
  render(<HistoryPage />);
  await waitFor(() => expect(screen.getByText("weak")).toBeInTheDocument());
  expect(screen.getByLabelText("Giai đoạn Mầm (1/5)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Chỉ từ chưa thuộc" }));
  expect(screen.getByText("weak")).toBeInTheDocument();
  expect(screen.queryByText("strong")).not.toBeInTheDocument();
});
