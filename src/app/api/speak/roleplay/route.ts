import { NextRequest, NextResponse } from "next/server";
import { callTask } from "@/lib/ai-tasks";
import { parseAiJson } from "@/lib/ai-json";
import { z } from "zod";
import type { Scenario, ConversationTurn } from "@/lib/speech/types";
import { isLearnLang, type LearnLang } from "@/lib/languages";

// Vercel: AI providers are tried in turn (25 s each) plus a JSON repair call; 300 s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

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
  reading: z.string().optional(),
});

const LANGUAGE: Record<Exclude<LearnLang, "en">, { name: string; reading: string }> = {
  zh: { name: "Simplified Chinese", reading: "pinyin with tone marks" },
  ja: { name: "Japanese", reading: "kana" },
  ko: { name: "Korean", reading: "Revised Romanization" },
};

export async function POST(req: NextRequest) {
  const body: Partial<{ scenario: Scenario; history: ConversationTurn[]; userText: string; lang: unknown }> | null =
    await req.json().catch(() => null);
  const { scenario, history, userText } = body ?? {};
  const lang: LearnLang = isLearnLang(body?.lang) ? body.lang : "en";
  if (!scenario?.aiRole || !Array.isArray(history) || typeof userText !== "string") {
    return NextResponse.json({ error: "scenario, history and userText are required" }, { status: 400 });
  }

  // Only the latest turns go into the prompt: the whole conversation grows the cost of every reply.
  const historyText = history
    .slice(-30)
    .map((t) => `${t.role === "user" ? "User" : scenario.aiRole}: ${t.text}`)
    .join("\n");

  const target = lang === "en" ? null : LANGUAGE[lang];
  // English keeps its original prompt; other languages: the AI speaks that language, explanations stay Vietnamese.
  const prompt = target
    ? `You are playing the role of: ${scenario.aiRole}
The user is: ${scenario.userRole}, practising ${target.name}.
Goal for this conversation: ${scenario.goal}

Conversation history:
${historyText || "(conversation just started)"}

User's latest message: "${userText}"

Instructions:
1. Reply in-character as ${scenario.aiRole}, in natural, simple ${target.name}. Keep the conversation moving toward the goal.
2. "reading": your reply's reading in ${target.reading}.
3. If the user's message has a significant grammar or vocabulary error, put it in "correction" with the fixed ${target.name} sentence and a short note in Vietnamese. Null if no error.
4. "goalAchieved": true only if the goal "${scenario.goal}" has been clearly completed in the conversation.
5. "suggestedReplies": 2-3 natural next things the user could say, in ${target.name}, as the user role.

Return ONLY JSON:
{
  "reply": "your in-character response in ${target.name}",
  "reading": "its reading",
  "correction": {"original": "user's error", "fixed": "corrected version", "note": "short Vietnamese note"} or null,
  "goalAchieved": false,
  "suggestedReplies": ["option 1", "option 2", "option 3"]
}`
    : `You are playing the role of: ${scenario.aiRole}
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
      callTask({ task: "speaking-roleplay", prompt: `${prompt}\n\nSchema error: ${err}\nReturn valid JSON only.`, provider: providerId, repair: true }).then((r) => r.text),
  });

  return NextResponse.json(parsed, { headers: { "X-Provider-Used": providerId } });
}
