"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { generatePlan, type PlanBlock } from "@/lib/plan/generate-plan";
import { getWordsForReview } from "@/lib/storage";
import { getAttempts, getExamSettings } from "@/lib/exam/exam-storage";
import { getMistakes as getUnifiedMistakes } from "@/lib/mistakes";
import { recomputeMastery } from "@/lib/mastery-all";
import { localDateKey } from "@/lib/date";
import Segmented from "@/components/Segmented";
import { goalProgress, type GoalProgress } from "@/lib/goal-progress";
import { getProfile } from "@/lib/profile";

const BUDGET_OPTIONS = [15, 30, 60] as const;

const KIND_LABEL: Record<PlanBlock["kind"], string> = {
  srs_review: "Ôn tập",
  new_words: "Từ mới",
  exam_drill: "Luyện thi",
  speaking: "Nói",
  writing: "Viết",
  grammar: "Ngữ pháp",
  mistakes: "Sổ lỗi",
};

function getTodayKey() {
  return localDateKey();
}

function loadStoredPlan(): { date: string; blocks: PlanBlock[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("dailyPlan");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePlan(plan: PlanBlock[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("dailyPlan", JSON.stringify({ date: getTodayKey(), blocks: plan }));
}

export default function TodayPage() {
  const [budget, setBudget] = useState<15 | 30 | 60>(30);
  // Stored plan is read after mount so the first client render matches the server HTML.
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[] | null>(null);
  useEffect(() => {
    const stored = loadStoredPlan();
    if (stored?.date === getTodayKey()) setPlanBlocks(stored.blocks);
  }, []);

  function buildPlan() {
    const dueWords = getWordsForReview().length;
    const attempts = getAttempts();
    const settings = getExamSettings();

    // Get last speaking/writing dates from localStorage
    const lastSpeakingAt = localStorage.getItem("lastSpeakingAt") ?? undefined;
    const lastWritingAt = localStorage.getItem("lastWritingAt") ?? undefined;

    const blocks = generatePlan({
      dueWords,
      unifiedMistakes: getUnifiedMistakes(),
      skillMastery: recomputeMastery(),
      attempts,
      lastSpeakingAt,
      lastWritingAt,
      settings,
      availableMin: budget,
    });

    savePlan(blocks);
    setPlanBlocks(blocks);
  }

  function markDone(id: string) {
    if (!planBlocks) return;
    const updated = planBlocks.map((b) => (b.id === id ? { ...b, done: true } : b));
    setPlanBlocks(updated);
    savePlan(updated);
  }

  const doneCount = planBlocks?.filter((b) => b.done).length ?? 0;
  const totalCount = planBlocks?.length ?? 0;
  const minutesLeft = planBlocks?.filter((b) => !b.done).reduce((sum, b) => sum + b.estimatedMin, 0) ?? 0;

  const [goal, setGoal] = useState<GoalProgress | null>(null);
  useEffect(() => setGoal(goalProgress(getProfile(), getAttempts())), []);

  // Read after mount: the date and due count come from the device, not the server render.
  const [today, setToday] = useState<{ label: string; due: number } | null>(null);
  useEffect(() => {
    const label = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    setToday({ label: label.charAt(0).toUpperCase() + label.slice(1), due: getWordsForReview().length });
  }, [planBlocks]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:px-8 lg:pt-12">
      <p className="text-sm text-muted" suppressHydrationWarning>{today?.label ?? "\u00a0"}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Hôm nay học gì?</h1>
      <p className="page-lead">
        {today && today.due > 0
          ? <>Có <span className="marker-stroke font-semibold tabular-nums">{today.due} từ</span> đến hạn ôn. Kế hoạch dưới đây xếp việc quan trọng nhất lên trước.</>
          : "Kế hoạch được lập từ từ cần ôn, điểm yếu khi luyện thi và lỗi bạn hay mắc."}
      </p>

      {goal && <GoalCard goal={goal} />}

      {!planBlocks ? (
        <section aria-labelledby="budget-label" className="mt-8 rounded-xl border border-rule bg-card p-5 sm:p-6">
          <p id="budget-label" className="font-medium text-ink">Hôm nay bạn có bao nhiêu thời gian?</p>
          <div className="mt-4">
            <Segmented label="Thời gian học hôm nay" value={budget} onChange={setBudget}
              options={BUDGET_OPTIONS.map((b) => ({ value: b, label: `${b} phút` }))} />
          </div>
          <div className="mt-6">
            <button type="button" onClick={buildPlan} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-white transition-colors hover:bg-primary-strong">
              Lập kế hoạch
            </button>
          </div>
        </section>
      ) : (
        <section aria-label="Kế hoạch hôm nay" className="mt-8">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-muted">
              <span className="font-semibold tabular-nums text-ink">{doneCount}/{totalCount}</span> việc xong
              {minutesLeft > 0 && <> · còn khoảng <span className="tabular-nums">{minutesLeft}</span> phút</>}
            </p>
            <button
              type="button"
              onClick={() => {
                setPlanBlocks(null);
                localStorage.removeItem("dailyPlan");
              }}
              className="min-h-11 text-sm font-medium text-primary hover:underline"
            >
              Lập lại
            </button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : "0%" }} />
          </div>

          <ol className="mt-6 divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-card">
            {planBlocks.map((block) => (
              <li key={block.id} className="flex items-start gap-4 px-4 py-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => markDone(block.id)}
                  disabled={block.done}
                  aria-label={block.done ? `${block.title}: đã xong` : `Đánh dấu xong: ${block.title}`}
                  className="group -m-2.5 flex size-11 shrink-0 items-center justify-center"
                >
                  <span className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors ${block.done ? "border-primary bg-primary text-white" : "border-rule group-hover:border-primary"}`}>
                    {block.done && <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>}
                  </span>
                </button>
                <div className={`min-w-0 flex-1 ${block.done ? "opacity-55" : ""}`}>
                  <p className={`font-medium text-ink ${block.done ? "line-through decoration-muted" : ""}`}>{block.title}</p>
                  <p className="mt-0.5 text-sm leading-6 text-muted">{block.reason}</p>
                  <p className="mt-1 text-xs text-muted">{KIND_LABEL[block.kind]} · khoảng {block.estimatedMin} phút</p>
                </div>
                {!block.done && (
                  <Link href={block.href} className="shrink-0 self-center rounded-lg border border-rule px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary">
                    Bắt đầu
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}

function formatScore(goal: GoalProgress, value: number) {
  return goal.exam === "TOEIC" ? `${value} điểm` : `band ${value}`;
}

/** Target exam score, the latest mock test estimate and the days left, from Cài đặt → Hồ sơ. */
function GoalCard({ goal }: { goal: GoalProgress }) {
  const percent = goal.target && goal.latest ? Math.min(100, Math.round((goal.latest.score / goal.target) * 100)) : 0;
  return (
    <section aria-label="Mục tiêu kỳ thi" className="panel mt-6 p-5">
      {goal.target ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="section-title">Mục tiêu {goal.exam}: {formatScore(goal, goal.target)}</h2>
            {goal.daysLeft !== undefined && (
              <p className="text-sm text-muted">
                {goal.daysLeft > 0 ? <>Còn <span className="marker-stroke font-semibold tabular-nums">{goal.daysLeft} ngày</span> đến ngày thi</> : goal.daysLeft === 0 ? "Hôm nay là ngày thi" : "Ngày thi đã qua"}
              </p>
            )}
          </div>
          {goal.latest ? (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-rule" role="progressbar" aria-label="Điểm ước lượng so với mục tiêu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className={`h-full rounded-full ${goal.gap === 0 ? "bg-ok" : "bg-primary"}`} style={{ width: `${Math.max(percent, 2)}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted">
                Thi thử gần nhất ({new Date(goal.latest.at).toLocaleDateString("vi-VN")}): <span className="font-semibold text-ink">{formatScore(goal, goal.latest.score)}</span>.{" "}
                {goal.gap ? `Còn thiếu ${goal.exam === "TOEIC" ? `${goal.gap} điểm` : `${goal.gap} band`}.` : "Đã đạt mục tiêu."}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Chưa có điểm ước lượng. <Link href="/exam/mock" className="font-medium text-primary hover:underline">Làm một bài thi thử</Link> để xem bạn còn cách mục tiêu bao xa.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">
          Bạn đang luyện {goal.exam} nhưng chưa đặt điểm mục tiêu. <Link href="/settings" className="font-medium text-primary hover:underline">Đặt mục tiêu và ngày thi</Link> trong Cài đặt → Hồ sơ.
        </p>
      )}
    </section>
  );
}
