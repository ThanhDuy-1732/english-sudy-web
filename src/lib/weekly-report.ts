import type { LearningSession } from "./sessions";
import type { ExamAttempt } from "./exam/types";
import { getLearnedWords } from "./storage";

export interface WeeklyReport {
  studyMinutes: number;
  sessions: number;
  wordsLearned: number;
  srsAccuracy: number | null;
  examAccuracy: number | null;
}

function startOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function computeWeeklyReport(
  sessions: LearningSession[],
  attempts: ExamAttempt[]
): WeeklyReport {
  const since = startOfWeekISO();
  const weekSessions = sessions.filter((s) => s.startedAt >= since);
  const studyMinutes = Math.round(weekSessions.reduce((s, x) => s + x.durationSeconds, 0) / 60);

  const wordsLearned = getLearnedWords().filter((w) => (w.learnedAt ?? "") >= since).length;

  const reviewSessions = weekSessions.filter((s) => s.type === "review");
  const srsAccuracy = reviewSessions.length > 0
    ? Math.round(
        reviewSessions.reduce((s, x) => {
          const total = x.totalItems ?? 0;
          const correct = x.correctItems ?? 0;
          return s + (total > 0 ? correct / total : 0);
        }, 0) / reviewSessions.length * 100
      )
    : null;

  const weekAttempts = attempts.filter((a) => a.startedAt >= since);
  let examAccuracy: number | null = null;
  if (weekAttempts.length > 0) {
    const allAnswers = weekAttempts.flatMap((a) => a.answers);
    if (allAnswers.length > 0) {
      examAccuracy = Math.round(allAnswers.filter((a) => a.correct).length / allAnswers.length * 100);
    }
  }

  return { studyMinutes, sessions: weekSessions.length, wordsLearned, srsAccuracy, examAccuracy };
}
