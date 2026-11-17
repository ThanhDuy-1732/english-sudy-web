import { NextRequest, NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";
import { parseAiJson } from "@/lib/ai-json";
import { buildSpeakingAnchorBlock } from "@/lib/grading/anchors";
import { z } from "zod";

const GRADING_PROVIDER = process.env.GRADING_PROVIDER;
const GRADING_OPTS = { temperature: 0.2 } as const;

const FeedbackSchema = z.object({
  bands: z.object({
    fluency: z.number().min(0).max(9),
    lexical: z.number().min(0).max(9),
    grammar: z.number().min(0).max(9),
    pronunciation: z.null(),
  }),
  overall: z.number().min(0).max(9),
  strengths: z.array(z.string()).max(4),
  improvements: z
    .array(
      z.object({
        issue: z.string(),
        example: z.string(),
        better: z.string(),
      })
    )
    .max(4),
  upgradedVersion: z.string(),
  newVocabulary: z.array(z.string()).max(6),
});

export async function POST(req: NextRequest) {
  const { task, transcript, durationSec } = await req.json();

  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const wpm = durationSec > 0 ? Math.round((wordCount / durationSec) * 60) : 0;
  const fillerCount = (transcript.match(/\b(um|uh|like|you know|kind of|sort of)\b/gi) ?? []).length;

  const anchorBlock = buildSpeakingAnchorBlock();
  const prompt = `You are an IELTS Speaking examiner. Score this response using the public band descriptors.

Calibration examples (do not grade these, use them as reference points only):
${anchorBlock}

Task: ${task.prompt}
Response length: ${durationSec}s, ${wordCount} words (${wpm} wpm)
Filler words: ${fillerCount}
Transcript (auto-generated, may contain ASR errors — ignore capitalisation/punctuation):
"""${transcript}"""

Rules:
- Score fluency, lexical resource, grammatical range & accuracy on the 0-9 scale (0.5 steps).
- pronunciation must be null — you only see text, not audio.
- improvements: max 4, each must quote the learner's own words (example), then the fixed version (better).
- upgradedVersion: rewrite THEIR answer at one band higher. Keep their ideas and personal details.
- Be strict. A band 6 answer must not be called band 7.
- newVocabulary: suggest 2-5 high-value words the learner could have used.

Return ONLY JSON:
{
  "bands": {"fluency": 0-9, "lexical": 0-9, "grammar": 0-9, "pronunciation": null},
  "overall": 0-9,
  "strengths": ["..."],
  "improvements": [{"issue": "...", "example": "...", "better": "..."}],
  "upgradedVersion": "...",
  "newVocabulary": ["..."]
}`;

  const { text, providerId } = await callTask({ task: "speaking-grade", prompt, temperature: GRADING_OPTS.temperature });

  const parsed = await parseAiJson(text, FeedbackSchema, {
    repair: (err) =>
      callTask({ task: "speaking-grade", prompt: `${prompt}\n\nOutput trước bị lỗi schema: ${err}\nTrả lại JSON hợp lệ.`, provider: providerId, temperature: GRADING_OPTS.temperature }).then((r) => r.text),
  });

  return NextResponse.json({
    ...parsed,
    transcript,
    durationSec,
    wordsPerMinute: wpm,
    fillerCount,
    gradedBy: providerId,
  });
}
