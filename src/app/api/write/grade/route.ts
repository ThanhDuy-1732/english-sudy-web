import { NextRequest, NextResponse } from "next/server";
import { callWithFallback } from "@/lib/providers";
import { parseAiJson } from "@/lib/ai-json";
import { buildWritingAnchorBlock } from "@/lib/grading/anchors";
import { z } from "zod";

const GRADING_PROVIDER = process.env.GRADING_PROVIDER;
const GRADING_OPTS = { temperature: 0.2 } as const;

const WritingFeedbackSchema = z.object({
  bands: z.object({
    task: z.number().min(0).max(9),
    coherence: z.number().min(0).max(9),
    lexical: z.number().min(0).max(9),
    grammar: z.number().min(0).max(9),
  }),
  overall: z.number().min(0).max(9),
  wordCount: z.number(),
  annotations: z
    .array(
      z.object({
        excerpt: z.string(),
        issue: z.string(),
        category: z.enum(["grammar", "vocab", "cohesion", "task", "style"]),
        suggestion: z.string(),
      })
    )
    .max(8),
  modelAnswer: z.string(),
  nextFocus: z.string(),
});

export async function POST(req: NextRequest) {
  const { kind, prompt: taskPrompt, content, chartData } = await req.json();

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const taskLabel = kind === "ielts_task1" ? "IELTS Writing Task 1" : "IELTS Writing Task 2";

  const anchorBlock = buildWritingAnchorBlock();
  const prompt = `You are an IELTS examiner grading ${taskLabel}.

Calibration examples (do not grade these, use them as reference points only):
${anchorBlock}

Task prompt: ${taskPrompt}
${chartData ? `Chart/graph data: ${JSON.stringify(chartData)}` : ""}

Student's essay (${wordCount} words):
"""${content}"""

Grading rules:
- Score Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy on 0-9 scale.
- overall = average of the 4 bands, rounded to nearest 0.5.
- annotations: quote VERBATIM from the student's text in "excerpt". Max 6 annotations.
- modelAnswer: a band 8 response to the same task.
- nextFocus: ONE specific skill for the student to improve next.
- Be strict. A band 6 response must not be called band 7.

Return ONLY JSON:
{
  "bands": {"task": 0-9, "coherence": 0-9, "lexical": 0-9, "grammar": 0-9},
  "overall": 0-9,
  "wordCount": ${wordCount},
  "annotations": [{"excerpt": "exact quote", "issue": "...", "category": "grammar|vocab|cohesion|task|style", "suggestion": "..."}],
  "modelAnswer": "...",
  "nextFocus": "..."
}`;

  const { text, providerId } = await callWithFallback(prompt, GRADING_PROVIDER, undefined, GRADING_OPTS);
  const parsed = await parseAiJson(text, WritingFeedbackSchema, {
    repair: (err) =>
      callWithFallback(
        `${prompt}\n\nSchema error: ${err}\nReturn valid JSON only.`,
        providerId,
        undefined,
        GRADING_OPTS
      ).then((r) => r.text),
  });

  return NextResponse.json({ ...parsed, gradedBy: providerId });
}
