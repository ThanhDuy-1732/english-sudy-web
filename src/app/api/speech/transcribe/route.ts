import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const audio = form.get("audio") as File | null;

  if (!audio) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  const model = process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo";

  const upstream = new FormData();
  upstream.append("file", audio, "speech.webm");
  upstream.append("model", model);
  upstream.append("response_format", "verbose_json");
  upstream.append("language", "en");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}` },
    body: upstream,
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({
    text: data.text,
    durationSec: data.duration,
    segments: (data.segments ?? []).map((s: { start: number; end: number; text: string }) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
  });
}
