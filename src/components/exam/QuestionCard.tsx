"use client";

import { questionTypeLabel } from "@/lib/exam/labels";
import type { ExamQuestion, ExamItem } from "@/lib/exam/types";
import PassageReader from "./PassageReader";
import ListeningPlayer from "./ListeningPlayer";
import type { AudioLine } from "@/lib/exam/types";

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
  // Part 2 items carry no script: the question and the three responses are what gets spoken.
  const script: AudioLine[] | undefined =
    item.script ??
    (item.part === "LC2" && question.options
      ? [{ speaker: "M1", text: question.prompt }, ...question.options.map((text) => ({ speaker: "W1" as const, text }))]
      : undefined);

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
        <span className="question-type">{questionTypeLabel(question.type)}</span>
      </div>

      {/* Listening player for LC parts */}
      {LISTENING_PARTS.has(item.part) && script && <ListeningPlayer script={script} />}

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
          color: rgb(var(--muted));
          margin-bottom: 0.75rem;
        }
        .passage-context {
          color: rgb(var(--ink));
          background: rgb(var(--paper));
          border-left: 3px solid rgb(var(--muted));
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
          color: rgb(var(--ink));
          text-align: left;
          padding: 0.75rem 1rem;
          border: 1.5px solid rgb(var(--rule));
          border-radius: 6px;
          background: rgb(var(--card));
          cursor: pointer;
          font-size: 0.95rem;
          transition: all 0.15s;
        }
        .option-btn:hover:not(:disabled) {
          border-color: rgb(var(--primary));
          background: rgb(var(--primary-soft));
        }
        .option-btn.selected {
          border-color: rgb(var(--primary));
          background: rgb(var(--primary-soft));
        }
        .option-btn.correct {
          border-color: rgb(var(--ok));
          background: rgb(var(--ok-soft));
        }
        .option-btn.wrong {
          border-color: rgb(var(--margin));
          background: rgb(var(--margin-soft));
        }
        .completion-input {
          margin-bottom: 1rem;
        }
        .text-input {
          width: 100%;
          padding: 0.6rem 0.9rem;
          border: 1.5px solid rgb(var(--rule));
          border-radius: 6px;
          font-size: 0.95rem;
          box-sizing: border-box;
        }
        .result-panel {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: rgb(var(--ok-soft));
          border-radius: 6px;
          border-left: 3px solid rgb(var(--ok));
        }
        .result-panel.wrong {
          background: rgb(var(--margin-soft));
          border-color: rgb(var(--margin));
        }
        .correct-answer {
          margin: 0 0 0.35rem;
          font-size: 0.9rem;
        }
        .explanation {
          margin: 0 0 0.35rem;
          font-size: 0.875rem;
          color: rgb(var(--ink));
        }
        .vocab-note {
          margin: 0;
          font-size: 0.8rem;
          color: rgb(var(--muted));
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

