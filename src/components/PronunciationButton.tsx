"use client";

import { useEffect, useState } from "react";
import { LANG_INFO, type LearnLang } from "@/lib/languages";
import { useVoiceSettings } from "@/lib/useVoiceSettings";
import { speakText, voicesFor } from "@/lib/speech-voice";

interface Props {
  word: string;
  lang?: LearnLang;
}

export default function PronunciationButton({ word, lang = "en" }: Props) {
  const { settings } = useVoiceSettings();
  // Voices load asynchronously; until they do, assume the device can speak.
  const [missing, setMissing] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const hint = `Thiết bị chưa có giọng đọc ${LANG_INFO[lang].label}`;

  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    const check = () => {
      if (synth.getVoices().length > 0) setMissing(voicesFor(lang).length === 0);
    };
    check();
    synth.addEventListener?.("voiceschanged", check);
    return () => synth.removeEventListener?.("voiceschanged", check);
  }, [lang]);

  function speak() {
    speakText(word, lang, settings);
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={missing ? hint : `Nghe phát âm ${word}`}
        onClick={(e) => {
          e.stopPropagation();
          // No voice: say so on tap (a title tooltip never shows on phones).
          if (missing) setHintShown(true);
          else speak();
        }}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors hover:bg-primary-soft hover:text-primary-text ${missing ? "text-muted opacity-50" : "text-muted"}`}
        title={missing ? hint : "Nghe phát âm"}
      >
        🔊
      </button>
      {missing && hintShown && (
        <span role="status" className="absolute right-0 top-full z-20 mt-1 w-48 rounded-2xl border border-rule bg-card px-3 py-2 text-xs text-ink shadow-lg">
          {hint}. Cài thêm giọng đọc trong cài đặt của máy.
        </span>
      )}
    </span>
  );
}
