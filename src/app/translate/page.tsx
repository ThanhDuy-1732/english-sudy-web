"use client";

import { useEffect, useState } from "react";
import {
  MAX_TRANSLATE_CHARS,
  TRANSLATE_INFO,
  TRANSLATE_LANGS,
  addHistory,
  getHistory,
  getTranslatePair,
  setTranslatePair,
  type HistoryEntry,
  type TranslateLang,
  type TranslatePair,
  type TranslationResult,
} from "@/lib/translate";
import { TranslationCard } from "@/components/TranslationCard";
import { MicButton } from "@/components/MicButton";
import { PhotoTranslate } from "@/components/PhotoTranslate";
import { useProvider } from "@/contexts/ProviderContext";
import { useApiFetch } from "@/lib/useApiFetch";

export default function TranslatePage() {
  // localStorage is read in effects only: server HTML renders the defaults, hydration then applies the stored pair.
  const [pair, setPair] = useState<TranslatePair>({ from: "vi", to: "en" });
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<TranslateLang | null>(null);
  const [vietnamese, setVietnamese] = useState("");
  const [results, setResults] = useState<TranslationResult[]>([]);
  // The pair the shown results came from: the selectors can change before the next translation.
  const [resultPair, setResultPair] = useState<TranslatePair>(pair);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const { fetchWithProvider } = useApiFetch();
  // Photos need Gemini (the only provider that reads images); without its key the button is hidden.
  const canReadPhotos = useProvider().availableProviders.some((provider) => provider.id === "gemini");

  useEffect(() => {
    setPair(getTranslatePair());
    setHistory(getHistory());
  }, []);

  const overLimit = text.length > MAX_TRANSLATE_CHARS;

  function swap() {
    if (pair.from === "auto") return;
    setPair({ from: pair.to, to: pair.from });
  }

  async function translateText(value: string) {
    if (!value.trim() || value.length > MAX_TRANSLATE_CHARS || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithProvider("/api/translate", { text: value, from: pair.from, to: pair.to });
      const data = (await res.json()) as {
        error?: string;
        detected?: TranslateLang;
        vietnamese?: string;
        results?: TranslationResult[];
      };
      if (!res.ok || !data.results || !data.detected) {
        setError(data.error ?? "Không dịch được lúc này. Vui lòng thử lại.");
        return;
      }
      setDetected(data.detected);
      setVietnamese(data.vietnamese ?? "");
      setResults(data.results);
      setResultPair(pair);
      setTranslatePair(pair);
      addHistory({
        id: globalThis.crypto?.randomUUID?.() ?? `tr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        from: pair.from,
        to: pair.to,
        text: value,
        translation: { detected: data.detected, vietnamese: data.vietnamese ?? "", results: data.results },
        at: new Date().toISOString(),
      });
      setHistory(getHistory());
    } catch {
      setError("Không dịch được lúc này. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function onSpoken(spoken: string) {
    setText(spoken);
    void translateText(spoken);
  }

  function restore(entry: HistoryEntry) {
    setText(entry.text);
    setPair({ from: entry.from, to: entry.to });
    setDetected(entry.translation.detected);
    setVietnamese(entry.translation.vietnamese);
    setResults(entry.translation.results);
    setResultPair({ from: entry.from, to: entry.to });
    setError(null);
  }

  return (
    <main className="page">
      <h1 className="page-title mb-4">Dịch</h1>

      <section aria-label="Ngôn ngữ" className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Ngôn ngữ nguồn"
          value={pair.from}
          onChange={(event) =>
            setPair((prev) => ({ ...prev, from: event.target.value as TranslatePair["from"] }))
          }
          className="field w-auto"
        >
          <option value="auto">Tự nhận</option>
          {TRANSLATE_LANGS.map((lang) => (
            <option key={lang} value={lang}>
              {TRANSLATE_INFO[lang].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={swap}
          disabled={pair.from === "auto"}
          aria-label="Đảo chiều"
          className="chip disabled:opacity-40"
        >
          ⇄
        </button>
        <select
          aria-label="Ngôn ngữ đích"
          value={pair.to}
          onChange={(event) =>
            setPair((prev) => ({ ...prev, to: event.target.value as TranslateLang }))
          }
          className="field w-auto"
        >
          {TRANSLATE_LANGS.map((lang) => (
            <option key={lang} value={lang}>
              {TRANSLATE_INFO[lang].label}
            </option>
          ))}
        </select>
      </section>

      <textarea
        aria-label="Nội dung cần dịch"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        maxLength={MAX_TRANSLATE_CHARS + 200}
        className="field mb-2 w-full"
        placeholder="Nhập nội dung cần dịch…"
      />
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className={`text-xs tabular-nums ${overLimit ? "text-margin" : "text-muted"}`}>{text.length}/1.000</p>
        <MicButton language={pair.from} onText={onSpoken} onError={setError} disabled={loading} />
      </div>

      <button
        type="button"
        onClick={() => void translateText(text)}
        disabled={!text.trim() || overLimit || loading}
        className="btn btn-primary mb-4 w-full"
      >
        {loading ? "Đang dịch…" : "Dịch"}
      </button>

      {canReadPhotos && <PhotoTranslate to={pair.to} />}

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-margin/30 bg-margin/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <section aria-label="Kết quả" className="mb-6">
          {resultPair.from === "auto" && detected && (
            <p className="mb-3 text-sm text-muted">Đã nhận: {TRANSLATE_INFO[detected].label}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((result) => (
              <TranslationCard
                key={`${resultPair.to}-${result.tone}-${result.text}`}
                result={result}
                to={resultPair.to}
                vietnamese={vietnamese}
              />
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section aria-label="Gần đây">
          <h2 className="section-title mb-2">Gần đây</h2>
          <ul className="panel divide-y divide-rule p-0">
            {history.map((entry) => {
              const source = entry.from === "auto" ? entry.translation.detected : entry.from;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => restore(entry)}
                    className="block w-full px-4 py-3 text-left hover:bg-primary/5"
                  >
                    <span
                      lang={TRANSLATE_INFO[source].htmlLang}
                      className={`block truncate ${source === "en" || source === "vi" ? "font-en" : "font-sans"}`}
                    >
                      {entry.text}
                    </span>
                    <span className="text-xs text-muted">
                      {TRANSLATE_INFO[source].label} → {TRANSLATE_INFO[entry.to].label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
