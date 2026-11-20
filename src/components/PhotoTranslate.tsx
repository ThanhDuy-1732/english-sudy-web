"use client";

import { useState } from "react";
import { shrinkImage } from "@/lib/image-resize";
import { speakCode } from "@/lib/speech-voice";
import { useVoiceSettings } from "@/lib/useVoiceSettings";
import { TRANSLATE_INFO, type ImageTranslation, type TranslateLang } from "@/lib/translate";

const fontFor = (lang: TranslateLang | null) => (lang === "en" || lang === "vi" ? "font-en" : "font-sans");

/** 📷: reads the text in a photo (signs, menus) and lists each line with its translation. Nothing is stored. */
export function PhotoTranslate({ to }: { to: TranslateLang }) {
  const { settings } = useVoiceSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(ImageTranslation & { to: TranslateLang }) | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const image = await shrinkImage(file);
      const res = await fetch("/api/translate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, to }),
      });
      const data = (await res.json()) as Partial<ImageTranslation> & { error?: string };
      if (!res.ok || !data.lines) throw new Error(data.error ?? "Không dịch được lúc này. Vui lòng thử lại.");
      setResult({ detected: data.detected ?? null, lines: data.lines, to });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không dịch được lúc này. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const target = result ? TRANSLATE_INFO[result.to] : null;
  return (
    <section className="mb-4">
      <label className={`chip cursor-pointer ${loading ? "pointer-events-none opacity-40" : ""}`}>
        {loading ? "Đang đọc ảnh…" : "📷 Dịch ảnh"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Dịch ảnh"
          className="sr-only"
          disabled={loading}
          onChange={(event) => {
            void onPick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-margin/30 bg-margin/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      {result && target && (
        <ul className="postcard mt-3 divide-y divide-rule px-5 py-2">
          {result.lines.map((line, index) => (
            <li key={`${index}-${line.text}`} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p
                  lang={result.detected ? TRANSLATE_INFO[result.detected].htmlLang : undefined}
                  className={`text-sm text-muted ${fontFor(result.detected)}`}
                >
                  {line.text}
                </p>
                <p lang={target.htmlLang} className={`break-words text-lg font-semibold ${fontFor(result.to)}`}>
                  {line.translation}
                </p>
                {line.reading && <p className="text-sm text-muted">{line.reading}</p>}
              </div>
              <button
                type="button"
                onClick={() => speakCode(line.translation, target.voice, settings)}
                aria-label="Đọc to"
                className="chip"
              >
                🔊
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
