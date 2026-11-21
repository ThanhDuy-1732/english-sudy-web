/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { logEvent } from "@/lib/db-events";
import { POST } from "../track/route";

jest.mock("@/lib/db-events", () => ({ logEvent: jest.fn() }));
const mockLog = logEvent as jest.MockedFunction<typeof logEvent>;

const post = (body: string) =>
  POST(new NextRequest("http://localhost/api/track", { method: "POST", body }));

const DEVICE = "0b6a2c1e-1111-4222-8333-444455556666";

test("valid page view is logged", async () => {
  const res = await post(JSON.stringify({ kind: "page", name: "/vocab", device: DEVICE }));
  expect(res.status).toBe(204);
  expect(mockLog).toHaveBeenCalledWith({ kind: "page", name: "/vocab", device: DEVICE });
});

test("done event is logged", async () => {
  const res = await post(JSON.stringify({ kind: "done", name: "exam", device: DEVICE }));
  expect(res.status).toBe(204);
  expect(mockLog).toHaveBeenCalledWith({ kind: "done", name: "exam", device: DEVICE });
});

test.each([
  ["client cannot forge ai events", JSON.stringify({ kind: "ai", name: "x", device: DEVICE })],
  ["name too long", JSON.stringify({ kind: "page", name: "/" + "a".repeat(200), device: DEVICE })],
  ["bad device", JSON.stringify({ kind: "page", name: "/", device: "x".repeat(80) })],
  ["not json", "{oops"],
])("rejects: %s", async (_label, body) => {
  const res = await post(body);
  expect(res.status).toBe(400);
  expect(mockLog).not.toHaveBeenCalled();
});
