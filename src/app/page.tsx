"use client";

import { useEffect, useState } from "react";
import { localDateKey } from "@/lib/date";
import FlashcardGrid from "@/components/FlashcardGrid";
import TopicSelector from "@/components/TopicSelector";
import QuizMode from "@/components/QuizMode";
import ReadingMode from "@/components/ReadingMode";
import { getDailyChallenge, getStreak, setDailyComplete } from "@/lib/daily-challenge";
import { useApiFetch } from "@/lib/useApiFetch";

interface Word {
  word: string;
  meaning: string;
}

interface ReadingData {
  passage: string;
  questions: { question: string; options: string[]; answer: string }[];
}

function parseReadingData(payload: unknown): ReadingData | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Partial<ReadingData>;
  if (typeof candidate.passage !== "string" || !Array.isArray(candidate.questions)) return null;
  const questions = candidate.questions.filter((question): question is ReadingData["questions"][number] => Boolean(question) && typeof question === "object" && typeof question.question === "string" && Array.isArray(question.options) && question.options.every((option) => typeof option === "string") && typeof question.answer === "string");
  return questions.length > 0 ? { passage: candidate.passage, questions } : null;
}

export default function HomePage() {
  const { fetchWithProvider } = useApiFetch();
  const [topic, setTopic] = useState("Daily Communication");
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flippedCount, setFlippedCount] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [readingData, setReadingData] = useState<ReadingData | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [streak, setStreak] = useState(0);
  const progress = words.length > 0 ? Math.round((flippedCount / words.length) * 100) : 0;

  useEffect(() => {
    const challenge = getDailyChallenge();
    setDailyCompleted(Boolean(challenge?.completed));
    setStreak(getStreak());
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setWords([]);
    setFlippedCount(0);
    setQuizOpen(false);
    setReadingData(null);

    try {
      const res = await fetchWithProvider("/api/generate-words", { topic });

      if (!res.ok) {
        throw new Error("Không thể sinh từ mới lúc này.");
      }

      const data = (await res.json()) as Word[];
      setWords(data);
    } catch {
      setError("Không thể sinh từ mới lúc này. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function handleTopicChange(nextTopic: string) {
    setTopic(nextTopic);
    setWords([]);
    setError(null);
    setFlippedCount(0);
    setQuizOpen(false);
    setReadingData(null);
  }

  async function handleReadingMode() {
    if (words.length === 0 || readingLoading) return;
    setReadingLoading(true);
    try {
      const response = await fetchWithProvider("/api/generate-reading", { words: words.map((word) => word.word) });
      if (!response.ok) throw new Error();
      const parsed = parseReadingData(await response.json());
      if (!parsed) throw new Error();
      setReadingData(parsed);
    } catch {
      setError("Không thể tạo bài đọc lúc này. Vui lòng thử lại.");
    } finally { setReadingLoading(false); }
  }

  function completeDailyChallenge() {
    if (words.length === 0 || flippedCount < words.length || dailyCompleted) return;
    const wordList = words.map((w) => w.word);
    setDailyComplete(wordList);
    setDailyCompleted(true);
    setStreak(getStreak());
  }

  const challengeLabel = dailyCompleted
    ? "Đã hoàn thành hôm nay"
    : words.length > 0 && flippedCount < words.length
      ? `Lật thêm ${words.length - flippedCount} thẻ để hoàn thành`
      : "Hoàn thành thử thách";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-8 lg:pt-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Từ mới</h1>
        <p className="page-lead">
          Chọn chủ đề và sinh 5 từ. Lật từng thẻ để xem nghĩa, câu ví dụ, rồi lưu những từ bạn muốn ôn lại.
        </p>
      </header>

      <section aria-label="Chọn chủ đề" className="mt-8 flex flex-col items-start gap-4">
        <TopicSelector value={topic} onChange={handleTopicChange} />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="min-h-12 shrink-0 rounded-xl bg-primary px-6 text-base font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Đang sinh từ..." : "Sinh từ mới"}
        </button>
      </section>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-margin/30 bg-margin/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      <section aria-label="Thử thách hằng ngày" className="mt-6 flex flex-col gap-3 rounded-xl border border-rule bg-card px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
        <p className="shrink-0 text-sm text-muted">
          Chuỗi ngày học <span className="marker-stroke text-lg font-semibold tabular-nums">{streak}</span>
        </p>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule" role="progressbar" aria-label="Thẻ đã lật" aria-valuemin={0} aria-valuemax={words.length || 5} aria-valuenow={flippedCount}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted">{Math.min(flippedCount, words.length)}/{words.length || 5} thẻ</span>
        </div>
        <button
          type="button"
          onClick={completeDailyChallenge}
          disabled={!words.length || flippedCount < words.length || dailyCompleted}
          className="min-h-11 shrink-0 rounded-lg border border-rule px-4 text-sm font-medium text-ink transition-colors enabled:hover:bg-marker enabled:hover:text-deep disabled:text-muted"
        >
          {challengeLabel}
        </button>
      </section>

      <section aria-label="Thẻ từ" className="mt-10">
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="index-card h-72 animate-pulse rounded-xl border border-rule" />
            ))}
            <p className="sr-only">Đang chuẩn bị bộ từ mới...</p>
          </div>
        )}

        {!loading && words.length === 0 && (
          <div className="index-card max-w-xl rounded-xl border border-rule px-6 pb-7">
            <p className="flex h-14 items-center text-sm text-muted">{topic === "Daily Communication" ? "Giao tiếp hằng ngày" : topic}</p>
            <p className="pt-[1.5px] font-en text-xl leading-7 text-ink">Chưa có thẻ nào.</p>
            <p className="text-base leading-7 text-muted">Bấm <strong className="font-semibold text-ink">Sinh từ mới</strong> để nhận 5 từ cho chủ đề này. Mỗi thẻ có nghĩa tiếng Việt, câu ví dụ, và bài luyện viết câu, điền từ, nghe chép.</p>
          </div>
        )}

        {words.length > 0 && (
          <>
            <FlashcardGrid words={words} topic={topic} onFlip={() => setFlippedCount((c) => c + 1)} />
            {flippedCount >= 3 && (
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setQuizOpen(true)}
                  className="min-h-11 rounded-xl bg-primary px-6 font-medium text-white transition-colors hover:bg-primary-strong"
                >
                  Kiểm tra kiến thức
                </button>
                <button
                  type="button"
                  onClick={handleReadingMode}
                  disabled={readingLoading}
                  className="min-h-11 rounded-xl border border-rule bg-card px-6 font-medium text-ink transition-colors hover:border-primary disabled:opacity-50"
                >
                  {readingLoading ? "Đang tạo bài đọc..." : "Đọc hiểu"}
                </button>
              </div>
            )}
            {quizOpen && (
              <QuizMode
                words={words.map((w) => ({ word: w.word, meaning: w.meaning }))}
                onClose={() => setQuizOpen(false)}
              />
            )}
          </>
        )}
        {readingData && <ReadingMode passage={readingData.passage} questions={readingData.questions} highlightWords={words.map((word) => word.word)} onClose={() => setReadingData(null)} />}
      </section>
    </main>
  );
}
