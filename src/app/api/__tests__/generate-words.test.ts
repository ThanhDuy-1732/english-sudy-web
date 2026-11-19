/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { generateConcepts, generateWords } from "@/lib/gemini";
import { POST } from "../generate-words/route";

jest.mock("@/lib/gemini", () => ({
  generateWords: jest.fn().mockResolvedValue([{ word: "negotiate", meaning: "đàm phán" }]),
  generateConcepts: jest.fn().mockResolvedValue([{ meaning: "hoá đơn", words: { en: { word: "invoice" }, zh: { word: "发票", reading: "fāpiào" } } }]),
}));

const mockGenerateConcepts = generateConcepts as jest.MockedFunction<typeof generateConcepts>;
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/generate-words", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

const mockGenerateWords = generateWords as jest.MockedFunction<typeof generateWords>;

beforeEach(() => {
  mockGenerateWords.mockResolvedValue([{ word: "negotiate", meaning: "đàm phán" }]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("returns word list for valid topic", async () => {
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toEqual([{ word: "negotiate", meaning: "đàm phán" }]);
});

test("forwards sanitized exclude list to generateWords", async () => {
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC", exclude: ["negotiate", "negotiate", 42, " invoice "] }),
    headers: { "Content-Type": "application/json" },
  });
  await POST(req);
  expect(mockGenerateWords).toHaveBeenCalledWith("TOEIC", expect.any(Function), {
    exclude: ["negotiate", "invoice"],
    count: 5,
    knownCount: 0,
  });
});

test("ignores a non-array exclude value", async () => {
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC", exclude: "negotiate" }),
    headers: { "Content-Type": "application/json" },
  });
  await POST(req);
  expect(mockGenerateWords).toHaveBeenCalledWith("TOEIC", expect.any(Function), {
    exclude: [],
    count: 5,
    knownCount: 0,
  });
});

test("kẹp count trong 1–30 và forward knownCount", async () => {
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC", count: 99, knownCount: 12 }),
    headers: { "Content-Type": "application/json" },
  });
  await POST(req);
  expect(mockGenerateWords).toHaveBeenCalledWith("TOEIC", expect.any(Function), {
    exclude: [],
    count: 30,
    knownCount: 12,
  });
});

test("cắt exclude còn 200 từ", async () => {
  const exclude = Array.from({ length: 250 }, (_, i) => `w${i}`);
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC", exclude }),
    headers: { "Content-Type": "application/json" },
  });
  await POST(req);
  const args = mockGenerateWords.mock.calls.at(-1)?.[2] as { exclude: string[] };
  expect(args.exclude).toHaveLength(200);
});

test("returns 400 when topic is missing", async () => {
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});

test("returns friendly 503 when Gemini fails", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockGenerateWords.mockRejectedValueOnce(new Error("Gemini unavailable"));

  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC" }),
    headers: { "Content-Type": "application/json" },
  });

  const res = await POST(req);
  expect(res.status).toBe(503);
  await expect(res.json()).resolves.toEqual({
    error: "Không thể sinh từ mới lúc này. Vui lòng thử lại.",
  });
});

test("giữ 429 của provider kèm Retry-After để client cooldown", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockGenerateWords.mockRejectedValueOnce(Object.assign(new Error("rate limited"), { status: 429 }));

  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC" }),
    headers: { "Content-Type": "application/json" },
  });

  const res = await POST(req);
  expect(res.status).toBe(429);
  expect(res.headers.get("Retry-After")).toBe("30");
});

test("returns 5xx with JSON error body when generateWords throws", async () => {  jest.spyOn(console, "error").mockImplementation(() => {});
  const { generateWords } = await import("@/lib/gemini");
  (generateWords as jest.Mock).mockRejectedValueOnce(new Error("Gemini API failure"));
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBe(503);
  const data = await res.json();
  expect(data).toEqual({
    error: "Không thể sinh từ mới lúc này. Vui lòng thử lại.",
  });
});

test("english-only request body is unchanged", async () => {
  const res = await post({ topic: "TOEIC", langs: ["en"], count: 5 });
  expect(await res.json()).toEqual([{ word: "negotiate", meaning: "đàm phán" }]);
  expect(mockGenerateConcepts).not.toHaveBeenCalled();
});

test("langs en+zh returns concepts with per-language excludes", async () => {
  const res = await post({ topic: "TOEIC", langs: ["en", "zh", "fr"], count: 20, exclude: { zh: ["合同", "合同"], en: "bad" } });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ concepts: [{ meaning: "hoá đơn", words: { en: { word: "invoice" }, zh: { word: "发票", reading: "fāpiào" } } }] });
  expect(mockGenerateConcepts).toHaveBeenCalledWith("TOEIC", ["en", "zh"], expect.any(Function), { exclude: { zh: ["合同"] }, count: 20, knownCount: 0 });
});

test("invalid langs → 400", async () => {
  const res = await post({ topic: "TOEIC", langs: ["fr"] });
  expect(res.status).toBe(400);
});
