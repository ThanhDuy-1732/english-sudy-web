"use client";

import { useState } from "react";
import { LearnedWord, saveLearnedWord } from "@/lib/storage";
import { pushWord } from "@/lib/sync";
import { useApiFetch } from "@/lib/useApiFetch";

interface WordResult { word: string; meaning: string; example: string }

export default function ImportWords() {
  const { fetchWithProvider } = useApiFetch();
  const [rawInput, setRawInput] = useState("");
  const [results, setResults] = useState<WordResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    const words = Array.from(new Map(rawInput.split(/\n|,/).map((word) => word.trim()).filter(Boolean).map((word) => [word.toLowerCase(), word])).values()).slice(0, 20);
    if (!words.length || loading) return;
    setLoading(true); setError(null); setResults([]); setSavedCount(0);
    try {
      const response = await fetchWithProvider("/api/generate-batch", { words });
      if (!response.ok) throw new Error();
      const payload: unknown = await response.json();
      const data = Array.isArray(payload) ? payload.filter((item): item is WordResult => Boolean(item) && typeof item === "object" && typeof (item as WordResult).word === "string" && typeof (item as WordResult).meaning === "string" && typeof (item as WordResult).example === "string") : [];
      if (!data.length) throw new Error();
      setResults(data); setSelected(new Set(data.map((item) => item.word)));
    } catch { setError("Không thể tra danh sách từ lúc này."); }
    finally { setLoading(false); }
  }

  function saveSelected() {
    let count = 0;
    results.filter((item) => selected.has(item.word)).forEach((item) => {
      const entry: LearnedWord = { word: item.word, meaning: item.meaning, example: item.example, topic: "Import", learnedAt: new Date().toISOString(), nextReviewAt: new Date(Date.now() + 86400000).toISOString(), reviewInterval: 1, mastery: 0 };
      if (saveLearnedWord(entry)) {
        count += 1;
        void pushWord(entry);
      }
    });
    setSavedCount(count);
  }

  return <div className="space-y-4">
    <div><label htmlFor="import-words" className="mb-2 block text-sm font-medium">Dán danh sách từ (mỗi dòng 1 từ, tối đa 20 từ):</label><textarea id="import-words" value={rawInput} onChange={(event) => setRawInput(event.target.value)} placeholder={"negotiate\nfacilitate\nsynthesize\n..."} rows={6} className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800" /></div>
    <button type="button" onClick={handleFetch} disabled={loading || !rawInput.trim()} className="min-h-12 w-full rounded-xl bg-blue-500 py-3 font-medium text-white hover:bg-blue-600 disabled:opacity-50">{loading ? "Đang tra nghĩa..." : "Tra nghĩa với AI"}</button>
    {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    {results.length > 0 && <><div className="overflow-hidden rounded-xl border border-gray-100"><table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-800"><tr><th className="w-8 px-4 py-2 text-left"><input type="checkbox" aria-label="Chọn tất cả" checked={selected.size === results.length} onChange={() => setSelected(selected.size === results.length ? new Set() : new Set(results.map((item) => item.word)))} /></th><th className="px-4 py-2 text-left font-medium">Từ</th><th className="px-4 py-2 text-left font-medium">Nghĩa</th><th className="hidden px-4 py-2 text-left font-medium md:table-cell">Ví dụ</th></tr></thead><tbody>{results.map((item) => <tr key={item.word} className="border-t border-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50"><td className="px-4 py-3"><input type="checkbox" aria-label={`Chọn ${item.word}`} checked={selected.has(item.word)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(item.word)) next.delete(item.word); else next.add(item.word); return next; })} /></td><td className="px-4 py-3 font-medium">{item.word}</td><td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.meaning}</td><td className="hidden px-4 py-3 text-xs italic text-gray-500 md:table-cell">{item.example}</td></tr>)}</tbody></table></div><button type="button" onClick={saveSelected} disabled={!selected.size} className="min-h-12 w-full rounded-xl bg-green-500 py-3 font-medium text-white hover:bg-green-600 disabled:opacity-50">Lưu {selected.size} từ vào lịch sử</button>{savedCount > 0 && <p className="text-center text-sm font-medium text-green-600">✓ Đã lưu {savedCount} từ vào lịch sử!</p>}</>}
  </div>;
}
