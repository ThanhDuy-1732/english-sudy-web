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
        ? <strong key={i} className="rounded bg-marker/50 px-0.5 text-ink">{p.slice(2, -2)}</strong>
        : p
    );
  }

  return (
    <main className="page">
      <Link href="/" className="back-link">← Từ mới</Link>
      <h1 className="page-title mb-4">Luyện từ trong ngữ cảnh</h1>

      <p className="page-lead mb-4">Chọn 2–8 từ, sau đó tạo nội dung chứa các từ đó.</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="field mb-3 w-full"
        placeholder="Tìm từ..."
      />

      <div className="panel mb-4 flex max-h-56 flex-wrap gap-2 overflow-y-auto p-3">
        {filtered.length === 0 && (
          <p className="w-full py-2 text-center text-sm text-muted">
            {allWords.length === 0 ? "Chưa có từ nào." : "Không tìm thấy từ."}
          </p>
        )}
        {filtered.map((w) => (
          <button key={w} onClick={() => toggle(w)}
            aria-pressed={selected.has(w)} className={`chip font-en ${selected.has(w) ? "chip-on" : ""}`}>
            {w}
          </button>
        ))}
      </div>

      <p className="mb-3 text-sm text-muted">Đã chọn: {selected.size} từ</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
          <button key={f} onClick={() => setFormat(f)}
            aria-pressed={format === f} className={`chip ${format === f ? "chip-on" : ""}`}>
            {FORMAT_LABELS[f]}
          </button>
        ))}
      </div>

      <button
        onClick={() => void generate()}
        disabled={selected.size < 2 || loading}
        className="btn btn-primary w-full mb-4"
      >
        {loading ? "Đang tạo..." : "Tạo nội dung"}
      </button>

      {result && (
        <div className="postcard whitespace-pre-wrap px-6 py-6 font-en text-lg leading-relaxed">
          {renderWithBold(result)}
        </div>
      )}
    </main>
  );
}
