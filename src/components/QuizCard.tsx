"use client";

interface Props {
  question: string;
  options: string[];
  correctAnswer: string;
  onAnswer: (correct: boolean) => void;
  disabled?: boolean;
}

export default function QuizCard({ question, options, correctAnswer, onAnswer, disabled = false }: Props) {
  return (
    <div className="postcard px-5 py-6">
      <p className="mb-2 text-center text-sm text-muted">Nghĩa của từ nào là:</p>
      <p className="mb-6 text-center text-xl font-semibold text-ink">{question}</p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(opt === correctAnswer)}
            className="choice justify-center font-en text-lg font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
