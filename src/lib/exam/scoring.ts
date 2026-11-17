import type { AnswerRecord, ScoreResult, ExamKind, ExamPart, ExamQuestion } from "./types";

// ─── TOEIC scaled score tables ────────────────────────────────────────────────
// Disclaimer: linear interpolation from public anchor tables, NOT ETS official.
// For progress tracking only.
const TOEIC_LC_ANCHORS: [number, number][] = [
  [0, 5], [10, 40], [20, 85], [30, 130], [40, 185], [50, 255],
  [60, 315], [70, 370], [80, 415], [90, 460], [96, 495], [100, 495],
];
const TOEIC_RC_ANCHORS: [number, number][] = [
  [0, 5], [10, 25], [20, 65], [30, 115], [40, 170], [50, 225],
  [60, 280], [70, 335], [80, 390], [90, 445], [96, 490], [100, 495],
];

function interpolate(anchors: [number, number][], x: number): number {
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1], [x1, y1] = anchors[i];
    if (x <= x1) return Math.round((y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)) / 5) * 5;
  }
  return anchors.at(-1)![1];
}

export function toeicScaled(raw: number, total: number, section: "LC" | "RC"): number {
  if (total === 0) return 5;
  const per100 = (raw / total) * 100;
  return interpolate(section === "LC" ? TOEIC_LC_ANCHORS : TOEIC_RC_ANCHORS, per100);
}

// ─── IELTS band tables ────────────────────────────────────────────────────────
const IELTS_READING_ACADEMIC: [number, number][] = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5],
  [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3],
];
const IELTS_LISTENING: [number, number][] = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5],
  [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [6, 3.5], [4, 3],
];

export function ieltsBand(raw: number, total: number, skill: "reading" | "listening"): number {
  const scaled40 = Math.round((raw / total) * 40);
  const table = skill === "reading" ? IELTS_READING_ACADEMIC : IELTS_LISTENING;
  return table.find(([r]) => scaled40 >= r)?.[1] ?? 2.5;
}

// ─── Completion answer check ──────────────────────────────────────────────────
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(a|an|the)\s+/, "");
}

export function isCompletionCorrect(user: string, q: ExamQuestion): boolean {
  const accepted = [q.answer, ...(q.acceptableAnswers ?? [])].map(normalize);
  return accepted.includes(normalize(user));
}

/**
 * True/False/Not Given (and Yes/No/Not Given) questions are answered by choosing, not typing:
 * give them their three options and spell the answer exactly like one of them.
 */
const JUDGEMENT_OPTIONS: Record<string, string[]> = {
  true_false_ng: ["True", "False", "Not Given"],
  yes_no_ng: ["Yes", "No", "Not Given"],
};

export function withJudgementOptions<T extends { questions: ExamQuestion[] }>(item: T): T {
  return {
    ...item,
    questions: item.questions.map((q) => {
      const options = JUDGEMENT_OPTIONS[q.type];
      if (!options || q.options?.length) return q;
      const answer = options.find((o) => normalize(o) === normalize(q.answer)) ?? q.answer;
      return { ...q, options, answer };
    }),
  };
}

// ─── Score computation ────────────────────────────────────────────────────────
const LC_PARTS = new Set(["LC1", "LC2", "LC3", "LC4", "LISTEN_S1", "LISTEN_S2", "LISTEN_S3", "LISTEN_S4"]);
const RC_PARTS = new Set(["RC5", "RC6", "RC7", "READ_P1", "READ_P2", "READ_P3"]);

export function computeScore(
  answers: AnswerRecord[],
  kind: ExamKind,
  parts: ExamPart[]
): ScoreResult {
  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;

  const byPart: ScoreResult["byPart"] = {};
  const byType: ScoreResult["byType"] = {};

  for (const a of answers) {
    // byPart
    if (!byPart[a.part]) byPart[a.part] = { correct: 0, total: 0 };
    byPart[a.part].total++;
    if (a.correct) byPart[a.part].correct++;

    // byType
    if (!byType[a.type]) byType[a.type] = { correct: 0, total: 0 };
    byType[a.type].total++;
    if (a.correct) byType[a.type].correct++;
  }

  const result: ScoreResult = { raw: { correct, total }, byPart, byType };

  if (kind === "TOEIC") {
    const lcAnswers = answers.filter((a) => LC_PARTS.has(a.part));
    const rcAnswers = answers.filter((a) => RC_PARTS.has(a.part));
    if (lcAnswers.length > 0 && rcAnswers.length > 0) {
      const lcScore = toeicScaled(
        lcAnswers.filter((a) => a.correct).length, lcAnswers.length, "LC"
      );
      const rcScore = toeicScaled(
        rcAnswers.filter((a) => a.correct).length, rcAnswers.length, "RC"
      );
      result.toeic = { listening: lcScore, reading: rcScore, total: lcScore + rcScore };
    } else if (lcAnswers.length > 0) {
      const lcScore = toeicScaled(lcAnswers.filter((a) => a.correct).length, lcAnswers.length, "LC");
      result.toeic = { listening: lcScore, reading: 0, total: lcScore };
    } else if (rcAnswers.length > 0) {
      const rcScore = toeicScaled(rcAnswers.filter((a) => a.correct).length, rcAnswers.length, "RC");
      result.toeic = { listening: 0, reading: rcScore, total: rcScore };
    }
  } else if (kind === "IELTS") {
    const listenAnswers = answers.filter((a) => LC_PARTS.has(a.part));
    const readAnswers = answers.filter((a) => RC_PARTS.has(a.part));
    result.ielts = {};
    if (listenAnswers.length > 0) {
      result.ielts.listening = ieltsBand(
        listenAnswers.filter((a) => a.correct).length, listenAnswers.length, "listening"
      );
    }
    if (readAnswers.length > 0) {
      result.ielts.reading = ieltsBand(
        readAnswers.filter((a) => a.correct).length, readAnswers.length, "reading"
      );
    }
  }

  return result;
}
