/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "../generate-sentence/route";

jest.mock("@/lib/gemini", () => ({
  generateSentence: jest.fn().mockResolvedValue("We need to negotiate."),
}));

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
