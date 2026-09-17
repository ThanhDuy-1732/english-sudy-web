import { render, screen } from "@testing-library/react";
import ActivityPage from "../page";

const previousTZ = process.env.TZ;

beforeEach(() => {
  localStorage.clear();
  process.env.TZ = "Asia/Ho_Chi_Minh";
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
  if (previousTZ === undefined) delete process.env.TZ;
  else process.env.TZ = previousTZ;
});

test("shows an empty state when no session is completed", () => {
  localStorage.setItem("learningSessions", JSON.stringify([{
    id: "open", type: "review", startedAt: "2026-09-17T03:00:00.000Z", durationSeconds: 0,
  }]));
  render(<ActivityPage />);
  expect(screen.getByRole("heading", { name: "Chưa có hoạt động" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Bắt đầu học" })).toHaveAttribute("href", "/");
});

test("groups completed sessions by local date with duration and accuracy", () => {
  localStorage.setItem("learningSessions", JSON.stringify([
    { id: "a", type: "review", startedAt: "2026-09-16T18:00:00.000Z", finishedAt: "2026-09-16T18:01:30.000Z", durationSeconds: 90, totalItems: 10, correctItems: 8 },
    { id: "b", type: "speaking", startedAt: "2026-09-16T10:00:00.000Z", finishedAt: "2026-09-16T10:00:30.000Z", durationSeconds: 30 },
    { id: "open", type: "exam", startedAt: "2026-09-16T19:00:00.000Z", durationSeconds: 0 },
  ]));
  render(<ActivityPage />);
  const days = screen.getAllByRole("heading", { level: 2 });
  expect(days).toHaveLength(2);
  expect(days[0]).toHaveTextContent("17");
  expect(days[1]).toHaveTextContent("16");
  expect(screen.getByText("Ôn tập")).toBeInTheDocument();
  expect(screen.getByText("80%")).toBeInTheDocument();
  expect(screen.getByText("1m 30s")).toBeInTheDocument();
  expect(screen.getByText("Luyện nói")).toBeInTheDocument();
  expect(screen.getByText("30s")).toBeInTheDocument();
  expect(screen.queryByText("Luyện thi")).not.toBeInTheDocument();
});
