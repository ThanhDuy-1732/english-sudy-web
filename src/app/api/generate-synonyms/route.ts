import { generateSynonyms } from "@/lib/gemini";
import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";
import { isLearnLang } from "@/lib/languages";
import { badJson, readJson } from "@/lib/read-json";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const json = await readJson<{
    word?: string;
    lang?: unknown;
    provider?: string;
    disabledProviders?: string[];
  }>(req);
  if (!json) return badJson();
  const { word, provider, disabledProviders, lang: rawLang } = json;

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callTask({ task: "vocab-exercise", prompt, provider, disabledProviders });
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const result = await generateSynonyms(word, generateFn, isLearnLang(rawLang) ? rawLang : "en");
    return NextResponse.json(result, {
      headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId },
    });
  } catch (error) {
    console.error("Failed to generate synonyms", error);
    return NextResponse.json(
      { error: "Không thể sinh từ đồng/trái nghĩa lúc này." },
      { status: 503, headers: NO_STORE }
    );
  }
}
