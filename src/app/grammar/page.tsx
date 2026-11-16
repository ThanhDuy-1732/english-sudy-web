"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GrammarContent from "@/components/GrammarContent";
import GrammarSidebar from "@/components/GrammarSidebar";
import { STATIC_GRAMMAR_TOPICS, type GrammarTopic } from "@/lib/grammar-data";
import { getUserGrammarTopics, saveUserGrammarTopic } from "@/lib/grammar-storage";
import { getTopicProgress } from "@/lib/grammar-progress";
import { isBookmarked, toggleBookmark } from "@/lib/grammar-bookmarks";

export default function GrammarPage() {
  const [userTopics, setUserTopics] = useState<GrammarTopic[]>([]);
  const [selectedId, setSelectedId] = useState(STATIC_GRAMMAR_TOPICS[0].id);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [topicAccuracy, setTopicAccuracy] = useState<Record<string, number>>({});

  useEffect(() => {
    setUserTopics(getUserGrammarTopics());
    // Compute per-topic accuracy from grammar progress
    const allTopics = [...STATIC_GRAMMAR_TOPICS, ...getUserGrammarTopics()];
    const acc: Record<string, number> = {};
    for (const t of allTopics) {
      const prog = getTopicProgress(t.id);
      if (prog.length > 0) {
        acc[t.id] = Math.round(prog.reduce((s, p) => s + p.accuracy, 0) / prog.length);
      }
    }
    setTopicAccuracy(acc);
  }, []);

  const allTopics = [...STATIC_GRAMMAR_TOPICS, ...userTopics];
  const selectedTopic = allTopics.find((topic) => topic.id === selectedId) ?? allTopics[0];

  async function handleAddTopic(request: string) {
    setIsAdding(true);
    setError("");
    try {
      const response = await fetch("/api/grammar-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      if (!response.ok) throw new Error("Failed to generate grammar topic");
      const topic = (await response.json()) as GrammarTopic;
      const normalizedTopic = {
        ...topic,
        isUserGenerated: true,
        createdAt: topic.createdAt ?? new Date().toISOString(),
      };
      saveUserGrammarTopic(normalizedTopic);
      setUserTopics(getUserGrammarTopics());
      setSelectedId(normalizedTopic.id);
    } catch {
      setError("Không thể tạo chủ đề lúc này. Vui lòng thử lại.");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <span />
        <Link href="/grammar/quiz" className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500">
          Quiz Ngữ pháp
        </Link>
      </div>
      <div className="mb-4 md:hidden">
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="min-h-11 w-full rounded-lg bg-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
        >
          {allTopics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="flex min-w-0 flex-col gap-6 md:flex-row md:items-start">
        <div className="hidden md:block">
          <GrammarSidebar
            topics={allTopics}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddTopic={(request) => void handleAddTopic(request)}
            isAdding={isAdding}
            topicAccuracy={topicAccuracy}
          />
        </div>

        <div className="min-w-0 flex-1">
          <GrammarContent topic={selectedTopic} />
        </div>
      </div>

      <div className="mt-6 md:hidden">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-sm font-medium text-[#d9ecff]">Thêm chủ đề ngữ pháp</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const request = (formData.get("request") as string | null)?.trim();
              if (!request) return;
              void handleAddTopic(request);
              event.currentTarget.reset();
            }}
            className="flex min-w-0 gap-2"
          >
            <input
              name="request"
              type="text"
              placeholder="Nhập chủ đề mới..."
              disabled={isAdding}
              className="min-h-11 min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isAdding}
              className="min-h-11 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40"
            >
              {isAdding ? "..." : "+"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
