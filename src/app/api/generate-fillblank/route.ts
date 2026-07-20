import { generateFillBlank } from "@/lib/gemini";
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    word?: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!body.word?.trim()) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callWithFallback(prompt, body.provider, body.disabledProviders);
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const result = await generateFillBlank(body.word.trim(), generateFn);
    return NextResponse.json(result, { headers: { "X-Provider-Used": resolvedProviderId } });
  } catch {
    return NextResponse.json(
      { error: "Unable to generate fill-in-the-blank sentence" },
      { status: 502 }
    );
  }
}
