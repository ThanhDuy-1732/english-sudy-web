import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseAiJson } from "@/lib/ai-json";
import { badJson, readJson } from "@/lib/read-json";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

const ExerciseSchema = z.object({
  type: z.string(),
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string(),
});

export async function POST(req: NextRequest) {
  const json = await readJson<{
    topic?: string;
    subRule?: string;
    provider?: string;
    disabledProviders?: string[];
  }>(req);
  if (!json) return badJson();
  const { topic, subRule, provider, disabledProviders } = json;

  if (!topic || !subRule) {
    return NextResponse.json({ error: "topic and subRule are required" }, { status: 400, headers: NO_STORE });
  }

  try {
    const prompt = `Create one grammar exercise testing the "${subRule}" rule in ${topic}.
Choose fill-in-the-blank for rules where the correct form is predictable, MCQ for rules with tricky options.

Return ONLY one of these JSON formats (no markdown, no extra text):
Fill-in-the-blank: { "type": "fill", "question": "She ___ to school every day.", "answer": "goes" }
Multiple choice: { "type": "mcq", "question": "Choose the correct form:", "options": ["opt1", "opt2", "opt3", "opt4"], "answer": "correct option" }`;

    const result = await callTask({ task: "grammar-exercise", prompt, provider, disabledProviders });
    const exercise = await parseAiJson(result.text, ExerciseSchema, {
      repair: (err) =>
        callTask({ task: "grammar-exercise", prompt: `${prompt}\n\nSchema error: ${err}\nReturn valid JSON only.`, provider: result.providerId, disabledProviders, repair: true }).then((r) => r.text),
    });

    return NextResponse.json(exercise, {
      headers: { ...NO_STORE, "X-Provider-Used": result.providerId },
    });
  } catch (error) {
    console.error("grammar-exercise failed", error);
    return NextResponse.json(
      { error: "Không thể tạo bài tập lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
