"use client";

import type { ExamItem, ExamQuestion } from "@/lib/exam/types";

interface Props {
  item: ExamItem;
  question: ExamQuestion;
  questionNumber: number;
  totalQuestions: number;
  userAnswer?: string;
  showResult?: boolean;
  onAnswer: (answer: string) => void;
}

/**
 * Two-column layout: passage sticky left, question right.
 * Used for RC6, RC7, IELTS Reading.
 */
export default function PassageReader({
  item,
  question,
  questionNumber,
  totalQuestions,
  userAnswer,
  showResult,
  onAnswer,
}: Props) {
  const isCompletion = !question.options;

  return (
    <div className="passage-reader">
      {/* Left: passage */}
      <div className="passage-pane">
        <p className="passage-label">Đoạn văn</p>
        <div className="passage-text">
          {(item.passage ?? "").split("\n").map((line, i) =>
            line.trim() ? <p key={i}>{line}</p> : <br key={i} />
          )}
        </div>
      </div>

      {/* Right: question */}
      <div className="question-pane">
        <div className="question-header">
          <span>{questionNumber} / {totalQuestions}</span>
          <span className="q-type">{formatType(question.type)}</span>
        </div>

        <p className="question-prompt">{question.prompt}</p>

        {question.options ? (
          <div className="options-list">
            {question.options.map((opt) => {
              const selected = userAnswer === opt;
              const correct = showResult && opt === question.answer;
              const wrong = showResult && selected && opt !== question.answer;
              return (
                <button
                  key={opt}
                  onClick={() => !showResult && onAnswer(opt)}
                  disabled={showResult}
                  className={[
                    "option-btn",
                    selected ? "selected" : "",
                    correct ? "correct" : "",
                    wrong ? "wrong" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            type="text"
            value={userAnswer ?? ""}
            onChange={(e) => !showResult && onAnswer(e.target.value)}
            disabled={showResult}
            placeholder="Nhập đáp án…"
            className="text-input"
          />
        )}

        {showResult && (
          <div className={`result-panel ${isCompletion || userAnswer === question.answer ? "ok" : "wrong"}`}>
            <p><strong>Đáp án: {question.answer}</strong></p>
            <p>{question.explanation}</p>
            {question.keyVocabulary && question.keyVocabulary.length > 0 && (
              <p className="vocab">Từ vựng: {question.keyVocabulary.join(", ")}</p>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .passage-reader {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          padding: 1rem 1.5rem;
          max-width: 1100px;
          margin: 0 auto;
          align-items: start;
        }
        .passage-pane {
          color: #212529;
          position: sticky;
          top: 80px;
          max-height: calc(100vh - 120px);
          overflow-y: auto;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 10px;
          border-left: 3px solid #6c757d;
        }
        .passage-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6c757d;
          margin-bottom: 0.75rem;
        }
        .passage-text p { margin: 0 0 0.75rem; line-height: 1.7; font-size: 0.9rem; }
        .question-pane { padding: 0.5rem; }
        .question-header { display: flex; justify-content: space-between; font-size: 0.8rem; color: #6c757d; margin-bottom: 0.75rem; }
        .q-type { font-style: italic; }
        .question-prompt { font-size: 0.95rem; font-weight: 500; line-height: 1.6; margin-bottom: 1rem; }
        .options-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .option-btn { color: #212529; text-align: left; padding: 0.65rem 0.9rem; border: 1.5px solid #dee2e6; border-radius: 6px; background: white; cursor: pointer; font-size: 0.9rem; }
        .option-btn:hover:not(:disabled) { border-color: #0d6efd; background: #e8f0fe; }
        .option-btn.selected { border-color: #0d6efd; background: #e8f0fe; }
        .option-btn.correct { border-color: #198754; background: #d1e7dd; }
        .option-btn.wrong { border-color: #dc3545; background: #f8d7da; }
        .text-input { width: 100%; padding: 0.6rem 0.8rem; border: 1.5px solid #dee2e6; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; }
        .result-panel { margin-top: 0.75rem; padding: 0.75rem; border-radius: 6px; background: #d1e7dd; border-left: 3px solid #198754; font-size: 0.875rem; }
        .result-panel.wrong { background: #f8d7da; border-color: #dc3545; }
        .result-panel p { margin: 0 0 0.35rem; }
        .vocab { font-style: italic; color: #555; }
        @media (max-width: 700px) {
          .passage-reader { grid-template-columns: 1fr; }
          .passage-pane { position: static; max-height: 200px; }
        }
        @media (prefers-color-scheme: dark) {
          .passage-pane { background: #1e2a35; color: #eee; }
          .option-btn { background: #1a1a2e; border-color: #444; color: #eee; }
          .text-input { background: #1a1a2e; color: #eee; border-color: #444; }
        }
      `}</style>
    </div>
  );
}

function formatType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
