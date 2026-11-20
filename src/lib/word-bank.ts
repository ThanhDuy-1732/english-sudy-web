import { readStored } from "./safe-json";
import { getLearnedWords, wordKey } from "./storage";
import { langOf, type LearnLang } from "./languages";
import { RANDOM_TOPIC } from "./topics";

export interface BankWord {
  word: string;
  meaning: string;
  topic: string;
  createdAt: string;
  seenAt?: string;
  lang?: LearnLang;            // missing = English
  reading?: string;
  conceptId?: string;          // words with the same meaning in other languages share it
}

/** One meaning with a word per language, generated together. */
export interface Concept {
  conceptId: string;
  meaning: string;
  words: Partial<Record<LearnLang, { word: string; reading?: string }>>;
}

const keyOf = (entry: { word: string; lang?: string }) => wordKey(langOf(entry), normalizeWord(entry.word));

export const WORD_BANK_KEY = "wordBank";
export const WORD_BANK_LIMIT = 5000;

const RECENT_EXCLUDE_COUNT = 120;
const DEFAULT_EXCLUDE_MAX = 200;

// A failed write keeps the full snapshot here so the current session can still use
// (and display) words the learner already paid for. The next successful write clears it.
let overlay: BankWord[] | null = null;

export function normalizeWord(word: string): string {
  return word.trim().replace(/\s+/g, " ").toLowerCase();
}

function isValidEntry(entry: unknown): entry is BankWord {
  return Boolean(entry) && typeof (entry as BankWord).word === "string";
}

/** Stored bank plus the in-memory overlay; later entries win, first position kept. */
export function getBank(): BankWord[] {
  const stored = readStored<BankWord[]>(WORD_BANK_KEY, []).filter(isValidEntry);
  const merged = new Map<string, BankWord>();
  for (const entry of [...stored, ...(overlay ?? [])]) {
    if (!isValidEntry(entry)) continue;
    if (!normalizeWord(entry.word)) continue;
    merged.set(keyOf(entry), entry);
  }
  return [...merged.values()];
}

function learnedWordsList(): { word: string; lang?: string }[] {
  return getLearnedWords().filter((entry) => typeof entry?.word === "string");
}

/** Learned words as language keys. */
function learnedKeys(): Set<string> {
  return new Set(learnedWordsList().map(keyOf));
}

export function getKnownWordSet(): Set<string> {
  const known = new Set(getBank().map((entry) => normalizeWord(entry.word)));
  for (const entry of learnedWordsList()) known.add(normalizeWord(entry.word));
  return known;
}

export function addBankWords(entries: BankWord[]): { added: number; persisted: boolean } {
  const bank = getBank();
  const known = new Set(bank.map(keyOf));
  for (const key of learnedKeys()) known.add(key);

  const fresh: BankWord[] = [];
  for (const entry of entries) {
    if (!isValidEntry(entry)) continue;
    const word = entry.word.trim();
    const key = keyOf({ ...entry, word });
    if (!normalizeWord(word) || known.has(key)) continue;
    known.add(key);
    fresh.push({ ...entry, word });
  }

  if (fresh.length === 0) return { added: 0, persisted: true };

  const next = [...bank, ...fresh].slice(-WORD_BANK_LIMIT);
  try {
    localStorage.setItem(WORD_BANK_KEY, JSON.stringify(next));
    overlay = null;
    return { added: fresh.length, persisted: true };
  } catch {
    overlay = next;
    return { added: fresh.length, persisted: false };
  }
}

