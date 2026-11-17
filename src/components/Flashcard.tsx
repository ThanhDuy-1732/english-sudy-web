"use client";

import { useEffect, useRef, useState } from "react";
import { getProfile } from "@/lib/profile";
import { saveLearnedWord, reviewWord, getLearnedWords } from "@/lib/storage";
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
  onReviewed?: (quality: 0 | 3 | 4 | 5) => void;
  onFlip?: () => void;
  /** Keyboard shortcuts for the active review card: Space/Enter flips, 1–4 grade (Quên, Khó, Được, Dễ). */
  shortcuts?: boolean;
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
  shortcuts = false,
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
    }
  }

  function grade(quality: 0 | 3 | 4 | 5) {
    reviewWord(word, quality);
    onReviewed?.(quality);
  }

  const flipRef = useRef(handleFlip);
  flipRef.current = handleFlip;
  const gradeRef = useRef(grade);
  gradeRef.current = grade;

  useEffect(() => {
    if (!shortcuts || !getProfile().shortcutsEnabled) return;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Typing, or a focused control that already reacts to Space/Enter.
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        void flipRef.current();
        return;
      }
      const quality = ({ "1": 0, "2": 3, "3": 4, "4": 5 } as const)[event.key as "1" | "2" | "3" | "4"];
      if (quality !== undefined && flipped) {
        event.preventDefault();
        gradeRef.current(quality);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts, flipped]);

  return (
    <div className={`relative [perspective:1000px] ${isReviewMode ? "h-[26rem] sm:h-96" : "h-80 sm:h-72"} ${shortcuts ? "rounded-xl ring-2 ring-primary/60 ring-offset-2 ring-offset-paper" : ""}`}>
      {/* Pronunciation button floats on front face — positioned outside the front button to avoid nesting <button> */}
      {!flipped && !loading && (
        <div className="absolute right-2 top-1.5 z-10">
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
          className="index-card absolute inset-0 flex h-full w-full flex-col rounded-xl border border-rule px-5 pb-5 text-left shadow-[0_1px_2px_rgb(22_35_63/0.06)] transition-[border-color,box-shadow] [backface-visibility:hidden] hover:border-primary/50 hover:shadow-[0_6px_20px_rgb(22_35_63/0.08)] disabled:cursor-wait"
        >
          <span className="flex h-14 shrink-0 items-center pr-12 text-sm text-muted">{topic === "Daily Communication" ? "Giao tiếp hằng ngày" : topic}</span>
          <span className="break-words pt-[1.5px] font-en text-[2rem] font-medium leading-[3.5rem] text-ink [overflow-wrap:anywhere]">
            {loading ? <span className="text-xl text-muted">Đang tạo câu ví dụ...</span> : word}
          </span>
          {!loading && <span className="text-sm leading-7 text-muted">Chạm để xem nghĩa</span>}
          {error && (
            <span className="mt-3 text-center text-sm text-red-700" role="alert">
              {error}
            </span>
          )}
        </button>

        {/* Back face */}
        <div
          aria-hidden={!flipped}
          className="index-card absolute inset-0 flex flex-col overflow-y-auto rounded-xl border border-rule px-5 pb-4 text-left shadow-[0_1px_2px_rgb(22_35_63/0.06)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <div className="flex h-14 shrink-0 items-center"><div role="group" aria-label="Cách học thẻ này" className="flex w-full gap-0.5 rounded-lg bg-paper p-0.5" onClick={(event) => event.stopPropagation()}>
            {(["study", "write", "fill", "dictation"] as CardMode[]).map((cardMode) => (
              <button key={cardMode} type="button" onClick={() => selectMode(cardMode)} aria-pressed={mode === cardMode} className={`min-h-9 flex-1 rounded-md px-1 text-xs font-medium transition-colors ${mode === cardMode ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                {cardMode === "study" ? "Nghĩa" : cardMode === "write" ? "Viết câu" : cardMode === "fill" ? "Điền từ" : "Nghe"}
              </button>
            ))}
          </div></div>
          {mode === "study" && <div className="pt-[1.5px]">
            <p className="break-words leading-7 [overflow-wrap:anywhere]"><span className="font-en text-lg font-medium text-ink">{word}</span> <span className="font-semibold text-primary">{meaning}</span></p>
            {example && <p className="break-words font-en text-[15px] italic leading-7 text-ink [overflow-wrap:anywhere]">{example}</p>}
            {synonymData && <div className="text-sm leading-7 text-muted">{synonymData.synonyms.length > 0 && <p><span className="font-medium text-ink">Đồng nghĩa</span>{" "}<span className="font-en">{synonymData.synonyms.join(", ")}</span></p>}{synonymData.antonyms.length > 0 && <p><span className="font-medium text-ink">Trái nghĩa</span>{" "}<span className="font-en">{synonymData.antonyms.join(", ")}</span></p>}</div>}
          </div>}
          {mode === "write" && <WritingChallenge word={word} />}
          {mode === "fill" && (fillSentence ? <FillBlank word={word} sentence={fillSentence} /> : <p className="text-sm text-muted">{fillLoading ? "Đang tạo câu điền từ..." : "Chưa có câu điền từ."}</p>)}
          {mode === "dictation" && (example ? <DictationMode sentence={example} /> : <p className="text-sm text-muted">Đang tạo câu ví dụ...</p>)}
          <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              tabIndex={flipped ? 0 : -1}
              onClick={handleFlip}
              className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Lật lại
            </button>
            {example && !isReviewMode && (
              <button
                type="button"
                tabIndex={flipped ? 0 : -1}
                onClick={handleSave}
                disabled={saved || !example}
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-strong disabled:bg-rule disabled:text-muted"
              >
                {saved ? "Đã lưu" : "Lưu để ôn"}
              </button>
            )}
          </div>
          {isReviewMode && (
            <div className="flex w-full flex-wrap gap-2">
              {(
                [
                  { label: "Quên", key: "1", quality: 0, cls: "bg-margin-soft text-ink hover:bg-margin/20" },
                  { label: "Khó", key: "2", quality: 3, cls: "bg-warn-soft text-ink hover:bg-warn/20" },
                  { label: "Được", key: "3", quality: 4, cls: "bg-primary-soft text-ink hover:bg-primary/20" },
                  { label: "Dễ", key: "4", quality: 5, cls: "bg-ok-soft text-ink hover:bg-ok/20" },
                ] as const
              ).map(({ label, key, quality, cls }) => (
                <button
                  key={quality}
                  type="button"
                  tabIndex={flipped ? 0 : -1}
                  onClick={(e) => {
                    e.stopPropagation();
                    grade(quality);
                  }}
                  className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium ${cls}`}
                >
                  {label}
                  {shortcuts && <kbd aria-hidden="true" className="ml-1.5 hidden rounded border border-ink/20 px-1 text-[11px] font-normal text-muted sm:inline">{key}</kbd>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
