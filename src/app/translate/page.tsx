"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logActivity } from "@/lib/sessions";
import {
  MAX_TRANSLATE_CHARS,
  TONES,
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
  const [pair, setPair] = useState<TranslatePair>({ from: "auto", to: "en" });
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<TranslateLang | null>(null);
  const [vietnamese, setVietnamese] = useState("");
  const [results, setResults] = useState<TranslationResult[]>([]);
  // The pair the shown results came from: the selectors can change before the next translation.
  const [resultPair, setResultPair] = useState<TranslatePair>(pair);
  // The source text behind the shown results, for "more tones" (the textarea may have been edited since).
  const [resultText, setResultText] = useState("");
  const [moreLoading, setMoreLoading] = useState(false);
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

  type Fetched = { error: string } | { data: { detected: TranslateLang; vietnamese: string; results: TranslationResult[] } };

  // The server picks the provider (translation prefers the fastest one) and leaves the learner's choice alone.
  async function fetchTranslation(value: string, from: TranslatePair["from"], to: TranslateLang, tone?: "polite"): Promise<Fetched> {
    const generic = "Không dịch được lúc này. Vui lòng thử lại.";
    try {
      const res = await fetchWithProvider("/api/translate", { text: value, from, to, ...(tone && { tone }) }, undefined, { auto: true });
      const data = (await res.json()) as {
        error?: string;
        detected?: TranslateLang;
        vietnamese?: string;
        results?: TranslationResult[];
      };
      if (!res.ok || !data.results || !data.detected) return { error: data.error ?? generic };
      return { data: { detected: data.detected, vietnamese: data.vietnamese ?? "", results: data.results } };
    } catch {
      return { error: generic };
    }
  }

  function showTranslation(value: string, used: TranslatePair, data: { detected: TranslateLang; vietnamese: string; results: TranslationResult[] }) {
    setDetected(data.detected);
    setVietnamese(data.vietnamese);
    setResults(data.results);
    setResultPair(used);
    setResultText(value);
    setTranslatePair(used);
    addHistory({
      id: globalThis.crypto?.randomUUID?.() ?? `tr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      from: used.from,
      to: used.to,
      text: value,
      translation: data,
      at: new Date().toISOString(),
    });
    setHistory(getHistory());
    logActivity("translation", "translate");
  }

  // Only the polite tone first (~2 s); casual and formal take ~2x longer and most phrases never need them.
  async function translateText(value: string) {
    if (!value.trim() || loading) return;
    if (value.length > MAX_TRANSLATE_CHARS) {
      setError("Tối đa 1.000 ký tự.");
      return;
    }
    setLoading(true);
    setError(null);
    const fetched = await fetchTranslation(value, pair.from, pair.to, "polite");
    if ("error" in fetched) setError(fetched.error);
    else showTranslation(value, pair, fetched.data);
    setLoading(false);
  }

  async function showAllTones() {
    if (moreLoading || !resultText) return;
    setMoreLoading(true);
    setError(null);
    const fetched = await fetchTranslation(resultText, resultPair.from, resultPair.to);
    if ("error" in fetched) setError(fetched.error);
    else showTranslation(resultText, resultPair, fetched.data);
    setMoreLoading(false);
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
    setResultText(entry.text);
    setError(null);
  }

  return (
    <main className="page">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="page-title">Dịch</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/translate/phrases" className="chip">
            Sổ câu du lịch
          </Link>
          <Link href="/translate/conversation" className="chip">
            Hội thoại hai chiều
          </Link>
        </div>
      </div>

      <section aria-label="Ngôn ngữ" className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Ngôn ngữ nguồn"
          value={pair.from}
          onChange={(event) =>
            setPair((prev) => {
              const from = event.target.value as TranslatePair["from"];
              // Picking the target language as the source swaps the pair instead of allowing vi→vi.
              if (from !== prev.to) return { ...prev, from };
              return { from, to: prev.from !== "auto" ? prev.from : from === "vi" ? "en" : "vi" };
            })
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
            setPair((prev) => {
              const to = event.target.value as TranslateLang;
              return to === prev.from ? { from: prev.to, to } : { ...prev, to };
            })
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
          {results.length < TONES.length && (
            <button type="button" onClick={() => void showAllTones()} disabled={moreLoading} className="chip mt-3">
              {moreLoading ? "Đang tải…" : "Xem thêm sắc thái (thân mật, trang trọng)"}
            </button>
          )}
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
