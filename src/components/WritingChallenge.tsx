"use client";

import { useState } from "react";
import { LANG_INFO, languagePhrase, type LearnLang } from "@/lib/languages";
import { useApiFetch } from "@/lib/useApiFetch";

interface Props { word: string; lang?: LearnLang }
interface GradeResult { score: number; feedback: string; corrected: string }

export default function WritingChallenge({ word, lang = "en" }: Props) {
  const { fetchWithProvider } = useApiFetch();
  const [sentence, setSentence] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGrade() {
    if (!sentence.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const response = await fetchWithProvider("/api/grade-sentence", { word, sentence: sentence.trim(), ...(lang === "en" ? {} : { lang }) });
      if (!response.ok) throw new Error();
      setResult((await response.json()) as GradeResult);
    } catch { setError("Không thể chấm điểm lúc này."); }
    finally { setLoading(false); }
  }

  const scoreColor = !result ? "" : result.score >= 8 ? "text-ok" : result.score >= 5 ? "text-warn" : "text-margin";
  return (
    <div className="mt-3 w-full space-y-2 text-left" onClick={(event) => event.stopPropagation()}>
      <p className="text-sm text-muted">Viết câu {lang === "en" ? "" : `${languagePhrase(lang)} `}dùng từ <strong lang={LANG_INFO[lang].htmlLang}>{word}</strong>:</p>
      <textarea value={sentence} onChange={(event) => setSentence(event.target.value)} placeholder={lang === "en" ? `Ví dụ: I need to ${word}...` : `Viết một câu có từ ${word}...`} lang={LANG_INFO[lang].htmlLang} rows={2} className="field w-full resize-none text-sm" />
      <button type="button" onClick={handleGrade} disabled={loading || !sentence.trim()} className="btn btn-primary w-full">{loading ? "Đang chấm..." : "Chấm điểm"}</button>
      {error && <p className="text-sm text-margin" role="alert">{error}</p>}
      {result && <div className="space-y-1 rounded-2xl bg-paper p-3 text-sm"><p className={`text-lg font-bold ${scoreColor}`}>{result.score}/10</p><p className="text-muted">{result.feedback}</p>{result.corrected.trim() !== sentence.trim() && <p className="text-ok"><span className="font-medium">Sửa lại:</span> {result.corrected}</p>}</div>}
    </div>
  );
}
