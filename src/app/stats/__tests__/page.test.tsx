import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StatsPage from "../page";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("learnedWords", JSON.stringify([{ word: "negotiate", meaning: "đàm phán", topic: "TOEIC", example: "We negotiate.", learnedAt: "2026-07-16T00:00:00.000Z", mastery: 3 }]));
});

test("renders analytics page and populated summary", async () => {
  render(<StatsPage />);
  expect(screen.getByRole("heading", { name: "Thống kê học tập" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("TOEIC")).toBeInTheDocument());
  expect(screen.getByText("Mastery trung bình")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Lịch học tập" })).toBeInTheDocument();
});

test("average mastery follows the language filter", async () => {
  localStorage.setItem(
    "learnedWords",
    JSON.stringify([
      { word: "negotiate", meaning: "đàm phán", topic: "TOEIC", example: "", learnedAt: "2026-07-16T00:00:00.000Z", mastery: 4 },
      { word: "学生", meaning: "học sinh", topic: "TOEIC", example: "", learnedAt: "2026-07-16T00:00:00.000Z", mastery: 1, lang: "zh" },
    ])
  );
  render(<StatsPage />);
  expect(await screen.findByText("2.5/5")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "中文" }));
  expect(screen.getByText("1/5")).toBeInTheDocument();
});