export function getUnseen(topic: string, limit: number, lang: LearnLang = "en"): BankWord[] {
  const learned = learnedKeys();
  return getBank()
    .filter(
      (entry) =>
        !entry.seenAt && entry.topic === topic && langOf(entry) === lang && !learned.has(keyOf(entry))
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(0, limit);
}

export function markBankWordsSeen(words: string[], lang: LearnLang = "en"): void {
  markSeen(new Set(words.map((word) => keyOf({ word, lang }))));
}

function markSeen(keys: Set<string>): void {
  if (keys.size === 0) return;
  const now = new Date().toISOString();
  const next = getBank().map((entry) =>
    !entry.seenAt && keys.has(keyOf(entry)) ? { ...entry, seenAt: now } : entry
  );
  try {
    localStorage.setItem(WORD_BANK_KEY, JSON.stringify(next));
    overlay = null;
  } catch {
    overlay = next;
  }
}

export function takeUnseen(topic: string, limit: number): BankWord[] {
  const picked = getUnseen(topic, limit);
  markBankWordsSeen(picked.map((entry) => entry.word));
  return picked;
}

export function countBank(topic?: string, lang: LearnLang = "en"): number {
  const learned = learnedKeys();
  return getBank().filter(
    (entry) =>
      !entry.seenAt &&
      (!topic || entry.topic === topic) &&
      langOf(entry) === lang &&
      !learned.has(keyOf(entry))
  ).length;
}

/** Unseen concepts of a topic that have a word, not yet learned, in every one of `langs`; oldest first. */
export function getUnseenConcepts(topic: string, langs: LearnLang[], limit: number): Concept[] {
  const learned = learnedKeys();
  const groups = new Map<string, { createdAt: string; concept: Concept }>();
  for (const entry of getBank()) {
    if (!entry.conceptId || entry.seenAt || entry.topic !== topic || learned.has(keyOf(entry))) continue;
    const group = groups.get(entry.conceptId) ?? { createdAt: entry.createdAt, concept: { conceptId: entry.conceptId, meaning: entry.meaning, words: {} } };
    group.concept.words[langOf(entry)] = entry.reading ? { word: entry.word, reading: entry.reading } : { word: entry.word };
    groups.set(entry.conceptId, group);
  }
  return [...groups.values()]
    .filter(({ concept }) => langs.every((lang) => concept.words[lang]))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(0, limit)
    .map(({ concept }) => concept);
}

/** English only counts words (as before multi-language); several languages count complete concepts. */
export function countAvailable(topic: string, langs: LearnLang[]): number {
  return isEnglishOnly(langs) ? countBank(topic) : countConcepts(topic, langs);
}

export function isEnglishOnly(langs: LearnLang[]): boolean {
  return langs.length === 1 && langs[0] === "en";
}

export function countConcepts(topic: string, langs: LearnLang[]): number {
  return getUnseenConcepts(topic, langs, Number.MAX_SAFE_INTEGER).length;
}

/**
 * Stores each concept as one bank word per language, linked by a fresh conceptId. A concept is stored whole or
 * not at all: if any of its words is already in the bank, learned, or used by an earlier concept of the batch,
 * the whole concept is skipped, so no partial concept can hide (and block) its other words. `added` counts concepts.
 */
export function addConcepts(topic: string, concepts: Omit<Concept, "conceptId">[]): { added: number; persisted: boolean } {
  const known = new Set(getBank().map(keyOf));
  for (const key of learnedKeys()) known.add(key);
  const createdAt = new Date().toISOString();
  const entries: BankWord[] = [];
  let added = 0;
  for (const concept of concepts) {
    const items = (Object.entries(concept.words) as [LearnLang, { word: string; reading?: string }][])
      .map(([lang, item]) => ({ lang, word: item.word.trim(), reading: item.reading }))
      .filter((item) => normalizeWord(item.word));
    if (items.length === 0 || items.some((item) => known.has(keyOf(item)))) continue;
    const conceptId = crypto.randomUUID();
    for (const item of items) {
      known.add(keyOf(item));
      entries.push({
        word: item.word,
        meaning: concept.meaning,
        topic,
        createdAt,
        lang: item.lang,
        conceptId,
        ...(item.reading ? { reading: item.reading } : {}),
      });
    }
    added += 1;
  }
  if (entries.length === 0) return { added: 0, persisted: true };
  return { added, persisted: addBankWords(entries).persisted };
}

export function markConceptsSeen(concepts: Concept[]): void {
  markSeen(new Set(concepts.flatMap((concept) => (Object.entries(concept.words) as [LearnLang, { word: string }][]).map(([lang, item]) => keyOf({ word: item.word, lang })))));
}

/**
 * Bounded sample for the model: the topic's newest words first (so repeats are
 * avoided immediately), then a random slice of older bank words and learned words.
 */
export function pickExcludeSample(topic: string, max = DEFAULT_EXCLUDE_MAX, lang: LearnLang = "en"): string[] {
  // Random has no theme of its own, so every topic's words count as already seen.
  const topicWords = getBank()
    .filter((entry) => langOf(entry) === lang && (topic === RANDOM_TOPIC || entry.topic === topic))
    .map((entry) => entry.word);
  const recentCount = Math.min(RECENT_EXCLUDE_COUNT, topicWords.length);
  const recent = topicWords.slice(topicWords.length - recentCount);
  const older = topicWords.slice(0, topicWords.length - recentCount);

  const used = new Set(recent.map(normalizeWord));
  const rest: string[] = [];
  for (const word of [...older, ...learnedWordsList().filter((entry) => langOf(entry) === lang).map((entry) => entry.word)]) {
    const key = normalizeWord(word);
    if (!key || used.has(key)) continue;
    used.add(key);
    rest.push(word);
  }

  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  return [...recent, ...rest].slice(0, max);
}

/** Why a generation left nothing new to show: no answer from the AI, a full browser storage, or a used-up topic. */
export function emptyBatchMessage(received: number, persisted: boolean): string {
  if (!persisted) return "Bộ nhớ trình duyệt đã đầy nên chưa lưu được từ mới. Hãy xuất file sao lưu rồi xoá bớt dữ liệu trong Cài đặt.";
  if (received === 0) return "Không thể sinh từ mới lúc này. Vui lòng thử lại.";
  return "Chủ đề này đã cạn từ mới. Thử chủ đề khác.";
}
