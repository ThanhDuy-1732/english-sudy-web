export type LearningActivityType =
  | "vocabulary" | "review" | "grammar" | "exam" | "speaking" | "writing";

export interface LearningSession {
  id: string;
  type: LearningActivityType;
  startedAt: string;
  finishedAt?: string;
  durationSeconds: number;
  totalItems?: number;
  correctItems?: number;
  metadata?: Record<string, unknown>;
}

const KEY = "learningSessions";
const CAP = 500;

function load(): LearningSession[] {
  if (typeof window === "undefined") return [];
  try {
    const sessions = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(sessions) ? sessions as LearningSession[] : [];
  } catch {
    return [];
  }
}

function save(sessions: LearningSession[]): void {
  if (typeof window === "undefined") return;
  sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  localStorage.setItem(KEY, JSON.stringify(sessions.slice(0, CAP)));
}

export function startSession(type: LearningActivityType, metadata?: Record<string, unknown>): string {
  const id = crypto.randomUUID();
  const session: LearningSession = {
    id, type, startedAt: new Date().toISOString(), durationSeconds: 0,
    ...(metadata ? { metadata } : {}),
  };
  save([...load(), session]);
  return id;
}

export function updateSession(
  id: string,
  patch: Partial<Pick<LearningSession, "totalItems" | "correctItems" | "metadata">>
): void {
  const sessions = load();
  const session = sessions.find((entry) => entry.id === id);
  if (!session) return;
  Object.assign(session, patch);
  save(sessions);
}

export function finishSession(
  id: string,
  totals?: { totalItems?: number; correctItems?: number }
): void {
  const sessions = load();
  const session = sessions.find((entry) => entry.id === id);
  if (!session || session.finishedAt) return;
  const now = new Date();
  session.finishedAt = now.toISOString();
  session.durationSeconds = Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 1000);
  if (totals?.totalItems !== undefined) session.totalItems = totals.totalItems;
  if (totals?.correctItems !== undefined) session.correctItems = totals.correctItems;
  save(sessions);
}

export function cancelSession(id: string): void {
  const sessions = load();
  if (sessions.some((session) => session.id === id)) {
    save(sessions.filter((session) => session.id !== id));
  }
}

export function getSessions(): LearningSession[] {
  return load();
}

export function getSessionsForDate(localDateStr: string): LearningSession[] {
  return load().filter((session) => {
    const date = new Date(session.startedAt);
    const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return localDate === localDateStr;
  });
}

export function getRecentSessions(n: number): LearningSession[] {
  return load().slice(0, n);
}
