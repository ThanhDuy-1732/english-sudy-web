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
  const [masteryFilter, setMasteryFilter] = useState<"all" | "weak">("all");

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
  const filtered = words
    .filter((word) => filter === "Tất cả" || word.topic === filter)
    .filter((word) => masteryFilter === "all" || (word.mastery ?? 0) < 3);
  const dueCount = words.filter((word) => {
    return new Date(word.nextReviewAt ?? 0).getTime() <= Date.now();
  }).length;

  return (
    <main className="page-wide">
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Từ đã học</h1>
          <p className="page-lead">Theo dõi vốn từ và chọn nhóm cần ôn lại.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-64">
          <div className="panel p-4">
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink">{words.length}</p>
            <p className="mt-1 text-sm text-muted">Từ đã lưu</p>
          </div>
          <div className="panel p-4">
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink">{dueCount}</p>
            <p className="mt-1 text-sm text-muted">Đến hạn ôn</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {topics.map((topic) => (
          <button
            type="button"
            key={topic}
            onClick={() => setFilter(topic)}
            aria-pressed={filter === topic}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === topic
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {topic}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMasteryFilter((current) => (current === "all" ? "weak" : "all"))}
          aria-pressed={masteryFilter === "weak"}
          className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            masteryFilter === "weak"
              ? "border-orange-400 bg-orange-100 text-orange-700"
              : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
          }`}
        >
          {masteryFilter === "weak" ? "★ Chưa thành thạo ✓" : "★ Chưa thành thạo"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">Chưa có từ nào được lưu.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((entry) => (
            <li
              key={entry.word}
              className="flex items-start gap-3 panel p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="break-words font-bold text-gray-800 [overflow-wrap:anywhere]">
                    {entry.word}{" "}
                    <span className="font-normal text-gray-500">- {entry.meaning}</span>
                  </p>
                  <div className="flex shrink-0 gap-0.5" aria-label={`Mastery ${entry.mastery ?? 0} trên 5 sao`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={star <= (entry.mastery ?? 0) ? "text-amber-400" : "text-gray-200"}>★</span>
                    ))}
                  </div>
                </div>
                <p className="mt-1 break-words text-sm italic text-gray-600 [overflow-wrap:anywhere]">
                  {entry.example}
                </p>
                <p className="mt-1 break-words text-xs text-gray-600 [overflow-wrap:anywhere]">
                  {entry.topic} · {new Date(entry.learnedAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(entry.word)}
                aria-label={`Xóa ${entry.word}`}
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 hover:text-red-800"
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
