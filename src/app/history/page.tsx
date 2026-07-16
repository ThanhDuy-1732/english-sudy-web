"use client";

import { useEffect, useState } from "react";
import {
  deleteLearnedWord,
  getLearnedWords,
  type LearnedWord,
} from "@/lib/storage";

export default function HistoryPage() {
  const [words, setWords] = useState<LearnedWord[]>([]);
  const [filter, setFilter] = useState("Tất cả");

  useEffect(() => {
    setWords(getLearnedWords());
  }, []);

  function handleDelete(word: string) {
    deleteLearnedWord(word);
    const nextWords = words.filter((w) => w.word !== word);
    setWords(nextWords);

    if (filter !== "Tất cả" && !nextWords.some((entry) => entry.topic === filter)) {
      setFilter("Tất cả");
    }
  }

  const topics = ["Tất cả", ...Array.from(new Set(words.map((word) => word.topic)))];
  const filtered =
    filter === "Tất cả" ? words : words.filter((word) => word.topic === filter);

  return (
    <main className="bg-[#f7f4ff] px-4 py-12 text-[#2c1f4a] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-[32px] bg-[#2c1f4a] p-8 text-white shadow-2xl shadow-black/20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d9ecff]">
            Learning history
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold">Từ đã học</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#b0b0d1]">
            Xem lại các từ đã lưu, lọc theo chủ đề và dọn bớt những từ không còn cần luyện.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => setFilter(topic)}
              className={`min-h-10 rounded-full px-5 text-sm font-semibold transition-colors ${
                filter === topic
                  ? "bg-[#7f56d9] text-white"
                  : "bg-white text-[#6b6384] hover:bg-[#efe9ff]"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[28px] border border-[#e0d8ff] bg-white p-8 text-center shadow-sm">
            <p className="font-semibold">Chưa có từ nào được lưu.</p>
            <p className="mt-2 text-sm text-[#6b6384]">
              Quay lại trang học từ mới, lật thẻ và bấm Đã học để lưu từ.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {filtered.map((entry) => (
              <li
                key={entry.word}
                className="rounded-[24px] border border-[#e0d8ff] bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-3xl font-bold">{entry.word}</p>
                    <p className="mt-1 font-semibold text-[#7f56d9]">{entry.meaning}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.word)}
                    className="rounded-full bg-[#fff1f1] px-4 py-2 text-sm font-semibold text-red-500 transition-colors hover:bg-red-100"
                  >
                    Xóa
                  </button>
                </div>
                <p className="mt-4 text-sm italic leading-6 text-[#6b6384]">{entry.example}</p>
                <p className="mt-4 text-xs font-medium text-[#9b92b5]">
                  {entry.topic} - {new Date(entry.learnedAt).toLocaleDateString("vi-VN")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
