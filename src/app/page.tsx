"use client";

import Plant from "@/components/Plant";
import { useEffect, useState } from "react";
import { localDateKey } from "@/lib/date";
import FlashcardGrid from "@/components/FlashcardGrid";
import TopicSelector from "@/components/TopicSelector";
import { topicLabel } from "@/lib/topics";
import QuizMode from "@/components/QuizMode";
import ReadingMode from "@/components/ReadingMode";
import { getDailyChallenge, getStreak, setDailyComplete } from "@/lib/daily-challenge";
import { useApiFetch } from "@/lib/useApiFetch";
import { WordBankPanel } from "@/components/WordBankPanel";
import {
  addBankWords,
  addConcepts,
  countBank,
  countConcepts,
  getUnseen,
  getUnseenConcepts,
  isEnglishOnly,
  markBankWordsSeen,
  markConceptsSeen,
  pickExcludeSample,
  takeUnseen,
  type Concept,
} from "@/lib/word-bank";
import ConceptCard from "@/components/ConceptCard";
import { useLearningLanguages } from "@/lib/useLearningLanguages";

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
  const [langs] = useLearningLanguages();
  const multi = !isEnglishOnly(langs);
  // Several languages: one card per meaning, a word per language.
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const cardCount = multi ? concepts.length : words.length;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flippedCount, setFlippedCount] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [readingData, setReadingData] = useState<ReadingData | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [streak, setStreak] = useState(0);
  const progress = cardCount > 0 ? Math.round((flippedCount / cardCount) * 100) : 0;

  useEffect(() => {
    const challenge = getDailyChallenge();
    setDailyCompleted(Boolean(challenge?.completed));
    setStreak(getStreak());
  }, []);

  // A different set of languages makes the cards on screen stale.
  useEffect(() => {
    setWords([]);
    setConcepts([]);
    setFlippedCount(0);
  }, [langs]);

  async function generateConcepts() {
    const ready = getUnseenConcepts(topic, langs, 5);
    if (ready.length === 5) {
      markConceptsSeen(ready);
      setConcepts(ready);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithProvider("/api/generate-words", {
        topic,
        langs,
        exclude: Object.fromEntries(langs.map((lang) => [lang, pickExcludeSample(topic, 200, lang)])),
        count: 20,
        knownCount: countConcepts(topic, langs),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { concepts?: Omit<Concept, "conceptId">[] };
      addConcepts(topic, Array.isArray(data.concepts) ? data.concepts : []);
      const picked = getUnseenConcepts(topic, langs, 5);
      if (picked.length === 0) {
        setError("Chủ đề này đã cạn từ mới. Thử chủ đề khác.");
        return;
      }
      markConceptsSeen(picked);
      setConcepts(picked);
    } catch {
      setError("Không thể sinh từ mới lúc này. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setError(null);
    setWords([]);
    setConcepts([]);
    setFlippedCount(0);
    setQuizOpen(false);
    setReadingData(null);
    if (multi) return generateConcepts();

    // Peek first: taking words here would mark them seen and then lose them when the
    // fallback below only shows the freshly generated batch.
    const ready = getUnseen(topic, 5);
    if (ready.length === 5) {
      markBankWordsSeen(ready.map((entry) => entry.word));
      setWords(ready.map(({ word, meaning }) => ({ word, meaning })));
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithProvider("/api/generate-words", {
        topic,
        exclude: pickExcludeSample(topic),
        count: 20,
        knownCount: countBank(topic),
      });

      if (!res.ok) {
        throw new Error("Không thể sinh từ mới lúc này.");
      }

      const data = (await res.json()) as Word[];
      addBankWords(
        data.map((entry) => ({ ...entry, topic, createdAt: new Date().toISOString() }))
      );

      const picked = takeUnseen(topic, 5);
      if (picked.length === 0) {
        setError("Chủ đề này đã cạn từ mới. Thử chủ đề khác.");
        return;
      }
      setWords(picked.map(({ word, meaning }) => ({ word, meaning })));
    } catch {
      setError("Không thể sinh từ mới lúc này. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function handleTopicChange(nextTopic: string) {
    setTopic(nextTopic);
    setWords([]);
    setConcepts([]);
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
    if (cardCount === 0 || flippedCount < cardCount || dailyCompleted) return;
    const wordList = multi ? concepts.flatMap((concept) => Object.values(concept.words).map((item) => item!.word)) : words.map((w) => w.word);
    setDailyComplete(wordList);
    setDailyCompleted(true);
    setStreak(getStreak());
  }

  const challengeLabel = dailyCompleted
    ? "Đã hoàn thành hôm nay"
    : cardCount > 0 && flippedCount < cardCount
      ? `Lật thêm ${cardCount - flippedCount} thẻ để hoàn thành`
      : "Hoàn thành thử thách";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-8 lg:pt-12">
      <header className="max-w-2xl">
        <h1 className="page-title">Gieo từ mới</h1>
        <p className="page-lead">Chọn một chủ đề, hoặc Ngẫu nhiên để trộn từ nhiều chủ đề, rồi gieo 5 từ. Lật từng bưu thiếp để xem nghĩa và câu ví dụ, rồi gieo những từ muốn giữ vào vườn để ôn.</p>
      </header>

      <section aria-label="Chọn chủ đề" className="mt-8 flex flex-col items-start gap-4">
        <TopicSelector value={topic} onChange={handleTopicChange} />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="btn btn-primary min-h-12 px-7 text-base disabled:cursor-wait"
        >
          {loading ? "Đang sinh từ..." : "Gieo 5 từ mới"}
        </button>
      </section>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-margin/30 bg-margin/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      <WordBankPanel topic={topic} langs={langs} />

      <section aria-label="Thử thách hằng ngày" className="panel mt-6 flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
        <p className="shrink-0 text-sm text-muted">
          Chuỗi ngày tưới vườn <span className="ml-1 rounded-full bg-marker px-2.5 py-0.5 font-display text-lg font-bold tabular-nums text-deep">{streak}</span>
        </p>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule" role="progressbar" aria-label="Thẻ đã lật" aria-valuemin={0} aria-valuemax={cardCount || 5} aria-valuenow={flippedCount}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted">{Math.min(flippedCount, cardCount)}/{cardCount || 5} thẻ</span>
        </div>
        <button
          type="button"
          onClick={completeDailyChallenge}
          disabled={!cardCount || flippedCount < cardCount || dailyCompleted}
          className="btn btn-secondary shrink-0 text-sm disabled:opacity-100 disabled:text-muted"
        >
          {challengeLabel}
        </button>
      </section>

      <section aria-label="Thẻ từ" className="mt-10">
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="postcard h-80 animate-pulse" />
            ))}
            <p className="sr-only">Đang chuẩn bị bộ từ mới...</p>
          </div>
        )}

        {!loading && cardCount === 0 && (
          <div className="postcard relative max-w-xl px-6 pb-7 pt-5">
            <span className="stamp absolute right-4 top-4 h-[5.25rem] w-[4.5rem]"><span><Plant stage={0} size={40} />hạt</span></span>
            <p className="pr-20 text-sm text-muted">{topicLabel(topic)}</p>
            <p className="mt-10 font-en text-2xl font-semibold text-ink">Chưa có bưu thiếp nào.</p>
            <p className="mt-2 text-base leading-7 text-muted">Bấm <strong className="font-semibold text-ink">Gieo 5 từ mới</strong> để nhận 5 từ cho chủ đề này. Mỗi bưu thiếp có nghĩa tiếng Việt, câu ví dụ, và bài luyện viết câu, điền từ, nghe chép.</p>
          </div>
        )}

        {multi && concepts.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {concepts.map((concept) => (
              <ConceptCard key={concept.conceptId} concept={concept} langs={langs} topic={topic} onFlip={() => setFlippedCount((c) => c + 1)} />
            ))}
          </div>
        )}

        {!multi && words.length > 0 && (
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
