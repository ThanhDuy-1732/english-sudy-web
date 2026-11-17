// Limits applied to every POST /api/* request by src/middleware.ts, before a route reads the body.
// They cap how much text can reach an AI prompt and how fast one client can spend provider quota.

const KB = 1024;

// Request body size per route. Essays and roleplay histories are long; everything else is a word, a topic or a short answer.
export const BODY_LIMITS: Record<string, number> = {
  "/api/write/grade": 64 * KB,
  "/api/speak/roleplay": 64 * KB,
  "/api/speech/grade": 32 * KB,
  "/api/exam/generate-item": 8 * KB,
};
export const DEFAULT_BODY_LIMIT = 16 * KB;
// Audio uploads have their own 25 MiB check in the route.
const NO_BODY_LIMIT = new Set(["/api/speech/transcribe"]);

// API_RATE_LIMIT overrides the request count; 0 turns rate limiting off.
export const RATE_LIMIT = Number(process.env.API_RATE_LIMIT ?? 60); // requests
export const RATE_WINDOW_MS = 60_000; // per minute, per client IP

// ponytail: in-memory per server instance (resets on cold start, not shared between instances); fine for two users.
const hits = new Map<string, number[]>();

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}

export type LimitResult = { ok: true } | { ok: false; status: 413 | 429; error: string; retryAfterSec?: number };

export function checkApiRequest(input: { path: string; ip: string; contentLength: string | null; now?: number }): LimitResult {
  const now = input.now ?? Date.now();

  if (!NO_BODY_LIMIT.has(input.path)) {
    const limit = BODY_LIMITS[input.path] ?? DEFAULT_BODY_LIMIT;
    const length = Number(input.contentLength);
    if (input.contentLength !== null && Number.isFinite(length) && length > limit) {
      return { ok: false, status: 413, error: `Nội dung gửi lên quá dài (tối đa ${Math.round(limit / KB)} KB).` };
    }
  }

  if (RATE_LIMIT <= 0) return { ok: true };
  const recent = (hits.get(input.ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(input.ip, recent);
    return { ok: false, status: 429, error: "Gửi quá nhiều yêu cầu. Đợi một phút rồi thử lại.", retryAfterSec: Math.ceil((recent[0] + RATE_WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  hits.set(input.ip, recent);
  if (hits.size > 1000) hits.clear(); // bound memory if many IPs pass through
  return { ok: true };
}

/** Test helper. */
export function resetApiLimits() {
  hits.clear();
}
