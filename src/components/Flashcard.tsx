"use client";

import { useState } from "react";
import { saveLearnedWord, updateWordReview } from "@/lib/storage";
import PronunciationButton from "./PronunciationButton";

interface FlashcardProps {
  word: string;
  meaning: string;
  topic: string;
  isReviewMode?: boolean;
  onReviewed?: () => void;
  onFlip?: () => void;
}

export default function Flashcard({
  word,
  meaning,
  topic,
  isReviewMode,
  onReviewed,
  onFlip,
}: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);
  const [example, setExample] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synonymData, setSynonymData] = useState<{
    synonyms: string[];
    antonyms: string[];
  } | null>(null);

  async function handleFlip() {
    if (!flipped && !example && !loading) {
      setLoading(true);
      setError(null);
      try {
        const [sentenceResult, synonymsResult] = await Promise.allSettled([
          fetch("/api/generate-sentence", {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ word }),
          }),
          fetch("/api/generate-synonyms", {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ word }),
          }),
        ]);

        if (sentenceResult.status === "rejected" || !sentenceResult.value.ok) {
          throw new Error();
        }
        const data = (await sentenceResult.value.json()) as { sentence: string };
        setExample(data.sentence);

        if (synonymsResult.status === "fulfilled" && synonymsResult.value.ok) {
          const synData = (await synonymsResult.value.json()) as {
            synonyms: string[];
            antonyms: string[];
          };
          setSynonymData(synData);
        }

        setFlipped(true);
        onFlip?.();
      } catch {
        setError("Không thể tạo câu ví dụ.");
      } finally {
        setLoading(false);
      }
    } else if (!loading) {
      setFlipped((current) => !current);
    }
  }

  function handleSave(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!example) return;
    const didSave = saveLearnedWord({
      word,
      meaning,
      example,
      topic,
      learnedAt: new Date().toISOString(),
    });
    if (didSave) setSaved(true);
  }

  return (
    <div className="relative h-64 [perspective:1000px] sm:h-60">
      {/* Pronunciation button floats on front face — positioned outside the front button to avoid nesting <button> */}
      {!flipped && !loading && (
        <div className="absolute bottom-4 right-4 z-10">
          <PronunciationButton word={word} />
        </div>
      )}

      <div
        className={`relative h-full w-full text-left transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Front face */}
        <button
          type="button"
          aria-label={`Xem nghĩa của ${word}`}
          aria-busy={loading}
          aria-hidden={flipped}
          tabIndex={flipped ? -1 : 0}
          onClick={handleFlip}
          disabled={loading}
          className="absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-xl bg-white p-4 shadow-md [backface-visibility:hidden] disabled:cursor-wait"
        >
          <span className="break-words text-center text-2xl font-bold text-gray-800 [overflow-wrap:anywhere]">
            {loading ? "Đang tạo câu ví dụ..." : word}
          </span>
          {error && (
            <span className="mt-3 text-center text-sm text-red-700" role="alert">
              {error}
            </span>
          )}
        </button>

        {/* Back face */}
        <div
          aria-hidden={!flipped}
          className="absolute inset-0 flex flex-col items-center gap-3 overflow-y-auto rounded-xl bg-blue-50 p-4 text-center shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <p className="break-words font-semibold text-blue-800 [overflow-wrap:anywhere]">
            {meaning}
          </p>
          {example && (
            <p className="break-words text-sm italic leading-6 text-gray-700 [overflow-wrap:anywhere]">
              {example}
            </p>
          )}
          {synonymData && (
            <div className="text-sm">
              {synonymData.synonyms.length > 0 && (
                <p>
                  <span className="text-green-600 font-medium">Đồng nghĩa:</span>{" "}
                  {synonymData.synonyms.join(", ")}
                </p>
              )}
              {synonymData.antonyms.length > 0 && (
                <p>
                  <span className="text-red-500 font-medium">Trái nghĩa:</span>{" "}
                  {synonymData.antonyms.join(", ")}
                </p>
              )}
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              tabIndex={flipped ? 0 : -1}
              onClick={handleFlip}
              className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-100"
            >
              Lật lại
            </button>
            {example && (
              <button
                type="button"
                tabIndex={flipped ? 0 : -1}
                onClick={handleSave}
                disabled={saved || !example}
                className="inline-flex min-h-11 items-center rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-50"
              >
                {saved ? "Đã lưu ✓" : "Đã học ✓"}
              </button>
            )}
          </div>
          {isReviewMode && (
            <div className="flex w-full gap-2">
              <button
                type="button"
                tabIndex={flipped ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  updateWordReview(word, true);
                  onReviewed?.();
                }}
                className="min-h-11 flex-1 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-200"
              >
                Nhớ tốt ✓
              </button>
              <button
                type="button"
                tabIndex={flipped ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  updateWordReview(word, false);
                  onReviewed?.();
                }}
                className="min-h-11 flex-1 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Quên ✗
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
