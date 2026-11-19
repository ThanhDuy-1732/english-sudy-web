/** Số từ tự thêm tối đa cho một lần tạo ngữ cảnh. */
export const MAX_CUSTOM_WORDS = 20;
const MAX_WORD_LENGTH = 40;

/**
 * Reads words typed by the learner: commas, semicolons or newlines separate them.
 * Keeps the first spelling seen, drops duplicates case-insensitively, and ignores
 * entries with no letters or that are too long for a vocabulary item.
 */
export function parseWordInput(input: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];

  // ASCII separators plus the full-width ones Chinese/Japanese keyboards type (，、；).
  for (const raw of input.split(/[,;，、；\n]+/)) {
    const word = raw.trim().replace(/\s+/g, " ");
    if (!word || word.length > MAX_WORD_LENGTH) continue;
    if (!/\p{L}/u.test(word)) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
    if (words.length >= MAX_CUSTOM_WORDS) break;
  }

  return words;
}
