"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { startSession, finishSession } from "@/lib/sessions";
import { recordGrammarAttempt, getWeakSubRules } from "@/lib/grammar-progress";
import { getBookmarks } from "@/lib/grammar-bookmarks";
import { addMistake } from "@/lib/mistakes";
import { getAllGrammarTopics } from "@/lib/grammar-storage";

type QuizMode = "all" | "weak" | "bookmarks";
type Phase = "setup" | "quiz" | "done";

interface QuizItem {
  topicId: string;
  subRuleId: string;
  topicName: string;
  subRuleName: string;
  explanation?: string;
}

interface QuizQuestion extends QuizItem {
  question: { type: string; question: string; options?: string[]; answer: string };
}

interface QuizResult {
  question: QuizQuestion;
  userAnswer: string;
  correct: boolean;
}

function selectItems(mode: QuizMode, count: number): QuizItem[] {
  const allTopics = getAllGrammarTopics();
  let pool: QuizItem[] = [];

  if (mode === "weak") {
    const weak = getWeakSubRules(70).slice(0, count * 2);
    pool = weak.map((w) => {
      const topic = allTopics.find((t) => t.id === w.topicId);
      const rule = topic?.rules?.find((r) => r.id === w.subRuleId);
      if (!topic || !rule) return null;
      return { topicId: w.topicId, subRuleId: w.subRuleId, topicName: topic.name, subRuleName: rule.name, explanation: rule.explanation };
    }).filter(Boolean) as QuizItem[];
  } else if (mode === "bookmarks") {
    const bm = getBookmarks();
    pool = bm.map((b) => {
      const topic = allTopics.find((t) => t.id === b.topicId);
      const rule = topic?.rules?.find((r) => r.id === b.subRuleId);
      if (!topic || !rule) return null;
      return { topicId: b.topicId, subRuleId: b.subRuleId, topicName: topic.name, subRuleName: rule.name, explanation: rule.explanation };
    }).filter(Boolean) as QuizItem[];
  } else {
    for (const topic of allTopics) {
      for (const rule of topic.rules ?? []) {
        pool.push({ topicId: topic.id, subRuleId: rule.id, topicName: topic.name, subRuleName: rule.name, explanation: rule.explanation });
      }
    }
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export default function GrammarQuizPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<QuizMode>("all");
  const [pool, setPool] = useState<QuizItem[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState(false);
  const inflight = useRef(new Set<number>());
  const sessionId = useRef<string | null>(null);

  async function fetchQuestion(item: QuizItem): Promise<QuizQuestion> {
    const res = await fetch("/api/grammar-exercise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: item.topicName, subRule: item.subRuleName }),
    });
    const q = await res.json() as { type: string; question: string; options?: string[]; answer: string };
    if (!res.ok || typeof q.question !== "string" || typeof q.answer !== "string") throw new Error("invalid question");
    return { ...item, question: q };
  }

  // Loads pool[index] into questions[index]; used for prefetching and as the fallback when a prefetch failed.
  function loadQuestion(index: number, items = pool) {
    if (!items[index] || inflight.current.has(index)) return;
    inflight.current.add(index);
    fetchQuestion(items[index])
      .then((q) => setQuestions((prev) => { const next = [...prev]; next[index] = q; return next; }))
      .catch(() => { if (index === current) setQuestionError(true); })
      .finally(() => inflight.current.delete(index));
  }

  // If the question on screen is missing (e.g. its prefetch failed), fetch it now.
  useEffect(() => {
    if (phase === "quiz" && !questions[current]) loadQuestion(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current, questions]);

  async function startQuiz() {
    setError(null);
    const items = selectItems(mode, count);
    if (items.length === 0) {
      setError(mode === "weak"
        ? "Chưa có điểm yếu: cần ít nhất 3 lượt trả lời cho cùng một quy tắc với độ chính xác dưới 70%. Hãy thử chế độ \"Tất cả\"."
        : mode === "bookmarks"
          ? "Bạn chưa lưu quy tắc nào. Hãy lưu quy tắc ở trang Ngữ pháp trước, hoặc thử chế độ \"Tất cả\"."
          : "Không đủ nội dung cho chế độ này. Hãy thử chế độ khác.");
      return;
    }
    setLoading(true);
    let first: QuizQuestion;
    try {
      first = await fetchQuestion(items[0]);
    } catch {
      setLoading(false);
      setError("Không thể tạo câu hỏi lúc này. Vui lòng thử lại.");
      return;
    }
    setQuestionError(false);
    inflight.current.clear();
    setPool(items);
    setQuestions([first]);
    sessionId.current = startSession("grammar");
    setPhase("quiz");
    setCurrent(0);
    setResults([]);
    setSelected(null);
    setLoading(false);
    // Prefetch next question in background
    if (items.length > 1) loadQuestion(1, items);
  }

  function handleAnswer(answer: string) {
    if (selected !== null) return;
    setSelected(answer);
    const q = questions[current];
    const correct = answer.trim().toLowerCase() === q.question.answer.trim().toLowerCase();
    recordGrammarAttempt({ topicId: q.topicId, subRuleId: q.subRuleId, correct });
    if (!correct) {
      addMistake({
        skill: "grammar",
        category: q.subRuleId,
        source: `grammar:${q.topicId}`,
        userAnswer: answer,
        correctAnswer: q.question.answer,
        explanation: `${q.topicName} — ${q.subRuleName}`,
      });
    }
    setResults((prev) => [...prev, { question: q, userAnswer: answer, correct }]);
  }

  async function handleNext() {
    const next = current + 1;
    if (next >= count) {
      if (sessionId.current) {
        finishSession(sessionId.current, {
          totalItems: results.length + 1,
          correctItems: results.filter((r) => r.correct).length + (selected === questions[current]?.question.answer ? 1 : 0),
        });
      }
      setPhase("done");
      return;
    }
    setSelected(null);
    setQuestionError(false);
    setCurrent(next);
    // Prefetch the question after next if not already loaded
    if (!questions[next + 1]) loadQuestion(next + 1);
  }

  if (phase === "setup") {
    return (
      <main className="page">
        <h1 className="page-title mb-6">Quiz Ngữ pháp</h1>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Số câu</p>
            <div className="flex gap-2">
              {([5, 10, 20] as const).map((n) => (
                <button key={n} onClick={() => setCount(n)}
                  aria-pressed={count === n} className={`chip min-w-14 ${count === n ? "chip-on" : ""}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Chủ đề</p>
            <div className="flex gap-2 flex-wrap">
              {([["all", "Tất cả"], ["weak", "Điểm yếu"], ["bookmarks", "Đã lưu"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setMode(v)}
                  aria-pressed={mode === v} className={`chip ${mode === v ? "chip-on" : ""}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-margin">{error}</p>}
          <button onClick={startQuiz} disabled={loading}
            className="btn btn-primary w-full">
            {loading ? "Đang tải..." : "Bắt đầu"}
          </button>
          <Link href="/grammar" className="back-link mt-2">← Quay lại ngữ pháp</Link>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    const correct = results.filter((r) => r.correct).length;
    const worstCounts = results
      .filter((r) => !r.correct)
      .reduce<Record<string, string>>((acc, r) => {
        acc[r.question.subRuleId] = r.question.subRuleName;
        return acc;
      }, {});
    const topWeak = Object.keys(worstCounts)[0];
    return (
      <main className="page">
        <h1 className="page-title mb-2">Kết quả</h1>
        <p className="mb-1 font-display text-5xl font-extrabold tabular-nums text-primary-text">{correct}/{results.length}</p>
        <p className="mb-8 text-muted">{Math.round((correct / results.length) * 100)}% chính xác</p>
        {topWeak && (
          <Link
            href={`/exam/drill/RC5?topic=${encodeURIComponent(worstCounts[topWeak])}&grammarSlug=${encodeURIComponent(topWeak)}`}
            className="btn mb-4 mt-2 bg-marker font-semibold text-deep hover:brightness-95">
            Luyện tiếp trong TOEIC RC5
          </Link>
        )}
        <div className="flex gap-3">
          <button onClick={() => setPhase("setup")} className="btn btn-primary">Làm lại</button>
          <Link href="/grammar" className="btn btn-secondary">Quay lại</Link>
        </div>
      </main>
    );
  }

  const currentQ = questions[current];
  if (!currentQ) {
    return questionError ? (
      <main className="page">
        <p role="alert" className="mb-4">Không thể tải câu hỏi. Vui lòng thử lại.</p>
        <button onClick={() => { setQuestionError(false); loadQuestion(current); }} className="btn btn-primary">Thử lại</button>
      </main>
    ) : <p className="p-4 text-center">Đang tải câu hỏi...</p>;
  }

  return (
    <main className="page">
      <div className="mb-4 flex justify-between gap-3 text-sm text-muted">
        <span>{currentQ.topicName} — {currentQ.subRuleName}</span>
        <span>{current + 1}/{count}</span>
      </div>
      <p className="postcard mb-5 px-6 py-8 font-en text-xl leading-relaxed">{currentQ.question.question}</p>
      <div className="space-y-2">
        {(currentQ.question.options ?? [currentQ.question.answer]).map((opt) => {
          const isCorrect = opt === currentQ.question.answer;
          const isSelected = opt === selected;
          const cls = `choice font-en ${selected === null ? "" : isCorrect ? "choice-right" : isSelected ? "choice-wrong" : "choice-dim"}`;
          return (
            <button key={opt} onClick={() => handleAnswer(opt)} className={cls} disabled={selected !== null && !isCorrect && !isSelected}>
              {opt}
              {selected !== null && (isCorrect || isSelected) && (
                <span className="ml-2 font-sans text-sm font-semibold">{isCorrect ? "✓ Đáp án đúng" : "✗ Bạn chọn"}</span>
              )}
            </button>
          );
        })}
      </div>
      <div aria-live="polite" className="mt-4">
        {selected !== null && (
          <p className={`text-sm font-medium ${selected === currentQ.question.answer ? "text-ok" : "text-margin"}`}>
            {selected === currentQ.question.answer ? "Đúng!" : `Sai. Đáp án đúng: ${currentQ.question.answer}`}
            {currentQ.explanation && <span className="mt-1 block font-normal text-muted">{currentQ.explanation}</span>}
          </p>
        )}
      </div>
      {selected !== null && (
        <button onClick={handleNext} className="btn btn-primary mt-6 w-full">
          {current + 1 >= count ? "Xem kết quả" : "Tiếp theo"}
        </button>
      )}
    </main>
  );
}
