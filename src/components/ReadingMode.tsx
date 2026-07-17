"use client";

import { useState } from "react";

interface Question { question: string; options: string[]; answer: string }
interface Props { passage: string; questions: Question[]; highlightWords: string[]; onClose: () => void }

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function HighlightedPassage({ text, words }: { text: string; words: string[] }) {
  const validWords = words.filter(Boolean);
  if (validWords.length === 0) return <p className="leading-relaxed text-gray-700 dark:text-gray-300">{text}</p>;
  const pattern = new RegExp(`\\b(${validWords.map(escapeRegExp).join("|")})\\b`, "gi");
  return <p className="leading-relaxed text-gray-700 dark:text-gray-300">{text.split(pattern).map((part, index) => validWords.some((word) => word.toLowerCase() === part.toLowerCase()) ? <mark key={index} className="rounded bg-yellow-200 px-0.5 font-medium dark:bg-yellow-800">{part}</mark> : <span key={index}>{part}</span>)}</p>;
}

export default function ReadingMode({ passage, questions, highlightWords, onClose }: Props) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = submitted ? questions.filter((question, index) => answers[index] === question.answer.toUpperCase()).length : 0;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Đọc hiểu">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl dark:bg-gray-900"><div className="space-y-6 p-6">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Đọc hiểu</h2><button type="button" onClick={onClose} aria-label="Đóng" className="text-xl text-gray-400 hover:text-gray-600">✕</button></div>
      <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><HighlightedPassage text={passage} words={highlightWords} /></div>
      <div className="space-y-4"><h3 className="font-semibold">Câu hỏi:</h3>{questions.map((question, questionIndex) => <div key={questionIndex} className="space-y-2"><p className="text-sm font-medium">{questionIndex + 1}. {question.question}</p><div className="space-y-1">{question.options.map((option) => { const letter = option.trim().charAt(0).toUpperCase(); const selected = answers[questionIndex] === letter; const correct = submitted && letter === question.answer.toUpperCase(); const wrong = submitted && selected && !correct; return <button type="button" key={option} disabled={submitted} onClick={() => setAnswers((current) => ({ ...current, [questionIndex]: letter }))} className={`w-full rounded-lg border px-4 py-2 text-left text-sm transition-colors disabled:cursor-default ${correct ? "border-green-400 bg-green-50 text-green-800" : wrong ? "border-red-400 bg-red-50 text-red-800" : selected ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>{option}</button>; })}</div></div>)}</div>
      {!submitted ? <button type="button" onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length < questions.length} className="min-h-12 w-full rounded-xl bg-blue-500 py-3 font-medium text-white hover:bg-blue-600 disabled:opacity-50">Nộp bài</button> : <div className="text-center"><p className="mb-1 text-2xl font-bold">{score}/{questions.length}</p><p className="text-sm text-gray-500">{score === questions.length ? "Xuất sắc! 🎉" : "Đọc lại đoạn văn và thử lại nhé."}</p></div>}
    </div></div>
  </div>;
}
