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
    <div className="relative h-52 [perspective:1000px]">
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
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white p-4 shadow-md [backface-visibility:hidden]">
          <span className="text-center text-2xl font-bold text-gray-800">{word}</span>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-blue-50 p-4 shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {loading ? (
            <span className="text-gray-400">Đang tải...</span>
          ) : (
            <>
              <p className="text-center font-semibold text-blue-700">{meaning}</p>
              {example && <p className="text-center text-sm italic text-gray-600">{example}</p>}
              {error && <p className="text-center text-sm text-red-600">{error}</p>}
              <button
                onClick={handleSave}
                disabled={saved || !example}
                className="mt-2 rounded-lg bg-green-500 px-3 py-1 text-sm text-white disabled:opacity-50"
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
