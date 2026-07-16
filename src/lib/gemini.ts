import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeneratedWord {
  word: string;
  meaning: string;
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

function stripJsonCodeFence(text: string) {
  return text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
}

export async function generateWords(topic: string): Promise<GeneratedWord[]> {
  const prompt = `Generate 5 English vocabulary words for the topic "${topic}". For each word, provide the Vietnamese meaning. Return ONLY a JSON array with no markdown: [{"word": "...", "meaning": "..."}]`;
  const result = await getModel().generateContent(prompt);
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
  const result = await getModel().generateContent(prompt);

  return result.response.text().trim();
}
