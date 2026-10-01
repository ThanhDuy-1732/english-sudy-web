import { getAttempts } from "./exam/exam-storage";
import { getSpeaking } from "./speech/speaking-storage";
import { getWriting } from "./write/writing-storage";
import { getLearnedWords } from "./storage";
import {
  computeSkillMastery,
  getCachedMastery,
  saveMasteryCache,
  type SkillMastery,
  type MasteryInput,
  type MasterySkill,
  type AttemptRecord,
} from "./mastery";
import type { ExamPart } from "./exam/types";

const READING_PARTS: ExamPart[] = ["RC5", "RC6", "RC7", "READ_P1", "READ_P2", "READ_P3"];
const LISTENING_PARTS: ExamPart[] = ["LC1", "LC2", "LC3", "LC4", "LISTEN_S1", "LISTEN_S2", "LISTEN_S3", "LISTEN_S4"];

function byCategory<T>(
  items: T[],
  categoryOf: (item: T) => string,
  toAttempt: (item: T) => AttemptRecord,
): Map<string, AttemptRecord[]> {
  const map = new Map<string, AttemptRecord[]>();
  for (const item of items) {
    const category = categoryOf(item);
    const list = map.get(category) ?? [];
    list.push(toAttempt(item));
    map.set(category, list);
  }
  return map;
}

function toInputs(skill: MasterySkill, byCategoryMap: Map<string, AttemptRecord[]>): MasteryInput[] {
  return Array.from(byCategoryMap.entries()).map(([category, attempts]) => ({ skill, category, attempts }));
}

function examInputs(skill: "reading" | "listening", parts: ExamPart[]): MasteryInput[] {
  const attempts: { part: ExamPart; correct: boolean; at: string }[] = [];
  for (const a of getAttempts()) {
    for (const ans of a.answers) {
      if (parts.includes(ans.part)) attempts.push({ part: ans.part, correct: ans.correct, at: a.startedAt });
    }
  }
  return toInputs(skill, byCategory(attempts, (a) => a.part, (a) => ({ correct: a.correct, at: a.at })));
}

function speakingInputs(): MasteryInput[] {
  const map = byCategory(getSpeaking(), (r) => r.mode, (r) => ({ correct: r.feedback.overall >= 6, at: r.createdAt }));
  return toInputs("speaking", map);
}

function writingInputs(): MasteryInput[] {
  const map = byCategory(getWriting(), (r) => r.kind, (r) => ({ correct: r.feedback.overall >= 6, at: r.createdAt }));
  return toInputs("writing", map);
}

function vocabularyInputs(): MasteryInput[] {
  const attempts = getLearnedWords().map((w) => ({
    correct: (w.mastery ?? 0) >= 3,
    at: w.updatedAt ?? w.learnedAt,
  }));
  return attempts.length > 0 ? [{ skill: "vocabulary", category: "review", attempts }] : [];
}

/** Recomputes mastery for every skill from its source data (grammar is cached separately by grammar-progress.ts) and persists the merged cache. */
export function recomputeMastery(): SkillMastery[] {
  const grammar = getCachedMastery().filter((s) => s.skill === "grammar");
  const inputsBySkill: [MasterySkill, MasteryInput[]][] = [
    ["reading", examInputs("reading", READING_PARTS)],
    ["listening", examInputs("listening", LISTENING_PARTS)],
    ["speaking", speakingInputs()],
    ["writing", writingInputs()],
    ["vocabulary", vocabularyInputs()],
  ];
  const computed = inputsBySkill
    .filter(([, inputs]) => inputs.length > 0)
    .map(([skill, inputs]) => computeSkillMastery(skill, inputs));

  const all = [...grammar, ...computed];
  saveMasteryCache(all);
  return all;
}
