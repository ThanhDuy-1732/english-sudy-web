import { NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

const FORMAT_PROMPTS: Record<string, string> = {
  mini_story: "a short story (3-4 sentences)",
  dialogue: "a short dialogue between two people (4-6 lines)",
  email: "a short professional email",
  workplace: "a short workplace situation description (3-4 sentences)",
};

export async function POST(req: Request) {
  const { words, format = "dialogue" } = await req.json() as {
    words: string[];
    format?: string;
  };

  if (!words?.length) {
    return NextResponse.json({ error: "words required" }, { status: 400 });
  }

  const formatDesc = FORMAT_PROMPTS[format] ?? FORMAT_PROMPTS.dialogue;
  const prompt = `Create ${formatDesc} that naturally uses ALL of these English words: ${words.join(", ")}.
Mark each target word with **bold** formatting.
Return only the text, no explanation.`;

  const { text } = await callTask({ task: "vocab-context", prompt });
  return NextResponse.json({ text });
}
