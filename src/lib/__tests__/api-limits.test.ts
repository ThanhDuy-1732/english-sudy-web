import { BODY_LIMITS, DEFAULT_BODY_LIMIT, RATE_LIMIT, RATE_WINDOW_MS, checkApiRequest, clientIp, resetApiLimits } from "../api-limits";

beforeEach(() => resetApiLimits());

test("rejects bodies over the route's limit and lets audio uploads through", () => {
  expect(checkApiRequest({ path: "/api/generate-words", ip: "a", contentLength: String(DEFAULT_BODY_LIMIT + 1) })).toMatchObject({ ok: false, status: 413 });
  expect(checkApiRequest({ path: "/api/write/grade", ip: "a", contentLength: String(DEFAULT_BODY_LIMIT + 1) })).toEqual({ ok: true });
  expect(checkApiRequest({ path: "/api/write/grade", ip: "a", contentLength: String(BODY_LIMITS["/api/write/grade"] + 1) })).toMatchObject({ status: 413 });
  expect(checkApiRequest({ path: "/api/speech/transcribe", ip: "a", contentLength: String(20 * 1024 * 1024) })).toEqual({ ok: true });
});

test("limits each IP to RATE_LIMIT requests per window", () => {
  const now = 1_000_000;
  for (let i = 0; i < RATE_LIMIT; i++) expect(checkApiRequest({ path: "/api/generate-words", ip: "a", contentLength: "10", now })).toEqual({ ok: true });
  expect(checkApiRequest({ path: "/api/generate-words", ip: "a", contentLength: "10", now })).toMatchObject({ ok: false, status: 429, retryAfterSec: 60 });
  expect(checkApiRequest({ path: "/api/generate-words", ip: "b", contentLength: "10", now })).toEqual({ ok: true });
  expect(checkApiRequest({ path: "/api/generate-words", ip: "a", contentLength: "10", now: now + RATE_WINDOW_MS })).toEqual({ ok: true });
});

test("reads the first forwarded address", () => {
  expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  expect(clientIp(new Headers())).toBe("local");
});
