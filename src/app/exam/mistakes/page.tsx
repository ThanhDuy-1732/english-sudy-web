"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Segmented from "@/components/Segmented";
import { getExamMistakes, resolveMistake, type ExamMistake } from "@/lib/mistakes";
import { runMistakeMigration } from "@/lib/mistake-migration";
import MistakeWords from "@/components/MistakeWords";
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
  // Storage is read after mount so the first client render matches the server HTML.
  const [mistakes, setMistakes] = useState<ExamMistake[]>([]);
  useEffect(() => {
    runMistakeMigration();
    setMistakes(getExamMistakes());
  }, []);
  const [filter, setFilter] = useState<"all" | "unresolved">("unresolved");

  const shown = filter === "all" ? mistakes : mistakes.filter((m) => m.status !== "resolved");

  function handleResolve(id: string) {
    resolveMistake(id);
    setMistakes(getExamMistakes());
  }


  return (
    <div className="mistakes-page">
      <div className="page-header">
        <button onClick={() => router.push("/exam")} className="back-btn">
          ← Luyện thi
        </button>
        <h1>Sổ lỗi</h1>
        <span className="count">
          {mistakes.filter((m) => m.status !== "resolved").length} chưa giải quyết
        </span>
      </div>

      <div className="filter-row">
        <Segmented label="Lọc lỗi" value={filter} onChange={setFilter}
          options={[{ value: "unresolved", label: "Chưa giải quyết" }, { value: "all", label: "Tất cả" }] as const} />
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <p>Không có lỗi {filter === "unresolved" ? "chưa giải quyết" : ""}.</p>
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
              <MistakeWords mistake={m} />

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
        .mistakes-page { max-width: 48rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
        .page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .back-btn { background: none; border: none; cursor: pointer; color: rgb(var(--muted)); font-size: 0.9rem; }
        h1 { color: rgb(var(--ink)); letter-spacing: -0.015em; font-size: 1.625rem; font-weight: 600; margin: 0; flex: 1; }
        .count { font-size: 0.85rem; color: rgb(var(--muted)); }
        .filter-row { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
        .empty { text-align: center; padding: 3rem; color: rgb(var(--muted)); }
        .mistakes-list { display: flex; flex-direction: column; gap: 1rem; }
        .mistake-card { padding: 1rem; border: 1.5px solid rgb(var(--rule)); border-radius: 1.5rem; }
        .mistake-card.resolved { opacity: 0.65; border-style: dashed; }
        .mistake-meta { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; font-size: 0.8rem; }
        .part-tag { color: rgb(var(--ink)); background: rgb(var(--rule)); border-radius: 1.5rem; padding: 0.15rem 0.5rem; font-weight: 600; }
        .date { color: rgb(var(--muted)); }
        .resolved-tag { color: rgb(var(--ok)); font-weight: 600; }
        .mistake-prompt { font-size: 0.9rem; font-weight: 500; margin-bottom: 0.5rem; }
        .answer-row { display: flex; gap: 1rem; margin-bottom: 0.5rem; font-size: 0.875rem; }
        .wrong-answer { color: rgb(var(--margin)); }
        .correct-answer { color: rgb(var(--ok)); }
        .explanation { font-size: 0.85rem; color: rgb(var(--muted)); margin-bottom: 0.75rem; }
        .mistake-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .drill-btn, .resolve-btn { padding: 0.4rem 0.9rem; border-radius: 999px; min-height: 44px; font-size: 0.8rem; cursor: pointer; border: 1.5px solid; }
        .drill-btn { border-color: rgb(var(--primary)); color: rgb(var(--primary-text)); background: rgb(var(--card)); }
        .drill-btn:hover { background: rgb(var(--primary-soft)); }
        .resolve-btn { border-color: rgb(var(--ok)); color: rgb(var(--ok)); background: rgb(var(--card)); }
        .resolve-btn:hover { background: rgb(var(--ok-soft)); }
      `}</style>
    </div>
  );
}
