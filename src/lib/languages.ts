import { readStored } from "./safe-json";

// Languages the learner can study. Meanings and explanations are always Vietnamese.
export type LearnLang = "en" | "zh" | "ja" | "ko";

export const LEARN_LANGS: LearnLang[] = ["en", "zh", "ja", "ko"];

export const LANG_INFO: Record<LearnLang, { label: string; native: string; short: string; voice: string; htmlLang: string; reading?: string }> = {
  en: { label: "Tiếng Anh", native: "English", short: "EN", voice: "en-US", htmlLang: "en" },
  zh: { label: "Tiếng Trung", native: "中文", short: "中", voice: "zh-CN", htmlLang: "zh-CN", reading: "pinyin" },
  ja: { label: "Tiếng Nhật", native: "日本語", short: "日", voice: "ja-JP", htmlLang: "ja", reading: "kana" },
  ko: { label: "Tiếng Hàn", native: "한국어", short: "한", voice: "ko-KR", htmlLang: "ko", reading: "romanization" },
};

export const LEARNING_LANGUAGES_KEY = "learningLanguages";
export const LEARNING_LANGUAGES_EVENT = "learning-languages";

export function isLearnLang(value: unknown): value is LearnLang {
  return typeof value === "string" && (LEARN_LANGS as string[]).includes(value);
}

/** A saved word or bank entry's language; entries from before multi-language are English. */
export function langOf(entry: { lang?: string }): LearnLang {
  return isLearnLang(entry.lang) ? entry.lang : "en";
}

function clean(langs: unknown): LearnLang[] {
  const list = Array.isArray(langs) ? langs : [];
  return LEARN_LANGS.filter((lang) => list.includes(lang));
}

export function getLearningLanguages(): LearnLang[] {
  const langs = clean(readStored<unknown>(LEARNING_LANGUAGES_KEY, ["en"]));
  return langs.length > 0 ? langs : ["en"];
}

/** Stores the learning languages in a fixed order. Refuses an empty list: at least one language is always studied. */
export function setLearningLanguages(langs: LearnLang[]): boolean {
  const next = clean(langs);
  if (next.length === 0) return false;
  localStorage.setItem(LEARNING_LANGUAGES_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(LEARNING_LANGUAGES_EVENT));
  return true;
}
