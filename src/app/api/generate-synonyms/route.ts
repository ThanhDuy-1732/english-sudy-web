import { generateSynonyms } from "@/lib/gemini";
import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { word, provider, disabledProviders } = (await req.json()) as {
    word?: string;
    provider?: string;
    disabledProviders?: string[];
  };

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

    const result = await generateSynonyms(word, generateFn);
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
