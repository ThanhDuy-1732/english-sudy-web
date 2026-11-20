import { readStored } from "./safe-json";
import { LANG_INFO, isLearnLang, type LearnLang } from "./languages";

// Translator languages: the learner's languages plus Vietnamese as a source/target.
export type TranslateLang = "vi" | LearnLang;

export const TRANSLATE_LANGS: TranslateLang[] = ["vi", "en", "zh", "ja", "ko"];

export const TRANSLATE_INFO: Record<
  TranslateLang,
  { label: string; native: string; short: string; voice: string; htmlLang: string }
> = {
  vi: { label: "Tiếng Việt", native: "Tiếng Việt", short: "VI", voice: "vi-VN", htmlLang: "vi" },
  en: LANG_INFO.en,
  zh: LANG_INFO.zh,
  ja: LANG_INFO.ja,
  ko: LANG_INFO.ko,
};

export function isTranslateLang(value: unknown): value is TranslateLang {
  return typeof value === "string" && (TRANSLATE_LANGS as string[]).includes(value);
}

export type Tone = "casual" | "polite" | "formal";

export const TONES: { tone: Tone; label: string }[] = [
  { tone: "casual", label: "Thân mật" },
  { tone: "polite", label: "Lịch sự" },
  { tone: "formal", label: "Trang trọng" },
];

export interface TranslationResult {
  tone: Tone;
  text: string;
  reading?: string;
  note: string;
}

export interface Translation {
  detected: TranslateLang;
  vietnamese: string;
  results: TranslationResult[];
}

const TONE_INDEX = new Map(TONES.map((entry, index) => [entry.tone, index]));

/** Keeps known tones in TONES order, at most one per tone; drops empty texts. */
export function parseTranslation(raw: unknown): Translation | null {
  if (!raw || typeof raw !== "object") return null;
  const { detected, vietnamese, results } = raw as {
    detected?: unknown;
    vietnamese?: unknown;
    results?: unknown;
  };
  if (!isTranslateLang(detected) || typeof vietnamese !== "string" || !Array.isArray(results)) {
    return null;
  }

  const byTone = new Map<Tone, TranslationResult>();
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const { tone, text, reading, note } = item as Record<string, unknown>;
    if (typeof tone !== "string" || !TONE_INDEX.has(tone as Tone)) continue;
    if (typeof text !== "string" || text.trim() === "") continue;
    const key = tone as Tone;
    if (byTone.has(key)) continue;
    byTone.set(key, {
      tone: key,
      text: text.trim(),
      ...(typeof reading === "string" && reading.trim() !== "" ? { reading: reading.trim() } : {}),
      note: typeof note === "string" ? note : "",
    });
  }

  const ordered = TONES.map(({ tone }) => byTone.get(tone)).filter(
    (result): result is TranslationResult => Boolean(result)
  );
  return ordered.length > 0 ? { detected, vietnamese, results: ordered } : null;
}

export interface TranslatePair {
  from: TranslateLang | "auto";
  to: TranslateLang;
}

export const TRANSLATE_PAIR_KEY = "translatePair";
const DEFAULT_PAIR: TranslatePair = { from: "vi", to: "en" };

export function getTranslatePair(): TranslatePair {
  const stored = readStored<Partial<TranslatePair> | null>(TRANSLATE_PAIR_KEY, null);
  const from = stored && (stored.from === "auto" || isTranslateLang(stored.from)) ? stored.from : DEFAULT_PAIR.from;
  const to = stored && isTranslateLang(stored.to) ? stored.to : DEFAULT_PAIR.to;
  return { from, to };
}

export function setTranslatePair(pair: TranslatePair): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(TRANSLATE_PAIR_KEY, JSON.stringify(pair));
    return true;
  } catch {
    return false;
  }
}

export interface HistoryEntry {
  id: string;
  from: TranslateLang | "auto";
  to: TranslateLang;
  text: string;
  translation: Translation;
  at: string;
}

export const TRANSLATION_HISTORY_KEY = "translationHistory";
const HISTORY_LIMIT = 20;

export function getHistory(): HistoryEntry[] {
  return readStored<HistoryEntry[]>(TRANSLATION_HISTORY_KEY, []);
}

/** Newest first, keeps HISTORY_LIMIT entries, and replaces an entry with the same text + target. */
export function addHistory(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  const list = getHistory().filter((item) => !(item.text === entry.text && item.to === entry.to));
  list.unshift({ ...entry });
  try {
    localStorage.setItem(TRANSLATION_HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
  } catch {
    // Storage full or blocked: the history is a convenience, not data.
  }
}

export const MAX_TRANSLATE_CHARS = 1000;
