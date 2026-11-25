/**
 * @jest-environment node
 */
// In-memory stand-in for the Neon client: INSERT … ON CONFLICT bumps `fails[key]` and returns it, DELETE resets it.
let fails: Record<string, number> = {};
let failing = false;
const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
  if (failing) throw new Error("db down");
  const key = values[0] as string;
  if (strings[0].trim().startsWith("DELETE")) {
    delete fails[key];
    return [];
  }
  fails[key] = (fails[key] ?? 0) + 1;
  return [{ fails: fails[key], since: new Date().toISOString() }];
};
jest.mock("../db-events", () => ({ db: async () => sql }));
jest.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { MAX_PER_IP, clientKey, countAttempt } from "../unlock-limit";
import { POST } from "@/app/api/providers/unlock/route";

const post = (password: string, ip = "1.2.3.4") =>
  POST(new Request("http://localhost/api/providers/unlock", {
    method: "POST",
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
    body: JSON.stringify({ password }),
  }));

beforeEach(() => {
  fails = {};
  failing = false;
  process.env.OPENCODE_LOCK_PASSWORD = "right";
});
afterAll(() => delete process.env.OPENCODE_LOCK_PASSWORD);

test("clientKey takes the first forwarded hop and cuts IPv6 to its /64", () => {
  const key = (ip: string) => clientKey(new Request("http://x", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } }));
  expect(key("1.2.3.4")).toBe("ip:1.2.3.4");
  expect(key("2001:db8:1:2:aaaa::1")).toBe(key("2001:db8:1:2:bbbb::9"));
  expect(key("2001:db8:1:2:aaaa::1")).toBe("ip:2001:db8:1:2::/64");
});

test("blocks after MAX_PER_IP attempts, not before", async () => {
  for (let i = 0; i < MAX_PER_IP; i++) expect(await countAttempt("ip:a")).toBe(0);
  expect(await countAttempt("ip:a")).toBeGreaterThan(14 * 60);
  expect(await countAttempt("ip:b")).toBe(0);
});

test("parallel guesses cannot all pass: each attempt is counted before the password check", async () => {
  const statuses = await Promise.all(Array.from({ length: 20 }, (_, i) => post("wrong" + i).then((r) => r.status)));
  expect(statuses.filter((s) => s === 401)).toHaveLength(MAX_PER_IP);
  expect(statuses.filter((s) => s === 429)).toHaveLength(20 - MAX_PER_IP);
});

test("fails closed when the database errors", async () => {
  failing = true;
  expect(await countAttempt("ip:a")).toBeGreaterThan(0);
});

test("a blocked IP gets 429 even with the right password; other IPs are unaffected", async () => {
  for (let i = 0; i < MAX_PER_IP; i++) await post("wrong");
  const res = await post("right");
  expect(res.status).toBe(429);
  expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect(res.cookies.get("provider_unlock")).toBeUndefined();
  expect((await post("right", "5.6.7.8")).status).toBe(200);
});

test("a right password clears the count", async () => {
  await post("wrong");
  expect((await post("right")).status).toBe(200);
  expect(fails["ip:1.2.3.4"]).toBeUndefined();
});
