"use client";

import { useEffect, useState } from "react";
import { deleteCustomTopic, getCustomTopics, saveCustomTopic } from "@/lib/custom-topics";

const TOPICS = ["Daily Communication", "TOEIC"];

interface TopicSelectorProps {
  value: string;
  onChange: (topic: string) => void;
}

export default function TopicSelector({ value, onChange }: TopicSelectorProps) {
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => setCustomTopics(getCustomTopics()), []);

  function addTopic() {
    const topic = inputValue.trim();
    if (!topic) return;
    saveCustomTopic(topic);
    setCustomTopics(getCustomTopics());
    onChange(topic);
    setInputValue("");
  }

  function removeTopic(topic: string) {
    deleteCustomTopic(topic);
    setCustomTopics(getCustomTopics());
    if (value === topic) onChange(TOPICS[0]);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {TOPICS.map((topic) => (
          <button
            type="button"
            key={topic}
            onClick={() => onChange(topic)}
            aria-pressed={value === topic}
            className={`min-h-12 rounded-full px-5 text-sm font-semibold transition-colors ${
              value === topic
                ? "bg-[#7f56d9] text-white shadow-lg shadow-black/20"
                : "bg-white/10 text-[#d9ecff] hover:bg-white/15"
            }`}
          >
            {topic}
          </button>
        ))}
        {customTopics.map((topic) => (
          <div key={topic} className="flex min-w-0 max-w-full items-center overflow-hidden">
            <button
              type="button"
              onClick={() => onChange(topic)}
              aria-pressed={value === topic}
              className={`min-h-12 min-w-0 truncate rounded-l-full pl-5 pr-3 text-sm font-semibold transition-colors ${
                value === topic
                  ? "bg-[#7f56d9] text-white shadow-lg shadow-black/20"
                  : "bg-white/10 text-[#d9ecff] hover:bg-white/15"
              }`}
            >
              {topic}
            </button>
            <button
              type="button"
              onClick={() => removeTopic(topic)}
              aria-label={`Xóa chủ đề ${topic}`}
              className={`min-h-12 flex-none rounded-r-full pl-1 pr-4 text-sm transition-colors ${
                value === topic
                  ? "bg-[#7f56d9] text-white/70 shadow-lg shadow-black/20 hover:text-white"
                  : "bg-white/10 text-[#b0b0d1] hover:bg-white/15 hover:text-white"
              }`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 gap-2">
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") addTopic(); }}
          placeholder="Chủ đề khác... (nhấn Enter)"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-[#b0b0d1] focus:border-[#d9ecff] focus:outline-none"
        />
        <button
          type="button"
          onClick={addTopic}
          disabled={!inputValue.trim()}
          className="min-h-11 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-[#d9ecff] transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          + Thêm
        </button>
      </div>
    </div>
  );
}
