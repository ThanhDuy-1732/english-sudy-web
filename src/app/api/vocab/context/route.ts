import { NextResponse } from "next/server";
import { isLearnLang } from "@/lib/languages";
import { callTask } from "@/lib/ai-tasks";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

const LANGUAGE_NAMES = { en: "English", zh: "Simplified Chinese", ja: "Japanese", ko: "Korean" } as const;
const READINGS = { en: "", zh: "pinyin with tone marks", ja: "kana", ko: "Revised Romanization" } as const;

const FORMAT_PROMPTS: Record<string, string> = {
  mini_story: "a short story (3-4 sentences)",
  dialogue: "a short dialogue between two people (4-6 lines)",
  email: "a short professional email",
  workplace: "a short workplace situation description (3-4 sentences)",
};

export async function POST(req: Request) {
  const { words, format = "dialogue", lang: rawLang } = await req.json() as {
    words: string[];
    format?: string;
    lang?: unknown;
  };
  const lang = isLearnLang(rawLang) ? rawLang : "en";

  if (!words?.length) {
    return NextResponse.json({ error: "words required" }, { status: 400 });
  }

  const formatDesc = FORMAT_PROMPTS[format] ?? FORMAT_PROMPTS.dialogue;
  // English keeps its original prompt; other languages put each sentence's reading under it and a Vietnamese translation at the end.
  const prompt =
    lang === "en"
      ? `Create ${formatDesc} that naturally uses ALL of these English words: ${words.join(", ")}.
Mark each target word with **bold** formatting.
Return only the text, no explanation.`
      : `Create ${formatDesc} in ${LANGUAGE_NAMES[lang]} that naturally uses ALL of these words: ${words.join(", ")}.
Mark each target word with **bold** formatting.
After each line, add its reading (${READINGS[lang]}) in parentheses on its own line.
End with a blank line and a Vietnamese translation of the whole text, starting with "Dịch:".
Return only the text, no explanation.`;

  const { text, providerId } = await callTask({ task: "vocab-context", prompt });
  return NextResponse.json({ text }, { headers: { "X-Provider-Used": providerId } });
}
