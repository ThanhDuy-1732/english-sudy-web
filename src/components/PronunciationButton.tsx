"use client";

import { useEffect, useState } from "react";
import { LANG_INFO, type LearnLang } from "@/lib/languages";
import { useVoiceSettings } from "@/lib/useVoiceSettings";

interface Props {
  word: string;
  lang?: LearnLang;
}

/** Voices for a language: those whose lang starts with its 2-letter code (ko-KR, ko_KR…). */
function voicesFor(lang: LearnLang): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const prefix = LANG_INFO[lang].voice.slice(0, 2).toLowerCase();
  return window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(prefix));
}

export default function PronunciationButton({ word, lang = "en" }: Props) {
  const { settings } = useVoiceSettings();
  // Voices load asynchronously; until they do, assume the device can speak.
  const [missing, setMissing] = useState(false);

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
    // The saved voice is chosen for English; use it only when it speaks this language.
    const voice = candidates.find((item) => item.voiceURI === settings.voiceURI) ?? candidates[0] ?? null;
    if (voice) utterance.voice = voice;
    utterance.lang = LANG_INFO[lang].voice;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      aria-label={`Nghe phát âm ${word}`}
      disabled={missing}
      onClick={(e) => {
        e.stopPropagation();
        speak();
      }}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-primary-soft hover:text-primary-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      title={missing ? `Thiết bị chưa có giọng đọc ${LANG_INFO[lang].label}` : "Nghe phát âm"}
    >
      🔊
    </button>
  );
}
