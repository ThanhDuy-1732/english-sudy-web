import { LANG_INFO, type LearnLang } from "@/lib/languages";

const SIZES = { lg: "text-[2.25rem] leading-tight", md: "text-lg leading-snug", sm: "text-base leading-snug" };

/**
 * A word in its own language: the `lang` attribute makes the browser pick the right Han glyphs (zh vs ja),
 * English keeps Fraunces, Chinese/Japanese/Korean fall back to the system CJK fonts. The reading sits underneath.
 */
export default function LangText({ lang, word, reading, size = "md", className = "" }: { lang: LearnLang; word: string; reading?: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 flex-col ${className}`}>
      <span lang={LANG_INFO[lang].htmlLang} className={`break-words font-semibold [overflow-wrap:anywhere] ${lang === "en" ? "font-en" : "font-sans"} ${SIZES[size]}`}>
        {word}
      </span>
      {reading && <span className="mt-0.5 text-sm text-muted">{reading}</span>}
    </span>
  );
}
