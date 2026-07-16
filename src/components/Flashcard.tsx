"use client";

import { useState } from "react";
import { saveLearnedWord } from "@/lib/storage";

interface FlashcardProps {
  word: string;
  meaning: string;
  topic: string;
}

export default function Flashcard({ word, meaning, topic }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);
  const [example, setExample] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFlip() {
    if (!flipped && !example && !loading) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/generate-sentence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word }),
        });
        if (!res.ok) {
          throw new Error();
        }
        const data = (await res.json()) as { sentence: string };
        setExample(data.sentence);
        setFlipped(true);   // ← flip AFTER fetch succeeds
      } catch {
        setError("Không thể tạo câu ví dụ.");
      } finally {
        setLoading(false);
      }
    } else if (!loading) {
      // Only toggle when not mid-fetch
      setFlipped((current) => !current);
    }
  }

  function handleSave(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!example) return;
    const didSave = saveLearnedWord({ word, meaning, example, topic, learnedAt: new Date().toISOString() });
    if (didSave) setSaved(true);
  }

  return (
    <div className="relative h-64 [perspective:1200px]">
      <div
        aria-label={word}
        role="button"
        tabIndex={0}
        onClick={handleFlip}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void handleFlip();
          }
        }}
        className={`relative h-full w-full text-left transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div className="absolute inset-0 flex flex-col justify-between rounded-[24px] border border-[#e0d8ff] bg-white p-5 shadow-sm [backface-visibility:hidden]">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-[#f4f2ff] px-3 py-1 text-xs font-semibold text-[#7f56d9]">
              {topic}
            </span>
            <span className="text-xs font-medium text-[#9b92b5]">Tap to flip</span>
          </div>
          <div>
            <p className="font-display text-4xl font-bold leading-tight text-[#2c1f4a]">
              {word}
            </p>
            <p className="mt-4 text-sm leading-6 text-[#6b6384]">
              Tạo câu ví dụ và luyện ghi nhớ nghĩa theo ngữ cảnh.
            </p>
          </div>
          <div className="h-2 rounded-full bg-[#f0ebff]">
            <div className="h-2 w-1/2 rounded-full bg-[#7f56d9]" />
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col justify-between rounded-[24px] border border-white/10 bg-[#2c1f4a] p-5 text-white shadow-xl shadow-[#2c1f4a]/25 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-[#b0b0d1]">Đang tải...</span>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-semibold text-[#d9ecff]">Meaning</p>
                <p className="mt-2 text-2xl font-bold">{meaning}</p>
                {example && (
                  <p className="mt-4 text-sm italic leading-6 text-[#b0b0d1]">{example}</p>
                )}
                {error && <p className="mt-4 text-sm text-red-200">{error}</p>}
              </div>
              <button
                onClick={handleSave}
                disabled={saved || !example}
                className="mt-4 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-[#2c1f4a] transition-colors hover:bg-[#d9ecff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saved ? "Đã lưu ✓" : "Đã học ✓"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
