"use client";

import { useState } from "react";
import FlashcardGrid from "@/components/FlashcardGrid";
import TopicSelector from "@/components/TopicSelector";
import QuizMode from "@/components/QuizMode";

interface Word {
  word: string;
  meaning: string;
}

export default function HomePage() {
  const [topic, setTopic] = useState("Daily Communication");
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flippedCount, setFlippedCount] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setWords([]);
    setFlippedCount(0);
    setQuizOpen(false);

    try {
      const res = await fetch("/api/generate-words", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

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
                ["10x", "Words"],
                ["2", "Topics"],
                ["30s", "Practice"],
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
                <div className="h-2 w-2/3 rounded-full bg-[#d9ecff]" />
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
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={() => setQuizOpen(true)}
                    className="rounded-xl bg-[#7f56d9] px-8 py-3 font-medium text-white hover:bg-[#6941c6]"
                  >
                    Kiểm tra kiến thức
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
        </div>
      </section>
    </main>
  );
}
