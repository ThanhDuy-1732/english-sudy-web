"use client";

import { getProfile } from "@/lib/profile";
import RetentionNotice from "@/components/RetentionNotice";
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
  const [shortcutsOn, setShortcutsOn] = useState(false);
  useEffect(() => setShortcutsOn(getProfile().shortcutsEnabled), []);

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
      <main className="page">
        <div className="mx-auto max-w-md text-center">
          <h1 className="page-title mb-6">Ôn tập xong!</h1>
          <div className="mb-6 space-y-3 panel p-6 text-left">
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
                <span className="text-muted">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="btn btn-primary w-full"
          >
            Xong
          </button>
        </div>
      </main>
    );
  }

  if (words.length === 0) {
    return (
      <main className="page">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="page-title mb-3">Hoàn thành rồi!</h1>
          <p className="text-muted text-lg">Không có từ nào cần ôn hôm nay.</p>
          <RetentionNotice className="mt-8 text-left" />
        </div>
      </main>
    );
  }

  return (
    <main className="page-wide">
      <div>
        <div className="mb-8">
          <h1 className="page-title">Tưới vườn</h1>
          <p className="page-lead">{words.length} cây cần tưới. Nhớ đúng thì cây lớn thêm một bậc và được hẹn ôn xa hơn.</p>
          {shortcutsOn && (
            <p className="mt-3 hidden text-sm text-muted sm:block">
              Phím tắt cho thẻ đang viền xanh: <kbd className="rounded border border-rule bg-card px-1.5">Space</kbd> lật thẻ, <kbd className="rounded border border-rule bg-card px-1.5">1</kbd> Quên, <kbd className="rounded border border-rule bg-card px-1.5">2</kbd> Khó, <kbd className="rounded border border-rule bg-card px-1.5">3</kbd> Được, <kbd className="rounded border border-rule bg-card px-1.5">4</kbd> Dễ.
            </p>
          )}
          <RetentionNotice className="mt-4 max-w-2xl" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {words.map((w, index) => (
            <Flashcard
              shortcuts={index === 0}
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
              learned={w}
              onReviewed={handleReviewed}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
