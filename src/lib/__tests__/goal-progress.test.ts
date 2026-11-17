import { goalProgress } from "../goal-progress";
import type { ExamAttempt } from "../exam/types";
import type { LearningProfile } from "../profile";

const profile: LearningProfile = { goal: "toeic", currentLevel: 3, dailyStudyMinutes: 30, shortcutsEnabled: true, targetToeicScore: 750, targetDate: "2026-12-31" };
const attempt = (over: Partial<ExamAttempt>): ExamAttempt => ({ id: "a", kind: "TOEIC", mode: "mock", parts: [], startedAt: "2026-11-10T00:00:00.000Z", answers: [], ...over } as ExamAttempt);

test("compares the latest TOEIC mock with the target and counts days to the exam", () => {
  const attempts = [
    attempt({ id: "drill", mode: "drill", score: { raw: { correct: 1, total: 1 }, byPart: {}, byType: {}, toeic: { listening: 495, reading: 495, total: 990 } } }),
    attempt({ id: "mock", finishedAt: "2026-11-12T00:00:00.000Z", score: { raw: { correct: 10, total: 18 }, byPart: {}, byType: {}, toeic: { listening: 300, reading: 320, total: 620 } } }),
  ];
  expect(goalProgress(profile, attempts, new Date("2026-11-17T09:00:00"))).toEqual({
    exam: "TOEIC", target: 750, latest: { score: 620, at: "2026-11-12T00:00:00.000Z" }, gap: 130, daysLeft: 44,
  });
});

test("IELTS uses the average band; other goals have no exam progress", () => {
  const ielts = { ...profile, goal: "ielts" as const, targetIeltsScore: 6.5, targetDate: undefined };
  const attempts = [attempt({ kind: "IELTS", score: { raw: { correct: 1, total: 2 }, byPart: {}, byType: {}, ielts: { listening: 6, reading: 6.5 } } })];
  expect(goalProgress(ielts, attempts)).toMatchObject({ exam: "IELTS", target: 6.5, latest: { score: 6.5 }, gap: 0 });
  expect(goalProgress({ ...profile, goal: "mixed" }, attempts)).toBeNull();
});
