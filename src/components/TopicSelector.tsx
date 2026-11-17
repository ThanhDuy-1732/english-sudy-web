"use client";

import { useEffect, useState } from "react";
import { deleteCustomTopic, getCustomTopics, saveCustomTopic } from "@/lib/custom-topics";

const TOPICS = ["Daily Communication", "TOEIC"];
// The topic string goes to the AI as-is; the chip shows a Vietnamese name.
const TOPIC_LABELS: Record<string, string> = { "Daily Communication": "Giao tiếp hằng ngày" };
const CHIP = "min-h-11 text-sm font-medium transition-colors";
const ON = "bg-ink text-paper";
const OFF = "border border-rule bg-card text-ink hover:border-primary";

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
      <div className="flex flex-wrap gap-2">
        {TOPICS.map((topic) => (
          <button
            type="button"
            key={topic}
            onClick={() => onChange(topic)}
            aria-pressed={value === topic}
            className={`${CHIP} rounded-full px-4 ${value === topic ? ON : OFF}`}
          >
            {TOPIC_LABELS[topic] ?? topic}
          </button>
        ))}
        {customTopics.map((topic) => (
          <div key={topic} className="flex min-w-0 max-w-full items-center overflow-hidden">
            <button
              type="button"
              onClick={() => onChange(topic)}
              aria-pressed={value === topic}
              className={`${CHIP} min-w-0 truncate rounded-l-full border-r-0 pl-4 pr-2 ${value === topic ? ON : OFF}`}
            >
              {topic}
            </button>
            <button
              type="button"
              onClick={() => removeTopic(topic)}
              aria-label={`Xóa chủ đề ${topic}`}
              className={`${CHIP} flex-none rounded-r-full border-l-0 pl-1 pr-3 ${value === topic ? `${ON} opacity-90` : `${OFF} text-muted`}`}
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
          placeholder="Chủ đề khác, ví dụ: du lịch"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-rule bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none sm:w-72 sm:flex-none"
        />
        <button
          type="button"
          onClick={addTopic}
          disabled={!inputValue.trim()}
          className="min-h-11 rounded-lg border border-rule bg-card px-4 py-2 text-sm font-medium text-ink transition-colors enabled:hover:border-primary disabled:text-muted"
        >
          Thêm chủ đề
        </button>
      </div>
    </div>
  );
}
