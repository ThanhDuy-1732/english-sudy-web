"use client";

import { useEffect, useRef, useState } from "react";
import { getProfile } from "@/lib/profile";
import { saveLearnedWord, reviewWord, getLearnedWords, type LearnedWord } from "@/lib/storage";
import { fsrs, fsrsStateOf, stabilityToMastery } from "@/lib/srs";
import Plant, { STAGE_NAMES, growthStage } from "./Plant";
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
  /** The saved word, in review mode: shows its growth stage and previews each grade (next stage, days until next review). */
  learned?: LearnedWord;
}

const TOPIC_LABELS: Record<string, string> = { "Daily Communication": "Giao tiếp hằng ngày" };

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
  learned,
}: FlashcardProps) {
  const stage = growthStage(learned?.mastery);
  // What each grade would do, computed with the same FSRS step the review uses.
  const preview = (quality: 0 | 3 | 4 | 5) => {
    if (!learned) return null;
    const next = fsrs(fsrsStateOf(learned), quality);
    return { stage: STAGE_NAMES[growthStage(stabilityToMastery(next.stability))], days: next.intervalDays };
  };
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
    <div className={`relative [perspective:1000px] ${isReviewMode ? "h-[28rem] sm:h-[26rem]" : "h-80"} ${shortcuts ? "rounded-2xl ring-2 ring-primary/60 ring-offset-4 ring-offset-paper" : ""}`}>
      {/* Pronunciation button floats on the front face, outside the front <button> to avoid nesting buttons */}
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
          className="postcard absolute inset-0 flex h-full w-full flex-col px-5 pb-5 pt-4 text-left transition-transform [backface-visibility:hidden] hover:-translate-y-0.5 disabled:cursor-wait"
        >
          <span className="pr-20 text-sm text-muted">{TOPIC_LABELS[topic] ?? topic}</span>
          <span className="stamp absolute right-3 top-3 h-[5.25rem] w-[4.5rem]"><span><Plant stage={stage} size={40} />{STAGE_NAMES[stage].toLowerCase()}</span></span>
          <span className="mt-auto break-words font-en text-[2.5rem] font-semibold leading-tight tracking-tight text-ink [overflow-wrap:anywhere]">
            {loading ? <span className="text-xl font-normal text-muted">Đang tạo câu ví dụ...</span> : word}
          </span>
          {!loading && <span className="mb-auto mt-1 text-sm font-medium text-primary-text">Chạm để lật thẻ</span>}
          {error && (
            <span className="mt-3 text-center text-sm text-margin" role="alert">
              {error}
            </span>
          )}
        </button>

        {/* Back face */}
        <div
          aria-hidden={!flipped}
          className="postcard absolute inset-0 flex flex-col gap-2 overflow-y-auto px-4 pb-4 pt-3 text-left [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <div className="flex shrink-0 items-center"><div role="group" aria-label="Cách học thẻ này" className="flex w-full gap-0.5 rounded-full bg-paper p-1" onClick={(event) => event.stopPropagation()}>
            {(["study", "write", "fill", "dictation"] as CardMode[]).map((cardMode) => (
              <button key={cardMode} type="button" onClick={() => selectMode(cardMode)} aria-pressed={mode === cardMode} className={`min-h-9 flex-1 rounded-full px-1 text-xs font-medium transition-colors ${mode === cardMode ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                {cardMode === "study" ? "Nghĩa" : cardMode === "write" ? "Viết câu" : cardMode === "fill" ? "Điền từ" : "Nghe"}
              </button>
            ))}
          </div></div>
          {mode === "study" && <div className="px-1">
            <p className="break-words font-en text-2xl font-semibold leading-tight text-ink [overflow-wrap:anywhere]">{word}</p>
            <p className="mt-1 break-words text-lg font-semibold text-primary-text [overflow-wrap:anywhere]">{meaning}</p>
            {example && <p className="mt-1 break-words font-en text-[15px] italic leading-relaxed text-ink [overflow-wrap:anywhere]">{example}</p>}
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
              className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Lật lại
            </button>
            {example && !isReviewMode && (
              <button
                type="button"
                tabIndex={flipped ? 0 : -1}
                onClick={handleSave}
                disabled={saved || !example}
                className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-strong disabled:bg-rule disabled:text-muted"
              >
                {saved ? "Đã gieo" : "Gieo vào vườn"}
              </button>
            )}
          </div>
          {isReviewMode && (
            <div className="grid w-full grid-cols-4 gap-1.5">
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
                  className={`flex min-h-14 flex-col items-center justify-center rounded-2xl px-1 py-1.5 text-sm font-semibold leading-tight ${cls}`}
                >
                  <span>
                    {label}
                    {shortcuts && <kbd aria-hidden="true" className="ml-1 hidden rounded border border-ink/20 px-1 text-[10px] font-normal text-muted sm:inline">{key}</kbd>}
                  </span>
                  {preview(quality) && (
                    <span aria-hidden="true" className="mt-0.5 text-[11px] font-normal text-muted">
                      {preview(quality)!.stage.toLowerCase()}, {preview(quality)!.days === 1 ? "mai" : `${preview(quality)!.days} ngày`}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
