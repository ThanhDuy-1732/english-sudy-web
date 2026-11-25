import { NextRequest, NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";
import { badJson, readJson } from "@/lib/read-json";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const json = await readJson<Record<string, any>>(req);
  if (!json) return badJson();
  const { question, userAnswer, correctAnswer, explanation } = json;
  if ([question, userAnswer, correctAnswer].some((v) => typeof v !== "string") || !question.trim() || !correctAnswer.trim()) {
    return NextResponse.json({ error: "question, userAnswer and correctAnswer are required" }, { status: 400 });
  }

  const prompt = `You are an IELTS/TOEIC tutor explaining why an answer is correct.

Question: ${question}
Student answered: ${userAnswer}
Correct answer: ${correctAnswer}
Base explanation: ${explanation ?? ""}

Give a clear, concise explanation (2-4 sentences) of why the correct answer is right and why the student's answer is wrong (if different). Focus on the grammar rule or reading/listening strategy.

Return ONLY JSON: {"explanation": "your explanation here"}`;

  const { text, providerId } = await callTask({ task: "exam-explanation", prompt });
  try {
    const result = JSON.parse(text.replace(/```(?:json)?/gi, "").trim());
    return NextResponse.json(result, { headers: { "X-Provider-Used": providerId } });
  } catch {
    return NextResponse.json({ explanation: explanation ?? "See correct answer above." }, { headers: { "X-Provider-Used": providerId } });
  }
}
