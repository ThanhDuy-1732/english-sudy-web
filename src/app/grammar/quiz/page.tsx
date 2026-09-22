"use client";
import { useState, useRef } from "react";
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
      return { topicId: w.topicId, subRuleId: w.subRuleId, topicName: topic.name, subRuleName: rule.name };
    }).filter(Boolean) as QuizItem[];
  } else if (mode === "bookmarks") {
    const bm = getBookmarks();
    pool = bm.map((b) => {
      const topic = allTopics.find((t) => t.id === b.topicId);
      const rule = topic?.rules?.find((r) => r.id === b.subRuleId);
      if (!topic || !rule) return null;
      return { topicId: b.topicId, subRuleId: b.subRuleId, topicName: topic.name, subRuleName: rule.name };
    }).filter(Boolean) as QuizItem[];
  } else {
    for (const topic of allTopics) {
      for (const rule of topic.rules ?? []) {
        pool.push({ topicId: topic.id, subRuleId: rule.id, topicName: topic.name, subRuleName: rule.name });
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
  const sessionId = useRef<string | null>(null);

  async function fetchQuestion(item: QuizItem): Promise<QuizQuestion> {
    const res = await fetch("/api/grammar-exercise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: item.topicName, subRule: item.subRuleName }),
    });
    const q = await res.json() as { type: string; question: string; options?: string[]; answer: string };
    return { ...item, question: q };
  }

  async function startQuiz() {
    const items = selectItems(mode, count);
    if (items.length === 0) {
      alert("Không đủ nội dung cho chế độ này. Hãy thử chế độ khác.");
      return;
    }
    setLoading(true);
    const first = await fetchQuestion(items[0]);
    setPool(items);
    setQuestions([first]);
    sessionId.current = startSession("grammar");
    setPhase("quiz");
    setCurrent(0);
    setResults([]);
    setSelected(null);
    setLoading(false);
    // Prefetch next question in background
    if (items.length > 1) {
      fetchQuestion(items[1]).then((q) => setQuestions((prev) => [...prev, q]));
    }
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
    setCurrent(next);
    // Prefetch the question after next if not already loaded
    if (!questions[next + 1] && pool[next + 1]) {
      fetchQuestion(pool[next + 1]).then((q) => setQuestions((prev) => [...prev, q]));
    }
  }

  if (phase === "setup") {
    return (
      <main className="max-w-md mx-auto p-4">
        <h1 className="text-xl font-bold mb-6">Quiz Ngữ pháp</h1>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Số câu</p>
            <div className="flex gap-2">
              {([5, 10, 20] as const).map((n) => (
                <button key={n} onClick={() => setCount(n)}
                  className={`px-4 py-2 rounded ${count === n ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Chủ đề</p>
            <div className="flex gap-2 flex-wrap">
              {([["all", "Tất cả"], ["weak", "Điểm yếu"], ["bookmarks", "Đã lưu"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setMode(v)}
                  className={`px-4 py-2 rounded ${mode === v ? "bg-purple-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <button onClick={startQuiz} disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
            {loading ? "Đang tải..." : "Bắt đầu"}
          </button>
          <Link href="/grammar" className="block text-center text-sm text-gray-500 mt-2">← Quay lại ngữ pháp</Link>
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
      <main className="max-w-md mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Kết quả</h1>
        <p className="text-4xl font-bold text-blue-600 mb-1">{correct}/{results.length}</p>
        <p className="text-gray-500 mb-8">{Math.round((correct / results.length) * 100)}% chính xác</p>
        {topWeak && (
          <Link
            href={`/exam/drill/RC5?topic=${encodeURIComponent(worstCounts[topWeak])}&grammarSlug=${encodeURIComponent(topWeak)}`}
            className="mt-2 mb-4 block px-6 py-2 bg-orange-500 text-white rounded-lg text-center">
            Luyện tiếp trong TOEIC RC5
          </Link>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={() => setPhase("setup")} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Làm lại</button>
          <Link href="/grammar" className="px-6 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">Quay lại</Link>
        </div>
      </main>
    );
  }

  const currentQ = questions[current];
  if (!currentQ) return <p className="p-4 text-center">Đang tải câu hỏi...</p>;

  return (
    <main className="max-w-md mx-auto p-4">
      <div className="flex justify-between text-sm text-gray-500 mb-4">
        <span>{currentQ.topicName} — {currentQ.subRuleName}</span>
        <span>{current + 1}/{count}</span>
      </div>
      <p className="text-base font-medium mb-4">{currentQ.question.question}</p>
      <div className="space-y-2">
        {(currentQ.question.options ?? [currentQ.question.answer]).map((opt) => {
          const isCorrect = opt === currentQ.question.answer;
          const isSelected = opt === selected;
          let cls = "w-full text-left px-4 py-3 rounded border text-sm ";
          if (selected === null) cls += "hover:bg-gray-50 dark:hover:bg-gray-800";
          else if (isCorrect) cls += "bg-green-50 border-green-500 text-green-800 dark:bg-green-900/20 dark:text-green-300";
          else if (isSelected) cls += "bg-red-50 border-red-400 text-red-700 dark:bg-red-900/20 dark:text-red-300";
          else cls += "opacity-50";
          return (
            <button key={opt} onClick={() => handleAnswer(opt)} className={cls} disabled={selected !== null && !isCorrect && !isSelected}>
              {opt}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <button onClick={handleNext} className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg font-medium">
          {current + 1 >= count ? "Xem kết quả" : "Tiếp theo"}
        </button>
      )}
    </main>
  );
}
