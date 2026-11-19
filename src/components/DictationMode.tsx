"use client";

import { useState } from "react";
import { normalizeAnswer } from "@/lib/answer-match";
import { LANG_INFO, type LearnLang } from "@/lib/languages";
import { speakText } from "@/lib/speech-voice";
import { useVoiceSettings } from "@/lib/useVoiceSettings";

function normalize(word: string) { return word.toLowerCase().replace(/[.,!?;:'"“”]/g, ""); }

/** Word by word, as the sentence is written (English, Korean). */
function highlightWords(input: string, correct: string) {
  const inputWords = input.trim().split(/\s+/);
  const correctWords = correct.trim().split(/\s+/);
  const words = Array.from({ length: Math.max(inputWords.length, correctWords.length) }, (_, index) => correctWords[index] ?? inputWords[index]);
  return words.map((word, index) => {
    const match = index < correctWords.length && normalize(inputWords[index] ?? "") === normalize(word);
    return <span key={`${word}-${index}`} className={match ? "text-ok" : "text-margin underline"}>{word}{" "}</span>;
  });
}

/** Character by character for Chinese and Japanese: spaces and punctuation in either text are ignored. */
function highlightChars(input: string, correct: string, lang: LearnLang) {
  const typed = [...normalizeAnswer(input, lang)];
  let position = 0;
  return [...correct].map((char, index) => {
    if (!normalizeAnswer(char, lang)) return <span key={index}>{char}</span>;
    const match = typed[position] === char.toLowerCase();
    position += 1;
    return <span key={index} className={match ? "text-ok" : "text-margin underline"}>{char}</span>;
  });
}

export default function DictationMode({ sentence, lang = "en" }: { sentence: string; lang?: LearnLang }) {
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const { settings } = useVoiceSettings();
  const byChar = lang === "zh" || lang === "ja";

  function speak() {
    speakText(sentence, lang, settings, { onstart: () => setPlaying(true), onend: () => setPlaying(false) });
  }

  return <div className="mt-3 w-full space-y-3 text-left" onClick={(event) => event.stopPropagation()}>
    <p className="text-sm text-muted">Nghe và gõ lại câu:</p>
    <button type="button" onClick={speak} disabled={playing} className="min-h-11 w-full rounded-full border border-rule py-2 text-sm font-medium hover:bg-primary-soft/50 disabled:opacity-50">{playing ? "Đang phát..." : "▶ Nghe câu"}</button>
    <textarea value={input} onChange={(event) => { setInput(event.target.value); setChecked(false); }} placeholder="Gõ lại câu bạn vừa nghe..." rows={2} lang={LANG_INFO[lang].htmlLang} className="field w-full resize-none text-sm" />
    {!checked ? <button type="button" onClick={() => setChecked(true)} disabled={!input.trim()} className="btn btn-primary w-full disabled:opacity-50">Kiểm tra</button> : <div className="rounded-2xl bg-paper p-3 text-sm"><p className="mb-1 font-medium">Kết quả:</p><p lang={LANG_INFO[lang].htmlLang}>{byChar ? highlightChars(input, sentence, lang) : highlightWords(input, sentence)}</p><p className="mt-2 text-xs text-muted">Câu đúng: {sentence}</p></div>}
  </div>;
}
