"use client";

import { useEffect, useState } from "react";
import { LANG_INFO, type LearnLang } from "@/lib/languages";
import { useVoiceSettings } from "@/lib/useVoiceSettings";

interface Props {
  word: string;
  lang?: LearnLang;
}

const normalized = (code: string) => code.toLowerCase().replace("_", "-");

/** Voices for a language: those whose lang starts with its 2-letter code (ko-KR, ko_KR…). Only decides whether the device can speak it. */
function voicesFor(lang: LearnLang): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const prefix = LANG_INFO[lang].voice.slice(0, 2).toLowerCase();
  return window.speechSynthesis.getVoices().filter((voice) => normalized(voice.lang).startsWith(prefix));
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
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const candidates = voicesFor(lang);
    const utterance = new SpeechSynthesisUtterance(word);
    // The saved voice if it speaks this language, else an exact match (en-US, zh-CN — never zh-HK Cantonese for
    // Mandarin), else none: the browser then picks its own default for utterance.lang, as before multi-language.
    const exact = normalized(LANG_INFO[lang].voice);
    const voice =
      candidates.find((item) => item.voiceURI === settings.voiceURI) ??
      candidates.find((item) => normalized(item.lang) === exact) ??
      null;
    if (voice) utterance.voice = voice;
    utterance.lang = LANG_INFO[lang].voice;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    window.speechSynthesis.speak(utterance);
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
