"use client";

import { useState } from "react";
import { type GrammarTopic } from "@/lib/grammar-data";

interface Props {
  topics: GrammarTopic[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddTopic: (request: string) => void;
  isAdding: boolean;
  topicAccuracy?: Record<string, number>;
}

export default function GrammarSidebar({
  topics,
  selectedId,
  onSelect,
  onAddTopic,
  isAdding,
  topicAccuracy = {},
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
      <p className="mb-2 px-2 text-[13px] font-medium text-muted">
        Chủ đề ngữ pháp
      </p>
      {topics.map((topic) => (
        <div key={topic.id}>
          <button
            type="button"
            onClick={() => onSelect(topic.id)}
            className={`flex min-h-11 min-w-0 w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              selectedId === topic.id
                ? "bg-primary-soft font-medium text-primary-text"
                : "text-muted hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <span className="min-w-0 flex-1 truncate">{topic.name}</span>
            {topicAccuracy[topic.id] !== undefined ? (
              <span className="ml-2 flex-none text-xs text-muted">{topicAccuracy[topic.id]}%</span>
            ) : (
              <span className="ml-2 flex-none text-xs text-muted">{topic.rules.length}</span>
            )}
          </button>
          {topicAccuracy[topic.id] !== undefined && (
            <div className="mx-3 mb-1 h-1 rounded bg-ink/5">
              <div
                className="h-1 rounded bg-primary"
                style={{ width: `${topicAccuracy[topic.id]}%` }}
              />
            </div>
          )}
        </div>
      ))}

      <div className="mt-4 border-t border-rule pt-4">
        <form aria-label="form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={isAdding}
            placeholder="Nhập chủ đề mới..."
            className="min-h-11 w-full rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || isAdding}
            className="btn btn-primary mt-2 w-full"
          >
            {isAdding ? "Đang tạo..." : "+ Thêm chủ đề"}
          </button>
        </form>
      </div>
    </aside>
  );
}
