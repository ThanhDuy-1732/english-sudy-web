import { computeSkillMastery, getCachedMastery, saveMasteryCache } from "./mastery";
import { asArray } from "./safe-json";

export interface GrammarAttempt {
  id: string;
  topicId: string;
  subRuleId: string;
  correct: boolean;
  at: string;
}

export interface GrammarProgress {
  topicId: string;
  subRuleId: string;
  attempts: number;
  correct: number;
  accuracy: number;       // 0–100
  mastery: number;        // 0–100
  lastPracticedAt: string;
}

const KEY = "grammarAttempts";
const MAX = 2000;

function ls(): GrammarAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? asArray<GrammarAttempt>(JSON.parse(r)) : [];
  } catch { return []; }
}

function save(items: GrammarAttempt[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
}

function buildProgress(topicId: string, subRuleId: string, attempts: GrammarAttempt[]): GrammarProgress {
  const correct = attempts.filter((a) => a.correct).length;
  const accuracy = Math.round((correct / attempts.length) * 100);
  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at));
  return {
    topicId, subRuleId,
    attempts: attempts.length, correct, accuracy,
    mastery: accuracy,
    lastPracticedAt: sorted[sorted.length - 1].at,
  };
}

export function recordGrammarAttempt(input: {
  topicId: string; subRuleId: string; correct: boolean;
}): void {
  save([...ls(), {
    id: crypto.randomUUID(),
    topicId: input.topicId,
    subRuleId: input.subRuleId,
    correct: input.correct,
    at: new Date().toISOString(),
  }]);
  refreshGrammarMastery();
}

export function getGrammarProgress(topicId: string, subRuleId: string): GrammarProgress | null {
  const all = ls().filter((a) => a.topicId === topicId && a.subRuleId === subRuleId);
  if (all.length === 0) return null;
  return buildProgress(topicId, subRuleId, all);
}

export function getTopicProgress(topicId: string): GrammarProgress[] {
  const all = ls().filter((a) => a.topicId === topicId);
  const bySubRule = new Map<string, GrammarAttempt[]>();
  for (const a of all) {
    bySubRule.set(a.subRuleId, [...(bySubRule.get(a.subRuleId) ?? []), a]);
  }
  return Array.from(bySubRule.entries()).map(([subRuleId, attempts]) =>
    buildProgress(topicId, subRuleId, attempts)
  );
}

export function getWeakSubRules(accuracyThreshold = 70): GrammarProgress[] {
  const all = ls();
  const groups = new Map<string, GrammarAttempt[]>();
  for (const a of all) {
    const k = `${a.topicId}::${a.subRuleId}`;
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  return Array.from(groups.entries())
    .map(([k, attempts]) => {
      const [topicId, subRuleId] = k.split("::");
      return buildProgress(topicId, subRuleId, attempts);
    })
    .filter((p) => p.attempts >= 3 && p.accuracy < accuracyThreshold)
    .sort((a, b) => a.accuracy - b.accuracy);
}

function refreshGrammarMastery(): void {
  const all = ls();
  const bySubRule = new Map<string, { correct: boolean; at: string }[]>();
  for (const a of all) {
    bySubRule.set(a.subRuleId, [
      ...(bySubRule.get(a.subRuleId) ?? []),
      { correct: a.correct, at: a.at },
    ]);
  }
  const inputs = Array.from(bySubRule.entries()).map(([subRuleId, attempts]) => ({
    skill: "grammar" as const,
    category: subRuleId,
    attempts,
  }));
  const grammarMastery = computeSkillMastery("grammar", inputs);
  const existing = getCachedMastery().filter((s) => s.skill !== "grammar");
  saveMasteryCache([grammarMastery, ...existing]);
}
