import { generateWords } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { topic, provider } = (await req.json()) as { topic?: string; provider?: string };

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, provider);
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const words = await generateWords(topic, generateFn);
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
