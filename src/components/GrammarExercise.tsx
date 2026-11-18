"use client";

import { useState } from "react";

interface FillExercise {
  type: "fill";
  question: string;
  answer: string;
}

interface MCQExercise {
  type: "mcq";
  question: string;
  options: string[];
  answer: string;
}

export type Exercise = FillExercise | MCQExercise;

export default function GrammarExercise({ exercise }: { exercise: Exercise }) {
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);

  function isCorrect(answer: string) {
    return answer.trim().toLowerCase() === exercise.answer.trim().toLowerCase();
  }

  function check() {
    const answer = exercise.type === "fill" ? userAnswer : selectedOption ?? "";
    setResult(isCorrect(answer) ? "correct" : "incorrect");
  }

  function reset() {
    setUserAnswer("");
    setSelectedOption(null);
    setResult(null);
  }

  if (exercise.type === "fill") {
    return (
      <div className="mt-3 rounded-2xl border border-rule bg-ink/5 p-4">
        <p className="mb-3 text-sm text-ink">{exercise.question}</p>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={userAnswer}
            onChange={(event) => setUserAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && result === null && userAnswer.trim()) check();
            }}
            disabled={result !== null}
            placeholder="Nhập câu trả lời..."
            className="min-h-10 min-w-0 flex-1 rounded-xl bg-ink/5 px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-60"
          />
          {result === null ? (
            <button
              type="button"
              onClick={check}
              disabled={!userAnswer.trim()}
              className="btn btn-primary min-h-10 px-4 text-sm"
            >
              Kiểm tra
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="min-h-10 rounded-full bg-ink/5 px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/5"
            >
              Thử lại
            </button>
          )}
        </div>
        {result === "correct" && (
          <p className="mt-2 text-sm font-medium text-ok">Đúng rồi!</p>
        )}
        {result === "incorrect" && (
          <p className="mt-2 text-sm text-margin">
            Sai. Đáp án: <span className="font-medium text-ink">{exercise.answer}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-rule bg-ink/5 p-4">
      <p className="mb-3 text-sm text-ink">{exercise.question}</p>
      <div className="flex flex-col gap-2">
        {exercise.options.map((option) => {
          const isSelected = selectedOption === option;
          const showCorrect = result !== null && isCorrect(option);
          const showWrong = result !== null && isSelected && !isCorrect(option);

          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                if (result !== null) return;
                setSelectedOption(option);
                setResult(isCorrect(option) ? "correct" : "incorrect");
              }}
              className={`min-h-10 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                showCorrect
                  ? "bg-ok-soft text-ok"
                  : showWrong
                    ? "bg-margin-soft text-margin"
                    : "bg-ink/5 text-ink hover:bg-ink/5"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {result === "correct" && (
        <p className="mt-2 text-sm font-medium text-ok">Đúng rồi!</p>
      )}
      {result === "incorrect" && (
        <p className="mt-2 text-sm text-margin">
          Sai. Đáp án: <span className="font-medium text-ink">{exercise.answer}</span>
        </p>
      )}
      {result !== null && (
        <button
          type="button"
          onClick={reset}
          className="mt-2 text-sm text-primary-text hover:text-primary-text"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
