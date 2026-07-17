import { render, screen } from "@testing-library/react";
import StreakCalendar from "../StreakCalendar";

test("renders calendar days with accessible counts and legend", () => {
  render(<StreakCalendar data={[{ date: "2026-07-16", count: 5, level: 3 }]} />);
  expect(screen.getByRole("heading", { name: "Lịch học tập" })).toBeInTheDocument();
  expect(screen.getByLabelText("2026-07-16: 5 từ")).toBeInTheDocument();
  expect(screen.getByText("Nhiều")).toBeInTheDocument();
});
