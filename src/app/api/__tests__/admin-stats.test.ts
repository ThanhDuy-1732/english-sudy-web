/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { getStats } from "@/lib/db-events";
import { GET } from "../admin/stats/route";

jest.mock("@/lib/db-events", () => ({ getStats: jest.fn() }));
const mockStats = getStats as jest.MockedFunction<typeof getStats>;

const get = (query: string, secret?: string) =>
  GET(new NextRequest(`http://localhost/api/admin/stats${query}`, {
    headers: secret ? { "x-admin-secret": secret } : {},
  }));

afterEach(() => { delete process.env.ADMIN_SECRET; });

test("503 when ADMIN_SECRET is not configured", async () => {
  expect((await get("", "x")).status).toBe(503);
});

test("401 on wrong secret", async () => {
  process.env.ADMIN_SECRET = "s3cret";
  expect((await get("", "nope")).status).toBe(401);
  expect(mockStats).not.toHaveBeenCalled();
});

test.each([["?days=999", 90], ["?days=0", 1], ["?days=abc", 7], ["", 7]])("days %s → %d", async (q, days) => {
  process.env.ADMIN_SECRET = "s3cret";
  mockStats.mockResolvedValue({ days } as never);
  const res = await get(q, "s3cret");
  expect(res.status).toBe(200);
  expect(mockStats).toHaveBeenCalledWith(days);
});
