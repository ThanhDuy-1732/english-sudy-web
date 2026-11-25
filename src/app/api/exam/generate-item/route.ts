import { NextRequest, NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";
import { ExamItemSchema } from "@/lib/exam/schemas";
import { buildItemPrompt } from "@/lib/exam/prompts";
import { parseAiJson } from "@/lib/ai-json";
import type { ExamKind, ExamPart } from "@/lib/exam/types";
import { badJson, readJson } from "@/lib/read-json";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

const PARTS: Record<ExamKind, readonly ExamPart[]> = {
  TOEIC: ["LC1", "LC2", "LC3", "LC4", "RC5", "RC6", "RC7"],
  IELTS: ["LISTEN_S1", "LISTEN_S2", "LISTEN_S3", "LISTEN_S4", "READ_P1", "READ_P2", "READ_P3"],
};

export async function POST(req: NextRequest) {
  const json = await readJson<{
    kind: ExamKind;
    part: ExamPart;
    level: 1 | 2 | 3 | 4 | 5;
    topic?: string;
    provider?: string;
    disabledProviders?: string[];
  }>(req);
  if (!json) return badJson();
  const {
    kind,
    part,
    level,
    topic,
    provider,
    disabledProviders,
  } = json;

  // Without this, a bad kind/part/level reached the prompt as "undefined" and still cost a slow AI call.
  const parts: readonly string[] = Object.hasOwn(PARTS, kind) ? PARTS[kind] : [];
  if (!parts.includes(part) || !Number.isInteger(level) || level < 1 || level > 5 || (topic !== undefined && (typeof topic !== "string" || topic.length > 200))) {
    return NextResponse.json({ error: "Invalid kind, part, level or topic" }, { status: 400 });
  }

  // Provider failures and JSON that fails the schema even after repair used to escape as a bare 500.
  try {
    const prompt = buildItemPrompt({ kind, part, level, topic });
    const { text, providerId } = await callTask({ task: "exam-generation", prompt, provider, disabledProviders });

    const parsed = await parseAiJson(text, ExamItemSchema, {
      // retry once: send zod error back to the model to self-correct
      repair: (err) =>
        callTask({ task: "exam-generation", prompt: `${prompt}\n\nOutput trước bị lỗi schema: ${err}\nTrả lại JSON hợp lệ, KHÔNG giải thích.`, provider: providerId, disabledProviders: disabledProviders, repair: true }).then((r) => r.text),
    });

    const item = { ...parsed, providerUsed: providerId };
    return NextResponse.json(item, {
      headers: { "X-Provider-Used": providerId },
    });
  } catch {
    return NextResponse.json({ error: "Unable to generate exam item" }, { status: 502 });
  }
}
