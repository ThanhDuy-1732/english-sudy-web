"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { getLearnedWords } from "@/lib/storage";
import { getMistakes } from "@/lib/mistakes";
import { getSpeaking } from "@/lib/speech/speaking-storage";
import { getWriting } from "@/lib/write/writing-storage";

interface SearchResult {
  type: "vocabulary" | "mistake" | "speaking" | "writing";
  title: string;
  subtitle: string;
  href?: string;
}

function search(query: string): SearchResult[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const w of getLearnedWords()) {
    if (w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)) {
      results.push({ type: "vocabulary", title: w.word, subtitle: w.meaning });
    }
  }

  for (const m of getMistakes()) {
    if (m.category.toLowerCase().includes(q) || m.correctAnswer.toLowerCase().includes(q) ||
        m.explanation.toLowerCase().includes(q)) {
      results.push({ type: "mistake", title: m.correctAnswer.slice(0, 80),
        subtitle: `${m.skill} · ${m.category}`, href: "/mistakes" });
    }
  }

  for (const r of getSpeaking()) {
    if (r.prompt.toLowerCase().includes(q) || r.transcript.toLowerCase().includes(q)) {
      results.push({ type: "speaking", title: r.prompt.slice(0, 60),
        subtitle: `Band ${r.feedback.overall.toFixed(1)} · ${new Date(r.createdAt).toLocaleDateString("vi-VN")}`,
        href: "/speak/history" });
    }
  }

  for (const r of getWriting()) {
    if (r.prompt.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)) {
      results.push({ type: "writing", title: r.prompt.slice(0, 60),
        subtitle: `Band ${r.feedback.overall.toFixed(1)} · ${new Date(r.createdAt).toLocaleDateString("vi-VN")}`,
        href: "/write/history" });
    }
  }

  return results.slice(0, 50);
}

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  vocabulary: "Từ vựng", mistake: "Lỗi sai", speaking: "Speaking", writing: "Writing",
};
const TYPE_COLORS: Record<SearchResult["type"], string> = {
  vocabulary: "text-blue-500", mistake: "text-red-500",
  speaking: "text-green-500", writing: "text-purple-500",
};

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const results = useMemo(() => mounted ? search(query) : [], [query, mounted]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    acc[r.type] = [...(acc[r.type] ?? []), r];
    return acc;
  }, {});

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Thư viện kiến thức</h1>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border rounded-xl px-4 py-3 text-sm dark:bg-gray-900 dark:border-gray-700 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Tìm từ, lỗi sai, bài nói, bài viết..."
        autoFocus
      />

      {query.length >= 2 && results.length === 0 && (
        <p className="text-gray-400 text-center py-8">Không tìm thấy kết quả.</p>
      )}

      {query.length < 2 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">Nhập ít nhất 2 ký tự để tìm kiếm.</p>
          <p className="text-xs mt-1">Tìm trong: từ vựng, lỗi sai, bài nói, bài viết</p>
        </div>
      )}

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="mb-5">
          <p className={`text-xs font-semibold mb-2 ${TYPE_COLORS[type as SearchResult["type"]]}`}>
            {TYPE_LABELS[type as SearchResult["type"]]} ({items.length})
          </p>
          <ul className="space-y-1">
            {items.slice(0, 8).map((item, i) => {
              const content = (
                <div className="px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.subtitle}</p>
                </div>
              );
              return item.href
                ? <li key={i}><Link href={item.href}>{content}</Link></li>
                : <li key={i}>{content}</li>;
            })}
          </ul>
        </div>
      ))}
    </main>
  );
}
