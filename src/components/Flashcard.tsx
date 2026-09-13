"use client";

import { useRef, useState } from "react";
import { saveLearnedWord, updateWordReview, updateWordReviewSm2, getLearnedWords } from "@/lib/storage";
import { pushWord } from "@/lib/sync";
import { useApiFetch } from "@/lib/useApiFetch";
import PronunciationButton from "./PronunciationButton";
import WritingChallenge from "./WritingChallenge";
import FillBlank from "./FillBlank";
import DictationMode from "./DictationMode";

type CardMode = "study" | "write" | "fill" | "dictation";

interface FlashcardProps {
  word: string;
  meaning: string;
  topic: string;
  initialExample?: string;
  initialSynonymData?: { synonyms: string[]; antonyms: string[] };
  isReviewMode?: boolean;
  onReviewed?: () => void;
  onFlip?: () => void;
}

export default function Flashcard({
  word,
  meaning,
  topic,
  initialExample,
  initialSynonymData,
  isReviewMode,
  onReviewed,
  onFlip,
}: FlashcardProps) {
  const { fetchWithProvider } = useApiFetch();
  const [flipped, setFlipped] = useState(false);
  const hasFlippedOnce = useRef(false);
  const [example, setExample] = useState<string | null>(initialExample ?? null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synonymData, setSynonymData] = useState<{
    synonyms: string[];
    antonyms: string[];
  } | null>(initialSynonymData ?? null);
  const [mode, setMode] = useState<CardMode>("study");
  const [fillSentence, setFillSentence] = useState<string | null>(null);
  const [fillLoading, setFillLoading] = useState(false);

  async function handleFlip() {
    if (!flipped && !loading) {
      const needsSentence = !example;
      const needsSynonyms = !synonymData;

      if (!needsSentence && !needsSynonyms) {
        setFlipped(true);
        if (!hasFlippedOnce.current) {
          hasFlippedOnce.current = true;
          onFlip?.();
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const requests: Promise<Response>[] = [];
        if (needsSentence) requests.push(fetchWithProvider("/api/generate-sentence", { word }));
        if (needsSynonyms) requests.push(fetchWithProvider("/api/generate-synonyms", { word }));
        const results = await Promise.allSettled(requests);
        let requestIndex = 0;

        if (needsSentence) {
          const sentenceResult = results[requestIndex++];
          if (sentenceResult?.status === "rejected" || !sentenceResult?.value.ok) throw new Error();
          const data = (await sentenceResult.value.json()) as { sentence: string };
          setExample(data.sentence);
        }
        if (needsSynonyms) {
          const synonymsResult = results[requestIndex++];
          if (synonymsResult?.status === "fulfilled" && synonymsResult.value.ok) {
            const synData = (await synonymsResult.value.json()) as {
            synonyms: string[];
            antonyms: string[];
            };
            setSynonymData(synData);
          }
        }
        setFlipped(true);
        if (!hasFlippedOnce.current) {
          hasFlippedOnce.current = true;
          onFlip?.();
        }
      } catch {
        setError("Không thể tạo câu ví dụ.");
      } finally {
        setLoading(false);
      }
    } else if (!loading) {
      setFlipped((current) => !current);
    }
  }

  async function loadFillSentence() {
    if (fillSentence || fillLoading) return;
    setFillLoading(true);
    try {
      const response = await fetchWithProvider("/api/generate-fillblank", { word });
      if (!response.ok) throw new Error();
      setFillSentence(((await response.json()) as { sentence: string }).sentence);
    } catch {
      setError("Không thể tạo bài điền từ.");
    } finally { setFillLoading(false); }
  }

  function selectMode(nextMode: CardMode) {
    setMode(nextMode);
    if (nextMode === "fill") void loadFillSentence();
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
      synonyms: synonymData?.synonyms,
      antonyms: synonymData?.antonyms,
    });
    if (didSave) {
      setSaved(true);
      const saved = getLearnedWords().find((w) => w.word === word);
      if (saved) void pushWord(saved);
    }
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
          <div className="flex w-full gap-1" onClick={(event) => event.stopPropagation()}>
            {(["study", "write", "fill", "dictation"] as CardMode[]).map((cardMode) => (
              <button key={cardMode} type="button" onClick={() => selectMode(cardMode)} className={`min-h-10 flex-1 rounded-lg px-1 text-[11px] font-medium transition-colors ${mode === cardMode ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-blue-100"}`}>
                {cardMode === "study" ? "Nghĩa" : cardMode === "write" ? "Viết câu" : cardMode === "fill" ? "Điền từ" : "Nghe"}
              </button>
            ))}
          </div>
          {mode === "study" && <>
            <p className="break-words font-semibold text-blue-800 [overflow-wrap:anywhere]">{meaning}</p>
            {example && <p className="break-words text-sm italic leading-6 text-gray-700 [overflow-wrap:anywhere]">{example}</p>}
            {synonymData && <div className="text-sm">{synonymData.synonyms.length > 0 && <p><span className="font-medium text-green-600">Đồng nghĩa:</span>{" "}{synonymData.synonyms.join(", ")}</p>}{synonymData.antonyms.length > 0 && <p><span className="font-medium text-red-500">Trái nghĩa:</span>{" "}{synonymData.antonyms.join(", ")}</p>}</div>}
          </>}
          {mode === "write" && <WritingChallenge word={word} />}
          {mode === "fill" && (fillSentence ? <FillBlank word={word} sentence={fillSentence} /> : <p className="text-sm text-gray-500">{fillLoading ? "Đang tạo câu điền từ..." : "Chưa có câu điền từ."}</p>)}
          {mode === "dictation" && (example ? <DictationMode sentence={example} /> : <p className="text-sm text-gray-500">Đang tạo câu ví dụ...</p>)}
          <div className="mt-auto flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              tabIndex={flipped ? 0 : -1}
              onClick={handleFlip}
              className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-100"
            >
              Lật lại
            </button>
            {example && !isReviewMode && (
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
            <div className="flex w-full flex-wrap gap-2">
              {(
                [
                  { label: "Quên", quality: 0, cls: "bg-red-100 text-red-800 hover:bg-red-200" },
                  { label: "Khó", quality: 3, cls: "bg-orange-100 text-orange-800 hover:bg-orange-200" },
                  { label: "Được", quality: 4, cls: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
                  { label: "Dễ", quality: 5, cls: "bg-green-100 text-green-800 hover:bg-green-200" },
                ] as const
              ).map(({ label, quality, cls }) => (
                <button
                  key={quality}
                  type="button"
                  tabIndex={flipped ? 0 : -1}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateWordReviewSm2(word, quality);
                    const updated = getLearnedWords().find((w) => w.word === word);
                    if (updated) void pushWord(updated);
                    onReviewed?.();
                  }}
                  className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium ${cls}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
