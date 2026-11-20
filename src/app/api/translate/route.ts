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

// Vietnamese and English results must be Latin script: kana, Han or Hangul means the AI echoed the source.
const NON_LATIN = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
const wrongScript = (to: TranslateLang, results: { text: string }[]) =>
  (to === "vi" || to === "en") && results.some((result) => NON_LATIN.test(result.text));

function buildPrompt(text: string, from: TranslateLang | "auto", to: TranslateLang): string {
  const target = LANGUAGE_NAME[to];
  const task =
    from === "auto"
      ? `Detect the language of the text, then translate it into ${target}.`
      : `Translate the text from ${LANGUAGE_NAME[from]} into ${target}.`;
  const reading =
    to === "zh"
      ? 'For "reading": pinyin with tone marks.'
      : to === "ja"
        ? 'For "reading": kana.'
        : to === "ko"
          ? 'For "reading": Revised Romanization.'
          : 'Omit "reading".';

  return `You are a translator helping a Vietnamese learner.
${task}
Every result "text" must be written in ${target}, never in the source language.

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
  const body: Partial<{ text: unknown; from: unknown; to: unknown; provider: string; disabledProviders: string[] }> | null = await req
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
  const failed = () => NextResponse.json({ error: "Không dịch được lúc này. Vui lòng thử lại." }, { status: 503 });
  let providerUsed = "";
  const askRaw = (content: string, provider: string | undefined) =>
    callTask({ task: "translation", prompt: content, provider, disabledProviders: body?.disabledProviders }).then((result) => {
      providerUsed = result.providerId;
      return result.text;
    });
  const ask = async (content: string, provider = body?.provider) => {
    const raw = await askRaw(content, provider);
    const shaped = await parseAiJson(raw, ResponseSchema, {
      repair: (err) => askRaw(`${content}\n\nSchema error: ${err}\nReturn valid JSON only.`, providerUsed),
    });
    return parseTranslation(shaped);
  };

  try {
    let parsed = await ask(prompt);
    if (parsed && wrongScript(to as TranslateLang, parsed.results)) {
      parsed = await ask(
        `${prompt}\n\nYour previous answer was not in ${LANGUAGE_NAME[to as TranslateLang]}. Write every "text" in ${LANGUAGE_NAME[to as TranslateLang]}.`,
        providerUsed
      );
    }
    if (!parsed || wrongScript(to as TranslateLang, parsed.results)) return failed();
    // Only auto-detect can land on the target; a chosen source wins (学生 is the same in zh and ja).
    if (from === "auto" && parsed.detected === to) {
      return NextResponse.json({ error: "Ngôn ngữ nguồn và đích giống nhau." }, { status: 400 });
    }
    return NextResponse.json(parsed, { headers: { "X-Provider-Used": providerUsed } });
  } catch (error) {
    console.error("Failed to translate", error);
    return failed();
  }
}
