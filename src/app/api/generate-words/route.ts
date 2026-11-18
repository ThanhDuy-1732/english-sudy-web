import { generateWords } from "@/lib/gemini";
import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  const { topic, exclude, count, knownCount, provider, disabledProviders } = (await req.json()) as {
    topic?: string;
    exclude?: unknown;
    count?: unknown;
    knownCount?: unknown;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callTask({ task: "word-generation", prompt, provider, disabledProviders });
      resolvedProviderId = result.providerId;
      return result.text;
    };

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
    return NextResponse.json(
      { error: "Không thể sinh từ mới lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
