"use client";

import { useVoiceSettings } from "@/lib/useVoiceSettings";

interface Props {
  word: string;
}

export default function PronunciationButton({ word }: Props) {
  const { settings } = useVoiceSettings();

  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    const utterance = new SpeechSynthesisUtterance(word);
    const voice = voices.find((item) => item.voiceURI === settings.voiceURI) ?? null;
    if (voice) utterance.voice = voice;
    utterance.lang = "en-US";
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      aria-label={`Nghe phát âm ${word}`}
      onClick={(e) => {
        e.stopPropagation();
        speak();
      }}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-primary-soft hover:text-primary-text"
      title="Nghe phát âm"
    >
      🔊
    </button>
  );
}
