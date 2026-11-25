// Server-only (edge-safe): the per-minute request cap counted in Neon, because serverless instances share no memory,
// so the in-memory counter in api-limits.ts alone never reaches its limit in production.
import { neon } from "@neondatabase/serverless";
import { RATE_LIMIT, RATE_WINDOW_MS } from "./api-limits";

/**
 * Counts one request for `ip` and returns the seconds to wait when it is over the cap, else 0.
 * Without DATABASE_URL, or when the database fails or is slow, it allows the request (the in-memory cap still applies):
 * an outage must not take the whole app down.
 * ponytail: reuses the `unlock_attempts` counter table under an "api:" key, one row per client; a dedicated table or
 * a KV store if the traffic ever outgrows one write per request.
 */
export async function countSharedRequest(ip: string): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url || RATE_LIMIT <= 0) return 0;
  const secs = RATE_WINDOW_MS / 1000;
  try {
    const sql = neon(url, { fetchOptions: { signal: AbortSignal.timeout(1500) } });
    const [row] = (await sql`INSERT INTO unlock_attempts (key, fails, since) VALUES (${`api:${ip}`}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        fails = CASE WHEN unlock_attempts.since <= now() - make_interval(secs => ${secs}) THEN 1 ELSE unlock_attempts.fails + 1 END,
        since = CASE WHEN unlock_attempts.since <= now() - make_interval(secs => ${secs}) THEN now() ELSE unlock_attempts.since END
      RETURNING fails, since`) as { fails: number; since: string }[];
    // Rows are only reset when their client comes back, so now and then drop the stale ones.
    if (row.fails === 1 && Math.random() < 0.01) {
      await sql`DELETE FROM unlock_attempts WHERE key LIKE 'api:%' AND since < now() - interval '1 hour'`;
    }
    if (row.fails <= RATE_LIMIT) return 0;
    return Math.max(1, Math.ceil((new Date(row.since).getTime() + RATE_WINDOW_MS - Date.now()) / 1000));
  } catch (err) {
    console.error("shared rate limit failed", err);
    return 0;
  }
}
