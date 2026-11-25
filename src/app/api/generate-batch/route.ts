import { generateWordsBatch } from "@/lib/gemini";
import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";
import { badJson, readJson } from "@/lib/read-json";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = await readJson<{
    words?: unknown;
    provider?: string;
    disabledProviders?: string[];
  }>(request);
  if (!body) return badJson();

  if (!Array.isArray(body.words)) {
    return NextResponse.json({ error: "Missing words array" }, { status: 400 });
  }

  const words = body.words
    .filter((w): w is string => typeof w === "string")
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (words.length === 0) {
    return NextResponse.json({ error: "Missing words array" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callTask({ task: "vocab-batch", prompt, provider: body.provider, disabledProviders: body.disabledProviders });
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const result = await generateWordsBatch(words, generateFn);
    return NextResponse.json(result, { headers: { "X-Provider-Used": resolvedProviderId } });
  } catch {
    return NextResponse.json({ error: "Unable to generate word list" }, { status: 502 });
  }
}
