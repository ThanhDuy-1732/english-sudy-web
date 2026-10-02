"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { generatePlan, type PlanBlock } from "@/lib/plan/generate-plan";
import { getWordsForReview } from "@/lib/storage";
import { getAttempts, getExamSettings } from "@/lib/exam/exam-storage";
import { getMistakes as getUnifiedMistakes } from "@/lib/mistakes";
import { recomputeMastery } from "@/lib/mastery-all";
import { localDateKey } from "@/lib/date";

const BUDGET_OPTIONS = [15, 30, 60] as const;

const KIND_EMOJI: Record<PlanBlock["kind"], string> = {
  srs_review: "🔄",
  new_words: "✨",
  exam_drill: "📝",
  speaking: "🎤",
  writing: "📖",
  grammar: "📚",
  mistakes: "🔍",
};

const KIND_COLOR: Record<PlanBlock["kind"], string> = {
  srs_review: "#0d6efd",
  new_words: "#6610f2",
  exam_drill: "#fd7e14",
  speaking: "#20c997",
  writing: "#6f42c1",
  grammar: "#0dcaf0",
  mistakes: "#dc3545",
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

  return (
    <div className="today-page">
      <h1>Hôm nay học gì?</h1>
      <p className="subtitle">
        Kế hoạch học tự động dựa trên điểm yếu và nợ ôn tập của bạn.
      </p>

      {!planBlocks ? (
        <div className="setup">
          <p className="setup-label">Bạn có bao nhiêu thời gian hôm nay?</p>
          <div className="budget-selector">
            {BUDGET_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => setBudget(b)}
                className={budget === b ? "active" : ""}
              >
                {b} phút
              </button>
            ))}
          </div>
          <button onClick={buildPlan} className="generate-btn">
            🎯 Tạo kế hoạch
          </button>
        </div>
      ) : (
        <>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : "0%" }}
            />
          </div>
          <p className="progress-text">
            {doneCount}/{totalCount} hoàn thành
          </p>

          <div className="plan-blocks">
            {planBlocks.map((block) => (
              <div
                key={block.id}
                className={`plan-block ${block.done ? "done" : ""}`}
                style={{ "--accent": KIND_COLOR[block.kind] } as React.CSSProperties}
              >
                <div className="block-icon">{KIND_EMOJI[block.kind]}</div>
                <div className="block-content">
                  <p className="block-title">{block.title}</p>
                  <p className="block-reason">{block.reason}</p>
                  <p className="block-time">~{block.estimatedMin} phút</p>
                </div>
                <div className="block-actions">
                  {!block.done ? (
                    <>
                      <Link href={block.href} className="go-btn">
                        Bắt đầu →
                      </Link>
                      <button onClick={() => markDone(block.id)} className="done-btn">
                        ✓
                      </button>
                    </>
                  ) : (
                    <span className="done-label">✅ Xong</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setPlanBlocks(null);
              localStorage.removeItem("dailyPlan");
            }}
            className="regenerate-btn"
          >
            🔄 Tạo lại kế hoạch
          </button>
        </>
      )}

      <style jsx>{`
        .today-page { max-width: 640px; margin: 0 auto; padding: 1.5rem; }
        h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
        .subtitle { color: #6c757d; font-size: 0.9rem; margin-bottom: 1.5rem; }
        .setup { text-align: center; padding: 2rem; }
        .setup-label { font-size: 1rem; margin-bottom: 1rem; }
        .budget-selector { display: flex; justify-content: center; gap: 0.75rem; margin-bottom: 1.5rem; }
        .budget-selector button { color: #212529; padding: 0.6rem 1.5rem; border: 2px solid #dee2e6; border-radius: 20px; background: white; cursor: pointer; font-size: 0.95rem; }
        .budget-selector button.active { border-color: #0d6efd; background: #0d6efd; color: white; font-weight: 700; }
        .generate-btn { padding: 0.875rem 2rem; background: #0d6efd; color: white; border: none; border-radius: 10px; font-size: 1rem; cursor: pointer; }
        .generate-btn:hover { background: #0b5ed7; }
        .progress-bar-container { height: 6px; background: #e9ecef; border-radius: 3px; margin-bottom: 0.4rem; }
        .progress-bar { height: 100%; background: #198754; border-radius: 3px; transition: width 0.4s; }
        .progress-text { font-size: 0.8rem; color: #6c757d; margin-bottom: 1.25rem; }
        .plan-blocks { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
        .plan-block { color: #212529; display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 2px solid var(--accent, #dee2e6); border-radius: 12px; background: white; transition: opacity 0.2s; }
        .plan-block.done { opacity: 0.5; }
        .block-icon { font-size: 1.5rem; flex-shrink: 0; }
        .block-content { flex: 1; }
        .block-title { font-weight: 600; font-size: 0.95rem; margin: 0 0 0.2rem; }
        .block-reason { font-size: 0.8rem; color: #6c757d; margin: 0 0 0.15rem; }
        .block-time { font-size: 0.75rem; color: #adb5bd; margin: 0; }
        .block-actions { display: flex; gap: 0.4rem; align-items: center; flex-shrink: 0; }
        :global(.go-btn) { padding: 0.45rem 0.9rem; background: var(--accent, #0d6efd); color: white; border-radius: 8px; text-decoration: none; font-size: 0.85rem; white-space: nowrap; }
        .done-btn { color: #212529; width: 32px; height: 32px; border: 1.5px solid #dee2e6; border-radius: 50%; background: white; cursor: pointer; font-size: 0.85rem; }
        .done-btn:hover { background: #d1e7dd; border-color: #198754; }
        .done-label { font-size: 0.85rem; color: #198754; font-weight: 600; }
        .regenerate-btn { width: 100%; padding: 0.6rem; background: transparent; border: 1.5px solid #dee2e6; border-radius: 8px; cursor: pointer; font-size: 0.875rem; color: #6c757d; }
        .regenerate-btn:hover { background: #f8f9fa; }
        @media (prefers-color-scheme: dark) {
          .plan-block { background: #1a1a2e; color: #eee; }
          .budget-selector button { background: #1a1a2e; color: #eee; border-color: #444; }
        }
      `}</style>
    </div>
  );
}
