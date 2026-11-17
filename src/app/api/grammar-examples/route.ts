import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

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
    const prompt = `Generate 3 new example sentences for the "${subRule}" rule in ${topic} English grammar.
Make the sentences clear, natural, and at intermediate level.
Return ONLY JSON (no markdown, no extra text): { "examples": ["sentence1", "sentence2", "sentence3"] }`;

    const result = await callTask({ task: "grammar-explanation", prompt, provider, disabledProviders });
    const cleaned = result.text.replace(/```json\n?|```/g, "").trim();
    const data = JSON.parse(cleaned) as { examples: string[] };

    return NextResponse.json(data, {
      headers: { ...NO_STORE, "X-Provider-Used": result.providerId },
    });
  } catch (error) {
    console.error("grammar-examples failed", error);
    return NextResponse.json(
      { error: "Không thể tạo ví dụ lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
