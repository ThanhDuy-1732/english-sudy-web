import { callTask } from "@/lib/ai-tasks";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { request, provider, disabledProviders } = (await req.json()) as {
    request?: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!request?.trim()) {
    return NextResponse.json({ error: "request is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    const now = new Date().toISOString();
    const prompt = `You are an English grammar expert. Generate a grammar topic for: "${request}"

Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "id": "kebab-case-id",
  "name": "Topic Display Name",
  "isUserGenerated": true,
  "createdAt": "${now}",
  "rules": [
    {
      "id": "sub-rule-kebab-id",
      "name": "Sub-rule Name",
      "formula": "grammatical structure or pattern",
      "explanation": "Clear 1-2 sentence explanation in plain English",
      "examples": ["Example sentence 1.", "Example sentence 2.", "Example sentence 3."]
    }
  ]
}
Include 3-6 sub-rules covering the key aspects of this topic.`;

    const result = await callTask({ task: "grammar-generation", prompt, provider, disabledProviders });
    const cleaned = result.text.replace(/```json\n?|```/g, "").trim();
    const topic = JSON.parse(cleaned);

    return NextResponse.json(topic, {
      headers: { ...NO_STORE, "X-Provider-Used": result.providerId },
    });
  } catch (error) {
    console.error("grammar-generate failed", error);
    return NextResponse.json(
      { error: "Không thể tạo ngữ pháp lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
