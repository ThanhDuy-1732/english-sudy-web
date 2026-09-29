export interface MasterySnapshot {
  date: string;   // YYYY-MM-DD
  skill: string;
  mastery: number; // 0–100
}

const KEY = "masteryTimeline";
const MAX = 365 * 6; // ~6 skills × 365 days

function ls(): MasterySnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as MasterySnapshot[]) : [];
  } catch { return []; }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordMasterySnapshot(skill: string, mastery: number): void {
  const date = today();
  const all = ls().filter((s) => !(s.date === date && s.skill === skill));
  const updated = [...all, { date, skill, mastery }];
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(updated.slice(-MAX)));
  }
}

export function getMasteryTimeline(skill: string): MasterySnapshot[] {
  return ls().filter((s) => s.skill === skill).sort((a, b) => a.date.localeCompare(b.date));
}

export function getSkillTrend(skill: string): "up" | "down" | "stable" {
  const timeline = getMasteryTimeline(skill);
  if (timeline.length < 4) return "stable";
  const half = Math.floor(timeline.length / 2);
  const recent = timeline.slice(-half);
  const prior = timeline.slice(-half * 2, -half);
  const recentAvg = recent.reduce((s, t) => s + t.mastery, 0) / recent.length;
  const priorAvg = prior.reduce((s, t) => s + t.mastery, 0) / prior.length;
  if (recentAvg - priorAvg > 5) return "up";
  if (priorAvg - recentAvg > 5) return "down";
  return "stable";
}
