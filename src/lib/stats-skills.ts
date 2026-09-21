import { getSpeaking } from "./speech/speaking-storage";
import { getWriting } from "./write/writing-storage";
import { getAttempts } from "./exam/exam-storage";

export interface WeeklyBand {
  week: string;        // ISO week key e.g. "2026-W38"
  speaking?: number;
  writing?: number;
  listening?: number;
  reading?: number;
}

export interface SkillRadarPoint {
  skill: "L" | "R" | "S" | "W";
  label: string;
  value: number | null;  // 0–100, null when no data
  samples: number;
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + (jan4.getUTCDay() || 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const LC_PARTS = new Set(["LC1", "LC2", "LC3", "LC4", "LISTEN_S1", "LISTEN_S2", "LISTEN_S3", "LISTEN_S4"]);
const RC_PARTS = new Set(["RC5", "RC6", "RC7", "READ_P1", "READ_P2", "READ_P3"]);

export function weeklyBands(weeks = 12): WeeklyBand[] {
  const cutoff = new Date(Date.now() - weeks * 7 * 86400000).toISOString();
  const map = new Map<string, { s: number[]; w: number[]; l: number[]; r: number[] }>();
  const ensure = (k: string) => {
    if (!map.has(k)) map.set(k, { s: [], w: [], l: [], r: [] });
    return map.get(k)!;
  };

  for (const s of getSpeaking()) {
    if (s.createdAt < cutoff) continue;
    ensure(isoWeek(s.createdAt)).s.push(s.feedback.overall);
  }
  for (const w of getWriting()) {
    if (w.createdAt < cutoff) continue;
    ensure(isoWeek(w.createdAt)).w.push(w.feedback.overall);
  }
  for (const a of getAttempts()) {
    if (!a.finishedAt || a.finishedAt < cutoff || !a.score?.ielts) continue;
    const wk = isoWeek(a.finishedAt);
    const isLC = a.parts.some((p: string) => LC_PARTS.has(p));
    const isRC = a.parts.some((p: string) => RC_PARTS.has(p));
    if (a.score.ielts.listening != null && isLC) ensure(wk).l.push(a.score.ielts.listening);
    if (a.score.ielts.reading != null && isRC) ensure(wk).r.push(a.score.ielts.reading);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, d]) => ({
      week,
      ...(d.s.length ? { speaking: avg(d.s) } : {}),
      ...(d.w.length ? { writing: avg(d.w) } : {}),
      ...(d.l.length ? { listening: avg(d.l) } : {}),
      ...(d.r.length ? { reading: avg(d.r) } : {}),
    }));
}

export function skillRadar(): SkillRadarPoint[] {
  const speaking = getSpeaking().slice(0, 5);
  const writing = getWriting().slice(0, 5);
  const attempts = getAttempts().slice(0, 20);

  const lAnswers = attempts.flatMap((a) =>
    a.answers.filter((x: { part: string }) => LC_PARTS.has(x.part)));
  const rAnswers = attempts.flatMap((a) =>
    a.answers.filter((x: { part: string }) => RC_PARTS.has(x.part)));

  const lAcc = lAnswers.length
    ? lAnswers.filter((x: { correct: boolean }) => x.correct).length / lAnswers.length * 100
    : null;
  const rAcc = rAnswers.length
    ? rAnswers.filter((x: { correct: boolean }) => x.correct).length / rAnswers.length * 100
    : null;
  const sAvg = speaking.length ? avg(speaking.map((s) => s.feedback.overall)) / 9 * 100 : null;
  const wAvg = writing.length ? avg(writing.map((w) => w.feedback.overall)) / 9 * 100 : null;

  return [
    { skill: "L", label: "Listening", value: lAcc,            samples: lAnswers.length },
    { skill: "R", label: "Reading",   value: rAcc,            samples: rAnswers.length },
    { skill: "S", label: "Speaking",  value: sAvg,            samples: speaking.length },
    { skill: "W", label: "Writing",   value: wAvg,            samples: writing.length  },
  ];
}
