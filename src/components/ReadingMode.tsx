"use client";

import { useState } from "react";
import { LANG_INFO, type LearnLang } from "@/lib/languages";

interface Question { question: string; options: string[]; answer: string }
interface Props { passage: string; questions: Question[]; highlightWords: string[]; onClose: () => void; lang?: LearnLang; translation?: string }

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function HighlightedPassage({ text, words, lang }: { text: string; words: string[]; lang: LearnLang }) {
  const validWords = words.filter(Boolean);
  if (validWords.length === 0) return <p className="leading-relaxed text-ink">{text}</p>;
  // \b never matches between Chinese/Japanese characters, so only English and Korean use word boundaries.
  const edge = lang === "zh" || lang === "ja" ? "" : "\\b";
  const pattern = new RegExp(`${edge}(${validWords.map(escapeRegExp).join("|")})${edge}`, "gi");
  return <p className="leading-relaxed text-ink">{text.split(pattern).map((part, index) => validWords.some((word) => word.toLowerCase() === part.toLowerCase()) ? <mark key={index} className="rounded-xl bg-yellow-200 px-0.5 font-medium">{part}</mark> : <span key={index}>{part}</span>)}</p>;
}

export default function ReadingMode({ passage, questions, highlightWords, onClose, lang = "en", translation }: Props) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = submitted ? questions.filter((question, index) => answers[index] === question.answer.toUpperCase()).length : 0;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Đọc hiểu">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card shadow-xl"><div className="space-y-6 p-6">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Đọc hiểu</h2><button type="button" onClick={onClose} aria-label="Đóng" className="text-xl text-muted hover:text-muted">✕</button></div>
      <div lang={LANG_INFO[lang].htmlLang} className="rounded-xl bg-paper p-4"><HighlightedPassage text={passage} words={highlightWords} lang={lang} />{translation && <p className="mt-3 text-sm text-muted">{translation}</p>}</div>
      <div className="space-y-4"><h3 className="font-semibold">Câu hỏi:</h3>{questions.map((question, questionIndex) => <div key={questionIndex} className="space-y-2"><p className="text-sm font-medium">{questionIndex + 1}. {question.question}</p><div className="space-y-1">{question.options.map((option) => { const letter = option.trim().charAt(0).toUpperCase(); const selected = answers[questionIndex] === letter; const correct = submitted && letter === question.answer.toUpperCase(); const wrong = submitted && selected && !correct; return <button type="button" key={option} disabled={submitted} onClick={() => setAnswers((current) => ({ ...current, [questionIndex]: letter }))} className={`w-full rounded-full border px-4 py-2 text-left text-sm transition-colors disabled:cursor-default ${correct ? "border-ok bg-ok-soft text-ok" : wrong ? "border-margin bg-margin-soft text-margin" : selected ? "border-primary bg-primary-soft" : "border-rule hover:border-rule hover:bg-ink/5"}`}>{option}</button>; })}</div></div>)}</div>
      {!submitted ? <button type="button" onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length < questions.length} className="btn btn-primary w-full">Nộp bài</button> : <div className="text-center"><p className="mb-1 text-2xl font-bold">{score}/{questions.length}</p><p className="text-sm text-muted">{score === questions.length ? "Xuất sắc! 🎉" : "Đọc lại đoạn văn và thử lại nhé."}</p></div>}
    </div></div>
  </div>;
}
