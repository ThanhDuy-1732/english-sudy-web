"use client";

import { useReducer, useCallback, useEffect, useRef, useState } from "react";
import type { ExamItem, ExamQuestion, AnswerRecord, ExamAttempt, ExamPart, ExamKind } from "@/lib/exam/types";
import { saveAttempt, addMistake, addItemToBank, getItemsFromBank, takeUnseenBankItem } from "@/lib/exam/exam-storage";
import { computeScore, isCompletionCorrect, withJudgementOptions } from "@/lib/exam/scoring";
import { recordTagResult } from "@/lib/exam/exam-tags";
import { getProfile } from "@/lib/profile";
import { useTimer } from "@/contexts/TimerContext";
import QuestionCard from "./QuestionCard";
import ReportQuestionModal from "./ReportQuestionModal";

type RunnerState = {
  phase: "loading" | "ready" | "running" | "reviewing" | "done" | "error";
  items: ExamItem[];
  flatQuestions: { item: ExamItem; q: ExamQuestion }[];
  cursor: number;
  answers: Record<string, string>; // questionId → userAnswer
  flags: Set<string>;
  startedAt: number;
  perQuestionStart: number;
  attemptId: string;
};

type RunnerAction =
  | { type: "LOAD_ITEMS"; items: ExamItem[] }
  | { type: "START" }
  | { type: "ANSWER"; questionId: string; answer: string }
  | { type: "NEXT" }
  | { type: "FLAG"; questionId: string }
  | { type: "FINISH" }
  | { type: "LOADING_ERROR" }
  | { type: "FORCE_COMPLETE" };

function flatten(items: ExamItem[]): { item: ExamItem; q: ExamQuestion }[] {
  return items.flatMap((item) => item.questions.map((q) => ({ item, q })));
}

function reducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case "LOAD_ITEMS": {
      const flatQuestions = flatten(action.items);
      return {
        ...state,
        phase: "ready",
        items: action.items,
        flatQuestions,
      };
    }
    case "START":
      return {
        ...state,
        phase: "running",
        startedAt: Date.now(),
        perQuestionStart: Date.now(),
      };
    case "ANSWER":
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: action.answer },
      };
    case "NEXT": {
      const nextCursor = state.cursor + 1;
      if (nextCursor >= state.flatQuestions.length) {
        return { ...state, phase: "reviewing" };
      }
      return { ...state, cursor: nextCursor, perQuestionStart: Date.now() };
    }
    case "FLAG": {
      const flags = new Set(state.flags);
      flags.has(action.questionId) ? flags.delete(action.questionId) : flags.add(action.questionId);
      return { ...state, flags };
    }
    case "FINISH":
      return { ...state, phase: "done" };
    case "LOADING_ERROR":
      return { ...state, phase: "error" };
    case "FORCE_COMPLETE":
      return { ...state, phase: "reviewing" };
    default:
      return state;
  }
}

interface Props {
  kind: ExamKind;
  parts: ExamPart[];
  mode: "drill" | "mock";
  level: 1 | 2 | 3 | 4 | 5;
  topic?: string;
  preloadedItems?: ExamItem[];
  onComplete?: (attempt: ExamAttempt, sessionTags?: string[]) => void;
  onRunning?: () => void; // fires once when the user starts answering
  forceComplete?: boolean; // when true, finish with current answers (e.g. timer expired)
}

