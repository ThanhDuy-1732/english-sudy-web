"use client";

import { useEffect, useRef } from "react";
import { LANG_INFO, LEARN_LANGS, type LearnLang } from "@/lib/languages";
import { useLearningLanguages } from "@/lib/useLearningLanguages";

/** Which languages are studied, as a pill showing their short codes; the last checked one can't be unchecked. */
export default function LanguagePicker({ align = "left" }: { align?: "left" | "right" }) {
  const [langs, setLangs] = useLearningLanguages();
  const menu = useRef<HTMLDetailsElement>(null);

  // <details> only closes from its own summary: also close on Escape and on a tap anywhere else.
  useEffect(() => {
    const close = () => {
      if (menu.current) menu.current.open = false;
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    const onPointer = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  function toggle(lang: LearnLang) {
    setLangs(langs.includes(lang) ? langs.filter((item) => item !== lang) : [...langs, lang]);
  }

  return (
    <details ref={menu} className="relative">
      <summary
        aria-label={`Ngôn ngữ học: ${langs.map((lang) => LANG_INFO[lang].label).join(", ")}`}
        className="inline-flex min-h-11 shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-full border border-rule bg-card px-3 text-sm font-semibold text-ink hover:border-primary [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" /></svg>
        {/* More than two languages: two codes and a count, so the pill fits beside the brand on a phone. */}
        {langs.slice(0, 2).map((lang) => LANG_INFO[lang].short).join(" · ")}
        {langs.length > 2 && ` +${langs.length - 2}`}
      </summary>
      <div className={`absolute z-50 mt-2 w-56 rounded-3xl border border-rule bg-card p-2 shadow-[0_12px_40px_rgb(23_51_42/0.18)] ${align === "right" ? "right-0" : "left-0"}`}>
        <p className="px-3 pb-1 pt-1 text-sm text-muted">Ngôn ngữ học</p>
        {LEARN_LANGS.map((lang) => {
          const checked = langs.includes(lang);
          return (
            <label key={lang} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 hover:bg-ink/5 ${checked && langs.length === 1 ? "cursor-not-allowed" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={checked && langs.length === 1}
                onChange={() => toggle(lang)}
                className="size-4 accent-[rgb(var(--primary))]"
              />
              <span lang={LANG_INFO[lang].htmlLang} className="font-semibold text-ink">{LANG_INFO[lang].native}</span>
              <span className="text-sm text-muted">{LANG_INFO[lang].label}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}
