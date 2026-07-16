/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { generateSentence } from "@/lib/gemini";
import { POST } from "../generate-sentence/route";

jest.mock("@/lib/gemini", () => ({
  generateSentence: jest.fn().mockResolvedValue("We need to negotiate."),
}));

const mockGenerateSentence = generateSentence as jest.MockedFunction<typeof generateSentence>;

beforeEach(() => {
  mockGenerateSentence.mockResolvedValue("We need to negotiate.");
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("returns sentence for valid word", async () => {
  const req = new NextRequest("http://localhost/api/generate-sentence", {
    method: "POST",
    body: JSON.stringify({ word: "negotiate" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toEqual({ sentence: "We need to negotiate." });
});

test("returns 400 when word is missing", async () => {
  const req = new NextRequest("http://localhost/api/generate-sentence", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});

test("returns friendly 503 when Gemini fails", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockGenerateSentence.mockRejectedValueOnce(new Error("Gemini unavailable"));

  const req = new NextRequest("http://localhost/api/generate-sentence", {
    method: "POST",
    body: JSON.stringify({ word: "negotiate" }),
    headers: { "Content-Type": "application/json" },
  });

  const res = await POST(req);
  expect(res.status).toBe(503);
  await expect(res.json()).resolves.toEqual({
    error: "Không thể tạo câu ví dụ lúc này. Vui lòng thử lại.",
  });
});

test("returns 5xx with JSON error body when generateSentence throws", async () => {
  const { generateSentence } = await import("@/lib/gemini");
  (generateSentence as jest.Mock).mockRejectedValueOnce(new Error("Gemini API failure"));
  const req = new NextRequest("http://localhost/api/generate-sentence", {
    method: "POST",
    body: JSON.stringify({ word: "negotiate" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBeGreaterThanOrEqual(500);
  const data = await res.json();
  expect(data).toHaveProperty("error");
});
