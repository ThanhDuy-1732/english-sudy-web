import { NextRequest, NextResponse } from "next/server";
import { generateSynonyms } from "@/lib/gemini";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { word } = (await req.json()) as { word?: string };
  if (!word) {
    return NextResponse.json(
      { error: "word is required" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  try {
    const result = await generateSynonyms(word);
    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Failed to generate synonyms", error);
    return NextResponse.json(
      { error: "Không thể sinh từ đồng/trái nghĩa lúc này." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
