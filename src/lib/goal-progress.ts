// How far the learner is from the exam target set in Cài đặt → Hồ sơ, using the latest mock test score.
import type { LearningProfile } from "./profile";
import type { ExamAttempt, ExamKind } from "./exam/types";

export interface GoalProgress {
  exam: ExamKind;
  target?: number;
  latest?: { score: number; at: string };
  gap?: number;
  daysLeft?: number;
}

/** Only mock tests count: a drill covers one part, so its scaled score says little about the whole exam. */
export function latestMockScore(attempts: ExamAttempt[], exam: ExamKind): { score: number; at: string } | undefined {
  for (const attempt of attempts) {
    if (attempt.kind !== exam || attempt.mode !== "mock" || !attempt.score) continue;
    const at = attempt.finishedAt ?? attempt.startedAt;
    if (exam === "TOEIC" && attempt.score.toeic) return { score: attempt.score.toeic.total, at };
    const bands = [attempt.score.ielts?.listening, attempt.score.ielts?.reading].filter((b): b is number => typeof b === "number");
    if (exam === "IELTS" && bands.length) return { score: Math.round((bands.reduce((a, b) => a + b, 0) / bands.length) * 2) / 2, at };
  }
  return undefined;
}

export function goalProgress(profile: LearningProfile, attempts: ExamAttempt[], now = new Date()): GoalProgress | null {
  const exam: ExamKind | null = profile.goal === "toeic" ? "TOEIC" : profile.goal === "ielts" ? "IELTS" : null;
  if (!exam) return null;
  const rawTarget = exam === "TOEIC" ? profile.targetToeicScore : profile.targetIeltsScore;
  const target = rawTarget && Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : undefined;
  const latest = latestMockScore(attempts, exam);
  const gap = target !== undefined && latest ? Math.max(0, Math.round((target - latest.score) * 10) / 10) : undefined;
  let daysLeft: number | undefined;
  if (profile.targetDate) {
    const examDay = new Date(`${profile.targetDate}T00:00:00`);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((examDay.getTime() - today.getTime()) / 86_400_000);
    if (Number.isFinite(diff)) daysLeft = diff;
  }
  return { exam, target, latest, gap, daysLeft };
}
