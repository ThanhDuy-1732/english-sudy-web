import type { LearnedWord } from "./storage";

export interface SrsState {
  easiness: number; // EF, init 2.5, floor 1.3
  interval: number; // days
  repetitions: number;
  nextReviewAt: string;
}

/**
 * SM-2 algorithm.
 * quality: 0=forgot, 3=correct but hard, 4=correct, 5=easy
 */
export function sm2(prev: SrsState, quality: 0 | 1 | 2 | 3 | 4 | 5): SrsState {
  let { easiness, interval, repetitions } = prev;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    interval =
      repetitions === 1
        ? 1
        : repetitions === 2
        ? 6
        : Math.round(interval * easiness);
  }

  easiness = Math.max(
    1.3,
    easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  return {
    easiness,
    interval,
    repetitions,
    nextReviewAt: new Date(Date.now() + interval * 86400000).toISOString(),
  };
}

/**
 * One-time migration: words without easiness get SM-2 defaults.
 * Preserves existing nextReviewAt.
 */
export function migrateToSm2(w: LearnedWord): LearnedWord {
  if ((w as LearnedWord & { easiness?: number }).easiness !== undefined) return w;
  return {
    ...w,
    easiness: 2.5,
    repetitions: Math.max(0, (w.mastery ?? 0) - 1),
    reviewInterval: w.reviewInterval ?? 1,
  } as LearnedWord;
}

/** Map SM-2 repetitions to 0-5 mastery stars for display */
export function repetitionsToMastery(repetitions: number): number {
  return Math.min(5, repetitions);
}
