import { NextRequest, NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";
import { badJson, readJson } from "@/lib/read-json";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const json = await readJson<Record<string, any>>(req);
  if (!json) return badJson();
  const { question, userAnswer, correctAnswer } = json;
  if ([question, userAnswer, correctAnswer].some((v) => typeof v !== "string") || !question.trim() || !correctAnswer.trim()) {
    return NextResponse.json({ error: "question, userAnswer and correctAnswer are required" }, { status: 400 });
  }

  const prompt = `You are grading an IELTS/TOEIC completion answer.

Question: ${question}
Expected answer: ${correctAnswer}
Student's answer: ${userAnswer}

Decide if the student's answer is correct. Allow minor spelling mistakes (1-2 characters), British/American spelling variants, and article omission.

Return ONLY JSON: {"correct": true/false, "feedback": "one sentence explanation"}`;

  const { text, providerId } = await callTask({ task: "exam-grade", prompt });
  try {
    const result = JSON.parse(text.replace(/```(?:json)?/gi, "").trim());
    return NextResponse.json(result, { headers: { "X-Provider-Used": providerId } });
  } catch {
    return NextResponse.json({ correct: false, feedback: "Could not grade" }, { status: 200 });
  }
}
