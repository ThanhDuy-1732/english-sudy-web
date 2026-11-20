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

function isValidEntry(entry: unknown): entry is HistoryEntry {
  if (!entry || typeof entry !== "object") return false;
  const item = entry as HistoryEntry;
  if (typeof item.id !== "string" || typeof item.text !== "string" || item.text === "") return false;
  if (typeof item.at !== "string") return false;
  if (!(item.from === "auto" || isTranslateLang(item.from))) return false;
  if (!isTranslateLang(item.to)) return false;
  const translation = item.translation;
  if (!translation || typeof translation !== "object") return false;
  return (
    isTranslateLang(translation.detected) &&
    typeof translation.vietnamese === "string" &&
    Array.isArray(translation.results)
  );
}

export function getHistory(): HistoryEntry[] {
  return readStored<HistoryEntry[]>(TRANSLATION_HISTORY_KEY, []).filter(isValidEntry);
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

const WHISPER_NAMES: Record<string, TranslateLang> = {
  vietnamese: "vi",
  english: "en",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
};

/** Whisper reports the language as an English name ("korean"); codes are accepted too. */
export function whisperLang(name: unknown): TranslateLang | null {
  if (typeof name !== "string") return null;
  const key = name.trim().toLowerCase();
  return WHISPER_NAMES[key] ?? (isTranslateLang(key) ? key : null);
}

export interface ImageLine {
  text: string;
  translation: string;
  /** Reading of the translation (pinyin, kana, romanization) when the target is zh/ja/ko. */
  reading?: string;
}

export interface ImageTranslation {
  detected: TranslateLang | null;
  lines: ImageLine[];
}

/** Keeps lines that have both the original and the translation; null when none remain. */
export function parseImageTranslation(raw: unknown): ImageTranslation | null {
  if (!raw || typeof raw !== "object") return null;
  const { detected, lines } = raw as { detected?: unknown; lines?: unknown };
  if (!Array.isArray(lines)) return null;
  const kept: ImageLine[] = [];
  for (const item of lines) {
    if (!item || typeof item !== "object") continue;
    const { text, translation, reading } = item as Record<string, unknown>;
    if (typeof text !== "string" || typeof translation !== "string") continue;
    if (!text.trim() || !translation.trim()) continue;
    kept.push({
      text: text.trim(),
      translation: translation.trim(),
      ...(typeof reading === "string" && reading.trim() ? { reading: reading.trim() } : {}),
    });
  }
  return kept.length > 0 ? { detected: isTranslateLang(detected) ? detected : null, lines: kept } : null;
}
