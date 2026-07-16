import { generateSentence } from "@/lib/gemini";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { word } = (await req.json()) as { word?: string };

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  try {
    const sentence = await generateSentence(word);
    return NextResponse.json({ sentence });
  } catch (error) {
    console.error("Failed to generate sentence", error);
    return NextResponse.json(
      { error: "Không thể tạo câu ví dụ lúc này. Vui lòng thử lại." },
      { status: 503 }
    );
  }
}
