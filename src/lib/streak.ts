import type { LearningSession } from "./sessions";

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  activeDaysThisWeek: number;
}

function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function computeStreak(sessions: LearningSession[], referenceDate = new Date()): StreakInfo {
  const activeDates = new Set(sessions.map((s) => localDate(s.startedAt)));

  // Current streak — count backward from referenceDate
  let currentStreak = 0;
  const cursor = new Date(referenceDate);
  cursor.setHours(12, 0, 0, 0);
  while (activeDates.has(formatDate(cursor))) {
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak — sort and find longest consecutive run
  const sorted = Array.from(activeDates).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of sorted) {
    if (prev) {
      const diff = (new Date(date).getTime() - new Date(prev).getTime()) / 86400000;
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = date;
  }

  // Active days this week (Mon–Sun of referenceDate's week)
  const weekStart = new Date(referenceDate);
  const day = weekStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  let activeDaysThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    if (d > referenceDate) break;
    if (activeDates.has(formatDate(d))) activeDaysThisWeek++;
  }

  return { currentStreak, longestStreak: longest, activeDaysThisWeek };
}
