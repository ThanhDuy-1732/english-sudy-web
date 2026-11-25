// Limits applied to every POST /api/* request by src/middleware.ts, before a route reads the body.
// They cap how much text can reach an AI prompt and how fast one client can spend provider quota.

const KB = 1024;

// Request body size per route. Essays and roleplay histories are long; everything else is a word, a topic or a short answer.
export const BODY_LIMITS: Record<string, number> = {
  "/api/write/grade": 64 * KB,
  "/api/write/model-answer": 16 * KB,
  "/api/speak/roleplay": 64 * KB,
  "/api/speech/grade": 32 * KB,
  "/api/exam/generate-item": 8 * KB,
  // Base64 photo (shrunk on the device); stays under Vercel's 4.5 MB request cap.
  "/api/translate/image": 4 * 1024 * KB,
};
export const DEFAULT_BODY_LIMIT = 16 * KB;
// Audio uploads have their own 25 MiB check in the route.
const NO_BODY_LIMIT = new Set(["/api/speech/transcribe"]);

// API_RATE_LIMIT overrides the request count; 0 turns rate limiting off.
export const RATE_LIMIT = Number(process.env.API_RATE_LIMIT ?? 60); // requests
export const RATE_WINDOW_MS = 60_000; // per minute, per client IP

// ponytail: in-memory per server instance (resets on cold start, not shared between instances); fine for two users.
const hits = new Map<string, number[]>();

/**
 * Client address for rate limiting. The left-most X-Forwarded-For entry is whatever the client sent, so it is never
 * trusted: prefer the platform's own header, else the right-most entry (appended by the proxy in front of the app).
 * ponytail: behind several proxies the right-most entry is the inner proxy; set the platform header then.
 */
export function clientIp(headers: Headers): string {
  const platform = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (platform) return platform;
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  return forwarded?.at(-1) || headers.get("x-real-ip") || "local";
}

/**
 * What a rate limit counts: an IPv4 address as is, an IPv6 address cut to its /64, since one host can switch
 * addresses inside that prefix for free. `::` is expanded first, so every spelling of a prefix gives the same key.
 */
export function ipBucket(ip: string): string {
  // No colon: IPv4 or a placeholder. A dot as well: IPv4-mapped IPv6, where the /64 would lump every IPv4 client together.
  if (!ip.includes(":") || ip.includes(".")) return ip;
  const [head, tail] = ip.toLowerCase().split("::");
  const start = head ? head.split(":") : [];
  const end = tail ? tail.split(":") : [];
  const groups = tail === undefined ? start : [...start, ...Array<string>(Math.max(0, 8 - start.length - end.length)).fill("0"), ...end];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

export const RATE_LIMIT_MESSAGE = "Gửi quá nhiều yêu cầu. Đợi một phút rồi thử lại.";

export type LimitResult = { ok: true } | { ok: false; status: 411 | 413 | 429; error: string; retryAfterSec?: number };

export function checkApiRequest(input: { path: string; ip: string; contentLength: string | null; now?: number }): LimitResult {
  const now = input.now ?? Date.now();

  if (!NO_BODY_LIMIT.has(input.path)) {
    const limit = BODY_LIMITS[input.path] ?? DEFAULT_BODY_LIMIT;
    // Without a Content-Length the size can't be checked before the route reads the body, so refuse it.
    // Browsers always send one for fetch() with a string or FormData body.
    const length = Number(input.contentLength);
    if (input.contentLength === null || !Number.isFinite(length)) {
      return { ok: false, status: 411, error: "Thiếu độ dài nội dung (Content-Length)." };
    }
    if (length > limit) {
      return { ok: false, status: 413, error: `Nội dung gửi lên quá dài (tối đa ${Math.round(limit / KB)} KB).` };
    }
  }

  if (RATE_LIMIT <= 0) return { ok: true };
  const recent = (hits.get(input.ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(input.ip, recent);
    return { ok: false, status: 429, error: RATE_LIMIT_MESSAGE, retryAfterSec: Math.ceil((recent[0] + RATE_WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  hits.set(input.ip, recent);
  if (hits.size > 1000) {
    // Bound memory: drop clients with no request in the current window; active counters are kept.
    for (const [ip, times] of hits) if (now - times[times.length - 1] >= RATE_WINDOW_MS) hits.delete(ip);
  }
  return { ok: true };
}

/** Test helper. */
export function resetApiLimits() {
  hits.clear();
}
