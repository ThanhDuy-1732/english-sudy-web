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
      <main className="page">
        <h1 className="page-title mb-6">Quiz Từ vựng</h1>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Chế độ</p>
            <div className="flex gap-2 flex-wrap">
              {([["meaning", "Chọn nghĩa"], ["fill", "Điền vào chỗ trống"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setMode(v)}
                  aria-pressed={mode === v} className={`chip ${mode === v ? "chip-on" : ""}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
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
          <button
            onClick={startQuiz}
            disabled={allWords.length < 4}
            className="btn btn-primary w-full"
          >
            {allWords.length < 4 ? "Cần ít nhất 4 từ" : "Bắt đầu"}
          </button>
          <Link href="/" className="back-link mt-2">← Từ mới</Link>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    const correct = results.filter((r) => r.correct).length;
    return (
      <main className="page">
        <h1 className="page-title mb-2">Kết quả</h1>
        <p className="mb-1 font-display text-5xl font-extrabold tabular-nums text-primary-text">{correct}/{results.length}</p>
        <p className="mb-8 text-muted">{Math.round((correct / results.length) * 100)}% chính xác</p>
        <div className="flex gap-3">
          <button onClick={() => setPhase("setup")} className="btn btn-primary">Làm lại</button>
          <Link href="/" className="btn btn-secondary">Trang chủ</Link>
        </div>
      </main>
    );
  }

  const q = questions[currentIdx];
  if (!q) return null;

  return (
    <main className="page">
      <div className="mb-4 flex justify-between text-sm text-muted">
        <span>{mode === "meaning" ? "Chọn nghĩa đúng" : "Điền từ vào chỗ trống"}</span>
        <span>{currentIdx + 1}/{questions.length}</span>
      </div>

      {q.type === "mcq" && (
        <>
          <div className="postcard mb-6 px-6 py-10 text-center"><p className="break-words font-en text-[2.25rem] font-semibold leading-tight">{q.word}</p></div>
          <div className="space-y-2">
            {q.options.map((opt) => {
              const cls = `choice ${selected === null ? "" : opt === q.answer ? "choice-right" : opt === selected ? "choice-wrong" : "choice-dim"}`;
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
            <p className="py-8 text-center text-muted">Đang tạo câu hỏi...</p>
          ) : (
            <>
              <p className="postcard mb-4 px-6 py-8 font-en text-xl leading-relaxed">{q.sentence.replace(new RegExp(`\\b${q.word}\\b`, "i"), "______")}</p>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={selected !== null}
                onKeyDown={(e) => e.key === "Enter" && selected === null && handleAnswer(input)}
                className="field w-full"
                placeholder="Nhập từ..."
                autoFocus
              />
              {selected !== null && (
                <p className={`text-sm mt-2 ${input.toLowerCase() === q.answer.toLowerCase() ? "font-medium text-ok" : "font-medium text-margin"}`}>
                  {input.toLowerCase() === q.answer.toLowerCase() ? "Đúng!" : `Đáp án: ${q.answer}`}
                </p>
              )}
            </>
          )}
        </>
      )}

      {selected !== null && (
        <button onClick={handleNext} className="btn btn-primary mt-6 w-full">
          {currentIdx + 1 >= questions.length ? "Xem kết quả" : "Tiếp theo"}
        </button>
      )}
    </main>
  );
}
