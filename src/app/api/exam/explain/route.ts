import { NextRequest, NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { question, userAnswer, correctAnswer, explanation } = await req.json();

  const prompt = `You are an IELTS/TOEIC tutor explaining why an answer is correct.

Question: ${question}
Student answered: ${userAnswer}
Correct answer: ${correctAnswer}
Base explanation: ${explanation ?? ""}

Give a clear, concise explanation (2-4 sentences) of why the correct answer is right and why the student's answer is wrong (if different). Focus on the grammar rule or reading/listening strategy.

Return ONLY JSON: {"explanation": "your explanation here"}`;

  const { text } = await callTask({ task: "exam-explanation", prompt });
  try {
    const result = JSON.parse(text.replace(/```(?:json)?/gi, "").trim());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ explanation: explanation ?? "See correct answer above." });
  }
}
