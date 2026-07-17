import { generateSentence } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { word, provider } = (await req.json()) as { word?: string; provider?: string };

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, provider);
      resolvedProviderId = result.providerId;
      return result.text;
    };

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
