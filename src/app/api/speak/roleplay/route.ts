import { NextRequest, NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";
import { parseAiJson } from "@/lib/ai-json";
import { z } from "zod";
import type { Scenario, ConversationTurn } from "@/lib/speech/types";

const ResponseSchema = z.object({
  reply: z.string().min(1),
  correction: z
    .object({
      original: z.string(),
      fixed: z.string(),
      note: z.string(),
    })
    .nullable(),
  goalAchieved: z.boolean(),
  suggestedReplies: z.array(z.string()).max(3),
});

export async function POST(req: NextRequest) {
  const body: Partial<{ scenario: Scenario; history: ConversationTurn[]; userText: string }> | null =
    await req.json().catch(() => null);
  const { scenario, history, userText } = body ?? {};
  if (!scenario?.aiRole || !Array.isArray(history) || typeof userText !== "string") {
    return NextResponse.json({ error: "scenario, history and userText are required" }, { status: 400 });
  }

  const historyText = history
    .map((t) => `${t.role === "user" ? "User" : scenario.aiRole}: ${t.text}`)
    .join("\n");

  const prompt = `You are playing the role of: ${scenario.aiRole}
The user is: ${scenario.userRole}
Goal for this conversation: ${scenario.goal}
${scenario.mustUse?.length ? `Target phrases the user should try to use: ${scenario.mustUse.join(", ")}` : ""}

Conversation history:
${historyText || "(conversation just started)"}

User's latest message: "${userText}"

Instructions:
1. Reply in-character as ${scenario.aiRole}. Keep the conversation natural and help move toward the goal.
2. If the user made a grammar/vocabulary error, note it in "correction" — ONLY if it's significant. Null if no error.
3. "goalAchieved": true only if the goal "${scenario.goal}" has been clearly completed in the conversation.
4. "suggestedReplies": 2-3 natural next things the user could say (in English, as the user role).

Return ONLY JSON:
{
  "reply": "your in-character response",
  "correction": {"original": "user's error", "fixed": "corrected version", "note": "brief grammar note"} or null,
  "goalAchieved": false,
  "suggestedReplies": ["option 1", "option 2", "option 3"]
}`;

  const { text, providerId } = await callTask({ task: "speaking-roleplay", prompt });
  const parsed = await parseAiJson(text, ResponseSchema, {
    repair: (err) =>
      callTask({ task: "speaking-roleplay", prompt: `${prompt}\n\nSchema error: ${err}\nReturn valid JSON only.`, provider: providerId }).then((r) => r.text),
  });

  return NextResponse.json(parsed);
}
