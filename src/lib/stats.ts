import { getLearnedWords } from "./storage";

export interface DailyWordCount {
  date: string;
  count: number;
}

export interface CalendarDay extends DailyWordCount {
  level: 0 | 1 | 2 | 3;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromOffset(offset: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

export function getWordsPerDay(days = 30): DailyWordCount[] {
  const safeDays = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 30;
  const counts = new Map<string, number>();
  getLearnedWords().forEach((word) => {
    const learned = new Date(word.learnedAt);
    if (Number.isNaN(learned.getTime())) return;
    const date = formatDate(learned);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  });

  return Array.from({ length: safeDays }, (_, index) => {
    const date = formatDate(dateFromOffset(-(safeDays - 1 - index)));
    return { date, count: counts.get(date) ?? 0 };
  });
}

export function getTopicDistribution() {
  const counts = new Map<string, number>();
  getLearnedWords().forEach((word) => {
    const topic = word.topic?.trim() || "Chưa phân loại";
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  });
  return Array.from(counts, ([topic, count]) => ({ topic, count }));
}

function toLevel(count: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

export function getCalendarData(weeks = 26): CalendarDay[] {
  const safeWeeks = Number.isFinite(weeks) ? Math.max(0, Math.floor(weeks)) : 26;
  return getWordsPerDay(safeWeeks * 7).map((day) => ({ ...day, level: toLevel(day.count) }));
}
