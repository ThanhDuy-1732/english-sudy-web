"use client";

import { useEffect, useState } from "react";
import { deleteCustomTopic, getCustomTopics, saveCustomTopic } from "@/lib/custom-topics";
import { DEFAULT_TOPICS, RANDOM_TOPIC, topicLabel } from "@/lib/topics";

const TOPICS = DEFAULT_TOPICS;
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
        <button
          type="button"
          onClick={() => onChange(RANDOM_TOPIC)}
          aria-pressed={value === RANDOM_TOPIC}
          className={`${CHIP} inline-flex items-center gap-1.5 rounded-full px-4 ${value === RANDOM_TOPIC ? ON : OFF}`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="4" />
            <g fill="currentColor" stroke="none"><circle cx="9" cy="9" r="1.4" /><circle cx="15" cy="15" r="1.4" /><circle cx="15" cy="9" r="1.4" /><circle cx="9" cy="15" r="1.4" /></g>
          </svg>
          {topicLabel(RANDOM_TOPIC)}
        </button>
        {TOPICS.map((topic) => (
          <button
            type="button"
            key={topic}
            onClick={() => onChange(topic)}
            aria-pressed={value === topic}
            className={`${CHIP} rounded-full px-4 ${value === topic ? ON : OFF}`}
          >
            {topicLabel(topic)}
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
          className="field min-w-0 flex-1 text-sm"
        />
        <button
          type="button"
          onClick={addTopic}
          disabled={!inputValue.trim()}
          className="btn btn-secondary"
        >
          Thêm chủ đề
        </button>
      </div>
    </div>
  );
}
