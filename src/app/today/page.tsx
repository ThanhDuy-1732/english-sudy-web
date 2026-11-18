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
import { getSessions } from "@/lib/sessions";
import { computeStreak } from "@/lib/streak";
import GardenBed from "@/components/GardenBed";

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
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null);
  useEffect(() => {
    setGoal(goalProgress(getProfile(), getAttempts()));
    const info = computeStreak(getSessions());
    setStreak({ current: info.currentStreak, longest: info.longestStreak });
  }, []);

  // Read after mount: the date and due count come from the device, not the server render.
  const [today, setToday] = useState<{ label: string; due: number } | null>(null);
  useEffect(() => {
    const label = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    setToday({ label: label.charAt(0).toUpperCase() + label.slice(1), due: getWordsForReview().length });
  }, [planBlocks]);

  return (
    <main className="page-wide">
      <p className="text-sm text-muted" suppressHydrationWarning>{today?.label ?? "\u00a0"}</p>
      <h1 className="page-title mt-1">Vườn hôm nay</h1>
      <p className="page-lead">
        {today && today.due > 0
          ? <><span className="rounded-full bg-marker px-2 py-0.5 font-semibold tabular-nums text-deep">{today.due} cây</span> đang khát nước. Kế hoạch dưới đây xếp việc quan trọng nhất lên trước.</>
          : "Kế hoạch được lập từ từ cần ôn, điểm yếu khi luyện thi và lỗi bạn hay mắc."}
      </p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="min-w-0">
      <GardenBed />

      {!planBlocks ? (
        <section aria-labelledby="budget-label" className="panel mt-6 p-5 sm:p-6">
          <p id="budget-label" className="font-medium text-ink">Hôm nay bạn có bao nhiêu thời gian?</p>
          <div className="mt-4">
            <Segmented label="Thời gian học hôm nay" value={budget} onChange={setBudget}
              options={BUDGET_OPTIONS.map((b) => ({ value: b, label: `${b} phút` }))} />
          </div>
          <div className="mt-6">
            <button type="button" onClick={buildPlan} className="btn btn-primary min-h-12 px-7">
              Lập kế hoạch
            </button>
          </div>
        </section>
      ) : (
        <section aria-label="Kế hoạch hôm nay" className="mt-6">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-muted">
              <span className="font-semibold tabular-nums text-ink">{doneCount}/{totalCount}</span> việc xong
              {minutesLeft > 0 && <>, còn khoảng <span className="tabular-nums">{minutesLeft}</span> phút</>}
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

          <ol className="mt-4 grid gap-2.5">
            {planBlocks.map((block) => (
              <li key={block.id} className="panel flex items-start gap-4 px-4 py-4 sm:px-5">
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
                  <p className="mt-1 text-xs text-muted">{KIND_LABEL[block.kind]}, khoảng {block.estimatedMin} phút</p>
                </div>
                {!block.done && (
                  <Link href={block.href} className="btn btn-secondary shrink-0 self-center text-sm">
                    Bắt đầu
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      </div>

      <aside className="grid min-w-0 gap-4">
        {streak && (
          <section aria-label="Chuỗi ngày học" className="panel flex items-center gap-4 p-5">
            <svg aria-hidden="true" viewBox="0 0 64 64" width="60" height="60" className="shrink-0">
              <path d="M14 26h28v22a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" fill="#1f8a50" />
              <path d="M42 32l14-10 3 4-14 12z" fill="#1f8a50" />
              <path d="M20 26c0-8 4-12 8-12s8 4 8 12" fill="none" stroke="#146b3c" strokeWidth="4" />
              <g fill="#ffc93c"><circle cx="58" cy="34" r="2.5" /><circle cx="60" cy="42" r="2.5" /><circle cx="55" cy="40" r="2" /></g>
            </svg>
            <div>
              <p className="font-display text-3xl font-extrabold leading-none text-ink">{streak.current} ngày</p>
              <p className="mt-1 text-sm text-muted">
                {streak.current > 0 ? "tưới vườn liên tục." : "Tưới vườn hôm nay để bắt đầu chuỗi ngày học."}
                {streak.longest > streak.current && ` Kỷ lục của bạn: ${streak.longest} ngày.`}
              </p>
            </div>
          </section>
        )}
        {goal && <GoalCard goal={goal} />}
        <section aria-label="Gieo hạt mới" className="rounded-3xl bg-warn-soft p-5">
          <h2 className="section-title">Gieo hạt mới</h2>
          <p className="mt-0.5 text-sm text-muted">Mỗi ngày gieo vài từ, vườn sẽ lớn dần.</p>
          <Link href="/" className="btn btn-primary mt-3">Gieo 5 từ mới</Link>
        </section>
      </aside>
      </div>
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
    <section aria-label="Mục tiêu kỳ thi" className="panel p-5">
      {goal.target ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="section-title">Cây mục tiêu {goal.exam} {goal.exam === "TOEIC" ? goal.target : `band ${goal.target}`}</h2>
            {goal.daysLeft !== undefined && (
              <p className="text-sm text-muted">
                {goal.daysLeft > 0 ? <>Còn <span className="font-semibold tabular-nums text-ink">{goal.daysLeft} ngày</span> đến ngày thi</> : goal.daysLeft === 0 ? "Hôm nay là ngày thi" : "Ngày thi đã qua"}
              </p>
            )}
          </div>
          {goal.latest ? (
            <>
              <div className="mt-4 flex items-end gap-4">
                {/* The goal tree: grows towards the red line, the target score. */}
                <div className="relative h-32 w-8 shrink-0 overflow-hidden rounded-full bg-primary-soft" role="progressbar" aria-label="Điểm ước lượng so với mục tiêu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                  <div className={`absolute inset-x-0 bottom-0 rounded-full ${goal.gap === 0 ? "bg-ok" : "bg-gradient-to-b from-[#43b874] to-primary"}`} style={{ height: `${Math.max(percent, 4)}%` }} />
                  <div className="absolute inset-x-1 top-1.5 h-[3px] rounded bg-margin" />
                </div>
                <div>
                  <p className="font-display text-4xl font-extrabold leading-none text-ink">{goal.latest.score}</p>
                  <p className="text-sm text-muted">điểm ước lượng, thi thử {new Date(goal.latest.at).toLocaleDateString("vi-VN")}</p>
                  <p className="mt-2 text-sm text-ink">{goal.gap ? `Còn thiếu ${goal.exam === "TOEIC" ? `${goal.gap} điểm` : `${goal.gap} band`}. Vạch đỏ là mục tiêu.` : "Đã đạt mục tiêu."}</p>
                </div>
              </div>
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