export default function ExamRunner({
  kind,
  parts,
  mode,
  level,
  topic,
  preloadedItems,
  onComplete,
  onRunning,
  forceComplete,
}: Props) {
  const timer = useTimer();
  const savedRef = useRef(false);
  const [reporting, setReporting] = useState<{ questionId: string; itemId: string } | null>(null);
  // Parts whose fresh generation failed: served from the local bank, or left out of this test.
  const [fallback, setFallback] = useState<{ bank: ExamPart[]; missing: ExamPart[] }>({ bank: [], missing: [] });

  const [state, dispatch] = useReducer(reducer, {
    phase: preloadedItems ? "ready" : "loading",
    items: preloadedItems?.map(withJudgementOptions) ?? [],
    flatQuestions: preloadedItems ? flatten(preloadedItems.map(withJudgementOptions)) : [],
    cursor: 0,
    answers: {},
    flags: new Set<string>(),
    startedAt: Date.now(),
    perQuestionStart: Date.now(),
    attemptId: crypto.randomUUID(),
  });

  const onRunningRef = useRef(onRunning);
  onRunningRef.current = onRunning;
  useEffect(() => {
    if (state.phase === "running") onRunningRef.current?.();
  }, [state.phase]);

  // Load items from API if not preloaded
  useEffect(() => {
    if (preloadedItems || state.phase !== "loading") return;
    let cancelled = false;

    async function generate(part: ExamPart): Promise<ExamItem> {
      if (!navigator.onLine) throw new Error("offline");
      const res = await fetch("/api/exam/generate-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, part, level, topic }),
      });
      if (!res.ok) throw new Error("generation failed");
      const item = await res.json();
      if (!item.id || !Array.isArray(item.questions)) throw new Error("invalid item");
      addItemToBank(item);
      return item;
    }

    // Generating an item takes ~8 s, so keep one unseen item banked per part:
    // this session uses it instantly and a background call refills the bank for the next one.
    // ponytail: refills one item per part per session; topic drills skip the bank since items are topic-specific.
    function refill(part: ExamPart) {
      if (!topic && navigator.onLine) generate(part).catch(() => {});
    }

    async function loadPart(part: ExamPart): Promise<ExamItem | undefined> {
      const ready = !topic ? takeUnseenBankItem(kind, part, level) : undefined;
      if (ready) {
        refill(part);
        return ready;
      }
      try {
        const item = await generate(part);
        refill(part);
        return item;
      } catch {
        // Only reuse the general bank when no specific topic was requested.
        const banked = !topic ? getItemsFromBank(kind, part, level)[0] : undefined;
        if (!cancelled) {
          setFallback((f) => (banked ? { ...f, bank: [...f.bank, part] } : { ...f, missing: [...f.missing, part] }));
        }
        return banked;
      }
    }

    async function loadItems() {
      // Parts load in parallel; a mock test used to wait for each part in turn.
      const loaded = await Promise.all(parts.map(loadPart));
      if (cancelled) return;
      const fetched = loaded.filter((item): item is ExamItem => item !== undefined);
      if (fetched.length > 0) {
        dispatch({ type: "LOAD_ITEMS", items: fetched.map(withJudgementOptions) });
      } else {
        dispatch({ type: "LOADING_ERROR" });
      }
    }

    loadItems();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Force completion when timer expires (mock mode)
  useEffect(() => {
    if (!forceComplete) return;
    if (state.phase === "reviewing" || state.phase === "done" || state.phase === "error") return;
    dispatch({ type: "FORCE_COMPLETE" });
  }, [forceComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // Study timer integration — resume on mount, pause on unmount
  useEffect(() => {
    timer.resume();
    return () => { timer.pause(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = state.flatQuestions[state.cursor];

  const handleAnswer = useCallback((answer: string) => {
    if (!current) return;
    dispatch({ type: "ANSWER", questionId: current.q.id, answer });
  }, [current]);

  const handleNext = useCallback(() => {
    dispatch({ type: "NEXT" });
  }, []);

  // Keyboard shortcuts: 1–4 select MCQ option, Enter advances
  useEffect(() => {
    if (state.phase !== "running") return;
    if (!getProfile().shortcutsEnabled) return;

    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const c = state.flatQuestions[state.cursor];
      if (!c) return;
      if (["1","2","3","4"].includes(e.key)) {
        const idx = Number(e.key) - 1;
        const opt = c.q.options?.[idx];
        if (opt) handleAnswer(opt);
      }
      if (e.key === "Enter") {
        const answered = state.answers[c.q.id] !== undefined && state.answers[c.q.id] !== "";
        if (answered) handleNext();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [state.phase, state.cursor, state.answers, state.flatQuestions, handleAnswer, handleNext]);

  // Build and save attempt when done
  useEffect(() => {
    if (state.phase !== "reviewing" || savedRef.current) return;
    savedRef.current = true;

    const answerRecords: AnswerRecord[] = state.flatQuestions.map(({ item, q }) => {
      const userAnswer = state.answers[q.id] ?? "";
      const correct = q.options
        ? userAnswer === q.answer
        : isCompletionCorrect(userAnswer, q);

      return {
        itemId: item.id,
        questionId: q.id,
        type: q.type,
        part: item.part,
        userAnswer,
        correct,
        timeSpentSec: 0, // simplified; per-question timing can be added
        flagged: state.flags.has(q.id),
      };
    });

    const sessionTagsSet = new Set<string>();

    // Save mistakes + record tag results
    answerRecords.forEach((r) => {
      const { item, q } = state.flatQuestions.find((f) => f.q.id === r.questionId)!;
      q.tags?.forEach((tag) => {
        sessionTagsSet.add(tag);
        recordTagResult(tag, r.correct);
      });
      if (!r.correct) {
        addMistake({
          id: crypto.randomUUID(),
          questionId: q.id,
          itemId: item.id,
          type: q.type,
          part: item.part,
          prompt: q.prompt,
          userAnswer: r.userAnswer,
          correctAnswer: q.answer,
          explanation: q.explanation,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          resolved: false,
        });
      }
    });

    const attempt: ExamAttempt = {
      id: state.attemptId,
      kind,
      mode,
      parts,
      startedAt: new Date(state.startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      answers: answerRecords,
      score: computeScore(answerRecords, kind, parts),
    };

    saveAttempt(attempt);
    onComplete?.(attempt, sessionTagsSet.size > 0 ? Array.from(sessionTagsSet) : undefined);
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.phase === "loading") {
    return (
      <div className="runner-loading">
        <p>Đang tạo câu hỏi…</p>
        <div className="spinner" />
        <style jsx>{`
          .runner-loading { text-align: center; padding: 3rem; }
          .spinner { margin: 1rem auto; width: 32px; height: 32px; border: 3px solid rgb(var(--rule)); border-top-color: rgb(var(--primary)); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="runner-error">
        <p>Không thể tải câu hỏi. Kiểm tra kết nối và thử lại.</p>
        <button onClick={() => window.location.reload()}>Thử lại</button>
        <style jsx>{`
          .runner-error { text-align: center; padding: 3rem; }
          .runner-error p { color: rgb(var(--ink)); margin-bottom: 1rem; }
          .runner-error button { padding: 0.5rem 1.5rem; background: rgb(var(--primary)); color: white; border: none; border-radius: 999px; min-height: 44px; cursor: pointer; }
        `}</style>
      </div>
    );
  }

  if (state.phase === "ready") {
    return (
      <div className="runner-ready">
        <h2>Sẵn sàng chưa?</h2>
        <p>{state.flatQuestions.length} câu hỏi · {parts.join(", ")}</p>
        {(fallback.bank.length > 0 || fallback.missing.length > 0) && (
          <p role="status" className="fallback-note">
            Không tạo được câu mới cho {[...fallback.bank, ...fallback.missing].join(", ")}.
            {fallback.bank.length > 0 && ` Đã dùng câu đã lưu cho ${fallback.bank.join(", ")}.`}
            {fallback.missing.length > 0 && ` Bài này bỏ qua ${fallback.missing.join(", ")}.`}
          </p>
        )}
        <button onClick={() => dispatch({ type: "START" })} className="start-btn">
          Bắt đầu
        </button>
        <style jsx>{`
          .runner-ready { text-align: center; padding: 3rem; }
          .fallback-note { margin: 0.75rem auto 0; max-width: 32rem; font-size: 0.875rem; color: rgb(var(--margin)); }
          .start-btn { padding: 0.75rem 2rem; background: rgb(var(--primary)); color: white; border: none; border-radius: 999px; min-height: 44px; font-size: 1rem; cursor: pointer; }
          .start-btn:hover { background: rgb(var(--primary-strong)); }
        `}</style>
      </div>
    );
  }

  // In mock mode, MockPage shows its own result screen — skip ReviewSummary to avoid flicker
  if (state.phase === "reviewing" && mode === "mock") {
    return null;
  }

  if (state.phase === "reviewing") {
    return (
      <ReviewSummary
        flatQuestions={state.flatQuestions}
        answers={state.answers}
        onDone={() => dispatch({ type: "FINISH" })}
      />
    );
  }

  if (state.phase === "done") {
    return (
      <div className="runner-done">
        <h2>Đã làm xong</h2>
        <p>Kết quả đã được lưu.</p>
        <style jsx>{`
          .runner-done { text-align: center; padding: 3rem; }
        `}</style>
      </div>
    );
  }

  // Running
  if (!current) return null;
  const userAnswer = state.answers[current.q.id];
  const answered = userAnswer !== undefined && userAnswer !== "";

  return (
    <div className="runner">
      <QuestionCard
        item={current.item}
        question={current.q}
        questionNumber={state.cursor + 1}
        totalQuestions={state.flatQuestions.length}
        userAnswer={userAnswer}
        showResult={false}
        onAnswer={handleAnswer}
      />
      <div className="runner-controls">
        <div className="controls-left">
          <button
            onClick={() => dispatch({ type: "FLAG", questionId: current.q.id })}
            className={`flag-btn ${state.flags.has(current.q.id) ? "flagged" : ""}`}
          >
            {state.flags.has(current.q.id) ? "Đã đánh dấu xem lại" : "Đánh dấu xem lại"}
          </button>
          <button
            onClick={() => setReporting({ questionId: current.q.id, itemId: current.item.id })}
            className="report-btn"
          >
            Báo câu hỏi lỗi
          </button>
        </div>
        <button
          onClick={handleNext}
          disabled={!answered}
          className="next-btn"
        >
          {state.cursor + 1 >= state.flatQuestions.length ? "Xem kết quả" : "Câu tiếp"}
        </button>
      </div>
      {reporting && (
        <ReportQuestionModal
          questionId={reporting.questionId}
          itemId={reporting.itemId}
          onClose={() => setReporting(null)}
        />
      )}
      <style jsx>{`
        .runner-controls { display: flex; justify-content: space-between; align-items: center; max-width: 720px; margin: 1rem auto; padding: 0 1.5rem; }
        .controls-left { display: flex; gap: 0.5rem; }
        .next-btn { padding: 0.6rem 1.5rem; background: rgb(var(--primary)); color: white; border: none; border-radius: 999px; min-height: 44px; font-size: 0.95rem; cursor: pointer; }
        .next-btn:disabled { background: rgb(var(--muted)); cursor: not-allowed; }
        .next-btn:hover:not(:disabled) { background: rgb(var(--primary-strong)); }
        .flag-btn { padding: 0.5rem 1rem; background: transparent; border: 1.5px solid rgb(var(--rule)); border-radius: 999px; min-height: 44px; font-size: 0.85rem; cursor: pointer; }
        .flag-btn.flagged { border-color: rgb(var(--warn)); background: rgb(var(--warn-soft)); }
        .report-btn { padding: 0.5rem 1rem; background: transparent; border: 1.5px solid rgb(var(--rule)); border-radius: 999px; min-height: 44px; font-size: 0.85rem; cursor: pointer; color: rgb(var(--muted)); }
        .report-btn:hover { border-color: rgb(var(--muted)); color: rgb(var(--muted)); }
      `}</style>
    </div>
  );
}

function ReviewSummary({
  flatQuestions,
  answers,
  onDone,
}: {
  flatQuestions: { item: ExamItem; q: ExamQuestion }[];
  answers: Record<string, string>;
  onDone: () => void;
}) {
  const correct = flatQuestions.filter(({ q }) => {
    const ua = answers[q.id] ?? "";
    return q.options ? ua === q.answer : isCompletionCorrect(ua, q);
  }).length;

  return (
    <div className="review-summary">
      <h2>Tổng kết</h2>
      <p className="score">
        {correct} / {flatQuestions.length} câu đúng (
        {Math.round((correct / flatQuestions.length) * 100)}%)
      </p>
      <div className="review-list">
        {flatQuestions.map(({ item, q }, i) => {
          const ua = answers[q.id] ?? "";
          const ok = q.options ? ua === q.answer : isCompletionCorrect(ua, q);
          return (
            <QuestionCard
              key={q.id}
              item={item}
              question={q}
              questionNumber={i + 1}
              totalQuestions={flatQuestions.length}
              userAnswer={ua}
              showResult
              onAnswer={() => {}}
            />
          );
        })}
      </div>
      <button onClick={onDone} className="done-btn">Hoàn tất</button>
      <style jsx>{`
        .review-summary { max-width: 720px; margin: 0 auto; padding: 1.5rem; }
        .score { font-family: var(--font-display); font-size: 1.6rem; font-weight: 800; margin-bottom: 1.5rem; }
        .review-list { display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem; }
        .done-btn { width: 100%; padding: 0.75rem; background: rgb(var(--primary)); color: white; border: none; border-radius: 999px; min-height: 44px; font-size: 1rem; cursor: pointer; }
        .done-btn:hover { background: rgb(var(--ok)); }
      `}</style>
    </div>
  );
}
