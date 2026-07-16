import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeneratedWord {
  word: string;
  meaning: string;
}

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-flash-latest";

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}

function stripJsonCodeFence(text: string) {
  return text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
}

function isRetryableGeminiError(error: unknown) {
  const status = (error as { status?: number }).status;
  return status === 429 || status === 500 || status === 503;
}

async function generateContentWithRetry(prompt: string) {
  const model = getModel();

  try {
    return await model.generateContent(prompt);
  } catch (error) {
    if (!isRetryableGeminiError(error)) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    return model.generateContent(prompt);
  }
}

export async function generateWords(topic: string): Promise<GeneratedWord[]> {
  const prompt = `Generate 5 English vocabulary words for the topic "${topic}". For each word, provide the Vietnamese meaning. Return ONLY a JSON array with no markdown: [{"word": "...", "meaning": "..."}]`;
  const result = await generateContentWithRetry(prompt);
  const text = stripJsonCodeFence(result.response.text());

  let parsed: GeneratedWord[];
  try {
    parsed = JSON.parse(text) as GeneratedWord[];
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 100)}`);
  }
  return parsed;
}

export async function generateSentence(word: string): Promise<string> {
  const prompt = `Write one natural English example sentence using the word "${word}". Return only the sentence, nothing else.`;
  const result = await generateContentWithRetry(prompt);

  return result.response.text().trim();
}

export async function generateSynonyms(
  word: string
): Promise<{ synonyms: string[]; antonyms: string[] }> {
  const prompt = `For the English word "${word}", provide:
- 2-3 synonyms
- 1-2 antonyms
Return JSON only: {"synonyms": ["word1", "word2"], "antonyms": ["word1"]}`;
  const result = await generateContentWithRetry(prompt);
  const text = stripJsonCodeFence(result.response.text());
  try {
    return JSON.parse(text) as { synonyms: string[]; antonyms: string[] };
  } catch {
    return { synonyms: [], antonyms: [] };
  }
}
