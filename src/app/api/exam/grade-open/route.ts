import { NextRequest, NextResponse } from "next/server";
import { callWithFallback } from "@/lib/providers";

export async function POST(req: NextRequest) {
  const { question, userAnswer, correctAnswer } = await req.json();

  const prompt = `You are grading an IELTS/TOEIC completion answer.

Question: ${question}
Expected answer: ${correctAnswer}
Student's answer: ${userAnswer}

Decide if the student's answer is correct. Allow minor spelling mistakes (1-2 characters), British/American spelling variants, and article omission.

Return ONLY JSON: {"correct": true/false, "feedback": "one sentence explanation"}`;

  const { text } = await callWithFallback(prompt);
  try {
    const result = JSON.parse(text.replace(/```(?:json)?/gi, "").trim());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ correct: false, feedback: "Could not grade" }, { status: 200 });
  }
}
