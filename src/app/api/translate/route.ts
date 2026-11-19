import { NextRequest, NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";
import { parseAiJson } from "@/lib/ai-json";
import { z } from "zod";
import {
  MAX_TRANSLATE_CHARS,
  isTranslateLang,
  parseTranslation,
  type TranslateLang,
} from "@/lib/translate";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

const ResponseSchema = z.object({
  detected: z.string(),
  vietnamese: z.string(),
  results: z
    .array(
      z.object({
        tone: z.string(),
        text: z.string(),
        reading: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .min(1),
});

const LANGUAGE_NAME: Record<TranslateLang, string> = {
  vi: "Vietnamese",
  en: "English",
  zh: "Simplified Chinese",
  ja: "Japanese",
  ko: "Korean",
};

function buildPrompt(text: string, from: TranslateLang | "auto", to: TranslateLang): string {
  const source = from === "auto" ? `detect the language of the text` : `the text is in ${LANGUAGE_NAME[from]}`;
  const target = LANGUAGE_NAME[to];
  const reading =
    to === "zh"
      ? 'For "reading": pinyin with tone marks.'
      : to === "ja"
        ? 'For "reading": kana.'
        : to === "ko"
          ? 'For "reading": Revised Romanization.'
          : 'Omit "reading".';

  return `You are a translator between Vietnamese speakers and ${target} speakers.
${source}. Translate the text into ${target}.

Produce exactly one translation per tone, in this order:
1. "casual" — how friends or close family would say it.
2. "polite" — everyday polite speech.
3. "formal" — business, official or with strangers you must respect.

Make each natural for the target culture: use honorifics and register correctly for Japanese and Korean, and the 您 vs 你 distinction for Chinese.
${reading}
Each result gets a "note": one sentence in Vietnamese explaining when to use that tone.
Also return "vietnamese": the meaning of the source text in Vietnamese (the text itself if it is already Vietnamese).
Return ONLY JSON, no explanation:
{"detected": "source language code (vi, en, zh, ja or ko)", "vietnamese": "...", "results": [{"tone": "casual", "text": "...", "reading": "...", "note": "..."}, …]}

Text:
"""
${text}
"""`;
}

export async function POST(req: NextRequest) {
  const body: Partial<{ text: unknown; from: unknown; to: unknown }> | null = await req
    .json()
    .catch(() => null);
  const { text, from, to } = body ?? {};

  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "Nhập nội dung cần dịch." }, { status: 400 });
  }
  if (text.length > MAX_TRANSLATE_CHARS) {
    return NextResponse.json({ error: "Tối đa 1.000 ký tự." }, { status: 400 });
  }
  if (!(from === "auto" || isTranslateLang(from)) || !isTranslateLang(to)) {
    return NextResponse.json({ error: "Ngôn ngữ không được hỗ trợ." }, { status: 400 });
  }
  if (from === to) {
    return NextResponse.json({ error: "Ngôn ngữ nguồn và đích giống nhau." }, { status: 400 });
  }

  const prompt = buildPrompt(text.trim(), from as TranslateLang | "auto", to as TranslateLang);
  try {
    const { text: raw, providerId } = await callTask({ task: "translation", prompt });
    const shaped = await parseAiJson(raw, ResponseSchema, {
      repair: (err) =>
        callTask({ task: "translation", prompt: `${prompt}\n\nSchema error: ${err}\nReturn valid JSON only.`, provider: providerId }).then(
          (result) => result.text
        ),
    });
    const parsed = parseTranslation(shaped);
    if (!parsed) {
      return NextResponse.json({ error: "Không dịch được lúc này. Vui lòng thử lại." }, { status: 503 });
    }
    if (parsed.detected === to) {
      return NextResponse.json({ error: "Ngôn ngữ nguồn và đích giống nhau." }, { status: 400 });
    }
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Failed to translate", error);
    return NextResponse.json({ error: "Không dịch được lúc này. Vui lòng thử lại." }, { status: 503 });
  }
}
