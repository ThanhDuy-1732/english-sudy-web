"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Segmented from "@/components/Segmented";
import { LANG_INFO, type LearnLang } from "@/lib/languages";
import { speakCode } from "@/lib/speech-voice";
import { getTranslatePair } from "@/lib/translate";
import { PHRASE_LANGS, TRAVEL_PHRASES } from "@/lib/travel-phrases";
import { useVoiceSettings } from "@/lib/useVoiceSettings";

const OPTIONS = PHRASE_LANGS.map((value) => ({ value, label: LANG_INFO[value].native }));

export default function PhrasesPage() {
  const [lang, setLang] = useState<LearnLang>("en");
  // The phrase shown full screen, to hand the phone to someone.
  const [shown, setShown] = useState<{ text: string; reading?: string; vi: string } | null>(null);
  const { settings } = useVoiceSettings();
  const info = LANG_INFO[lang];
  const font = lang === "en" ? "font-en" : "font-sans";

  // Start on the language last translated into, when it is one of the phrasebook's.
  useEffect(() => {
    const { to } = getTranslatePair();
    if ((PHRASE_LANGS as readonly string[]).includes(to)) setLang(to as LearnLang);
  }, []);

  return (
    <main className="page">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="page-title">Sổ câu du lịch</h1>
        <Link href="/translate" className="chip">
          Dịch
        </Link>
      </div>
      <p className="mb-4 text-sm text-muted">Dùng được khi không có mạng. Chạm câu để phóng to cho người đối diện xem.</p>
      <div className="mb-6">
        <Segmented label="Ngôn ngữ" options={OPTIONS} value={lang} onChange={setLang} />
      </div>

      {TRAVEL_PHRASES.map(({ topic, phrases }) => (
        <section key={topic} aria-label={topic} className="mb-6">
          <h2 className="mb-2 font-semibold">{topic}</h2>
          <ul className="flex flex-col gap-2">
            {phrases.map((phrase) => {
              const [text, reading] = phrase[lang];
              return (
                <li key={phrase.vi} className="postcard flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setShown({ text, reading, vi: phrase.vi })}
                    className="flex-1 text-left"
                  >
                    <span className="block text-sm text-muted">{phrase.vi}</span>
                    <span lang={info.htmlLang} className={`block text-lg font-semibold ${font}`}>
                      {text}
                    </span>
                    {reading && <span className="block text-xs text-muted">{reading}</span>}
                  </button>
                  <button
                    type="button"
                    aria-label={`Đọc to: ${text}`}
                    onClick={() => speakCode(text, info.voice, settings)}
                    className="chip"
                  >
                    🔊
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {shown && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={shown.vi}
          onClick={() => setShown(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-card p-6 text-center"
        >
          <p lang={info.htmlLang} className={`text-5xl font-semibold leading-tight ${font}`}>
            {shown.text}
          </p>
          {shown.reading && <p className="text-xl text-muted">{shown.reading}</p>}
          <p className="text-muted">{shown.vi}</p>
          <p className="text-sm text-muted">Chạm để đóng</p>
        </div>
      )}
    </main>
  );
}
