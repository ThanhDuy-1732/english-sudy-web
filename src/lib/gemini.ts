// src/lib/gemini.ts
import { RANDOM_TOPIC } from "./topics";
import { LANG_INFO, type LearnLang } from "./languages";
export interface GeneratedWord {
  word: string;
  meaning: string;
}

export interface BatchGeneratedWord extends GeneratedWord {
  example: string;
}

export interface ReadingQuestion {
  question: string;
  options: string[];
  answer: string;
}

type GenerateFn = (prompt: string) => Promise<string>;

function stripJsonCodeFence(text: string) {
  return text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
}

export interface GenerateWordsOptions {
  exclude?: string[];
  count?: number;
  knownCount?: number;
}

export async function generateWords(
  topic: string,
  generateContentFn: GenerateFn,
  options: GenerateWordsOptions = {}
): Promise<GeneratedWord[]> {
  const count = options.count ?? 5;
  const excluded = (options.exclude ?? []).map((word) => word.trim()).filter(Boolean);
  const blocked = new Set(excluded.map((word) => word.toLowerCase()));
  const requested: string[] = [];
  const knownCount = options.knownCount ?? 0;

  // The model returns the topic's most obvious words every time unless the prompt
  // carries what the learner has already seen; temperature alone does not help.
  const buildPrompt = (missing: number) => {
    const avoid = [...excluded, ...requested];
    const knownLine =
      knownCount > 0
        ? `\nThe learner already knows ${knownCount} words on this topic; avoid them and prefer less common words.`
        : "";
    const avoidLine = avoid.length
      ? `\nDo NOT use any of these words, they were already shown to the learner: ${avoid.join(", ")}. Pick different words.`
      : "";
    const subject =
      topic === RANDOM_TOPIC
        ? `useful English vocabulary words picked at random from many different everyday topics (each word from a different area of life; mix nouns, verbs and adjectives; no shared theme)`
        : `English vocabulary words for the topic "${topic}"`;
    return `Generate ${missing} ${subject}. For each word, provide the Vietnamese meaning.${knownLine}${avoidLine}\nReturn ONLY a JSON array with no markdown: [{"word": "...", "meaning": "..."}]`;
  };

  const ask = async (missing: number): Promise<GeneratedWord[]> => {
    const text = stripJsonCodeFence(await generateContentFn(buildPrompt(missing)));
    try {
      return JSON.parse(text) as GeneratedWord[];
    } catch {
      throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 100)}`);
    }
  };

  const collected: GeneratedWord[] = [];
  let dropped = 0;

  for (const entry of await ask(count)) {
    const word = typeof entry?.word === "string" ? entry.word.trim() : "";
    if (!word || blocked.has(word.toLowerCase())) {
      dropped += 1;
      continue;
    }
    blocked.add(word.toLowerCase());
    requested.push(word);
    collected.push({ ...entry, word });
  }

  // One replacement call only; a bad batch still returns what the first call gave us.
  if (dropped > 0 && collected.length < count) {
    try {
      for (const entry of await ask(count - collected.length)) {
        const word = typeof entry?.word === "string" ? entry.word.trim() : "";
        if (!word || blocked.has(word.toLowerCase())) continue;
        blocked.add(word.toLowerCase());
        requested.push(word);
        collected.push({ ...entry, word });
        if (collected.length >= count) break;
      }
    } catch {
      // keep the first batch
    }
  }

  return collected.slice(0, count);
}

export async function generateSentence(
  word: string,
  generateContentFn: GenerateFn
): Promise<string> {
  const prompt = `Write one natural English example sentence using the word "${word}". Return only the sentence, nothing else.`;
  return (await generateContentFn(prompt)).trim();
}

export async function generateSynonyms(
  word: string,
  generateContentFn: GenerateFn
): Promise<{ synonyms: string[]; antonyms: string[] }> {
  const prompt = `For the English word "${word}", provide:\n- 2-3 synonyms\n- 1-2 antonyms\nReturn JSON only: {"synonyms": ["word1", "word2"], "antonyms": ["word1"]}`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as { synonyms: string[]; antonyms: string[] };
  } catch {
    return { synonyms: [], antonyms: [] };
  }
}

export async function gradeSentence(
  word: string,
  sentence: string,
  generateContentFn: GenerateFn
): Promise<{ score: number; feedback: string; corrected: string }> {
  const prompt = `Grade this English sentence that uses the word "${word}":\n"${sentence}"\n\nReturn JSON only:\n{"score": <number from 1 to 10>, "feedback": "<short Vietnamese feedback, one sentence>", "corrected": "<corrected sentence, same as input if no errors>"}`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as { score: number; feedback: string; corrected: string };
  } catch {
    throw new Error(`Gemini returned invalid JSON for gradeSentence: ${text.slice(0, 100)}`);
  }
}

export async function generateFillBlank(
  word: string,
  generateContentFn: GenerateFn
): Promise<{ sentence: string }> {
  const prompt = `Write one natural English sentence using the word "${word}". Replace the word "${word}" with "_____".\nReturn JSON only: {"sentence": "The sentence with _____ here."}`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as { sentence: string };
  } catch {
    throw new Error(`Gemini returned invalid JSON for generateFillBlank: ${text.slice(0, 100)}`);
  }
}

export interface GeneratedConcept {
  meaning: string;
  words: Partial<Record<LearnLang, { word: string; reading?: string }>>;
}

const READING_HINT: Record<LearnLang, string> = {
  en: "",
  zh: ' "reading" is pinyin with tone marks.',
  ja: ' "reading" is the kana reading (hiragana; katakana for loanwords).',
  ko: ' "reading" is the Revised Romanization.',
};

/** Concepts whose every requested language has a word; other languages and malformed items are dropped. */
export function parseConcepts(text: string, langs: LearnLang[]): GeneratedConcept[] {
  let raw: unknown;
  try {
    raw = JSON.parse(stripJsonCodeFence(text));
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 100)}`);
  }
  if (!Array.isArray(raw)) return [];
  const concepts: GeneratedConcept[] = [];
  for (const item of raw) {
    const meaning = typeof item?.meaning === "string" ? item.meaning.trim() : "";
    if (!meaning || !item.words || typeof item.words !== "object") continue;
    const words: GeneratedConcept["words"] = {};
    for (const lang of langs) {
      const entry = item.words[lang];
      const word = typeof entry?.word === "string" ? entry.word.trim() : "";
      if (!word) break;
      const reading = lang !== "en" && typeof entry.reading === "string" && entry.reading.trim() ? entry.reading.trim() : undefined;
      words[lang] = reading ? { word, reading } : { word };
    }
    if (langs.every((lang) => words[lang])) concepts.push({ meaning, words });
  }
  return concepts;
}

