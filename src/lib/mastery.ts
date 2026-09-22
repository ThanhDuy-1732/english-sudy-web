export type MasterySkill =
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "speaking"
  | "writing";

export interface CategoryMastery {
  category: string;
  mastery: number;
  confidence: number;
  attempts: number;
  trend: "up" | "down" | "stable";
  lastPracticedAt: string;
}

export interface SkillMastery {
  skill: MasterySkill;
  overallMastery: number;
  categories: CategoryMastery[];
  lastUpdatedAt: string;
}

export interface AttemptRecord {
  correct: boolean;
  at: string;
}

export interface MasteryInput {
  skill: MasterySkill;
  category: string;
  attempts: AttemptRecord[];
}

function decayWeight(daysAgo: number): number {
  return Math.exp(-daysAgo / 14);
}

export function computeCategoryMastery(input: MasteryInput): CategoryMastery {
  const { attempts, category } = input;
  if (attempts.length === 0) {
    return {
      category,
      mastery: 0,
      confidence: 0,
      attempts: 0,
      trend: "stable",
      lastPracticedAt: new Date().toISOString(),
    };
  }

  const now = Date.now();
  let weightedCorrect = 0;
  let weightedTotal = 0;

  for (const a of attempts) {
    const daysAgo = (now - new Date(a.at).getTime()) / 86400000;
    const w = decayWeight(Math.max(0, daysAgo));
    weightedTotal += w;
    if (a.correct) weightedCorrect += w;
  }

  const mastery =
    weightedTotal > 0 ? Math.round((weightedCorrect / weightedTotal) * 100) : 0;

  const confidence = Math.min(1, attempts.length / 10);

  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at));
  let trend: "up" | "down" | "stable" = "stable";
  if (sorted.length >= 4) {
    const half = Math.floor(sorted.length / 2);
    const recent = sorted.slice(-half);
    const prior = sorted.slice(-half * 2, -half);
    const recentAcc = recent.filter((a) => a.correct).length / recent.length;
    const priorAcc = prior.filter((a) => a.correct).length / prior.length;
    if (recentAcc - priorAcc > 0.15) trend = "up";
    else if (priorAcc - recentAcc > 0.15) trend = "down";
  }

  const lastPracticedAt = sorted[sorted.length - 1].at;
  return { category, mastery, confidence, attempts: attempts.length, trend, lastPracticedAt };
}

export function computeSkillMastery(
  skill: MasterySkill,
  categoryInputs: MasteryInput[]
): SkillMastery {
  const categories = categoryInputs.map(computeCategoryMastery);
  const withData = categories.filter((c) => c.attempts > 0);
  const overallMastery =
    withData.length > 0
      ? Math.round(
          withData.reduce((s, c) => s + c.mastery * c.confidence, 0) /
            withData.reduce((s, c) => s + c.confidence, 0)
        )
      : 0;
  return {
    skill,
    overallMastery,
    categories,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function getWeakestSkills(skills: SkillMastery[], limit = 3): SkillMastery[] {
  return [...skills].sort((a, b) => a.overallMastery - b.overallMastery).slice(0, limit);
}

export function getStrongestSkills(skills: SkillMastery[], limit = 3): SkillMastery[] {
  return [...skills].sort((a, b) => b.overallMastery - a.overallMastery).slice(0, limit);
}

const KEY = "skillMasteryCache";

export function getCachedMastery(): SkillMastery[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as SkillMastery[]) : [];
  } catch {
    return [];
  }
}

export function saveMasteryCache(skills: SkillMastery[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(skills));
}
