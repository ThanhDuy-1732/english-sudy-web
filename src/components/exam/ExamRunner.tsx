"use client";

import { useReducer, useCallback, useEffect, useRef, useState } from "react";
import type { ExamItem, ExamQuestion, AnswerRecord, ExamAttempt, ExamPart, ExamKind } from "@/lib/exam/types";
import { saveAttempt, addMistake, addItemToBank } from "@/lib/exam/exam-storage";
import { pushExamItem } from "@/lib/sync";
import { computeScore, isCompletionCorrect } from "@/lib/exam/scoring";
import { recordTagResult } from "@/lib/exam/exam-tags";
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
  forceComplete,
}: Props) {
  const timer = useTimer();
  const savedRef = useRef(false);
  const [reporting, setReporting] = useState<{ questionId: string; itemId: string } | null>(null);

  const [state, dispatch] = useReducer(reducer, {
    phase: preloadedItems ? "ready" : "loading",
    items: preloadedItems ?? [],
    flatQuestions: preloadedItems ? flatten(preloadedItems) : [],
    cursor: 0,
    answers: {},
    flags: new Set<string>(),
    startedAt: Date.now(),
    perQuestionStart: Date.now(),
    attemptId: crypto.randomUUID(),
  });

  // Load items from API if not preloaded
  useEffect(() => {
    if (preloadedItems || state.phase !== "loading") return;
    let cancelled = false;

    async function loadItems() {
      const fetched: ExamItem[] = [];
      for (const part of parts) {
        const res = await fetch("/api/exam/generate-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, part, level, topic }),
        });
        if (!res.ok) continue;
        const item = await res.json();
        if (item.id) {
          fetched.push(item);
          addItemToBank(item);
          pushExamItem(item);
        }
      }
      if (cancelled) return;
      if (fetched.length > 0) {
        dispatch({ type: "LOAD_ITEMS", items: fetched });
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
          .spinner { margin: 1rem auto; width: 32px; height: 32px; border: 3px solid #dee2e6; border-top-color: #0d6efd; border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="runner-error">
        <p>⚠️ Không thể tải câu hỏi. Kiểm tra kết nối và thử lại.</p>
        <button onClick={() => window.location.reload()}>Thử lại</button>
        <style jsx>{`
          .runner-error { text-align: center; padding: 3rem; }
          .runner-error p { color: #856404; margin-bottom: 1rem; }
          .runner-error button { padding: 0.5rem 1.5rem; background: #0d6efd; color: white; border: none; border-radius: 8px; cursor: pointer; }
        `}</style>
      </div>
    );
  }

  if (state.phase === "ready") {
    return (
      <div className="runner-ready">
        <h2>Sẵn sàng chưa?</h2>
        <p>{state.flatQuestions.length} câu hỏi · {parts.join(", ")}</p>
        <button onClick={() => dispatch({ type: "START" })} className="start-btn">
          Bắt đầu
        </button>
        <style jsx>{`
          .runner-ready { text-align: center; padding: 3rem; }
          .start-btn { padding: 0.75rem 2rem; background: #0d6efd; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
          .start-btn:hover { background: #0b5ed7; }
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
        <h2>✅ Hoàn thành!</h2>
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
            {state.flags.has(current.q.id) ? "🚩 Đã đánh dấu" : "🚩 Đánh dấu"}
          </button>
          <button
            onClick={() => setReporting({ questionId: current.q.id, itemId: current.item.id })}
            className="report-btn"
          >
            ⚑ Báo cáo
          </button>
        </div>
        <button
          onClick={handleNext}
          disabled={!answered}
          className="next-btn"
        >
          {state.cursor + 1 >= state.flatQuestions.length ? "Xem kết quả" : "Tiếp →"}
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
        .next-btn { padding: 0.6rem 1.5rem; background: #0d6efd; color: white; border: none; border-radius: 6px; font-size: 0.95rem; cursor: pointer; }
        .next-btn:disabled { background: #adb5bd; cursor: not-allowed; }
        .next-btn:hover:not(:disabled) { background: #0b5ed7; }
        .flag-btn { padding: 0.5rem 1rem; background: transparent; border: 1.5px solid #dee2e6; border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
        .flag-btn.flagged { border-color: #ffc107; background: #fff3cd; }
        .report-btn { padding: 0.5rem 1rem; background: transparent; border: 1.5px solid #dee2e6; border-radius: 6px; font-size: 0.85rem; cursor: pointer; color: #6c757d; }
        .report-btn:hover { border-color: #adb5bd; color: #495057; }
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
        .score { font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem; }
        .review-list { display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem; }
        .done-btn { width: 100%; padding: 0.75rem; background: #198754; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
        .done-btn:hover { background: #157347; }
      `}</style>
    </div>
  );
}
