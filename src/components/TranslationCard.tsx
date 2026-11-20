"use client";

import { useState } from "react";
import { saveLearnedWord } from "@/lib/storage";
import { speakCode } from "@/lib/speech-voice";
import { useVoiceSettings } from "@/lib/useVoiceSettings";
import { TONES, TRANSLATE_INFO, type TranslationResult, type TranslateLang } from "@/lib/translate";
import { isLearnLang } from "@/lib/languages";

/** One tone of a translation: the phrase, its reading, when to use it, playback, copy, and "Gieo vào vườn". */
export function TranslationCard({
  result,
  to,
  vietnamese,
}: {
  result: TranslationResult;
  to: TranslateLang;
  vietnamese: string;
}) {
  const { settings } = useVoiceSettings();
  const [status, setStatus] = useState<string | null>(null);
  const [saved, setSaved] = useState<"new" | "exists" | null>(null);
  const info = TRANSLATE_INFO[to];
  const toneLabel = TONES.find((tone) => tone.tone === result.tone)?.label ?? result.tone;

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text);
      setStatus("Đã chép");
    } catch {
      setStatus("Không chép được");
    }
    window.setTimeout(() => setStatus(null), 2000);
  }

  function save() {
    let added: boolean;
    try {
      added = saveLearnedWord({
        word: result.text,
        meaning: vietnamese,
        example: "",
        topic: "Dịch",
        learnedAt: new Date().toISOString(),
        lang: isLearnLang(to) ? to : undefined,
        reading: result.reading,
      });
    } catch {
      setStatus("Không lưu được");
      return;
    }
    setSaved(added ? "new" : "exists");
  }

  return (
    <article className="postcard flex flex-col px-5 pb-4 pt-4">
      <div className="flex items-center justify-between text-sm text-muted">
        {toneLabel}
        <span lang={info.htmlLang} className="font-sans text-xs font-semibold text-primary-text">
          {info.short}
        </span>
      </div>
      <p
        lang={info.htmlLang}
        className={`pt-[1.5px] break-words text-2xl font-semibold leading-snug [overflow-wrap:anywhere] ${
          to === "en" || to === "vi" ? "font-en" : "font-sans"
        }`}
      >
        {result.text}
      </p>
      {result.reading && <p className="mt-1 text-sm text-muted">{result.reading}</p>}
      <p className="mt-2 text-sm leading-relaxed text-muted">{result.note}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => speakCode(result.text, info.voice, settings)}
          aria-label="Đọc to"
          className="chip"
        >
          🔊
        </button>
        <button type="button" onClick={copy} aria-label="Sao chép" className="chip">
          ⧉
        </button>
        {status && (
          <span role="status" className="text-xs text-muted">
            {status}
          </span>
        )}
        {isLearnLang(to) && (
          <button type="button" onClick={save} disabled={saved !== null} className="btn btn-secondary ml-auto text-sm disabled:opacity-60">
            {saved === "new" ? "Đã gieo" : saved === "exists" ? "Đã có trong vườn" : "Gieo vào vườn"}
          </button>
        )}
      </div>
    </article>
  );
}
