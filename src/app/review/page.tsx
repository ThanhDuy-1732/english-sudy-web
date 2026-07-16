"use client";

import { useState, useEffect } from "react";
import { getWordsForReview, type LearnedWord } from "@/lib/storage";
import Flashcard from "@/components/Flashcard";

export default function ReviewPage() {
  const [words, setWords] = useState<LearnedWord[]>([]);

  useEffect(() => {
    setWords(getWordsForReview());
  }, []);

  function handleReviewed() {
    setWords(getWordsForReview());
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
              isReviewMode={true}
              onReviewed={handleReviewed}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
