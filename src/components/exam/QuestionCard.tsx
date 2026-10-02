"use client";

import type { ExamQuestion, ExamItem } from "@/lib/exam/types";
import PassageReader from "./PassageReader";
import ListeningPlayer from "./ListeningPlayer";

const READING_PARTS = new Set(["RC6", "RC7", "READ_P1", "READ_P2", "READ_P3"]);
const LISTENING_PARTS = new Set(["LC1", "LC2", "LC3", "LC4", "LISTEN_S1", "LISTEN_S2", "LISTEN_S3", "LISTEN_S4"]);

interface Props {
  item: ExamItem;
  question: ExamQuestion;
  questionNumber: number;
  totalQuestions: number;
  userAnswer?: string;
  showResult?: boolean;
  onAnswer: (answer: string) => void;
}

export default function QuestionCard({
  item,
  question,
  questionNumber,
  totalQuestions,
  userAnswer,
  showResult,
  onAnswer,
}: Props) {
  const isCompletion = !question.options;

  // Use PassageReader layout for reading parts with passages
  if (READING_PARTS.has(item.part) && item.passage) {
    return (
      <PassageReader
        item={item}
        question={question}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
        userAnswer={userAnswer}
        showResult={showResult}
        onAnswer={onAnswer}
      />
    );
  }

  return (
    <div className="question-card">
      <div className="question-header">
        <span className="question-number">
          {questionNumber} / {totalQuestions}
        </span>
        <span className="question-type">{formatType(question.type)}</span>
      </div>

      {/* Listening player for LC parts */}
      {LISTENING_PARTS.has(item.part) && item.script && (
        <ListeningPlayer script={item.script} />
      )}

      {/* Passage context for non-reading items that have a passage */}
      {!READING_PARTS.has(item.part) && item.passage && (
        <div className="passage-context">
          <p>{item.passage}</p>
        </div>
      )}

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
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="completion-input">
          <input
            type="text"
            value={userAnswer ?? ""}
            onChange={(e) => !showResult && onAnswer(e.target.value)}
            disabled={showResult}
            placeholder="Type your answer…"
            className="text-input"
          />
        </div>
      )}

      {showResult && (
        <div className={`result-panel ${userAnswer === question.answer || isCompletion ? "" : "wrong"}`}>
          <p className="correct-answer">
            ✓ Correct: <strong>{question.answer}</strong>
          </p>
          <p className="explanation">{question.explanation}</p>
          {question.keyVocabulary && question.keyVocabulary.length > 0 && (
            <p className="vocab-note">
              Key vocab: {question.keyVocabulary.join(", ")}
            </p>
          )}
        </div>
      )}

      <style jsx>{`
        .question-card {
          max-width: 720px;
          margin: 0 auto;
          padding: 1.5rem;
        }
        .question-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: #666;
          margin-bottom: 0.75rem;
        }
        .passage-context {
          color: #212529;
          background: #f8f9fa;
          border-left: 3px solid #6c757d;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          line-height: 1.6;
          border-radius: 0 4px 4px 0;
          max-height: 200px;
          overflow-y: auto;
        }
        .question-prompt {
          font-size: 1rem;
          line-height: 1.6;
          margin-bottom: 1.25rem;
          font-weight: 500;
        }
        .options-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .option-btn {
          color: #212529;
          text-align: left;
          padding: 0.75rem 1rem;
          border: 1.5px solid #dee2e6;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 0.95rem;
          transition: all 0.15s;
        }
        .option-btn:hover:not(:disabled) {
          border-color: #0d6efd;
          background: #e8f0fe;
        }
        .option-btn.selected {
          border-color: #0d6efd;
          background: #e8f0fe;
        }
        .option-btn.correct {
          border-color: #198754;
          background: #d1e7dd;
        }
        .option-btn.wrong {
          border-color: #dc3545;
          background: #f8d7da;
        }
        .completion-input {
          margin-bottom: 1rem;
        }
        .text-input {
          width: 100%;
          padding: 0.6rem 0.9rem;
          border: 1.5px solid #dee2e6;
          border-radius: 6px;
          font-size: 0.95rem;
          box-sizing: border-box;
        }
        .result-panel {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: #d1e7dd;
          border-radius: 6px;
          border-left: 3px solid #198754;
        }
        .result-panel.wrong {
          background: #f8d7da;
          border-color: #dc3545;
        }
        .correct-answer {
          margin: 0 0 0.35rem;
          font-size: 0.9rem;
        }
        .explanation {
          margin: 0 0 0.35rem;
          font-size: 0.875rem;
          color: #333;
        }
        .vocab-note {
          margin: 0;
          font-size: 0.8rem;
          color: #555;
          font-style: italic;
        }
        @media (prefers-color-scheme: dark) {
          .passage-context { background: #1e2a35; }
          .option-btn { background: #1a1a2e; border-color: #444; color: #eee; }
          .option-btn:hover:not(:disabled) { border-color: #4d9fff; background: #1a2f50; }
          .option-btn.selected { border-color: #4d9fff; background: #1a2f50; }
          .result-panel { background: #1a3027; }
          .result-panel.wrong { background: #3a1a1e; }
          .text-input { background: #1a1a2e; color: #eee; border-color: #444; }
        }
      `}</style>
    </div>
  );
}

function formatType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
