"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MicButton } from "@/components/MicButton";
import { useApiFetch } from "@/lib/useApiFetch";
import { speakCode } from "@/lib/speech-voice";
import { useVoiceSettings } from "@/lib/useVoiceSettings";
import {
  TRANSLATE_INFO,
  TRANSLATE_LANGS,
  getConversationPair,
  setConversationPair,
  type ConversationPair,
  type TranslateLang,
  type TranslationResult,
} from "@/lib/translate";

type Side = "me" | "them";

interface Turn {
  id: number;
  side: Side;
  from: TranslateLang;
  to: TranslateLang;
  original: string;
  translation: string;
  reading?: string;
}

const fontFor = (lang: TranslateLang) => (lang === "en" || lang === "vi" ? "font-en" : "font-sans");

export default function ConversationPage() {
  // localStorage is read in an effect: server HTML renders the default pair.
  const [pair, setPair] = useState<ConversationPair>({ me: "vi", them: "en" });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  // The side whose mic is recording or transcribing: the other side waits, so turns never overlap.
  const [active, setActive] = useState<Side | null>(null);
  const nextId = useRef(1);
  const { fetchWithProvider } = useApiFetch();
  const { settings } = useVoiceSettings();

  useEffect(() => setPair(getConversationPair()), []);

  function choose(side: Side, lang: TranslateLang) {
    const other: Side = side === "me" ? "them" : "me";
    // Picking the other side's language swaps the two, so both sides never speak the same language.
    const next = { ...pair, [side]: lang, ...(pair[other] === lang ? { [other]: pair[side] } : {}) } as ConversationPair;
    setPair(next);
    setConversationPair(next);
  }

  async function turn(side: Side, text: string) {
    const from = pair[side];
    const to = pair[side === "me" ? "them" : "me"];
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithProvider("/api/translate", { text, from, to, tone: "polite" });
      const data = (await res.json()) as { error?: string; results?: TranslationResult[] };
      const result = data.results?.[0];
      if (!res.ok || !result) throw new Error(data.error ?? "Không dịch được lúc này. Vui lòng thử lại.");
      setTurns((prev) => [
        ...prev,
        { id: nextId.current++, side, from, to, original: text, translation: result.text, reading: result.reading },
      ]);
      speakCode(result.text, TRANSLATE_INFO[to].voice, settings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không dịch được lúc này. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  // What the other person needs to read: the latest line in their language.
  const latest = turns.at(-1);
  const forThem = latest && (latest.side === "me" ? { text: latest.translation, reading: latest.reading } : { text: latest.original });

  const languageSelect = (side: Side, label: string) => (
    <select
      aria-label={label}
      value={pair[side]}
      onChange={(event) => choose(side, event.target.value as TranslateLang)}
      className="field w-auto"
    >
      {TRANSLATE_LANGS.map((lang) => (
        <option key={lang} value={lang}>
          {TRANSLATE_INFO[lang].native}
        </option>
      ))}
    </select>
  );

  return (
    <main className="page flex min-h-[calc(100dvh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="page-title">Hội thoại hai chiều</h1>
        <Link href="/translate" className="chip">
          Dịch
        </Link>
      </div>

      <section
        aria-label="Phía họ"
        className={`postcard flex flex-col items-center gap-3 px-5 py-4 transition-transform ${flipped ? "rotate-180" : ""}`}
      >
        <div className="flex w-full items-center justify-between gap-2 text-sm text-muted">
          <span>Họ nói · {TRANSLATE_INFO[pair.them].native}</span>
          {languageSelect("them", "Ngôn ngữ của họ")}
        </div>
        {forThem && (
          <div className="w-full text-center">
            <p lang={TRANSLATE_INFO[pair.them].htmlLang} className={`text-2xl font-semibold ${fontFor(pair.them)}`}>
              {forThem.text}
            </p>
            {forThem.reading && <p className="text-sm text-muted">{forThem.reading}</p>}
          </div>
        )}
        <MicButton
          language={pair.them}
          label="Họ nói"
          disabled={busy || active === "me"}
          onActiveChange={(on) => setActive(on ? "them" : null)}
          onText={(text) => void turn("them", text)}
          onError={setError}
          className="btn btn-primary min-h-16 w-full text-2xl"
        />
      </section>

      <button type="button" onClick={() => setFlipped((value) => !value)} aria-pressed={flipped} className="chip self-center">
        Xoay phía họ
      </button>

      {error && (
        <p role="alert" className="rounded-xl border border-margin/30 bg-margin/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      <section aria-label="Phía tôi" className="postcard mt-auto flex flex-col gap-3 px-5 py-4">
        {turns.length > 0 && (
          <ol aria-label="Hội thoại" className="flex max-h-72 flex-col gap-3 overflow-y-auto">
            {turns.map((item) => (
              <li key={item.id} className={item.side === "me" ? "self-end text-right" : "self-start"}>
                <p lang={TRANSLATE_INFO[item.from].htmlLang} className={`text-sm text-muted ${fontFor(item.from)}`}>
                  {item.original}
                </p>
                <p lang={TRANSLATE_INFO[item.to].htmlLang} className={`font-semibold ${fontFor(item.to)}`}>
                  {item.translation}
                </p>
                {item.reading && <p className="text-xs text-muted">{item.reading}</p>}
              </li>
            ))}
          </ol>
        )}
        <div className="flex items-center justify-between gap-2 text-sm text-muted">
          <span>Tôi nói · {TRANSLATE_INFO[pair.me].label}</span>
          {languageSelect("me", "Ngôn ngữ của tôi")}
        </div>
        <MicButton
          language={pair.me}
          label="Tôi nói"
          disabled={busy || active === "them"}
          onActiveChange={(on) => setActive(on ? "me" : null)}
          onText={(text) => void turn("me", text)}
          onError={setError}
          className="btn btn-primary min-h-16 w-full text-2xl"
        />
      </section>
    </main>
  );
}
