import { NextRequest, NextResponse } from "next/server";
import { isLearnLang } from "@/lib/languages";
import { audioFilename } from "@/lib/speech/recorder";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export async function POST(req: NextRequest) {
  // Reject before buffering a huge body; the size check below still covers a missing/understated header.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ error: "Audio file is too large" }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }
  const mimeType = audio.type.split(";")[0];
  if (!["audio/webm", "audio/mp4", "audio/x-m4a", "audio/ogg"].includes(mimeType)) {
    return NextResponse.json({ error: "Unsupported audio format" }, { status: 415 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio file is too large" }, { status: 413 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  const model = process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo";

  const upstream = new FormData();
  upstream.append("file", audio, audioFilename(audio));
  upstream.append("model", model);
  upstream.append("response_format", "verbose_json");
  // Whisper is told the language being practised; missing or unknown codes keep English.
  const language = form?.get("language");
  upstream.append("language", isLearnLang(language) ? language : "en");
  // Whisper often writes Mandarin in traditional characters; a simplified-Chinese prompt steers it to simplified.
  if (language === "zh") upstream.append("prompt", "以下是普通话的句子。");

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
    language: data.language,
    durationSec: data.duration,
    segments: (data.segments ?? []).map((s: { start: number; end: number; text: string }) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
  });
}
