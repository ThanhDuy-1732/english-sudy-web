"use client";

import { useState } from "react";

interface Props { word: string; sentence: string }

export default function FillBlank({ word, sentence }: Props) {
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const isCorrect = input.trim().toLowerCase() === word.trim().toLowerCase();
  const parts = sentence.split("_____");
  const hasBlank = parts.length > 1;
  return (
    <div className="mt-3 w-full space-y-2 text-left" onClick={(event) => event.stopPropagation()}>
      <p className="text-sm text-gray-500">Điền từ còn thiếu:</p>
      {hasBlank ? <div className="flex flex-wrap items-center gap-1 text-sm"><span>{parts[0]}</span><input value={input} onChange={(event) => { setInput(event.target.value); setChecked(false); }} disabled={checked && isCorrect} placeholder="____" className={`w-28 border-b-2 px-1 text-center focus:outline-none ${!checked ? "border-gray-300" : isCorrect ? "border-green-500 text-green-700" : "border-red-500 text-red-700"}`} /><span>{parts.slice(1).join("_____")}</span></div> : <p className="text-sm text-red-600">Câu hỏi chưa có ô trống hợp lệ.</p>}
      {hasBlank && (!checked || !isCorrect) && <button type="button" onClick={() => setChecked(true)} disabled={!input.trim()} className="min-h-11 w-full rounded-lg bg-indigo-500 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50">Kiểm tra</button>}
      {checked && <p className={`text-sm font-medium ${isCorrect ? "text-green-600" : "text-red-600"}`}>{isCorrect ? "Đúng rồi! ✓" : `Sai rồi. Đáp án: "${word}"`}</p>}
    </div>
  );
}
