"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getLearnedWords } from "@/lib/storage";
import { MAX_CUSTOM_WORDS, parseWordInput } from "@/lib/word-input";
import { LANG_INFO, LEARN_LANGS, langOf, type LearnLang } from "@/lib/languages";
import { useLearningLanguages } from "@/lib/useLearningLanguages";
import Segmented from "@/components/Segmented";
import type { LearnedWord } from "@/lib/storage";

type Format = "mini_story" | "dialogue" | "email" | "workplace";

const FORMAT_LABELS: Record<Format, string> = {
  mini_story: "Truyện ngắn",
  dialogue: "Hội thoại",
  email: "Email",
  workplace: "Tình huống",
};

export default function ContextPracticePage() {
  const [saved, setSaved] = useState<LearnedWord[]>([]);
  const [learning] = useLearningLanguages();
  const [chosenLang, setChosenLang] = useState<LearnLang | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<Format>("dialogue");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [customWords, setCustomWords] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setSaved(getLearnedWords());
  }, []);

  // The content is written in one language, from that language's saved words (each spelling once).
  const offered = LEARN_LANGS.filter((lang) => learning.includes(lang) && saved.some((w) => langOf(w) === lang));
  const contextLang: LearnLang = chosenLang && offered.includes(chosenLang) ? chosenLang : offered.includes("en") ? "en" : offered[0] ?? "en";
  const allWords = [...new Set(saved.filter((w) => langOf(w) === contextLang).map((w) => w.word))];

  function chooseLang(lang: LearnLang) {
    setChosenLang(lang);
    setSelected(new Set());
    setCustomWords([]);
    setResult(null);
  }

  const filtered = allWords.filter((w) => w.toLowerCase().includes(search.toLowerCase()));

  function toggle(word: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word); else next.add(word);
      return next;
    });
  }

  /**
   * Adds typed words to the selection. A word that is already in the saved list
   * reuses that spelling instead of creating a second chip that differs only by case.
   */
  function addCustomWords() {
    const parsed = parseWordInput(draft);
    if (parsed.length === 0) return;

    const known = new Map<string, string>();
    for (const word of allWords) known.set(word.toLowerCase(), word);
    for (const word of customWords) known.set(word.toLowerCase(), word);

    const picked: string[] = [];
    const extras: string[] = [];
    for (const word of parsed) {
      const key = word.toLowerCase();
      const existing = known.get(key);
      if (existing) {
        picked.push(existing);
        continue;
      }
      known.set(key, word);
      extras.push(word);
    }

    const room = Math.max(0, MAX_CUSTOM_WORDS - customWords.length);
    const accepted = extras.slice(0, room);
    if (accepted.length > 0) setCustomWords((prev) => [...prev, ...accepted]);
    if (picked.length + accepted.length > 0) {
      setSelected((prev) => new Set([...prev, ...picked, ...accepted]));
    }
    setDraft("");
  }

  function clearCustomWords() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const word of customWords) next.delete(word);
      return next;
    });
    setCustomWords([]);
  }

  async function generate() {
    if (selected.size < 2) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/vocab/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: Array.from(selected), format, ...(contextLang === "en" ? {} : { lang: contextLang }) }),
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
        ? <strong key={i} className="rounded-xl bg-marker/50 px-0.5 text-ink">{p.slice(2, -2)}</strong>
        : p
    );
  }

  return (
    <main className="page">
      <Link href="/" className="back-link">← Từ mới</Link>
      <h1 className="page-title mb-4">Luyện từ trong ngữ cảnh</h1>
      {offered.length > 1 && (
        <div className="mb-4">
          <Segmented
            label="Ngôn ngữ"
            value={contextLang}
            onChange={(value) => chooseLang(value as LearnLang)}
            options={offered.map((lang) => ({ value: lang, label: LANG_INFO[lang].native }))}
          />
        </div>
      )}

      <p className="page-lead mb-4">Chọn ít nhất 2 từ — từ đã lưu hoặc tự thêm — rồi tạo nội dung chứa các từ đó.</p>

      <section aria-label="Thêm từ của bạn" className="panel mb-4 p-4">
        <label htmlFor="custom-word" className="mb-2 block text-sm font-medium text-ink">
          Thêm từ của bạn
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="custom-word"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomWords();
              }
            }}
            className="field min-w-0 flex-1"
            placeholder="Ví dụ: invoice, deadline"
            autoComplete="off"
          />
          <button type="button" className="btn btn-secondary" onClick={addCustomWords} disabled={!draft.trim()}>
            Thêm
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">Cách nhau bằng dấu phẩy. Từ tự thêm chỉ dùng cho lần tạo này.</p>

        {customWords.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {customWords.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => toggle(word)}
                aria-pressed={selected.has(word)}
                lang={LANG_INFO[contextLang].htmlLang} className={`chip ${contextLang === "en" ? "font-en" : "font-sans"} ${selected.has(word) ? "chip-on" : ""}`}
              >
                {word}
              </button>
            ))}
            <button type="button" onClick={clearCustomWords} className="text-xs text-muted underline">
              Xoá từ tự thêm
            </button>
          </div>
        )}
      </section>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="field mb-3 w-full"
        placeholder="Tìm từ..."
      />

      <div className="panel mb-4 flex max-h-56 flex-wrap gap-2 overflow-y-auto p-3">
        {filtered.length === 0 && (
          <p className="w-full py-2 text-center text-sm text-muted">
            {allWords.length === 0 ? "Chưa có từ nào đã lưu. Bạn vẫn có thể thêm từ ở trên." : "Không tìm thấy từ."}
          </p>
        )}
        {filtered.map((w) => (
          <button key={w} onClick={() => toggle(w)}
            aria-pressed={selected.has(w)} lang={LANG_INFO[contextLang].htmlLang} className={`chip ${contextLang === "en" ? "font-en" : "font-sans"} ${selected.has(w) ? "chip-on" : ""}`}>
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
        <div lang={LANG_INFO[contextLang].htmlLang} className={`postcard whitespace-pre-wrap px-6 py-6 ${contextLang === "en" ? "font-en" : "font-sans"} text-lg leading-relaxed`}>
          {renderWithBold(result)}
        </div>
      )}
    </main>
  );
}
