"use client";

import { useState } from "react";
import FlashcardGrid from "@/components/FlashcardGrid";
import TopicSelector from "@/components/TopicSelector";

interface Word {
  word: string;
  meaning: string;
}

export default function HomePage() {
  const [topic, setTopic] = useState("Daily Communication");
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setWords([]);

    try {
      const res = await fetch("/api/generate-words", {
        method: "POST",
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
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Học từ vựng tiếng Anh</h1>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <TopicSelector value={topic} onChange={handleTopicChange} />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Đang sinh từ..." : "Sinh từ mới"}
        </button>
      </div>

      {error && <p className="mb-6 text-sm text-red-600">{error}</p>}
      {words.length > 0 && <FlashcardGrid words={words} topic={topic} />}
    </main>
  );
}
