"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getExamMistakes, resolveMistake, type ExamMistake } from "@/lib/mistakes";
import { runMistakeMigration } from "@/lib/mistake-migration";
import { saveLearnedWord } from "@/lib/storage";
import type { QuestionType } from "@/lib/exam/types";

const TYPE_LABELS: Partial<Record<QuestionType, string>> = {
  incomplete_sentence: "Part 5",
  text_completion: "Part 6",
  single_passage: "Part 7",
  multiple_passage: "Part 7",
  conversation: "Part 3",
  short_talk: "Part 4",
  question_response: "Part 2",
  true_false_ng: "IELTS T/F/NG",
  sentence_completion: "IELTS Completion",
  form_completion: "IELTS S1",
};

export default function MistakesPage() {
  const router = useRouter();
  const [mistakes, setMistakes] = useState<ExamMistake[]>(() => {
    runMistakeMigration();
    return getExamMistakes();
  });
  const [filter, setFilter] = useState<"all" | "unresolved">("unresolved");

  const shown = filter === "all" ? mistakes : mistakes.filter((m) => m.status !== "resolved");

  function handleResolve(id: string) {
    resolveMistake(id);
    setMistakes(getExamMistakes());
  }

  function handleAddToSRS(mistake: ExamMistake, word: string) {
    saveLearnedWord({
      word,
      meaning: "",
      example: mistake.exam.prompt,
      topic: `exam:${mistake.exam.part}`,
      learnedAt: new Date().toISOString(),
      mastery: 0,
      nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
      reviewInterval: 1,
    });
    alert(`Đã thêm "${word}" vào flashcard!`);
  }

  return (
    <div className="mistakes-page">
      <div className="page-header">
        <button onClick={() => router.push("/exam")} className="back-btn">
          ← Exam
        </button>
        <h1>Sổ lỗi</h1>
        <span className="count">
          {mistakes.filter((m) => m.status !== "resolved").length} chưa giải quyết
        </span>
      </div>

      <div className="filter-row">
        {(["unresolved", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? "active" : ""}
          >
            {f === "unresolved" ? "Chưa giải quyết" : "Tất cả"}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <p>🎉 Không có lỗi {filter === "unresolved" ? "chưa giải quyết" : ""}!</p>
        </div>
      ) : (
        <div className="mistakes-list">
          {shown.map((m) => (
            <div key={m.id} className={`mistake-card ${m.status === "resolved" ? "resolved" : ""}`}>
              <div className="mistake-meta">
                <span className="part-tag">{TYPE_LABELS[m.exam.type] ?? m.exam.type}</span>
                <span className="date">
                  {new Date(m.createdAt).toLocaleDateString("vi-VN")}
                </span>
                {m.occurrenceCount > 1 && (
                  <span className="date">{`sai ${m.occurrenceCount} lần`}</span>
                )}
                {m.status === "resolved" && <span className="resolved-tag">✓ Đã xử lý</span>}
              </div>

              <p className="mistake-prompt">{m.exam.prompt}</p>

              <div className="answer-row">
                <span className="wrong-answer">✗ {m.userAnswer || "(không trả lời)"}</span>
                <span className="correct-answer">✓ {m.correctAnswer}</span>
              </div>

              <p className="explanation">{m.explanation}</p>

              <div className="mistake-actions">
                <button
                  onClick={() => router.push(`/exam/drill/${m.exam.part}`)}
                  className="drill-btn"
                >
                  Luyện thêm
                </button>
                {m.status !== "resolved" && (
                  <button onClick={() => handleResolve(m.id)} className="resolve-btn">
                    ✓ Đánh dấu xử lý
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .mistakes-page { max-width: 720px; margin: 0 auto; padding: 1.5rem; }
        .page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .back-btn { background: none; border: none; cursor: pointer; color: #6c757d; font-size: 0.9rem; }
        h1 { font-size: 1.25rem; font-weight: 700; margin: 0; flex: 1; }
        .count { font-size: 0.85rem; color: #6c757d; }
        .filter-row { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
        .filter-row button { padding: 0.4rem 1rem; border: 1.5px solid #dee2e6; border-radius: 16px; background: white; cursor: pointer; font-size: 0.85rem; }
        .filter-row button.active { background: #0d6efd; color: white; border-color: #0d6efd; }
        .empty { text-align: center; padding: 3rem; color: #6c757d; }
        .mistakes-list { display: flex; flex-direction: column; gap: 1rem; }
        .mistake-card { padding: 1rem; border: 1.5px solid #dee2e6; border-radius: 10px; }
        .mistake-card.resolved { opacity: 0.65; border-style: dashed; }
        .mistake-meta { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; font-size: 0.8rem; }
        .part-tag { background: #e9ecef; border-radius: 10px; padding: 0.15rem 0.5rem; font-weight: 600; }
        .date { color: #6c757d; }
        .resolved-tag { color: #198754; font-weight: 600; }
        .mistake-prompt { font-size: 0.9rem; font-weight: 500; margin-bottom: 0.5rem; }
        .answer-row { display: flex; gap: 1rem; margin-bottom: 0.5rem; font-size: 0.875rem; }
        .wrong-answer { color: #dc3545; }
        .correct-answer { color: #198754; }
        .explanation { font-size: 0.85rem; color: #495057; margin-bottom: 0.75rem; }
        .mistake-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .drill-btn, .resolve-btn { padding: 0.4rem 0.9rem; border-radius: 6px; font-size: 0.8rem; cursor: pointer; border: 1.5px solid; }
        .drill-btn { border-color: #0d6efd; color: #0d6efd; background: white; }
        .drill-btn:hover { background: #e8f0fe; }
        .resolve-btn { border-color: #198754; color: #198754; background: white; }
        .resolve-btn:hover { background: #d1e7dd; }
      `}</style>
    </div>
  );
}
