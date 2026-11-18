import { questionTypeLabel } from "@/lib/exam/labels";
import type { ExamAttempt, QuestionType, ExamSettings } from "@/lib/exam/types";
import type { UnifiedMistake } from "@/lib/mistakes";
import type { SkillMastery } from "@/lib/mastery";

export interface PlanBlock {
  id: string;
  kind:
    | "srs_review"
    | "new_words"
    | "exam_drill"
    | "speaking"
    | "writing"
    | "grammar"
    | "mistakes";
  title: string;
  reason: string;
  estimatedMin: number;
  href: string;
  payload?: Record<string, unknown>;
  done: boolean;
}

/** Find the weakest question type in recent attempts */
export function weakestType(
  attempts: ExamAttempt[],
  opts: { days: number; minSamples: number }
): { type: QuestionType; accuracy: number; part: string } | null {
  const since = Date.now() - opts.days * 86400000;
  const recent = attempts.filter((a) => new Date(a.startedAt).getTime() >= since);

  const byType: Record<string, { correct: number; total: number; part: string }> = {};

  for (const attempt of recent) {
    for (const ans of attempt.answers) {
      if (!byType[ans.type]) byType[ans.type] = { correct: 0, total: 0, part: ans.part };
      byType[ans.type].total++;
      if (ans.correct) byType[ans.type].correct++;
    }
  }

  const eligible = Object.entries(byType).filter(
    ([, v]) => v.total >= opts.minSamples
  );
  if (eligible.length === 0) return null;

  const [worstType, worstStats] = eligible.sort(
    ([, a], [, b]) => a.correct / a.total - b.correct / b.total
  )[0];

  return {
    type: worstType as QuestionType,
    accuracy: Math.round((worstStats.correct / worstStats.total) * 100),
    part: worstStats.part,
  };
}

/** Fit blocks to the user's time budget */
function fitToBudget(blocks: PlanBlock[], budgetMin: number): PlanBlock[] {
  const result: PlanBlock[] = [];
  let used = 0;
  for (const block of blocks) {
    if (used + block.estimatedMin <= budgetMin) {
      result.push(block);
      used += block.estimatedMin;
    }
    if (result.length >= 6) break;
  }
  return result;
}

const TYPE_TO_PART: Partial<Record<QuestionType, string>> = {
  incomplete_sentence: "RC5",
  text_completion: "RC6",
  single_passage: "RC7",
  multiple_passage: "RC7",
  conversation: "LC3",
  short_talk: "LC4",
  question_response: "LC2",
  true_false_ng: "READ_P1",
  sentence_completion: "READ_P1",
  matching_headings: "READ_P2",
  mcq: "LISTEN_S3",
  summary_completion: "LISTEN_S4",
  form_completion: "LISTEN_S1",
};

export interface PlanContext {
  dueWords: number;
  unifiedMistakes: UnifiedMistake[];
  skillMastery: SkillMastery[];
  attempts: ExamAttempt[];
  lastSpeakingAt?: string;
  lastWritingAt?: string;
  settings: ExamSettings;
  availableMin: number;
}

export function generatePlan(ctx: PlanContext): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  const now = Date.now();

  // 1. SRS always first — debt is most expensive to delay
  if (ctx.dueWords > 0) {
    blocks.push({
      id: "srs",
      kind: "srs_review",
      title: "Ôn tập từ vựng",
      reason: `${ctx.dueWords} từ đến hạn ôn`,
      estimatedMin: Math.ceil(ctx.dueWords * 0.25),
      href: "/review",
      done: false,
    });
  }

  // 2. Weakest exam type (min 10 samples in 14 days)
  const weak = weakestType(ctx.attempts, { days: 14, minSamples: 10 });
  if (weak) {
    const part = TYPE_TO_PART[weak.type] ?? (ctx.settings.primaryExam === "TOEIC" ? "RC5" : "READ_P3");
    blocks.push({
      id: "exam-weak",
      kind: "exam_drill",
      title: `Luyện điểm yếu: ${questionTypeLabel(weak.type)}`,
      reason: `Accuracy ${weak.accuracy}% — thấp nhất trong 2 tuần`,
      estimatedMin: 15,
      href: `/exam/drill/${part}`,
      done: false,
    });
  }

  // 3. Unified mistakes >= 5 unresolved
  const unresolved = ctx.unifiedMistakes.filter((m) => m.status !== "resolved");
  if (unresolved.length >= 5) {
    blocks.push({
      id: "mistakes",
      kind: "mistakes",
      title: "Xem lại lỗi sai",
      reason: `${unresolved.length} lỗi chưa giải quyết`,
      estimatedMin: 10,
      href: "/mistakes",
      done: false,
    });
  }

  // 3b. Grammar block when mastery < 60
  const weakGrammar = ctx.skillMastery.find(
    (s) => s.skill === "grammar" && s.overallMastery < 60
  );
  if (weakGrammar) {
    const weakCat = weakGrammar.categories
      .filter((c) => c.confidence > 0.3)
      .sort((a, b) => a.mastery - b.mastery)[0];
    blocks.push({
      id: "grammar-weak",
      kind: "grammar",
      title: weakCat ? `Ngữ pháp — ${weakCat.category}` : "Luyện ngữ pháp",
      reason: `Mastery ${weakGrammar.overallMastery}%${weakCat ? ` — yếu nhất: ${weakCat.category}` : ""}`,
      estimatedMin: 10,
      href: "/grammar",
      payload: weakCat ? { focusCategory: weakCat.category } : undefined,
      done: false,
    });
  }

  // 4. Speaking — nudge after 2 days (fastest skill to decline)
  const daysSinceSpeak = ctx.lastSpeakingAt
    ? (now - new Date(ctx.lastSpeakingAt).getTime()) / 86400000
    : 999;
  if (daysSinceSpeak >= 2) {
    blocks.push({
      id: "speaking",
      kind: "speaking",
      title: "Luyện nói",
      reason: ctx.lastSpeakingAt ? `${Math.round(daysSinceSpeak)} ngày chưa luyện nói` : "Chưa luyện nói lần nào",
      estimatedMin: 10,
      href: "/speak",
      done: false,
    });
  }

  // 5. Writing — nudge after 5 days
  const daysSinceWrite = ctx.lastWritingAt
    ? (now - new Date(ctx.lastWritingAt).getTime()) / 86400000
    : 999;
  if (daysSinceWrite >= 5) {
    blocks.push({
      id: "writing",
      kind: "writing",
      title: "Luyện viết",
      reason: ctx.lastWritingAt ? `${Math.round(daysSinceWrite)} ngày chưa luyện viết` : "Chưa luyện viết lần nào",
      estimatedMin: 20,
      href: "/write",
      done: false,
    });
  }

  // 6. New words last — always fits if budget allows
  blocks.push({
    id: "new-words",
    kind: "new_words",
    title: "Học từ mới",
    reason: "Mở rộng vốn từ",
    estimatedMin: 10,
    href: "/",
    done: false,
  });

  return fitToBudget(blocks, ctx.availableMin);
}


// ponytail: no persistence here — caller reads localStorage and passes ctx in
