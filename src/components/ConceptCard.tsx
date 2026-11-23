"use client";

import { useRef, useState } from "react";
import LangText from "./LangText";
import PronunciationButton from "./PronunciationButton";
import { LANG_INFO, type LearnLang } from "@/lib/languages";
import { saveLearnedWord } from "@/lib/storage";
import { logActivity } from "@/lib/sessions";
import { topicLabel } from "@/lib/topics";
import { useApiFetch } from "@/lib/useApiFetch";
import type { Concept } from "@/lib/word-bank";

type Example = { sentence: string; reading?: string; translation?: string };

/**
 * One meaning in several languages, as a postcard. Front: each language's word, reading and voice.
 * Back: the Vietnamese meaning and an example per language. Saving plants one word per language.
 */
export default function ConceptCard({ concept, langs, topic, onFlip }: { concept: Concept; langs: LearnLang[]; topic: string; onFlip?: () => void }) {
  const { fetchWithProvider } = useApiFetch();
  const [flipped, setFlipped] = useState(false);
  const [examples, setExamples] = useState<Partial<Record<LearnLang, Example | null>>>({});
  const [saved, setSaved] = useState<"new" | "exists" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  // Examples are requested (and the flip counted) once, even if the card is flipped back before they arrive.
  const requested = useRef(false);
  const shown = langs.filter((lang) => concept.words[lang]);
  const names = shown.map((lang) => concept.words[lang]!.word).join(", ");

  async function flip() {
    const first = !flipped && !requested.current;
    setFlipped((value) => !value);
    if (!first) return;
    requested.current = true;
    onFlip?.();
    const results = await Promise.all(
      shown.map(async (lang) => {
        try {
          const res = await fetchWithProvider("/api/generate-sentence", { word: concept.words[lang]!.word, lang });
          return [lang, res.ok ? ((await res.json()) as Example) : null] as const;
        } catch {
          return [lang, null] as const;
        }
      })
    );
    setExamples(Object.fromEntries(results));
  }

  // Saving waits for every example: a word saved mid-load would keep an empty example for good.
  const examplesLoading = shown.some((lang) => examples[lang] === undefined);

  function save() {
    const learnedAt = new Date().toISOString();
    let added = 0;
    try {
      for (const lang of shown) {
        const item = concept.words[lang]!;
        if (saveLearnedWord({
        word: item.word,
        meaning: concept.meaning,
        example: examples[lang]?.sentence ?? "",
        topic,
        learnedAt,
        lang,
        conceptId: concept.conceptId,
        ...(item.reading ? { reading: item.reading } : {}),
        }))
          added += 1;
      }
    } catch {
      setStatus("Không lưu được");
      return;
    }
    setStatus(null);
    setSaved(added > 0 ? "new" : "exists");
    if (added > 0) logActivity("vocabulary", "flashcards");
  }

  return (
    <article className="postcard flex min-h-80 flex-col px-5 pb-4 pt-4">
      <p className="text-sm text-muted">{topicLabel(topic)}</p>

      {!flipped ? (
        <>
          <ul className="mt-4 flex flex-1 flex-col gap-3">
            {shown.map((lang) => {
              const item = concept.words[lang]!;
              return (
                <li key={lang} className="flex items-start gap-2">
                  <span className="mt-1.5 w-7 shrink-0 text-xs font-semibold text-muted">{LANG_INFO[lang].short}</span>
                  <LangText lang={lang} word={item.word} reading={item.reading} size="md" className="flex-1" />
                  <PronunciationButton word={item.word} lang={lang} />
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={flip} aria-label={`Xem nghĩa của ${names}`} className="btn btn-secondary mt-4 self-start">
            Chạm để lật thẻ
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-xl font-semibold text-primary-text">{concept.meaning}</p>
          <ul className="mt-3 flex flex-1 flex-col gap-3">
            {shown.map((lang) => {
              const example = examples[lang];
              return (
                <li key={lang} className="text-sm">
                  <span className="mr-2 text-xs font-semibold text-muted">{LANG_INFO[lang].short}</span>
                  {example === undefined ? (
                    <span className="text-muted">Đang tạo câu ví dụ…</span>
                  ) : example === null ? (
                    <span className="text-muted">Chưa tạo được câu ví dụ.</span>
                  ) : (
                    <span className="inline-flex flex-col">
                      <span lang={LANG_INFO[lang].htmlLang} className={`${lang === "en" ? "font-en italic" : ""} text-base text-ink`}>{example.sentence}</span>
                      {example.reading && <span className="text-muted">{example.reading}</span>}
                      {example.translation && <span className="text-muted">{example.translation}</span>}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={flip} className="btn btn-secondary">Lật lại</button>
            <button type="button" onClick={save} disabled={saved !== null || examplesLoading} className="btn btn-primary">
              {saved === "new" ? "Đã gieo" : saved === "exists" ? "Đã có trong vườn" : examplesLoading ? "Đang tải ví dụ…" : "Gieo vào vườn"}
            </button>
            {status && <span role="status" className="self-center text-sm text-margin">{status}</span>}
          </div>
        </>
      )}
    </article>
  );
}
