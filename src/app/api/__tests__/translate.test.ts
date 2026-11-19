/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { callTask } from "@/lib/ai-tasks";
import { POST } from "../translate/route";

jest.mock("@/lib/ai-tasks", () => ({ callTask: jest.fn() }));

const mockCallTask = callTask as jest.MockedFunction<typeof callTask>;

const TRANSLATION_JSON = JSON.stringify({
  detected: "vi",
  vietnamese: "Xin chào",
  results: [
    { tone: "casual", text: "你好", reading: "nǐ hǎo", note: "Thân mật." },
    { tone: "polite", text: "您好", reading: "nín hǎo", note: "Lịch sự." },
    { tone: "formal", text: "您好", reading: "nín hǎo", note: "Trang trọng." },
  ],
});

const post = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/translate", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  );

beforeEach(() => {
  mockCallTask.mockReset();
  mockCallTask.mockResolvedValue({ text: TRANSLATION_JSON, providerId: "opencode" });
});

test("dịch vi→zh trả ba sắc thái và yêu cầu pinyin trong lời nhắc", async () => {
  const res = await post({ text: "Xin chào", from: "vi", to: "zh" });

  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.detected).toBe("vi");
  expect(data.vietnamese).toBe("Xin chào");
  expect(data.results.map((r: { tone: string }) => r.tone)).toEqual(["casual", "polite", "formal"]);
  expect(data.results[0].reading).toBe("nǐ hǎo");

  const prompt = mockCallTask.mock.calls[0][0].prompt;
  expect(prompt).toContain("Simplified Chinese");
  expect(prompt).toContain("pinyin with tone marks");
  expect(prompt).toContain("Xin chào");
});

test("nguồn và đích giống nhau → 400, không gọi AI", async () => {
  const res = await post({ text: "Xin chào", from: "vi", to: "vi" });

  expect(res.status).toBe(400);
  await expect(res.json()).resolves.toEqual({ error: "Ngôn ngữ nguồn và đích giống nhau." });
  expect(mockCallTask).not.toHaveBeenCalled();
});

test("ngôn ngữ nhận diện trùng đích (auto) → 400", async () => {
  const res = await post({ text: "Xin chào", from: "auto", to: "vi" });

  expect(res.status).toBe(400);
  await expect(res.json()).resolves.toEqual({ error: "Ngôn ngữ nguồn và đích giống nhau." });
});

test("1001 ký tự → 400, 1000 ký tự vẫn dịch được", async () => {
  const res1001 = await post({ text: "a".repeat(1001), from: "vi", to: "zh" });
  expect(res1001.status).toBe(400);
  await expect(res1001.json()).resolves.toEqual({ error: "Tối đa 1.000 ký tự." });

  const res1000 = await post({ text: "a".repeat(1000), from: "vi", to: "zh" });
  expect(res1000.status).toBe(200);
});

test("thiếu văn bản hoặc ngôn ngữ lạ → 400", async () => {
  const empty = await post({ text: "   ", from: "vi", to: "zh" });
  expect(empty.status).toBe(400);
  await expect(empty.json()).resolves.toEqual({ error: "Nhập nội dung cần dịch." });

  const badLang = await post({ text: "hello", from: "fr", to: "zh" });
  expect(badLang.status).toBe(400);
  await expect(badLang.json()).resolves.toEqual({ error: "Ngôn ngữ không được hỗ trợ." });
});

test("AI lỗi → 503", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockCallTask.mockRejectedValueOnce(new Error("provider down"));

  const res = await post({ text: "Xin chào", from: "vi", to: "zh" });

  expect(res.status).toBe(503);
  await expect(res.json()).resolves.toEqual({ error: "Không dịch được lúc này. Vui lòng thử lại." });
});
