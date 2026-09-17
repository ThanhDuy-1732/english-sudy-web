"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getWordsForReview, type LearnedWord } from "@/lib/storage";
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
import Flashcard from "@/components/Flashcard";

interface ReviewSummary {
  total: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
  durationSeconds: number;
}

export default function ReviewPage() {
  const router = useRouter();
  const [words, setWords] = useState<LearnedWord[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef(0);
  const countsRef = useRef({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });

  useEffect(() => {
    const due = getWordsForReview();
    setWords(due);
    if (due.length > 0 && !sessionIdRef.current) {
      sessionIdRef.current = startSession("review");
      startTimeRef.current = Date.now();
      countsRef.current = { again: 0, hard: 0, good: 0, easy: 0, total: due.length };
    }
    return () => {
      if (sessionIdRef.current) {
        cancelSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, []);

  function handleReviewed(quality: 0 | 3 | 4 | 5) {
    if (quality === 0) countsRef.current.again++;
    else if (quality === 3) countsRef.current.hard++;
    else if (quality === 4) countsRef.current.good++;
    else countsRef.current.easy++;

    const remaining = getWordsForReview();
    setWords(remaining);
    if (remaining.length === 0 && sessionIdRef.current) {
      const counts = countsRef.current;
      finishSession(sessionIdRef.current, {
        totalItems: counts.total,
        correctItems: counts.good + counts.easy,
      });
      sessionIdRef.current = null;
      setSummary({ ...counts, durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000) });
    }
  }

  if (summary) {
    const accuracy = summary.total > 0
      ? Math.round(((summary.good + summary.easy) / summary.total) * 100)
      : 0;
    const minutes = Math.floor(summary.durationSeconds / 60);
    const seconds = String(summary.durationSeconds % 60).padStart(2, "0");
    return (
      <main className="bg-[#f7f4ff] px-4 py-16 text-[#2c1f4a] sm:px-6">
        <div className="mx-auto max-w-md text-center">
          <p className="mb-4 text-5xl" aria-hidden="true">✅</p>
          <h1 className="mb-6 font-display text-3xl font-bold">Ôn tập xong!</h1>
          <div className="mb-6 space-y-3 rounded-2xl bg-white p-6 text-left shadow-sm">
            {([
              ["Tổng số từ", summary.total],
              ["Quên", summary.again],
              ["Khó", summary.hard],
              ["Được", summary.good],
              ["Dễ", summary.easy],
              ["Độ chính xác", `${accuracy}%`],
              ["Thời gian", `${minutes}:${seconds}`],
              ["Cần ôn tiếp", getWordsForReview().length],
            ] as const).map(([label, value]) => (
              <div className="flex justify-between" key={label}>
                <span className="text-[#6b6384]">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full rounded-xl bg-[#7f56d9] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#6941c6]"
          >
            Xong
          </button>
        </div>
      </main>
    );
  }

  if (words.length === 0) {
    return (
      <main className="bg-[#f7f4ff] px-4 py-16 text-[#2c1f4a] sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-5xl mb-6">🎉</p>
          <h1 className="font-display text-3xl font-bold mb-3">Hoàn thành rồi!</h1>
          <p className="text-[#6b6384] text-lg">Không có từ nào cần ôn hôm nay.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#f7f4ff] px-4 py-12 text-[#2c1f4a] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f56d9]">
            Spaced repetition
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Ôn tập hôm nay</h1>
          <p className="mt-2 text-[#6b6384]">{words.length} từ cần ôn</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {words.map((w) => (
            <Flashcard
              key={w.word}
              word={w.word}
              meaning={w.meaning}
              topic={w.topic}
              initialExample={w.example}
              initialSynonymData={{
                synonyms: w.synonyms ?? [],
                antonyms: w.antonyms ?? [],
              }}
              isReviewMode={true}
              onReviewed={handleReviewed}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
