export interface DailyChallenge {
  date: string;
  words: string[];
  completed: boolean;
}

const KEY = "dailyChallenge";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today() { return formatDate(new Date()); }

function getHistory(): DailyChallenge[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((record): record is DailyChallenge => record && typeof record.date === "string" && Array.isArray(record.words));
  } catch { return []; }
}

export function getDailyChallenge(): DailyChallenge | null {
  return getHistory().find((record) => record.date === today()) ?? null;
}

export function setDailyComplete(words: string[]) {
  const history = getHistory();
  const record = { date: today(), words, completed: true };
  const index = history.findIndex((item) => item.date === record.date);
  if (index >= 0) history[index] = record; else history.push(record);
  localStorage.setItem(KEY, JSON.stringify(history));
}

export function getStreak() {
  const completed = getHistory().filter((record) => record.completed).map((record) => record.date).sort().reverse();
  if (completed.length === 0) return 0;
  let streak = 0;
  let date = new Date();
  date.setHours(0, 0, 0, 0);
  for (const dateString of completed) {
    if (dateString !== formatDate(date)) break;
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}
