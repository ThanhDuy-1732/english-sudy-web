"use client";

import { useState } from "react";

function normalize(word: string) { return word.toLowerCase().replace(/[.,!?;:'"“”]/g, ""); }
function highlightDiff(input: string, correct: string) {
  const inputWords = input.trim().split(/\s+/);
  const correctWords = correct.trim().split(/\s+/);
  const words = Array.from({ length: Math.max(inputWords.length, correctWords.length) }, (_, index) => correctWords[index] ?? inputWords[index]);
  return words.map((word, index) => {
    const match = index < correctWords.length && normalize(inputWords[index] ?? "") === normalize(word);
    return <span key={`${word}-${index}`} className={match ? "text-green-600" : "text-red-600 underline"}>{word}{" "}</span>;
  });
}

export default function DictationMode({ sentence }: { sentence: string }) {
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [playing, setPlaying] = useState(false);

  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = "en-US"; utterance.rate = 0.75;
    utterance.onstart = () => setPlaying(true); utterance.onend = () => setPlaying(false); utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  return <div className="mt-3 w-full space-y-3 text-left" onClick={(event) => event.stopPropagation()}>
    <p className="text-sm text-gray-500">Nghe và gõ lại câu:</p>
    <button type="button" onClick={speak} disabled={playing} className="min-h-11 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">{playing ? "Đang phát..." : "▶ Nghe câu"}</button>
    <textarea value={input} onChange={(event) => { setInput(event.target.value); setChecked(false); }} placeholder="Gõ lại câu bạn vừa nghe..." rows={2} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
    {!checked ? <button type="button" onClick={() => setChecked(true)} disabled={!input.trim()} className="min-h-11 w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">Kiểm tra</button> : <div className="rounded-lg bg-gray-50 p-3 text-sm"><p className="mb-1 font-medium">Kết quả:</p><p>{highlightDiff(input, sentence)}</p><p className="mt-2 text-xs text-gray-400">Câu đúng: {sentence}</p></div>}
  </div>;
}
