import { BODY_LIMITS, DEFAULT_BODY_LIMIT, RATE_LIMIT, RATE_WINDOW_MS, checkApiRequest, clientIp, resetApiLimits } from "../api-limits";

beforeEach(() => resetApiLimits());

test("rejects bodies over the route's limit and lets audio uploads through", () => {
  expect(checkApiRequest({ path: "/api/generate-words", ip: "a", contentLength: String(DEFAULT_BODY_LIMIT + 1) })).toMatchObject({ ok: false, status: 413 });
  expect(checkApiRequest({ path: "/api/write/grade", ip: "a", contentLength: String(DEFAULT_BODY_LIMIT + 1) })).toEqual({ ok: true });
  expect(checkApiRequest({ path: "/api/write/grade", ip: "a", contentLength: String(BODY_LIMITS["/api/write/grade"] + 1) })).toMatchObject({ status: 413 });
  expect(checkApiRequest({ path: "/api/speech/transcribe", ip: "a", contentLength: String(20 * 1024 * 1024) })).toEqual({ ok: true });
});

test("refuses bodies without a Content-Length, except audio uploads", () => {
  expect(checkApiRequest({ path: "/api/generate-words", ip: "a", contentLength: null })).toMatchObject({ ok: false, status: 411 });
  expect(checkApiRequest({ path: "/api/generate-words", ip: "a", contentLength: "abc" })).toMatchObject({ ok: false, status: 411 });
  expect(checkApiRequest({ path: "/api/speech/transcribe", ip: "a", contentLength: null })).toEqual({ ok: true });
});

test("limits each IP to RATE_LIMIT requests per window", () => {
  const now = 1_000_000;
  for (let i = 0; i < RATE_LIMIT; i++) expect(checkApiRequest({ path: "/api/generate-words", ip: "a", contentLength: "10", now })).toEqual({ ok: true });
  expect(checkApiRequest({ path: "/api/generate-words", ip: "a", contentLength: "10", now })).toMatchObject({ ok: false, status: 429, retryAfterSec: 60 });
  expect(checkApiRequest({ path: "/api/generate-words", ip: "b", contentLength: "10", now })).toEqual({ ok: true });
  expect(checkApiRequest({ path: "/api/generate-words", ip: "a", contentLength: "10", now: now + RATE_WINDOW_MS })).toEqual({ ok: true });
});

test("does not trust the client-controlled left-most forwarded address", () => {
  expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
  expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4", "x-vercel-forwarded-for": "9.9.9.9" }))).toBe("9.9.9.9");
  expect(clientIp(new Headers())).toBe("local");
});

test("pruning many clients keeps the counters of active ones", () => {
  const now = 5_000_000;
  for (let i = 0; i < RATE_LIMIT; i++) checkApiRequest({ path: "/api/x", ip: "busy", contentLength: "1", now });
  for (let i = 0; i < 1001; i++) checkApiRequest({ path: "/api/x", ip: `old-${i}`, contentLength: "1", now: now - RATE_WINDOW_MS });
  expect(checkApiRequest({ path: "/api/x", ip: "busy", contentLength: "1", now })).toMatchObject({ status: 429 });
});

test("photo translation allows a 4 MB body", () => {
  expect(checkApiRequest({ path: "/api/translate/image", ip: "a", contentLength: String(3 * 1024 * 1024) })).toEqual({ ok: true });
  expect(checkApiRequest({ path: "/api/translate/image", ip: "a", contentLength: String(4 * 1024 * 1024 + 1) })).toMatchObject({ status: 413 });
});
