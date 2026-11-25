import { generateFillBlank } from "@/lib/gemini";
import { isLearnLang } from "@/lib/languages";
import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";
import { badJson, readJson } from "@/lib/read-json";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = await readJson<{
    lang?: unknown;
    word?: string;
    provider?: string;
    disabledProviders?: string[];
  }>(request);
  if (!body) return badJson();

  if (!body.word?.trim()) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  try {
    let resolvedProviderId = "";
    const generateFn = async (prompt: string) => {
      const result = await callTask({ task: "vocab-exercise", prompt, provider: body.provider, disabledProviders: body.disabledProviders });
      resolvedProviderId = result.providerId;
      return result.text;
    };

    const result = await generateFillBlank(body.word.trim(), generateFn, isLearnLang(body.lang) ? body.lang : "en");
    return NextResponse.json(result, { headers: { "X-Provider-Used": resolvedProviderId } });
  } catch {
    return NextResponse.json(
      { error: "Unable to generate fill-in-the-blank sentence" },
      { status: 502 }
    );
  }
}
