/**
 * @jest-environment node
 */
type Row = { key: string; fails: number; since: string };
let rows: Row[] = [];
let failing = false;
const queries: string[] = [];
// Tagged-template stand-in for the Neon client: SELECT returns `rows`, other statements are recorded.
const sql = async (strings: TemplateStringsArray) => {
  const text = strings.join("?");
  queries.push(text.trim().split(/\s+/)[0]);
  if (failing) throw new Error("db down");
  return text.trim().startsWith("SELECT") ? rows : [];
};
jest.mock("../db-events", () => ({ db: async () => sql }));
jest.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { MAX_GLOBAL, MAX_PER_IP, clientIp, retryAfter } from "../unlock-limit";
import { POST } from "@/app/api/providers/unlock/route";

const now = () => new Date().toISOString();
const post = (password: string) =>
  POST(new Request("http://localhost/api/providers/unlock", {
    method: "POST",
    headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    body: JSON.stringify({ password }),
  }));

beforeEach(() => {
  rows = [];
  failing = false;
  queries.length = 0;
  process.env.OPENCODE_LOCK_PASSWORD = "right";
});
afterAll(() => delete process.env.OPENCODE_LOCK_PASSWORD);

test("clientIp takes the first forwarded hop", () => {
  const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
  expect(clientIp(req)).toBe("1.2.3.4");
});

test("blocks at the per-IP and global caps, not below", async () => {
  rows = [{ key: "ip:1.2.3.4", fails: MAX_PER_IP - 1, since: now() }];
  expect(await retryAfter("1.2.3.4")).toBe(0);
  rows = [{ key: "ip:1.2.3.4", fails: MAX_PER_IP, since: now() }];
  expect(await retryAfter("1.2.3.4")).toBeGreaterThan(14 * 60);
  rows = [{ key: "global", fails: MAX_GLOBAL, since: now() }];
  expect(await retryAfter("9.9.9.9")).toBeGreaterThan(0);
});

test("fails closed when the database errors", async () => {
  failing = true;
  expect(await retryAfter("1.2.3.4")).toBeGreaterThan(0);
});

test("route: wrong password records a failure; blocked IP gets 429 even with the right password", async () => {
  expect((await post("wrong")).status).toBe(401);
  expect(queries).toContain("INSERT");

  rows = [{ key: "ip:1.2.3.4", fails: MAX_PER_IP, since: now() }];
  const res = await post("right");
  expect(res.status).toBe(429);
  expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect(res.cookies.get("provider_unlock")).toBeUndefined();
});

test("route: right password clears this IP's count", async () => {
  const res = await post("right");
  expect(res.status).toBe(200);
  expect(queries).toContain("DELETE");
});