/** Words for several languages at once: one Vietnamese meaning per item, one word per language. */
export async function generateConcepts(
  topic: string,
  langs: LearnLang[],
  generateContentFn: GenerateFn,
  options: { count?: number; exclude?: Partial<Record<LearnLang, string[]>>; knownCount?: number } = {}
): Promise<GeneratedConcept[]> {
  const count = options.count ?? 5;
  const exclude = options.exclude ?? {};
  const blocked = new Set(langs.flatMap((lang) => (exclude[lang] ?? []).map((word) => `${lang}:${word.trim().toLowerCase()}`)));
  const subject =
    topic === RANDOM_TOPIC
      ? "useful vocabulary picked at random from many different everyday topics (each item from a different area of life; mix nouns, verbs and adjectives; no shared theme)"
      : `vocabulary for the topic "${topic}"`;
  const languageLines = langs
    .map((lang) => `- ${lang}: ${LANG_INFO[lang].native === "中文" ? "Simplified Chinese" : LANG_INFO[lang].native}.${READING_HINT[lang]}`)
    .join("\n");
  const avoid = langs
    .filter((lang) => exclude[lang]?.length)
    .map((lang) => `${lang}: ${exclude[lang]!.join(", ")}`)
    .join("\n");
  const known = options.knownCount ? `\nThe learner already knows ${options.knownCount} items on this topic; prefer less common ones.` : "";
  const prompt = `Generate ${count} ${subject}. Each item is one meaning given in these languages:\n${languageLines}\nGive the Vietnamese meaning once per item.${known}${avoid ? `\nDo NOT use these words, the learner has seen them:\n${avoid}` : ""}\nReturn ONLY a JSON array with no markdown: [{"meaning": "<Vietnamese>", "words": {${langs.map((lang) => `"${lang}": {"word": "..."${lang === "en" ? "" : ', "reading": "..."'}}`).join(", ")}}}]`;

  const concepts = parseConcepts(await generateContentFn(prompt), langs);
  return concepts
    .filter((concept) => !langs.some((lang) => blocked.has(`${lang}:${concept.words[lang]!.word.toLowerCase()}`)))
    .slice(0, count);
}

export async function generateWordsBatch(
  words: string[],
  generateContentFn: GenerateFn
): Promise<BatchGeneratedWord[]> {
  const wordList = words.slice(0, 20).join(", ");
  const prompt = `For each of these English words: ${wordList}\nProvide a concise Vietnamese meaning and one natural English example sentence.\nReturn JSON array only: [{"word":"...","meaning":"...","example":"..."}]`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as BatchGeneratedWord[];
  } catch {
    throw new Error(`Gemini returned invalid JSON for generateWordsBatch: ${text.slice(0, 100)}`);
  }
}

export async function generateReading(
  words: string[],
  generateContentFn: GenerateFn
): Promise<{ passage: string; questions: ReadingQuestion[] }> {
  const prompt = `Write a short English paragraph (80-100 words) that naturally uses all of these words: ${words.join(", ")}.\nThen write 2 comprehension questions, each with 3 multiple choice options (A, B, C).\nReturn JSON only: {"passage":"...","questions":[{"question":"...","options":["A. ...","B. ...","C. ..."],"answer":"A"}]}`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as { passage: string; questions: ReadingQuestion[] };
  } catch {
    throw new Error(`Gemini returned invalid JSON for generateReading: ${text.slice(0, 100)}`);
  }
}
