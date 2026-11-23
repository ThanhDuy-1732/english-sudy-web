/**
 * @jest-environment node
 */
let cookieValue: string | undefined;
jest.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }),
}));

import { LOCKED_PROVIDER_IDS, blockedProviderIds, checkPassword, unlockToken } from "../provider-lock";
import { GET, POST } from "@/app/api/providers/unlock/route";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/providers/unlock", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  process.env.OPENCODE_LOCK_PASSWORD = "correct horse";
  cookieValue = undefined;
});
afterAll(() => delete process.env.OPENCODE_LOCK_PASSWORD);

test("no password configured: nothing is blocked and unlock is refused", async () => {
  delete process.env.OPENCODE_LOCK_PASSWORD;
  expect(await blockedProviderIds()).toEqual([]);
  expect((await post({ password: "" })).status).toBe(503);
});

test("blocks the locked providers without a valid cookie", async () => {
  expect(await blockedProviderIds()).toEqual(LOCKED_PROVIDER_IDS);
  cookieValue = "forged";
  expect(await blockedProviderIds()).toEqual(LOCKED_PROVIDER_IDS);
  expect(await (await GET()).json()).toEqual({ unlocked: false });
});

test("wrong password → 401, no cookie", async () => {
  const res = await post({ password: "wrong" });
  expect(res.status).toBe(401);
  expect(res.cookies.get("provider_unlock")).toBeUndefined();
  expect(checkPassword(123)).toBe(false);
});

test("right password sets an httpOnly cookie that unlocks", async () => {
  const res = await post({ password: "correct horse" });
  expect(res.status).toBe(200);
  const cookie = res.cookies.get("provider_unlock");
  expect(cookie?.httpOnly).toBe(true);
  cookieValue = cookie?.value;
  expect(await blockedProviderIds()).toEqual([]);
});

test("changing the password invalidates old cookies", async () => {
  cookieValue = unlockToken();
  process.env.OPENCODE_LOCK_PASSWORD = "new password";
  expect(await blockedProviderIds()).toEqual(LOCKED_PROVIDER_IDS);
});
