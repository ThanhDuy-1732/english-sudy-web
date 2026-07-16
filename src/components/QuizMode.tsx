"use client";

import { useState } from "react";
import { getLearnedWords } from "@/lib/storage";
import QuizCard from "./QuizCard";

interface WordPair {
  word: string;
  meaning: string;
}

interface Props {
  words: WordPair[];
  onClose: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildOptions(correct: string, allWords: WordPair[]): string[] {
  const distractors = shuffle(allWords.filter((w) => w.word !== correct)).slice(0, 3);
  return shuffle([correct, ...distractors.map((w) => w.word)]);
}

export default function QuizMode({ words, onClose }: Props) {
  const history = getLearnedWords();
  const allWords: WordPair[] = [
    ...words,
    ...history.map((w) => ({ word: w.word, meaning: w.meaning })),
  ];

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);

  const current = words[index];
  const options = buildOptions(current.word, allWords);

  function handleAnswer(correct: boolean) {
    setLastCorrect(correct);
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      setLastCorrect(null);
      if (index + 1 >= words.length) {
        setDone(true);
      } else {
        setIndex((i) => i + 1);
      }
    }, 800);
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl dark:bg-gray-900">
          <p className="mb-2 font-display text-4xl font-bold text-[#2c1f4a]">
            {score}/{words.length}
          </p>
          <p className="mb-6 text-gray-500">
            {score === words.length ? "Tuyệt vời! 🎉" : "Cố gắng hơn nhé!"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#7f56d9] px-6 py-3 font-medium text-white hover:bg-[#6941c6]"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-400">
            {index + 1} / {words.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Đóng quiz"
          >
            ✕
          </button>
        </div>
        {lastCorrect !== null && (
          <div
            className={`mb-2 text-center text-lg font-bold ${
              lastCorrect ? "text-green-500" : "text-red-500"
            }`}
          >
            {lastCorrect ? "Đúng rồi! ✓" : "Sai rồi ✗"}
          </div>
        )}
        <QuizCard
          question={current.meaning}
          options={options}
          correctAnswer={current.word}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  );
}
