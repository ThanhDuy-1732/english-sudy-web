/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { generateWords } from "@/lib/gemini";
import { POST } from "../generate-words/route";

jest.mock("@/lib/gemini", () => ({
  generateWords: jest.fn().mockResolvedValue([{ word: "negotiate", meaning: "đàm phán" }]),
}));

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

test("returns 5xx with JSON error body when generateWords throws", async () => {
  const { generateWords } = await import("@/lib/gemini");
  (generateWords as jest.Mock).mockRejectedValueOnce(new Error("Gemini API failure"));
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBeGreaterThanOrEqual(500);
  const data = await res.json();
  expect(data).toHaveProperty("error");
});
