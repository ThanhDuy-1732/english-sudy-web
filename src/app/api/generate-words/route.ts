import { generateConcepts, generateWords } from "@/lib/gemini";
import { LEARN_LANGS, type LearnLang } from "@/lib/languages";
import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";
import { badJson, readJson } from "@/lib/read-json";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_EXCLUDE = 200;
const MAX_WORDS = 30;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

// Words the learner already saw for this topic; capped and de-duplicated because
// they go straight into the prompt.
function sanitizeExclude(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const words: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const word = item.trim();
    if (!word || word.length > 80) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
    if (words.length >= MAX_EXCLUDE) break;
  }
  return words;
}

// Requested learning languages, in the app's fixed order; unknown codes are dropped.
function sanitizeLangs(value: unknown): LearnLang[] {
  return Array.isArray(value) ? LEARN_LANGS.filter((lang) => value.includes(lang)) : [];
}

export async function POST(req: NextRequest) {
  const json = await readJson<{
    topic?: string;
    langs?: unknown;
    exclude?: unknown;
    count?: unknown;
    knownCount?: unknown;
    provider?: string;
    disabledProviders?: string[];
  }>(req);
  if (!json) return badJson();
  const { topic, exclude, count, knownCount, provider, disabledProviders, langs: rawLangs } = json;

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400, headers: NO_STORE });
  }

  // No langs, or English only: the original request and response, unchanged.
  const langs = rawLangs === undefined ? ["en" as const] : sanitizeLangs(rawLangs);
  if (langs.length === 0) {
    return NextResponse.json({ error: "langs has no supported language" }, { status: 400, headers: NO_STORE });
  }
  const multi = !(langs.length === 1 && langs[0] === "en");

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callTask({ task: "word-generation", prompt, provider, disabledProviders });
      resolvedProviderId = result.providerId;
      return result.text;
    };

    if (multi) {
      const byLang = (exclude && typeof exclude === "object" && !Array.isArray(exclude) ? exclude : {}) as Record<string, unknown>;
      const perLang: Partial<Record<LearnLang, string[]>> = {};
      for (const lang of langs) {
        const list = sanitizeExclude(byLang[lang]);
        if (list.length) perLang[lang] = list;
      }
      const concepts = await generateConcepts(topic, langs, generateFn, {
        exclude: perLang,
        count: clampInt(count, 1, MAX_WORDS, 5),
        knownCount: clampInt(knownCount, 0, 100_000, 0),
      });
      return NextResponse.json({ concepts }, { headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId } });
    }

    const words = await generateWords(topic, generateFn, {
      exclude: sanitizeExclude(exclude),
      count: clampInt(count, 1, MAX_WORDS, 5),
      knownCount: clampInt(knownCount, 0, 100_000, 0),
    });
    return NextResponse.json(words, {
      headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId },
    });
  } catch (error) {
    console.error("Failed to generate words", error);
    // Keep provider throttling visible so the client can cool down instead of retrying blind.
    if ((error as { status?: number }).status === 429) {
      return NextResponse.json(
        { error: "Nhà cung cấp AI đang giới hạn tốc độ. Thử lại sau." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": "30" } }
      );
    }
    return NextResponse.json(
      { error: "Không thể sinh từ mới lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
