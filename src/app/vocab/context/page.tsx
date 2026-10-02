"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getLearnedWords } from "@/lib/storage";

type Format = "mini_story" | "dialogue" | "email" | "workplace";

const FORMAT_LABELS: Record<Format, string> = {
  mini_story: "Truyện ngắn",
  dialogue: "Hội thoại",
  email: "Email",
  workplace: "Tình huống",
};

export default function ContextPracticePage() {
  const [allWords, setAllWords] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<Format>("dialogue");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setAllWords(getLearnedWords().map((w) => w.word));
  }, []);

  const filtered = allWords.filter((w) => w.toLowerCase().includes(search.toLowerCase()));

  function toggle(word: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word); else next.add(word);
      return next;
    });
  }

  async function generate() {
    if (selected.size < 2) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/vocab/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: Array.from(selected), format }),
      });
      const data = await res.json() as { text?: string };
      setResult(data.text ?? "Không thể tạo nội dung.");
    } finally {
      setLoading(false);
    }
  }

  function renderWithBold(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} className="text-blue-600">{p.slice(2, -2)}</strong>
        : p
    );
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Luyện từ trong ngữ cảnh</h1>
        <Link href="/" className="text-sm text-blue-500">← Trang chủ</Link>
      </div>

      <p className="text-sm text-gray-500 mb-4">Chọn 2–8 từ, sau đó tạo nội dung chứa các từ đó.</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
        placeholder="Tìm từ..."
      />

      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto mb-4 border rounded-lg p-3 dark:border-gray-700">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 w-full text-center py-2">
            {allWords.length === 0 ? "Chưa có từ nào." : "Không tìm thấy từ."}
          </p>
        )}
        {filtered.map((w) => (
          <button key={w} onClick={() => toggle(w)}
            className={`px-2 py-1 rounded text-sm ${selected.has(w) ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
            {w}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-3">Đã chọn: {selected.size} từ</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
          <button key={f} onClick={() => setFormat(f)}
            className={`px-3 py-1.5 rounded text-sm ${format === f ? "bg-purple-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
            {FORMAT_LABELS[f]}
          </button>
        ))}
      </div>

      <button
        onClick={() => void generate()}
        disabled={selected.size < 2 || loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 mb-4"
      >
        {loading ? "Đang tạo..." : "Tạo nội dung"}
      </button>

      {result && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {renderWithBold(result)}
        </div>
      )}
    </main>
  );
}
