"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getLearnedWords, type LearnedWord } from "@/lib/storage";
import { startSession, finishSession } from "@/lib/sessions";

type QuizMode = "meaning" | "fill";
type Phase = "setup" | "quiz" | "done";

interface MCQQuestion { type: "mcq"; word: string; meaning: string; options: string[]; answer: string }
interface FillQuestion { type: "fill"; word: string; sentence: string; answer: string; isLoading: boolean }
type Question = MCQQuestion | FillQuestion;

function buildMCQ(word: LearnedWord, allWords: LearnedWord[]): MCQQuestion {
  const distractors = allWords
    .filter((w) => w.word !== word.word && w.meaning)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((w) => w.meaning);
  const options = [...distractors, word.meaning].sort(() => Math.random() - 0.5);
  return { type: "mcq", word: word.word, meaning: word.meaning, options, answer: word.meaning };
}

export default function VocabQuizPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<QuizMode>("meaning");
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<{ correct: boolean }[]>([]);
  const [allWords, setAllWords] = useState<LearnedWord[]>([]);
  const sessionIdRef = { current: "" };

  useEffect(() => {
    setAllWords(getLearnedWords());
  }, []);

  function startQuiz() {
    const pool = [...allWords].sort(() => Math.random() - 0.5).slice(0, count);
    let qs: Question[];
    if (mode === "meaning") {
      qs = pool.map((w) => buildMCQ(w, allWords));
    } else {
      qs = pool.map((w) => ({
        type: "fill" as const,
        word: w.word,
        sentence: w.example ?? "",
        answer: w.word,
        isLoading: !w.example,
      }));
    }
    setQuestions(qs);
    setCurrentIdx(0);
    setResults([]);
    setSelected(null);
    setInput("");
    sessionIdRef.current = startSession("vocabulary");
    setPhase("quiz");
  }

  async function fetchFillSentence(word: string, idx: number) {
    try {
      const res = await fetch("/api/generate-fillblank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word }),
      });
      const data = await res.json() as { sentence?: string };
      setQuestions((prev) => prev.map((q, i) =>
        i === idx && q.type === "fill"
          ? { ...q, sentence: data.sentence ?? word, isLoading: false }
          : q
      ));
    } catch {
      setQuestions((prev) => prev.map((q, i) =>
        i === idx && q.type === "fill" ? { ...q, isLoading: false } : q
      ));
    }
  }

  useEffect(() => {
    if (phase !== "quiz") return;
    const q = questions[currentIdx];
    if (q?.type === "fill" && q.isLoading) {
      void fetchFillSentence(q.word, currentIdx);
    }
  }, [currentIdx, phase, questions]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(answer: string) {
    if (selected !== null) return;
    setSelected(answer);
    const q = questions[currentIdx];
    const correct = answer.trim().toLowerCase() === q.answer.trim().toLowerCase();
    setResults((prev) => [...prev, { correct }]);
  }

  function handleNext() {
    const lastCorrect = selected !== null &&
      selected.trim().toLowerCase() === questions[currentIdx].answer.trim().toLowerCase();
    if (currentIdx + 1 >= questions.length) {
      finishSession(sessionIdRef.current, {
        totalItems: results.length + 1,
        correctItems: results.filter((r) => r.correct).length + (lastCorrect ? 1 : 0),
      });
      setPhase("done");
      return;
    }
    setSelected(null);
    setInput("");
    setCurrentIdx((i) => i + 1);
  }

  if (phase === "setup") {
    return (
      <main className="max-w-md mx-auto p-4">
        <h1 className="text-xl font-bold mb-6">Quiz Từ vựng</h1>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Chế độ</p>
            <div className="flex gap-2 flex-wrap">
              {([["meaning", "Chọn nghĩa"], ["fill", "Điền vào chỗ trống"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setMode(v)}
                  className={`px-3 py-2 rounded text-sm ${mode === v ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
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
          <button
            onClick={startQuiz}
            disabled={allWords.length < 4}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {allWords.length < 4 ? "Cần ít nhất 4 từ" : "Bắt đầu"}
          </button>
          <Link href="/" className="block text-center text-sm text-gray-500">← Trang chủ</Link>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    const correct = results.filter((r) => r.correct).length;
    return (
      <main className="max-w-md mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Kết quả</h1>
        <p className="text-4xl font-bold text-blue-600 mb-1">{correct}/{results.length}</p>
        <p className="text-gray-500 mb-8">{Math.round((correct / results.length) * 100)}% chính xác</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => setPhase("setup")} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Làm lại</button>
          <Link href="/" className="px-6 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">Trang chủ</Link>
        </div>
      </main>
    );
  }

  const q = questions[currentIdx];
  if (!q) return null;

  return (
    <main className="max-w-md mx-auto p-4">
      <div className="flex justify-between text-sm text-gray-500 mb-4">
        <span>{mode === "meaning" ? "Chọn nghĩa đúng" : "Điền từ vào chỗ trống"}</span>
        <span>{currentIdx + 1}/{questions.length}</span>
      </div>

      {q.type === "mcq" && (
        <>
          <p className="text-2xl font-bold text-center mb-6">{q.word}</p>
          <div className="space-y-2">
            {q.options.map((opt) => {
              let cls = "w-full text-left px-4 py-3 rounded border text-sm ";
              if (selected === null) cls += "hover:bg-gray-50 dark:hover:bg-gray-800";
              else if (opt === q.answer) cls += "bg-green-50 border-green-500 text-green-800 dark:bg-green-900/20";
              else if (opt === selected) cls += "bg-red-50 border-red-400 text-red-700 dark:bg-red-900/20";
              else cls += "opacity-50";
              return (
                <button key={opt} onClick={() => handleAnswer(opt)} className={cls} disabled={selected !== null && opt !== q.answer && opt !== selected}>
                  {opt}
                </button>
              );
            })}
          </div>
        </>
      )}

      {q.type === "fill" && (
        <>
          {q.isLoading ? (
            <p className="text-center py-8 text-gray-400">Đang tạo câu hỏi...</p>
          ) : (
            <>
              <p className="text-base mb-4">{q.sentence.replace(new RegExp(`\\b${q.word}\\b`, "i"), "______")}</p>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={selected !== null}
                onKeyDown={(e) => e.key === "Enter" && selected === null && handleAnswer(input)}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                placeholder="Nhập từ..."
                autoFocus
              />
              {selected !== null && (
                <p className={`text-sm mt-2 ${input.toLowerCase() === q.answer.toLowerCase() ? "text-green-600" : "text-red-500"}`}>
                  {input.toLowerCase() === q.answer.toLowerCase() ? "Đúng!" : `Đáp án: ${q.answer}`}
                </p>
              )}
            </>
          )}
        </>
      )}

      {selected !== null && (
        <button onClick={handleNext} className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg font-medium">
          {currentIdx + 1 >= questions.length ? "Xem kết quả" : "Tiếp theo"}
        </button>
      )}
    </main>
  );
}
