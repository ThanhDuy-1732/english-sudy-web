import { render, screen, waitFor } from "@testing-library/react";
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
