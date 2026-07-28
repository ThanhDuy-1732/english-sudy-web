"use client";

import { useState } from "react";
import { type GrammarTopic } from "@/lib/grammar-data";

interface Props {
  topics: GrammarTopic[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddTopic: (request: string) => void;
  isAdding: boolean;
}

export default function GrammarSidebar({
  topics,
  selectedId,
  onSelect,
  onAddTopic,
  isAdding,
}: Props) {
  const [input, setInput] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onAddTopic(trimmed);
    setInput("");
  }

  return (
    <aside className="flex w-64 flex-none flex-col gap-1">
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-[#b0b0d1]">
        Chủ đề ngữ pháp
      </p>
      {topics.map((topic) => (
        <button
          key={topic.id}
          type="button"
          onClick={() => onSelect(topic.id)}
          className={`flex min-h-11 min-w-0 items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
            selectedId === topic.id
              ? "bg-purple-600/40 font-medium text-white"
              : "text-[#b0b0d1] hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className="min-w-0 truncate">{topic.name}</span>
          <span className="ml-2 flex-none text-xs text-white/40">{topic.rules.length}</span>
        </button>
      ))}

      <div className="mt-4 border-t border-white/10 pt-4">
        <form aria-label="form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={isAdding}
            placeholder="Nhập chủ đề mới..."
            className="min-h-11 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || isAdding}
            className="mt-2 min-h-11 w-full rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40"
          >
            {isAdding ? "Đang tạo..." : "+ Thêm chủ đề"}
          </button>
        </form>
      </div>
    </aside>
  );
}
