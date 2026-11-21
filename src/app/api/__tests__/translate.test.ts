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
  mockCallTask.mockResolvedValue({
    text: JSON.stringify({ detected: "vi", vietnamese: "Xin chào", results: [{ tone: "casual", text: "Chào", note: "" }] }),
    providerId: "opencode",
  });
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

test("nguồn chọn rõ thì không chặn khi AI nhận diện trùng đích (学生 zh→ja)", async () => {
  mockCallTask.mockResolvedValue({
    text: JSON.stringify({
      detected: "ja",
      vietnamese: "Học sinh",
      results: [{ tone: "polite", text: "学生です", reading: "がくせいです", note: "Lịch sự." }],
    }),
    providerId: "opencode",
  });
  const res = await post({ text: "学生", from: "zh", to: "ja" });
  expect(res.status).toBe(200);
});

test("lời nhắc nói rõ dịch từ nguồn sang đích, không có 'Vietnamese speakers and Vietnamese'", async () => {
  await post({ text: "안녕하세요", from: "auto", to: "vi" });
  const prompt = mockCallTask.mock.calls[0][0].prompt;
  expect(prompt).not.toContain("Vietnamese speakers and Vietnamese");
  expect(prompt).toContain("into Vietnamese");
  expect(prompt).toContain("written in Vietnamese");
});

const KOREAN_AS_VI = JSON.stringify({
  detected: "ko",
  vietnamese: "Xin chào",
  results: [{ tone: "casual", text: "안녕", note: "Thân mật." }],
});
const VIETNAMESE_OK = JSON.stringify({
  detected: "ko",
  vietnamese: "Xin chào",
  results: [{ tone: "casual", text: "Chào nhé", note: "Thân mật." }],
});

test("đích tiếng Việt mà kết quả là chữ Hàn → hỏi lại AI một lần", async () => {
  mockCallTask
    .mockResolvedValueOnce({ text: KOREAN_AS_VI, providerId: "opencode" })
    .mockResolvedValueOnce({ text: VIETNAMESE_OK, providerId: "opencode" });
  const res = await post({ text: "안녕하세요", from: "auto", to: "vi" });
  expect(res.status).toBe(200);
  expect((await res.json()).results[0].text).toBe("Chào nhé");
  expect(mockCallTask).toHaveBeenCalledTimes(2);
});

test("hỏi lại vẫn sai chữ → 503", async () => {
  mockCallTask.mockResolvedValue({ text: KOREAN_AS_VI, providerId: "opencode" });
  const res = await post({ text: "안녕하세요", from: "auto", to: "vi" });
  expect(res.status).toBe(503);
});

test("chuyển provider người dùng chọn và báo X-Provider-Used", async () => {
  mockCallTask.mockResolvedValue({ text: TRANSLATION_JSON, providerId: "gemini" });
  const res = await post({ text: "Xin chào", from: "vi", to: "zh", provider: "gemini", disabledProviders: ["groq"] });
  expect(mockCallTask.mock.calls[0][0]).toMatchObject({ provider: "gemini", disabledProviders: ["groq"] });
  expect(res.headers.get("X-Provider-Used")).toBe("gemini");
});

test("tone=polite asks for one tone and returns only it", async () => {
  const res = await post({ text: "Xin chào", from: "vi", to: "zh", tone: "polite" });
  expect(res.status).toBe(200);
  expect((await res.json()).results.map((r: { tone: string }) => r.tone)).toEqual(["polite"]);
  const prompt = mockCallTask.mock.calls[0][0].prompt;
  expect(prompt).toContain('"polite"');
  expect(prompt).not.toContain('"casual"');
});

test("unknown tone → 400", async () => {
  const res = await post({ text: "Xin chào", from: "vi", to: "zh", tone: "slang" });
  expect(res.status).toBe(400);
  await expect(res.json()).resolves.toEqual({ error: "Sắc thái không hợp lệ." });
  expect(mockCallTask).not.toHaveBeenCalled();
});

const VIETNAMESE_ECHO = JSON.stringify({
  detected: "vi",
  vietnamese: "Xin chào",
  results: [{ tone: "polite", text: "Xin chào bạn", note: "Lịch sự." }],
});
const KOREAN_OK = JSON.stringify({
  detected: "vi",
  vietnamese: "Xin chào",
  results: [{ tone: "polite", text: "안녕하세요", note: "Lịch sự." }],
});

test("đích tiếng Hàn mà kết quả vẫn là chữ Việt → hỏi lại cùng provider, rồi đổi provider khác", async () => {
  mockCallTask
    .mockResolvedValueOnce({ text: VIETNAMESE_ECHO, providerId: "cohere" })
    .mockResolvedValueOnce({ text: VIETNAMESE_ECHO, providerId: "cohere" })
    .mockResolvedValueOnce({ text: KOREAN_OK, providerId: "opencode" });
  const res = await post({ text: "Xin chào", from: "vi", to: "ko", tone: "polite" });
  expect(res.status).toBe(200);
  expect((await res.json()).results[0].text).toBe("안녕하세요");
  expect(mockCallTask.mock.calls[1][0].provider).toBe("cohere");
  expect(mockCallTask.mock.calls[2][0].disabledProviders).toEqual(["cohere"]);
});

test("mẫu JSON trong lời nhắc ghi rõ ngôn ngữ đích (opencode hay viết lại bằng ngôn ngữ nguồn nếu để \"...\")", async () => {
  await post({ text: "안녕하세요", from: "auto", to: "vi" });
  expect(mockCallTask.mock.calls[0][0].prompt).toContain('"text": "<Vietnamese>"');
});

test("đích tiếng Hàn mà mọi provider đều trả chữ Việt → 503", async () => {
  mockCallTask.mockResolvedValue({ text: VIETNAMESE_ECHO, providerId: "cohere" });
  expect((await post({ text: "Xin chào", from: "vi", to: "ko", tone: "polite" })).status).toBe(503);
});
