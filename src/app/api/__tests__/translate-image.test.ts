/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { getVisionProvider } from "@/lib/providers";
import { POST } from "../translate/image/route";

jest.mock("@/lib/providers", () => ({ getVisionProvider: jest.fn() }));

const mockGetVision = getVisionProvider as jest.MockedFunction<typeof getVisionProvider>;
const generateWithImage = jest.fn();

const LINES = JSON.stringify({
  detected: "zh",
  lines: [{ text: "出口", translation: "Lối ra", reading: "" }],
});

const dataUrl = (type: string, bytes = 10) => `data:${type};base64,${Buffer.alloc(bytes, 1).toString("base64")}`;

const post = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/translate/image", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  );

beforeEach(() => {
  generateWithImage.mockReset().mockResolvedValue(LINES);
  mockGetVision.mockReturnValue({ id: "gemini", name: "Gemini", model: "m", generateWithImage });
});

test("translates a photo into lines", async () => {
  const res = await post({ image: dataUrl("image/jpeg"), to: "vi" });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ detected: "zh", lines: [{ text: "出口", translation: "Lối ra" }] });
  const [prompt, image] = generateWithImage.mock.calls[0];
  expect(prompt).toContain("Vietnamese");
  expect(image.mimeType).toBe("image/jpeg");
});

test("no Gemini → 503", async () => {
  mockGetVision.mockReturnValue(undefined);
  const res = await post({ image: dataUrl("image/jpeg"), to: "vi" });
  expect(res.status).toBe(503);
  await expect(res.json()).resolves.toEqual({ error: "Dịch ảnh cần khoá Gemini." });
});

test("png accepted, gif or not a data URL → 415", async () => {
  expect((await post({ image: dataUrl("image/png"), to: "vi" })).status).toBe(200);
  const gif = await post({ image: dataUrl("image/gif"), to: "vi" });
  expect(gif.status).toBe(415);
  await expect(gif.json()).resolves.toEqual({ error: "Ảnh không hợp lệ." });
  expect((await post({ image: "hello", to: "vi" })).status).toBe(415);
});

test("unknown target → 400", async () => {
  expect((await post({ image: dataUrl("image/jpeg"), to: "fr" })).status).toBe(400);
});

test("too large → 413", async () => {
  const res = await post({ image: dataUrl("image/jpeg", 3 * 1024 * 1024), to: "vi" });
  expect(res.status).toBe(413);
  await expect(res.json()).resolves.toEqual({ error: "Ảnh quá lớn." });
  expect(generateWithImage).not.toHaveBeenCalled();
});

test("no text → 422", async () => {
  generateWithImage.mockResolvedValue(JSON.stringify({ detected: "zh", lines: [] }));
  const res = await post({ image: dataUrl("image/jpeg"), to: "vi" });
  expect(res.status).toBe(422);
  await expect(res.json()).resolves.toEqual({ error: "Không thấy chữ trong ảnh." });
});

test("AI failure → 503", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  generateWithImage.mockRejectedValue(new Error("down"));
  const res = await post({ image: dataUrl("image/jpeg"), to: "vi" });
  expect(res.status).toBe(503);
  await expect(res.json()).resolves.toEqual({ error: "Không dịch được lúc này. Vui lòng thử lại." });
});
