/**
 * @jest-environment node
 */

jest.mock("@/lib/providers", () => ({
  getProviderById: jest.fn(),
}));

import { POST } from "../providers/test/route";
import { getProviderById } from "@/lib/providers";
import { NextRequest } from "next/server";

const mockGetProviderById = getProviderById as jest.Mock;

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/providers/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => mockGetProviderById.mockReset());

test("returns 400 when providerId is missing", async () => {
  const res = await POST(makeReq({}));
  expect(res.status).toBe(400);
  const data = await res.json();
  expect(data.error).toMatch(/providerId/);
});

test("returns 404 when provider not found in registry", async () => {
  mockGetProviderById.mockReturnValue(undefined);
  const res = await POST(makeReq({ providerId: "unknown" }));
  expect(res.status).toBe(404);
});

test("returns { ok: true, latency: number } on success", async () => {
  mockGetProviderById.mockReturnValue({
    generateContent: jest.fn().mockResolvedValue("OK"),
  });
  const res = await POST(makeReq({ providerId: "gemini" }));
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.ok).toBe(true);
  expect(typeof data.latency).toBe("number");
});

test("returns { ok: false, error, latency } on provider error", async () => {
  mockGetProviderById.mockReturnValue({
    generateContent: jest.fn().mockRejectedValue(new Error("rate limited")),
  });
  const res = await POST(makeReq({ providerId: "groq" }));
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.ok).toBe(false);
  expect(data.error).toBe("rate limited");
  expect(typeof data.latency).toBe("number");
});
