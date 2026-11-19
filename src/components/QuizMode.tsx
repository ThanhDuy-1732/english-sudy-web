"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getLearnedWords } from "@/lib/storage";
import { langOf, type LearnLang } from "@/lib/languages";
import QuizCard from "./QuizCard";

interface WordPair {
  word: string;
  meaning: string;
  lang?: LearnLang;
}

interface Props {
  words: WordPair[];
  onClose: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/** Distractors come from words of the question's own language, so another script can't give the answer away. */
function buildOptions(correct: WordPair, allWords: WordPair[]): string[] {
  const lang = langOf(correct);
  const distractors = shuffle(
    allWords.filter((w) => langOf(w) === lang && w.word.toLowerCase() !== correct.word.toLowerCase()),
  ).slice(0, 3);
  return shuffle([correct.word, ...distractors.map((w) => w.word)]);
}

export default function QuizMode({ words, onClose }: Props) {
  const [history] = useState(() => getLearnedWords());
  const allWords = useMemo(() => {
    const unique = new Map<string, WordPair>();
    [...words, ...history.map((w) => ({ word: w.word, meaning: w.meaning, lang: langOf(w) }))].forEach((entry) => {
      const key = `${langOf(entry)}:${entry.word.toLowerCase()}`;
      if (!unique.has(key)) unique.set(key, entry);
    });
    return Array.from(unique.values());
  }, [history, words]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [answered, setAnswered] = useState(false);
  const answeredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = words[index];
  const options = useMemo(
    () => (current ? buildOptions(current, allWords) : []),
    [allWords, current],
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function handleAnswer(correct: boolean) {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setAnswered(true);
    setLastCorrect(correct);
    if (correct) setScore((s) => s + 1);
    timerRef.current = setTimeout(() => {
      setLastCorrect(null);
      setAnswered(false);
      answeredRef.current = false;
      if (index + 1 >= words.length) {
        setDone(true);
      } else {
        setIndex((i) => i + 1);
      }
    }, 800);
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-deep/50">
        <div className="mx-4 w-full max-w-sm rounded-3xl bg-card p-8 text-center shadow-xl">
          <p className="mb-2 font-display text-5xl font-extrabold tabular-nums text-primary-text">
            {score}/{words.length}
          </p>
          <p className="mb-6 text-muted">
            {score === words.length ? "Đúng hết, làm tốt lắm." : "Xem lại các từ sai rồi làm lại."}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-deep/50">
      <div className="mx-4 w-full max-w-md rounded-3xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-muted">
            {index + 1} / {words.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
            aria-label="Đóng quiz"
          >
            ✕
          </button>
        </div>
        {lastCorrect !== null && (
          <div
            className={`mb-2 text-center text-lg font-bold ${
              lastCorrect ? "text-ok" : "text-margin"
            }`}
          >
            {lastCorrect ? "Đúng rồi! ✓" : "Sai rồi ✗"}
          </div>
        )}
        <QuizCard
          lang={langOf(current)}
          question={current.meaning}
          options={options}
          correctAnswer={current.word}
          onAnswer={handleAnswer}
          disabled={answered}
        />
      </div>
    </div>
  );
}
