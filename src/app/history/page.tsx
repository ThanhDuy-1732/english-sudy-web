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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Từ đã học</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {topics.map((topic) => (
          <button
            key={topic}
            onClick={() => setFilter(topic)}
            className={`rounded-full px-4 py-1 text-sm font-medium transition-colors ${
              filter === topic
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {topic}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500">Chưa có từ nào được lưu.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((entry) => (
            <li
              key={entry.word}
              className="flex items-start justify-between rounded-xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-bold text-gray-800">
                  {entry.word}{" "}
                  <span className="font-normal text-gray-500">- {entry.meaning}</span>
                </p>
                <p className="mt-1 text-sm italic text-gray-600">{entry.example}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {entry.topic} · {new Date(entry.learnedAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
              <button
                onClick={() => handleDelete(entry.word)}
                className="ml-4 text-sm text-red-400 transition-colors hover:text-red-600"
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
