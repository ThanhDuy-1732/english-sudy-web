import { gradeSentence } from "@/lib/gemini";
import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    word?: string;
    sentence?: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!body.word?.trim() || !body.sentence?.trim()) {
    return NextResponse.json({ error: "Missing word or sentence" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callTask({ task: "sentence-grade", prompt, provider: body.provider, disabledProviders: body.disabledProviders });
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
