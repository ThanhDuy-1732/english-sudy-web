// Spaced repetition: FSRS-4.5 (Free Spaced Repetition Scheduler), default parameters, 90% target retention.
// A card's memory is two numbers: stability S (days until recall drops to 90%) and difficulty D (1–10).
// https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
import type { LearnedWord } from "./storage";

/** Review buttons: Quên, Khó, Được, Dễ. The app keeps its old 0/3/4/5 quality values at the UI boundary. */
export type Quality = 0 | 3 | 4 | 5;
type Grade = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81; // makes R(S, S) = 0.9
export const TARGET_RETENTION = 0.9;
const MAX_INTERVAL_DAYS = 365;
const DAY_MS = 86_400_000;

export interface FsrsState {
  stability: number; // days
  difficulty: number; // 1–10
  lastReviewedAt: string; // ISO
}

const toGrade = (q: Quality): Grade => (q === 0 ? 1 : q === 3 ? 2 : q === 4 ? 3 : 4);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Probability of recalling a card `elapsedDays` after the last review. */
export function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** Days until retrievability falls to the target retention. */
export function intervalDays(stability: number): number {
  const days = (stability / FACTOR) * (Math.pow(TARGET_RETENTION, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, MAX_INTERVAL_DAYS);
}

const initialDifficulty = (g: Grade) => clamp(W[4] - (g - 3) * W[5], 1, 10);

/** Next memory state after answering with `quality`. `prev` is undefined for a card's first review. */
export function fsrs(prev: FsrsState | undefined, quality: Quality, now = new Date()): FsrsState & { nextReviewAt: string; intervalDays: number } {
  const g = toGrade(quality);
  let stability: number;
  let difficulty: number;

  if (!prev) {
    stability = W[g - 1];
    difficulty = initialDifficulty(g);
  } else {
    const elapsed = (now.getTime() - Date.parse(prev.lastReviewedAt)) / DAY_MS;
    const r = retrievability(Number.isFinite(elapsed) ? elapsed : 0, prev.stability);
    const d = prev.difficulty;
    difficulty = clamp(W[7] * initialDifficulty(3) + (1 - W[7]) * (d - W[6] * (g - 3)), 1, 10);
    stability =
      g === 1
        ? W[11] * Math.pow(d, -W[12]) * (Math.pow(prev.stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))
        : prev.stability *
          (1 + Math.exp(W[8]) * (11 - d) * Math.pow(prev.stability, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
    stability = Math.max(0.1, g === 1 ? Math.min(stability, prev.stability) : stability);
  }

  // Forgotten cards come back tomorrow; others at the interval for 90% recall.
  const days = g === 1 ? 1 : intervalDays(stability);
  return {
    stability,
    difficulty,
    lastReviewedAt: now.toISOString(),
    intervalDays: days,
    nextReviewAt: new Date(now.getTime() + days * DAY_MS).toISOString(),
  };
}

/**
 * Memory state of a word, converting cards scheduled by the old SM-2 code:
 * stability ≈ its last interval, difficulty from its easiness factor (EF 2.5 → 4, EF 1.3 → 10).
 * Returns undefined for a card that has never been reviewed.
 */
export function fsrsStateOf(w: LearnedWord): FsrsState | undefined {
  if (w.stability !== undefined && w.difficulty !== undefined && w.lastReviewedAt) {
    return { stability: w.stability, difficulty: w.difficulty, lastReviewedAt: w.lastReviewedAt };
  }
  const reviewed = (w.repetitions ?? 0) > 0 || (w.mastery ?? 0) > 0 || w.easiness !== undefined;
  if (!reviewed) return undefined;
  const interval = Math.max(1, w.reviewInterval ?? 1);
  const due = Date.parse(w.nextReviewAt ?? "");
  return {
    stability: interval,
    difficulty: clamp(10 - ((w.easiness ?? 2.5) - 1.3) * 5, 1, 10),
    lastReviewedAt: new Date(Number.isNaN(due) ? Date.now() : due - interval * DAY_MS).toISOString(),
  };
}

/** 0–5 mastery stars for display, from how long the memory lasts. */
export function stabilityToMastery(stability: number): number {
  return stability < 1 ? 0 : stability < 3 ? 1 : stability < 7 ? 2 : stability < 21 ? 3 : stability < 60 ? 4 : 5;
}
