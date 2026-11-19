import type { LearnLang } from "./languages";

// ASCII and CJK punctuation (full-width forms included); never part of an answer.
const PUNCTUATION = /[.,!?;:'"()\[\]{}…。，、！？；：「」『』（）【】《》〈〉“”‘’～·-]/g;

/** Chinese and Japanese write words without spaces, so their answers compare character by character. */
const noSpaces = (lang: LearnLang) => lang === "zh" || lang === "ja";

/** Lowercase, no punctuation; zh/ja also drop all whitespace, en/ko collapse it to single spaces. */
export function normalizeAnswer(text: string, lang: LearnLang): string {
  const stripped = text.toLowerCase().replace(PUNCTUATION, " ");
  return noSpaces(lang) ? stripped.replace(/\s+/g, "") : stripped.replace(/\s+/g, " ").trim();
}

export function answersMatch(input: string, expected: string, lang: LearnLang): boolean {
  const a = normalizeAnswer(input, lang);
  return a.length > 0 && a === normalizeAnswer(expected, lang);
}

/** Units to compare: characters for zh/ja, words for en/ko. */
export function answerTokens(text: string, lang: LearnLang): string[] {
  const normalized = normalizeAnswer(text, lang);
  if (!normalized) return [];
  return noSpaces(lang) ? [...normalized] : normalized.split(" ");
}

/** Share (0–100) of the target's tokens found in what was spoken; each spoken token matches at most once. */
export function similarityPct(target: string, spoken: string, lang: LearnLang): number {
  const wanted = answerTokens(target, lang);
  if (wanted.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const token of answerTokens(spoken, lang)) pool.set(token, (pool.get(token) ?? 0) + 1);
  let matched = 0;
  for (const token of wanted) {
    const left = pool.get(token) ?? 0;
    if (left > 0) {
      matched += 1;
      pool.set(token, left - 1);
    }
  }
  return Math.round((matched / wanted.length) * 100);
}

/** Target tokens not found in what was spoken (same one-for-one matching as similarityPct), in target order. */
export function missingTokens(target: string, spoken: string, lang: LearnLang): string[] {
  const pool = new Map<string, number>();
  for (const token of answerTokens(spoken, lang)) pool.set(token, (pool.get(token) ?? 0) + 1);
  const missing: string[] = [];
  for (const token of answerTokens(target, lang)) {
    const left = pool.get(token) ?? 0;
    if (left > 0) pool.set(token, left - 1);
    else missing.push(token);
  }
  return missing;
}
