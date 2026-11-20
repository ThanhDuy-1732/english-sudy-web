"use client";

import { useState } from "react";
import { answersMatch } from "@/lib/answer-match";
import { LANG_INFO, type LearnLang } from "@/lib/languages";

// `reading`/`translation` belong to the sentence; `wordReading` is the answer word's own reading (kana is accepted for ja).
interface Props { word: string; sentence: string; lang?: LearnLang; reading?: string; translation?: string; wordReading?: string }

export default function FillBlank({ word, sentence, lang = "en", reading, translation, wordReading }: Props) {
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  // Chinese and Japanese answers ignore spaces and punctuation (学生 。 is 学生).
  const isCorrect = answersMatch(input, word, lang, wordReading);
  const parts = sentence.split("_____");
  const hasBlank = parts.length > 1;
  return (
    <div className="mt-3 w-full space-y-2 text-left" onClick={(event) => event.stopPropagation()}>
      <p className="text-sm text-muted">Điền từ còn thiếu:</p>
      {hasBlank ? <div lang={LANG_INFO[lang].htmlLang} className="flex flex-wrap items-center gap-1 text-sm"><span>{parts[0]}</span><input lang={LANG_INFO[lang].htmlLang} value={input} onChange={(event) => { setInput(event.target.value); setChecked(false); }} disabled={checked && isCorrect} placeholder="____" className={`${lang === "en" ? "w-28" : "w-32"} border-b-2 px-1 text-center focus:outline-none ${!checked ? "border-rule" : isCorrect ? "border-ok text-ok" : "border-margin text-margin"}`} /><span>{parts.slice(1).join("_____")}</span></div> : <p className="text-sm text-margin">Câu hỏi chưa có ô trống hợp lệ.</p>}
      {reading && <p className="text-xs text-muted">{reading}</p>}
      {translation && <p className="text-xs text-muted">{translation}</p>}
      {hasBlank && (!checked || !isCorrect) && <button type="button" onClick={() => setChecked(true)} disabled={!input.trim()} className="btn btn-primary w-full disabled:opacity-50">Kiểm tra</button>}
      {checked && <p className={`text-sm font-medium ${isCorrect ? "text-ok" : "text-margin"}`}>{isCorrect ? "Đúng rồi! ✓" : `Sai rồi. Đáp án: "${word}"`}</p>}
    </div>
  );
}
