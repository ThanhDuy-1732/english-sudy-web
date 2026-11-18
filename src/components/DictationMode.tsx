"use client";

import { useState } from "react";
import { useVoiceSettings } from "@/lib/useVoiceSettings";

function normalize(word: string) { return word.toLowerCase().replace(/[.,!?;:'"“”]/g, ""); }
function highlightDiff(input: string, correct: string) {
  const inputWords = input.trim().split(/\s+/);
  const correctWords = correct.trim().split(/\s+/);
  const words = Array.from({ length: Math.max(inputWords.length, correctWords.length) }, (_, index) => correctWords[index] ?? inputWords[index]);
  return words.map((word, index) => {
    const match = index < correctWords.length && normalize(inputWords[index] ?? "") === normalize(word);
    return <span key={`${word}-${index}`} className={match ? "text-ok" : "text-margin underline"}>{word}{" "}</span>;
  });
}

export default function DictationMode({ sentence }: { sentence: string }) {
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const { settings } = useVoiceSettings();

  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const utterance = new SpeechSynthesisUtterance(sentence);
    const voice = voices.find((item) => item.voiceURI === settings.voiceURI) ?? null;
    if (voice) utterance.voice = voice;
    utterance.lang = "en-US"; utterance.rate = settings.rate; utterance.pitch = settings.pitch; utterance.volume = settings.volume;
    utterance.onstart = () => setPlaying(true); utterance.onend = () => setPlaying(false); utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  return <div className="mt-3 w-full space-y-3 text-left" onClick={(event) => event.stopPropagation()}>
    <p className="text-sm text-muted">Nghe và gõ lại câu:</p>
    <button type="button" onClick={speak} disabled={playing} className="min-h-11 w-full rounded-full border border-rule py-2 text-sm font-medium hover:bg-primary-soft/50 disabled:opacity-50">{playing ? "Đang phát..." : "▶ Nghe câu"}</button>
    <textarea value={input} onChange={(event) => { setInput(event.target.value); setChecked(false); }} placeholder="Gõ lại câu bạn vừa nghe..." rows={2} className="field w-full resize-none text-sm" />
    {!checked ? <button type="button" onClick={() => setChecked(true)} disabled={!input.trim()} className="btn btn-primary w-full disabled:opacity-50">Kiểm tra</button> : <div className="rounded-2xl bg-paper p-3 text-sm"><p className="mb-1 font-medium">Kết quả:</p><p>{highlightDiff(input, sentence)}</p><p className="mt-2 text-xs text-muted">Câu đúng: {sentence}</p></div>}
  </div>;
}
