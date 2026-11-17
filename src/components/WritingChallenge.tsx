"use client";

import { useState } from "react";
import { useApiFetch } from "@/lib/useApiFetch";

interface Props { word: string }
interface GradeResult { score: number; feedback: string; corrected: string }

export default function WritingChallenge({ word }: Props) {
  const { fetchWithProvider } = useApiFetch();
  const [sentence, setSentence] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGrade() {
    if (!sentence.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const response = await fetchWithProvider("/api/grade-sentence", { word, sentence: sentence.trim() });
      if (!response.ok) throw new Error();
      setResult((await response.json()) as GradeResult);
    } catch { setError("Không thể chấm điểm lúc này."); }
    finally { setLoading(false); }
  }

  const scoreColor = !result ? "" : result.score >= 8 ? "text-green-600" : result.score >= 5 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="mt-3 w-full space-y-2 text-left" onClick={(event) => event.stopPropagation()}>
      <p className="text-sm text-gray-500">Viết câu dùng từ <strong>{word}</strong>:</p>
      <textarea value={sentence} onChange={(event) => setSentence(event.target.value)} placeholder={`Ví dụ: I need to ${word}...`} rows={2} className="field w-full resize-none text-sm" />
      <button type="button" onClick={handleGrade} disabled={loading || !sentence.trim()} className="btn btn-primary w-full">{loading ? "Đang chấm..." : "Chấm điểm"}</button>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {result && <div className="space-y-1 rounded-lg bg-paper p-3 text-sm"><p className={`text-lg font-bold ${scoreColor}`}>{result.score}/10</p><p className="text-gray-600">{result.feedback}</p>{result.corrected.trim() !== sentence.trim() && <p className="text-green-700"><span className="font-medium">Sửa lại:</span> {result.corrected}</p>}</div>}
    </div>
  );
}
