/** @jest-environment node */
import { NextRequest } from "next/server";
import { callTask } from "@/lib/ai-tasks";
import { POST } from "../speak/roleplay/route";

jest.mock("@/lib/ai-tasks", () => ({
  callTask: jest.fn().mockResolvedValue({ text: JSON.stringify({ reply: "好的。", reading: "Hǎo de.", correction: null, goalAchieved: false, suggestedReplies: ["谢谢"] }), providerId: "gemini" }),
}));

const scenario = { id: "hotel", title: "Đặt phòng khách sạn", aiRole: "hotel receptionist", userRole: "guest checking in", goal: "check in early and request a late checkout", level: "intermediate" };
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/speak/roleplay", { method: "POST", body: JSON.stringify(body) }));
const promptOf = () => (callTask as jest.Mock).mock.calls.at(-1)[0].prompt as string;

test("english prompt unchanged without lang", async () => {
  await post({ scenario, history: [], userText: "Hi, I want check in early." });
  expect(promptOf()).toMatchSnapshot();
});

test("zh prompt asks for a Chinese reply, its reading and a Vietnamese note; reading is returned", async () => {
  const res = await post({ scenario, history: [], userText: "你好，我想早点入住。", lang: "zh" });
  const prompt = promptOf();
  expect(prompt).toContain("Simplified Chinese");
  expect(prompt).toContain("pinyin");
  expect(prompt).toContain("Vietnamese");
  expect((await res.json()).reading).toBe("Hǎo de.");
});
