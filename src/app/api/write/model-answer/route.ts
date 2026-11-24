import { NextRequest, NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";

export const maxDuration = 300;

// The band 8 model answer, split out of /api/write/grade: it is the longest part of the grading output,
// so the scores and annotations no longer wait for it. It needs only the task, not the learner's essay.
export async function POST(req: NextRequest) {
  const { kind, prompt: taskPrompt, chartData } = await req.json();
  if (!taskPrompt || typeof taskPrompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  const label = kind === "ielts_task1" ? "IELTS Writing Task 1" : kind === "toeic_email" ? "a TOEIC business email" : "IELTS Writing Task 2";
  const prompt = `Write a band 8 model response for ${label}.

Task prompt: ${taskPrompt}
${chartData ? `Chart/graph data: ${JSON.stringify(chartData)}` : ""}

Return ONLY the response text, with no title, notes or markdown.`;
  const { text, providerId } = await callTask({ task: "writing-grade", prompt, temperature: 0.4 });
  return NextResponse.json({ modelAnswer: text.trim(), gradedBy: providerId }, { headers: { "X-Provider-Used": providerId } });
}
