// src/lib/gemini.ts
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

export async function generateWords(
  topic: string,
  generateContentFn: GenerateFn
): Promise<GeneratedWord[]> {
  const prompt = `Generate 5 English vocabulary words for the topic "${topic}". For each word, provide the Vietnamese meaning. Return ONLY a JSON array with no markdown: [{"word": "...", "meaning": "..."}]`;
  const text = stripJsonCodeFence(await generateContentFn(prompt));
  try {
    return JSON.parse(text) as GeneratedWord[];
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 100)}`);
  }
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
