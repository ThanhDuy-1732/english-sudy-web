import { generateWords } from "@/lib/gemini";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { topic } = (await req.json()) as { topic?: string };

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  const words = await generateWords(topic);
  return NextResponse.json(words);
}
