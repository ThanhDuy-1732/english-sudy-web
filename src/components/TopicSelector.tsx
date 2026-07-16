"use client";

const TOPICS = ["Daily Communication", "TOEIC"];

interface TopicSelectorProps {
  value: string;
  onChange: (topic: string) => void;
}

export default function TopicSelector({ value, onChange }: TopicSelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {TOPICS.map((topic) => (
        <button
          key={topic}
          onClick={() => onChange(topic)}
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            value === topic
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {topic}
        </button>
      ))}
    </div>
  );
}
