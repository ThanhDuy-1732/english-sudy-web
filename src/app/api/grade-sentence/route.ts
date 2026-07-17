import { gradeSentence } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { word?: string; sentence?: string; provider?: string };

  if (!body.word?.trim() || !body.sentence?.trim()) {
    return NextResponse.json({ error: "Missing word or sentence" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, body.provider);
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const gradeResult = await gradeSentence(body.word.trim(), body.sentence.trim(), generateFn);
    return NextResponse.json(gradeResult, {
      headers: { "X-Provider-Used": resolvedProviderId },
    });
  } catch {
    return NextResponse.json({ error: "Unable to grade sentence" }, { status: 502 });
  }
}
