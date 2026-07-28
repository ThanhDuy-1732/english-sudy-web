import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { topic, subRule, provider, disabledProviders } = (await req.json()) as {
    topic?: string;
    subRule?: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!topic || !subRule) {
    return NextResponse.json({ error: "topic and subRule are required" }, { status: 400, headers: NO_STORE });
  }

  try {
    const prompt = `Create one grammar exercise testing the "${subRule}" rule in ${topic}.
Choose fill-in-the-blank for rules where the correct form is predictable, MCQ for rules with tricky options.

Return ONLY one of these JSON formats (no markdown, no extra text):
Fill-in-the-blank: { "type": "fill", "question": "She ___ to school every day.", "answer": "goes" }
Multiple choice: { "type": "mcq", "question": "Choose the correct form:", "options": ["opt1", "opt2", "opt3", "opt4"], "answer": "correct option" }`;

    const result = await callWithFallback(prompt, provider, disabledProviders);
    const cleaned = result.text.replace(/```json\n?|```/g, "").trim();
    const exercise = JSON.parse(cleaned);

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
