/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "../generate-words/route";

jest.mock("@/lib/gemini", () => ({
  generateWords: jest.fn().mockResolvedValue([{ word: "negotiate", meaning: "đàm phán" }]),
}));

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
