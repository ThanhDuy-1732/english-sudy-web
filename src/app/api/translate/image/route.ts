import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getVisionProvider } from "@/lib/providers";
import { parseAiJson } from "@/lib/ai-json";
import { isTranslateLang, parseImageTranslation, type TranslateLang } from "@/lib/translate";

// Vercel: one Gemini call plus a JSON repair call.
export const maxDuration = 300;

// The body limit is 4 MB (api-limits.ts) and base64 adds a third, so 2.9 MB is the largest image that fits.
const MAX_IMAGE_BYTES = 2.9 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

const LANGUAGE_NAME: Record<TranslateLang, string> = {
  vi: "Vietnamese",
  en: "English",
  zh: "Simplified Chinese",
  ja: "Japanese",
  ko: "Korean",
};

const ResponseSchema = z.object({
  detected: z.string().nullable().optional(),
  lines: z.array(z.object({ text: z.string(), translation: z.string(), reading: z.string().optional() })),
});

function buildPrompt(to: TranslateLang): string {
  const target = LANGUAGE_NAME[to];
  const reading =
    to === "zh"
      ? 'For "reading": pinyin with tone marks of the translation.'
      : to === "ja"
        ? 'For "reading": kana of the translation.'
        : to === "ko"
          ? 'For "reading": Revised Romanization of the translation.'
          : 'Omit "reading".';
  return `Read every line of text in this photo (signs, menus, labels, notices), top to bottom.
Translate each line into ${target} in one natural, polite tone. Keep prices, numbers and names as they are.
${reading}
"detected" is the main language of the text in the photo (vi, en, zh, ja or ko), or null.
If there is no readable text, return an empty "lines" array.
Return ONLY JSON, no explanation:
{"detected": "zh", "lines": [{"text": "original line", "translation": "...", "reading": "..."}]}`;
}

export async function POST(req: NextRequest) {
  const body: Partial<{ image: unknown; to: unknown }> | null = await req.json().catch(() => null);
  const match = typeof body?.image === "string" ? DATA_URL.exec(body.image) : null;
  if (!match) return NextResponse.json({ error: "Ảnh không hợp lệ." }, { status: 415 });
  if (!isTranslateLang(body?.to)) {
    return NextResponse.json({ error: "Ngôn ngữ không được hỗ trợ." }, { status: 400 });
  }
  const [, mimeType, base64] = match;
  if (Buffer.byteLength(base64, "base64") > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Ảnh quá lớn." }, { status: 413 });
  }
  const vision = getVisionProvider();
  if (!vision) return NextResponse.json({ error: "Dịch ảnh cần khoá Gemini." }, { status: 503 });

  const prompt = buildPrompt(body.to);
  const image = { mimeType, base64 };
  try {
    const raw = await vision.generateWithImage(prompt, image);
    const shaped = await parseAiJson(raw, ResponseSchema, {
      repair: (err) => vision.generateWithImage(`${prompt}\n\nSchema error: ${err}\nReturn valid JSON only.`, image),
    });
    const parsed = parseImageTranslation(shaped);
    if (!parsed) return NextResponse.json({ error: "Không thấy chữ trong ảnh." }, { status: 422 });
    return NextResponse.json(parsed, { headers: { "X-Provider-Used": vision.id } });
  } catch (error) {
    console.error("Failed to translate image", error);
    return NextResponse.json({ error: "Không dịch được lúc này. Vui lòng thử lại." }, { status: 503 });
  }
}
