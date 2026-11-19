import { generateExample, generateSentence } from "@/lib/gemini";
import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";
import { isLearnLang } from "@/lib/languages";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { word, provider, disabledProviders, lang: rawLang } = (await req.json()) as {
    word?: string;
    lang?: unknown;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callTask({ task: "sentence-generation", prompt, provider, disabledProviders });
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const lang = isLearnLang(rawLang) ? rawLang : "en";
    if (lang !== "en") {
      const example = await generateExample(word, lang, generateFn);
      return NextResponse.json(example, { headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId } });
    }
    const sentence = await generateSentence(word, generateFn);
    return NextResponse.json({ sentence }, {
      headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId },
    });
  } catch (error) {
    console.error("Failed to generate sentence", error);
    return NextResponse.json(
      { error: "Không thể tạo câu ví dụ lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
