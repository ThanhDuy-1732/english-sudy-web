import { computeStreak } from "../streak";
import type { LearningSession } from "../sessions";

function makeSession(dateStr: string): LearningSession {
  return {
    id: dateStr,
    type: "review",
    startedAt: `${dateStr}T10:00:00`,
    durationSeconds: 600,
    finishedAt: `${dateStr}T10:10:00`,
  };
}

test("currentStreak counts consecutive days up to today", () => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);

  function fmt(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const sessions = [today, yesterday, twoDaysAgo].map((d) => makeSession(fmt(d)));
  const result = computeStreak(sessions);
  expect(result.currentStreak).toBe(3);
});

test("streak breaks if a day is missing", () => {
  const sessions = [
    makeSession("2026-09-22"),
    // 2026-09-21 missing
    makeSession("2026-09-20"),
  ];
  const result = computeStreak(sessions, new Date("2026-09-22"));
  expect(result.currentStreak).toBe(1);
});

test("longestStreak finds the longest run", () => {
  const sessions = [
    makeSession("2026-09-01"),
    makeSession("2026-09-02"),
    makeSession("2026-09-03"),
    // gap
    makeSession("2026-09-10"),
    makeSession("2026-09-11"),
  ];
  const result = computeStreak(sessions, new Date("2026-09-11"));
  expect(result.longestStreak).toBe(3);
});

test("activeDaysThisWeek counts Mon–Sun of current week", () => {
  const sessions = [
    makeSession("2026-09-21"), // Mon
    makeSession("2026-09-22"), // Tue
  ];
  const result = computeStreak(sessions, new Date("2026-09-22"));
  expect(result.activeDaysThisWeek).toBe(2);
});

test("empty sessions returns zeros", () => {
  const result = computeStreak([]);
  expect(result.currentStreak).toBe(0);
  expect(result.longestStreak).toBe(0);
  expect(result.activeDaysThisWeek).toBe(0);
});
