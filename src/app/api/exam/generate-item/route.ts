import { NextRequest, NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";
import { ExamItemSchema } from "@/lib/exam/schemas";
import { buildItemPrompt } from "@/lib/exam/prompts";
import { parseAiJson } from "@/lib/ai-json";
import type { ExamKind, ExamPart } from "@/lib/exam/types";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const {
    kind,
    part,
    level,
    topic,
    provider,
    disabledProviders,
  }: {
    kind: ExamKind;
    part: ExamPart;
    level: 1 | 2 | 3 | 4 | 5;
    topic?: string;
    provider?: string;
    disabledProviders?: string[];
  } = await req.json();

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
}
