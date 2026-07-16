"use client";

interface Props {
  word: string;
}

export default function PronunciationButton({ word }: Props) {
  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
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
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
      title="Nghe phát âm"
    >
      🔊
    </button>
  );
}
