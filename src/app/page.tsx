"use client";

import { useEffect, useState } from "react";
import { localDateKey } from "@/lib/date";
import FlashcardGrid from "@/components/FlashcardGrid";
import TopicSelector from "@/components/TopicSelector";
import QuizMode from "@/components/QuizMode";
import ReadingMode from "@/components/ReadingMode";
import { getDailyChallenge, getStreak, setDailyComplete } from "@/lib/daily-challenge";
import { pushChallenge } from "@/lib/sync";
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
    void pushChallenge({ date: localDateKey(), words: wordList, completed: true });
    setDailyCompleted(true);
    setStreak(getStreak());
  }

  return (
    <main className="overflow-hidden">
      <section className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div className="relative z-10">
          <p className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-[#d9ecff]">
            Online vocabulary studio
          </p>
          <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
            Best words are waiting to enrich your skill
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#b0b0d1]">
            Chọn chủ đề, sinh bộ từ mới bằng AI, lật thẻ để xem nghĩa và lưu lại những từ đã học.
          </p>

          <div className="mt-8 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/20 backdrop-blur sm:flex-row sm:items-center">
            <TopicSelector value={topic} onChange={handleTopicChange} />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="min-h-12 rounded-full bg-white px-7 text-sm font-semibold text-[#2c1f4a] shadow-lg shadow-black/20 transition-colors hover:bg-[#d9ecff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Đang sinh từ..." : "Sinh từ mới"}
            </button>
          </div>

          {error && (
            <p className="mt-5 rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#d9ecff]/20 bg-[#d9ecff]/10 p-4 text-[#d9ecff] sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold">Daily Challenge · 🔥 {streak} ngày liên tiếp</p><p className="mt-1 text-xs text-[#b0b0d1]">Sinh bộ từ hôm nay, luyện và đánh dấu hoàn thành để giữ streak.</p></div>
            <button type="button" onClick={completeDailyChallenge} disabled={!words.length || flippedCount < words.length || dailyCompleted} className="min-h-11 shrink-0 rounded-xl bg-[#d9ecff] px-4 text-sm font-semibold text-[#2c1f4a] disabled:opacity-50">{dailyCompleted ? "Đã hoàn thành ✓" : words.length && flippedCount < words.length ? "Lật hết thẻ" : "Đánh dấu hoàn thành"}</button>
          </div>
        </div>

        <aside className="relative z-10 rounded-[32px] border border-white/10 bg-[#3a2a61] p-5 shadow-2xl shadow-black/25">
          <div className="rounded-[24px] bg-[#f4f2ff] p-5 text-[#2c1f4a]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#7f56d9]">Today lesson</p>
                <h2 className="mt-1 font-display text-3xl font-bold">English Study</h2>
              </div>
              <span className="rounded-full bg-[#2c1f4a] px-4 py-2 text-sm font-semibold text-white">
                AI
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [String(words.length), "Words ready"],
                [topic ? "1" : "0", "Topic"],
                [`${progress}%`, "Progress"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="font-display text-3xl font-bold">{value}</p>
                  <p className="mt-1 text-sm text-[#6b6384]">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-[#2c1f4a] p-5 text-white">
              <p className="text-sm text-[#b0b0d1]">Current category</p>
              <p className="mt-2 text-xl font-semibold">{topic}</p>
              <div className="mt-5 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-[#d9ecff] transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="bg-[#f7f4ff] px-4 py-12 text-[#2c1f4a] sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f56d9]">
                Popular courses
              </p>
              <h2 className="mt-2 font-display text-4xl font-bold">Flashcard Practice</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[#6b6384]">
              Bấm vào từng thẻ để tạo câu ví dụ. Khi đã chắc nghĩa và ngữ cảnh, lưu vào lịch sử học.
            </p>
          </div>

          {loading && (
            <div className="rounded-[28px] border border-[#d8d0ff] bg-white p-8 text-center shadow-sm">
              <p className="font-semibold text-[#2c1f4a]">Đang chuẩn bị bộ từ mới...</p>
              <p className="mt-2 text-sm text-[#6b6384]">AI đang chọn các từ phù hợp với chủ đề.</p>
            </div>
          )}

          {!loading && words.length === 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {["Choose a topic", "Generate words", "Flip and save"].map((step, index) => (
                <div
                  key={step}
                  className="rounded-[24px] border border-[#e0d8ff] bg-white p-6 shadow-sm"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2c1f4a] font-display text-xl font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold">{step}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6b6384]">
                    {index === 0
                      ? "Bắt đầu với giao tiếp hằng ngày hoặc luyện TOEIC."
                      : index === 1
                        ? "Nhận một nhóm từ có nghĩa tiếng Việt rõ ràng."
                        : "Tạo câu ví dụ, lật thẻ và đánh dấu từ đã học."}
                  </p>
                </div>
              ))}
            </div>
          )}

          {words.length > 0 && (
            <>
              <FlashcardGrid
                words={words}
                topic={topic}
                onFlip={() => setFlippedCount((c) => c + 1)}
              />
              {flippedCount >= 3 && (
                <div className="mt-8 flex flex-wrap justify-center gap-3 text-center">
                  <button
                    type="button"
                    onClick={() => setQuizOpen(true)}
                    className="rounded-xl bg-[#7f56d9] px-8 py-3 font-medium text-white hover:bg-[#6941c6]"
                  >
                    Kiểm tra kiến thức
                  </button>
                  <button type="button" onClick={handleReadingMode} disabled={readingLoading} className="rounded-xl bg-teal-500 px-8 py-3 font-medium text-white hover:bg-teal-600 disabled:opacity-50">{readingLoading ? "Đang tạo bài đọc..." : "Đọc hiểu"}</button>
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
        </div>
      </section>
    </main>
  );
}
