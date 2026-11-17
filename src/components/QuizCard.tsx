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
    <div className="rounded-2xl bg-white p-6 shadow">
      <p className="mb-2 text-center text-sm text-gray-500">Nghĩa của từ nào là:</p>
      <p className="mb-6 text-center text-xl font-bold text-ink">{question}</p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(opt === correctAnswer)}
            className="rounded-xl border border-rule px-4 py-3 text-center font-medium text-ink transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
